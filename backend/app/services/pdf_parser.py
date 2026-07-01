"""PDF → structured Profile using pdfplumber (text) + Claude (semantic extraction)."""
import json
import pdfplumber
import anthropic

from app.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

_SYSTEM = """You are a CV parser. Extract structured career data from the raw CV text.
Return ONLY a valid JSON object with exactly these keys:
{
  "name": "string",
  "email": "string or null",
  "github_url": "string or null",
  "linkedin_url": "string or null",
  "skills": ["list of skill strings"],
  "experience": [
    {"company": "string", "role": "string", "years": 0.0, "tier": "FAANG|Tier1|Tier2|Startup|Unknown", "description": "string"}
  ],
  "education": [
    {"degree": "string", "institution": "string", "country": "string", "year": 2024}
  ],
  "projects": [
    {"name": "string", "url": "string or null", "description": "string", "type": "personal|research|open-source|work", "github_stars": 0}
  ]
}
Rules:
- years = total years at that role (estimate from date ranges if needed)
- tier: FAANG = Google/Meta/Amazon/Apple/Netflix/Microsoft; Tier1 = other big tech/top finance; Tier2 = mid-size; Startup; Unknown
- github_stars = 0 if not mentioned
- description fields: keep concise, 1-3 sentences
Return ONLY the JSON, no markdown fences, no explanation."""


def extract_text(pdf_bytes: bytes) -> str:
    with pdfplumber.open(pdf_bytes) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def parse_pdf(pdf_bytes: bytes) -> dict:
    raw_text = extract_text(pdf_bytes)
    if not raw_text:
        raise ValueError("Could not extract text from PDF")

    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=_SYSTEM,
        messages=[{"role": "user", "content": f"<cv>\n{raw_text}\n</cv>"}],
    )

    text_block = next((b for b in response.content if b.type == "text"), None)
    if not text_block:
        raise ValueError("LLM returned no text block")

    parsed = json.loads(text_block.text)
    parsed["raw_cv_text"] = raw_text
    return parsed
