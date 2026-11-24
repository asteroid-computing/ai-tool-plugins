---
type: llm
focus: trace
weight: 1
---

The mechanisms in design.md work as stated: each key condition matches the key formats and their sort order, each read direction returns the stated order, the read-unit and write-unit arithmetic is right (4 KB a read unit, 1 KB a write unit, transactions double), and no item or partition the design relies on exceeds its stated limit.
