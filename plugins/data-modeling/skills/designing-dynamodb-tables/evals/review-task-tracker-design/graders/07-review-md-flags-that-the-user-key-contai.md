---
type: llm
focus: trace
weight: 1
---

review.md flags that the user key contains createdAt, which the /users/<userId> request does not know, and keys the user by userId.
