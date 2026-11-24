---
type: llm
focus: trace
weight: 1
---

design.md puts the idempotency keys in their own table, with TTL on and point-in-time recovery off, and gives as the reason the stated needs: kept 24 hours, no backup.
