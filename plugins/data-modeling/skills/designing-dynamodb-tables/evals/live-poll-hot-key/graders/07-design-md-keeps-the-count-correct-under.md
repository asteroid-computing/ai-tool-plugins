---
type: llm
focus: trace
weight: 1
---

design.md keeps the count correct under retries and duplicate deliveries, for example by tying each increment to the conditional voter write or an idempotency key.
