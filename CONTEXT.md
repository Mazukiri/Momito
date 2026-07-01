# Momito

A personal job preparation tool for a single developer targeting FAANG, HPC, and Quant Hedge Fund SWE roles.

## Language

**Profile**:
The structured, editable representation of the user's career data — skills, experience, education, projects. Parsed from a CV PDF on first import; the profile is the canonical source afterward.
_Avoid_: CV, resume (reserve these for the PDF document itself)

**CV**:
The PDF document uploaded by the user. Used only as input for the initial profile parse.
_Avoid_: Resume (use CV consistently)

**Source of Truth**:
The auto-crawled, periodically refreshed dataset representing current market expectations — skills, technologies, and project patterns required for target roles.
_Avoid_: Market data, knowledge base

**Role Template**:
A predefined skill and experience bar for a specific role (e.g. "Google SWE L4", "Jane Street SWE", "HPC Engineer at NVIDIA"), derived from the Source of Truth.
_Avoid_: Role profile, job template

**Target**:
What a Profile is scored against. Either a Role Template (generic) or a specific JD (concrete). A JD overrides the Role Template where they conflict.
_Avoid_: Benchmark, reference

**Score**:
A breakdown of Profile quality across four categories relative to a Target: Skills Match, Project Quality, Experience Depth, Presentation. Never a single aggregate number.
_Avoid_: Rating, grade, ATS score

**Job Tracking**:
A list of positions the user is actively pursuing, with status, deadline, and visa-friendliness tags. Not an application automation system.
_Avoid_: Application tracker, job pipeline

**Visa Tag**:
A label applied to a job or company indicating historical H1B sponsorship activity, derived from public USCIS data. A signal, not a prediction.
_Avoid_: Visa prediction, visa score

**Project Formula**:
The three project archetypes a competitive SWE CV should contain: (1) a full-stack app with current market skills and system design depth, (2) a CS fundamentals deep-dive implementation, (3) a scientific paper re-implementation with improvements. The app checks for these in Project Quality scoring and suggests specific projects to build when one is missing.
_Avoid_: Project checklist, portfolio formula

**Gap**:
A specific missing item between the current Profile and a Target's checklist — a skill, project archetype, or experience type. The app surfaces gaps; the user decides when and how to close them.
_Avoid_: Weakness, deficiency
