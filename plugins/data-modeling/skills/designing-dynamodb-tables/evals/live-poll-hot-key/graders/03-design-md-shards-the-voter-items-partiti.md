---
type: llm
focus: trace
weight: 1
---

design.md shards the voter items' partition key (for example by a hash of viewerId) so that the one-vote rule stays a conditional write on a key the request can build.
