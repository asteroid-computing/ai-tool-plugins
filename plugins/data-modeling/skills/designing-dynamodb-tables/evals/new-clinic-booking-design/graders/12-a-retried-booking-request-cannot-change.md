---
type: llm
focus: trace
weight: 1
---

A retried booking request cannot change the monthly count twice, because the count change is in the same transaction as a conditional put that fails on a repeat.
