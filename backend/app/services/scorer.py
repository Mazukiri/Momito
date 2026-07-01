"""Deterministic 4-category scorer. Zero LLM calls."""
from __future__ import annotations
import re
from typing import Any

# ---------------------------------------------------------------------------
# Role templates — skills required, archetype projects, experience weights
# ---------------------------------------------------------------------------
ROLE_TEMPLATES: dict[str, dict] = {
    "google-l4-swe": {
        "required_skills": {
            "Python", "Go", "Java", "C++", "Distributed Systems",
            "Algorithms", "Data Structures", "System Design", "SQL",
        },
        "preferred_skills": {"Kubernetes", "gRPC", "Protobuf", "BigQuery", "Spanner"},
        "project_archetypes": ["distributed", "scalable", "open-source", "research"],
        "min_years": 2.0,
        "tier_weights": {"FAANG": 1.0, "Tier1": 0.7, "Tier2": 0.4, "Startup": 0.3, "Unknown": 0.1},
    },
    "hpc-engineer": {
        "required_skills": {
            "C++", "MPI", "OpenMP", "CUDA", "HPC", "Linux",
            "Parallel Computing", "Performance Optimization",
        },
        "preferred_skills": {"Fortran", "Slurm", "InfiniBand", "VTune", "Perf"},
        "project_archetypes": ["hpc", "simulation", "gpu", "parallel", "research"],
        "min_years": 1.0,
        "tier_weights": {"FAANG": 0.8, "Tier1": 0.9, "Tier2": 0.6, "Startup": 0.4, "Unknown": 0.2},
    },
    "quant-hedge-fund-swe": {
        "required_skills": {
            "Python", "C++", "Statistics", "Probability", "Linear Algebra",
            "Algorithms", "Data Structures", "SQL", "Backtesting",
        },
        "preferred_skills": {"Pandas", "NumPy", "R", "MATLAB", "Kafka", "Redis", "kdb+"},
        "project_archetypes": ["trading", "quant", "finance", "ml", "research", "backtesting"],
        "min_years": 1.0,
        "tier_weights": {"FAANG": 0.7, "Tier1": 0.9, "Tier2": 0.5, "Startup": 0.5, "Unknown": 0.1},
    },
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize(s: str) -> str:
    return s.lower().strip()


def _skill_set(skills: list[str]) -> set[str]:
    return {_normalize(s) for s in skills}


def _keyword_hit(text: str, keywords: list[str]) -> bool:
    t = text.lower()
    return any(kw.lower() in t for kw in keywords)


# ---------------------------------------------------------------------------
# Category 1: Skills Match  (0–1)
# ---------------------------------------------------------------------------

def score_skills(profile_skills: list[str], template: dict, jd_skills: list[str] | None = None) -> tuple[float, list[str]]:
    have = _skill_set(profile_skills)
    required = {_normalize(s) for s in template["required_skills"]}
    preferred = {_normalize(s) for s in template.get("preferred_skills", set())}

    if jd_skills:
        required |= _skill_set(jd_skills)

    missing_required = sorted(s for s in required if s not in have)
    missing_preferred = sorted(s for s in preferred if s not in have)

    req_hit = len(required & have) / max(len(required), 1)
    pref_hit = len(preferred & have) / max(len(preferred), 1) if preferred else 1.0

    score = 0.8 * req_hit + 0.2 * pref_hit
    gaps = [f"Missing required: {s}" for s in missing_required[:5]]
    gaps += [f"Missing preferred: {s}" for s in missing_preferred[:3]]
    return round(min(score, 1.0), 3), gaps


# ---------------------------------------------------------------------------
# Category 2: Project Quality  (0–1)
# ---------------------------------------------------------------------------

def score_projects(projects: list[dict], template: dict) -> tuple[float, list[str]]:
    archetypes = template["project_archetypes"]
    gaps: list[str] = []

    if not projects:
        return 0.0, ["No projects found in CV"]

    # Each project scored 0–1, final = average of top-3
    def _project_score(p: dict) -> float:
        desc = f"{p.get('name','')} {p.get('description','')} {p.get('type','')}".lower()
        hits = sum(1 for a in archetypes if a in desc)
        archetype_score = min(hits / max(len(archetypes), 1) * 3, 1.0)  # 3 hits = perfect
        star_score = min(p.get("github_stars", 0) / 100, 0.3)  # capped bonus
        url_bonus = 0.1 if p.get("url") else 0.0
        return min(archetype_score + star_score + url_bonus, 1.0)

    scored = sorted(projects, key=_project_score, reverse=True)
    top3 = scored[:3]
    avg = sum(_project_score(p) for p in top3) / max(len(top3), 1)

    matched_archetypes = set()
    for p in projects:
        desc = f"{p.get('name','')} {p.get('description','')} {p.get('type','')}".lower()
        for a in archetypes:
            if a in desc:
                matched_archetypes.add(a)

    missing_archetypes = [a for a in archetypes if a not in matched_archetypes]
    if missing_archetypes:
        gaps.append(f"No projects covering: {', '.join(missing_archetypes[:3])}")
    if len(projects) < 3:
        gaps.append("Fewer than 3 projects — add more to strengthen this section")

    return round(avg, 3), gaps


# ---------------------------------------------------------------------------
# Category 3: Experience Depth  (0–1)
# ---------------------------------------------------------------------------

def score_experience(experience: list[dict], template: dict) -> tuple[float, list[str]]:
    tier_weights = template["tier_weights"]
    min_years = template.get("min_years", 1.0)
    gaps: list[str] = []

    if not experience:
        return 0.0, ["No work experience found in CV"]

    total_weighted_years = sum(
        exp.get("years", 0) * tier_weights.get(exp.get("tier", "Unknown"), 0.1)
        for exp in experience
    )
    total_years = sum(exp.get("years", 0) for exp in experience)

    years_score = min(total_weighted_years / (min_years * 3), 1.0)  # 3× min = full score

    if total_years < min_years:
        gaps.append(f"Total experience ({total_years:.1f} yrs) below minimum ({min_years} yrs)")

    high_tier = [e for e in experience if tier_weights.get(e.get("tier", "Unknown"), 0) >= 0.7]
    if not high_tier:
        gaps.append("No FAANG/Tier1 experience — consider targeting internships or projects there")

    return round(min(years_score, 1.0), 3), gaps


# ---------------------------------------------------------------------------
# Category 4: Presentation  (0–1)
# ---------------------------------------------------------------------------

_METRIC_PATTERN = re.compile(r"\d+[%x]|\d+\s?(ms|seconds?|users?|requests?|GB|TB|MB|K|M)", re.IGNORECASE)
_ACTION_VERBS = {"built", "designed", "led", "implemented", "optimized", "reduced", "increased",
                 "developed", "architected", "scaled", "delivered", "launched", "created"}


def score_presentation(profile: dict) -> tuple[float, list[str]]:
    gaps: list[str] = []
    score = 0.0

    # Contact completeness (0.2)
    contact_score = 0.0
    if profile.get("email"):
        contact_score += 0.1
    if profile.get("github_url"):
        contact_score += 0.05
    if profile.get("linkedin_url"):
        contact_score += 0.05
    score += contact_score
    if not profile.get("github_url"):
        gaps.append("No GitHub URL — add to increase visibility")

    # Experience descriptions quality (0.4)
    all_descs = " ".join(e.get("description", "") for e in profile.get("experience", []))
    metric_hits = len(_METRIC_PATTERN.findall(all_descs))
    verb_hits = sum(1 for w in all_descs.lower().split() if w in _ACTION_VERBS)
    desc_score = min(metric_hits / 5, 0.2) + min(verb_hits / 10, 0.2)
    score += desc_score
    if metric_hits < 3:
        gaps.append("Few quantified metrics in experience — add numbers (%, latency, scale)")
    if verb_hits < 5:
        gaps.append("Use stronger action verbs (built, optimized, reduced, scaled...)")

    # Skills list quality (0.2)
    skills_count = len(profile.get("skills", []))
    score += min(skills_count / 20, 0.2)
    if skills_count < 8:
        gaps.append(f"Only {skills_count} skills listed — expand to at least 15")

    # Projects quality (0.2)
    proj_with_url = sum(1 for p in profile.get("projects", []) if p.get("url"))
    score += min(proj_with_url / 3, 0.2)
    if proj_with_url < 2:
        gaps.append("Add URLs to projects (GitHub, demo) to show verifiable work")

    return round(min(score, 1.0), 3), gaps


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def compute_score(profile_data: dict, role: str, jd_skills: list[str] | None = None) -> dict:
    template = ROLE_TEMPLATES.get(role)
    if not template:
        raise ValueError(f"Unknown role template: {role}")

    sm, sg = score_skills(profile_data.get("skills", []), template, jd_skills)
    pq, pg = score_projects(profile_data.get("projects", []), template)
    ed, eg = score_experience(profile_data.get("experience", []), template)
    pr, prg = score_presentation(profile_data)

    overall = round((sm + pq + ed + pr) / 4, 3)

    return {
        "skills_match": sm,
        "project_quality": pq,
        "experience_depth": ed,
        "presentation": pr,
        "overall": overall,
        "skills_gaps": sg,
        "project_gaps": pg,
        "experience_gaps": eg,
        "presentation_gaps": prg,
    }
