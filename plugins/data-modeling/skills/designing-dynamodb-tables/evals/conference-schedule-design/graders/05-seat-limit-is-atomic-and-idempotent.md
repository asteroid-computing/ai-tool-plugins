---
type: llm
focus: trace
weight: 1
---

Saving a session is one TransactWriteItems (or equivalent single atomic write) that puts the attendee-session item with attribute_not_exists and changes the session's seat count with a condition that keeps it within the seat limit. A repeated save fails the put, so it cannot take a second seat. Removing a saved session deletes the item with a condition that it exists and gives the seat back in the same transaction.
