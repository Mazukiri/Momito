# Tech stack: Python FastAPI backend, Next.js web, React Native/Expo mobile

Backend is Python + FastAPI. Python was chosen for its AI/ML ecosystem — PDF parsing, LLM integration, web crawling (BeautifulSoup, Playwright, LangChain) are all first-class in Python. Web frontend is Next.js (React + TypeScript). iPhone app is React Native + Expo — chosen over Swift/SwiftUI to share TypeScript types and component logic with the web frontend, and to avoid requiring macOS for development iteration. The iPhone feature set is already a subset of web (ADR-0006), so cross-platform code sharing is a genuine win here.

## Considered Options

- **Go backend** — rejected; AI/ML and crawling ecosystem is significantly weaker than Python.
- **Node.js backend** — rejected; Python is strictly better for the LLM and crawler workloads that make up most of the backend logic.
- **Swift/SwiftUI** — rejected in favor of React Native to reduce context switching between web and mobile codebases.
