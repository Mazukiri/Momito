# Auto-crawl for Source of Truth

The Source of Truth — the dataset used to evaluate CVs and suggest learning materials — is built by automatically crawling three sources in parallel: job postings (LinkedIn, Greenhouse, Lever) for Role Templates and Skills match; GitHub trending + ArXiv for Project quality signals and paper suggestions; and USCIS H1B disclosure CSVs for Visa Tags. This was chosen over a curated manual dataset (too expensive to maintain) and on-demand LLM synthesis (non-deterministic, API-cost dependent, potential hallucination). The crawl-based approach produces stable, auditable data that can be versioned and inspected.

## Considered Options

- **LLM on-demand synthesis** — rejected for MVP; hallucination risk is too high for a system that tells the user what skills to learn.
- **Manual curation** — rejected because it does not scale and defeats the "updated daily/weekly" requirement.
