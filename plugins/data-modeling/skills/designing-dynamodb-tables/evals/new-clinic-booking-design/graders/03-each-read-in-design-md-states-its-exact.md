---
type: llm
focus: trace
weight: 1
---

Each read access pattern in design.md states its exact request: the operation, the table or index, the key condition with key formats, the read direction or limit where it matters, and the number of requests. No read uses two serial requests unless design.md states why one request cannot serve it.
