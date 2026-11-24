---
type: llm
focus: trace
weight: 1
---

design.md checks the 12,000-payslip pay run against the limits: it keeps the writes under about 1,000 write units a second on any one partition key (or spreads or paces them), it uses BatchWriteItem (25 items a request) or a paced job rather than one transaction, and it makes the run safe to resume or repeat without duplicate payslips.
