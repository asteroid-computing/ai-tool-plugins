---
tags: [skill-creator, dynamodb]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Our live-poll feature for streamed shows is falling over. During a big show about 5 million viewers can vote in one poll. Most votes arrive in the first few minutes, peaking at 30,000 votes per second, and around 200,000 viewers keep the live totals per option open, refreshed every 2 seconds. One vote per viewer per poll.

Current design (on-demand table): each vote is a TransactWriteItems with (1) a Put of PK = `POLL#<pollId>`, SK = `VOTER#<viewerId>` with attribute_not_exists(PK) and (2) an Update of PK = `POLL#<pollId>`, SK = `OPTION#<optionId>` with ADD votes :one. Viewers GetItem each option item every 2 seconds. We see heavy throttling and TransactionConflict errors.

What's wrong, and how should we redesign it? Write it to design.md.
