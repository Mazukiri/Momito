# Personal tool, not SaaS

This is a single-user tool built for one developer. There is no multi-tenancy or billing. Auth is a single hardcoded bearer token in `.env` — enough to protect a cloud-hosted personal API from public access without the overhead of a full auth system. The decision was made to keep scope tight and validate the core features (CV scoring, learning tracking) before considering a multi-user product. Adding multi-tenancy later is meaningful work, but it is a distinct product decision — not a technical upgrade.

## Considered Options

- **SaaS from the start** — rejected because CV reading, learning personalization, and visa tagging are already complex enough; multi-tenancy would double the surface area without validating the product.
