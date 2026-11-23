---
type: llm
focus: trace
weight: 1
---

review.md flags the slug check as a race (read before write) and replaces it with a transaction whose writes carry attribute_not_exists conditions.
