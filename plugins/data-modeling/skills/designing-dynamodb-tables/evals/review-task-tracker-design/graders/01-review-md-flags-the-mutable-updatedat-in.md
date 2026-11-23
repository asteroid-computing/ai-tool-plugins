---
type: llm
focus: trace
weight: 1
---

review.md flags the mutable updatedAt in the task sort key and moves it to a GSI sort key (or an index), keeping a stable identifier in the base key.
