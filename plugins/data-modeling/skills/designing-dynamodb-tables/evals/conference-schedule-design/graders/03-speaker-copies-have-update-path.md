---
type: llm
focus: trace
weight: 1
---

For each speaker field that design.md copies onto other items (for example name, photo or short bio on a session or a relationship item), it names the update path that runs when the speaker edits it, such as a transaction over the few items or a stream consumer. A copied field with no update path fails. Reading the fields from the speaker items with BatchGetItem instead also passes.
