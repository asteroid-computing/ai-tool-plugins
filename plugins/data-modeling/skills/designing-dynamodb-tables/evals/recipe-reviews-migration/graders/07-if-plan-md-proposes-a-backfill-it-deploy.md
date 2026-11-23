---
type: llm
focus: trace
weight: 1
---

If plan.md proposes a backfill, it deploys the new write path first, scans with a filter on the item type, updates with attribute_exists, is resumable and stops only when LastEvaluatedKey is absent; if it proposes no backfill, it explains how existing recipes read with a default count of zero.
