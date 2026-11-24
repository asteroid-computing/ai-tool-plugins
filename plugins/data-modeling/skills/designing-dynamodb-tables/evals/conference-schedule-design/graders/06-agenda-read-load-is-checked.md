---
type: llm
focus: trace
weight: 1
---

design.md estimates the agenda's read load: roughly 20,000 attendees every 30 seconds is about 650 reads per second of about 120 KB (120 sessions of 1 KB), which is several thousand read units per second on one item collection, above the 3,000 RCU limit of one partition. It answers this with a cache, precomputed copies of the agenda spread over several keys, or another stated mechanism, and states how seats left stays fresh enough.
