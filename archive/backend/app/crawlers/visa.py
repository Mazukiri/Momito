"""
USCIS H1B visa crawler — downloads the annual LCA disclosure data and builds
a lookup table: company_name → h1b_count.

Data source: DOL OFLC Performance Data
URL pattern: https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY{year}_Q{q}.xlsx

Usage:
  from app.crawlers.visa import lookup_h1b
  result = lookup_h1b("Google LLC")
  # {"visa_tag": "sponsored", "h1b_count_last_year": 12345}
"""
from __future__ import annotations
import io
import re
import httpx

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False

# In-memory cache: normalised company → count
_CACHE: dict[str, int] = {}
_CACHE_LOADED = False

DOL_BASE = "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs"
FISCAL_YEAR = 2024  # update annually


def _normalise(name: str) -> str:
    name = name.upper().strip()
    # strip common suffixes to improve matching
    name = re.sub(r"\b(LLC|INC|CORP|CORPORATION|LTD|LIMITED|LP|LLP|CO\.?)\b\.?", "", name)
    return re.sub(r"\s+", " ", name).strip()


def _load_from_url(url: str) -> dict[str, int]:
    if not HAS_OPENPYXL:
        print("[visa crawler] openpyxl not installed — skipping XLSX parse")
        return {}
    try:
        resp = httpx.get(url, timeout=60, follow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        print(f"[visa crawler] download failed: {e}")
        return {}

    wb = openpyxl.load_workbook(io.BytesIO(resp.content), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return {}

    header = [str(c).upper() if c else "" for c in rows[0]]
    try:
        emp_col = next(i for i, h in enumerate(header) if "EMPLOYER" in h and "NAME" in h)
        status_col = next(i for i, h in enumerate(header) if "CASE_STATUS" in h or "STATUS" in h)
    except StopIteration:
        print("[visa crawler] Could not find EMPLOYER_NAME / CASE_STATUS columns")
        return {}

    counts: dict[str, int] = {}
    for row in rows[1:]:
        if row[status_col] and "CERTIFIED" in str(row[status_col]).upper():
            company = _normalise(str(row[emp_col] or ""))
            if company:
                counts[company] = counts.get(company, 0) + 1

    return counts


def _ensure_loaded() -> None:
    global _CACHE_LOADED
    if _CACHE_LOADED:
        return
    # Try Q4 then Q3 fallback
    for q in [4, 3, 2]:
        url = f"{DOL_BASE}/LCA_Disclosure_Data_FY{FISCAL_YEAR}_Q{q}.xlsx"
        data = _load_from_url(url)
        if data:
            _CACHE.update(data)
            _CACHE_LOADED = True
            print(f"[visa crawler] Loaded {len(data)} companies from FY{FISCAL_YEAR} Q{q}")
            return
    _CACHE_LOADED = True  # mark as attempted even if empty


def lookup_h1b(company_name: str) -> dict:
    """Return visa tag and H1B count for a company name."""
    _ensure_loaded()
    key = _normalise(company_name)
    count = _CACHE.get(key, 0)
    if count == 0:
        # fuzzy: check if any cached key starts with first two words
        words = key.split()[:2]
        prefix = " ".join(words)
        matches = [(k, v) for k, v in _CACHE.items() if k.startswith(prefix)]
        if matches:
            count = max(v for _, v in matches)
    return {
        "visa_tag": "sponsored" if count > 0 else "unknown",
        "h1b_count_last_year": count,
    }


if __name__ == "__main__":
    _ensure_loaded()
    for company in ["Google LLC", "Meta Platforms Inc", "Renaissance Technologies", "Unknown Startup XYZ"]:
        result = lookup_h1b(company)
        print(f"{company}: {result}")
