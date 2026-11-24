---
type: llm
focus: trace
weight: 1
---

design.md serves the session page (session plus its speakers' names, photos and short bios) with one request, or states why more requests are needed and runs them in parallel. Two serial requests with no stated reason fail.
