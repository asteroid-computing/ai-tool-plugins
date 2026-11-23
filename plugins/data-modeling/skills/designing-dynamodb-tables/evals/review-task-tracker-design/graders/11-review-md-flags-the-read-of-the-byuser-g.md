---
type: llm
focus: trace
weight: 1
---

review.md flags the read of the byUser GSI right after the grant as eventually consistent and uses a strongly consistent base-table read.
