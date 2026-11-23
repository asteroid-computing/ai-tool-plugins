---
type: llm
focus: trace
weight: 1
---

Email and phone uniqueness is enforced by items keyed on the email and on the phone, written in one transaction with attribute_not_exists conditions, not by a read or a GSI lookup before the write.
