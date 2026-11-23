---
type: llm
focus: trace
weight: 1
---

plan.md enforces one review per user per recipe with a review key that contains both the recipe and the user, written with attribute_not_exists on create.
