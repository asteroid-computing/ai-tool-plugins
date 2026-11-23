---
tags: [skill-creator, dynamodb]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Can you review this DynamoDB design for our task tracker before we ship it? Be blunt. Write your review to review.md.

Table `tracker` (on-demand), PK = `PK`, SK = `SK`.

- Project: PK = `project#<projectId>`, SK = `project#<projectId>`. Has a `slug` that must be unique; on create we GetItem `SLUG#<slug>` and if nothing comes back we PutItem the project and the slug item.
- Task: PK = `project#<projectId>`, SK = `<updatedAt>` where updatedAt is like `2026-3-4T9:05:07Z`. Each task has a `comments` list attribute that we append every comment to. Projects get up to 50,000 tasks.
- 'Blocked tasks' screen: Query PK = project#<id> with FilterExpression status = 'BLOCKED' (about 2% of tasks are blocked).
- Project dashboard shows the number of open tasks: Query with Select=COUNT and a filter on status on every page load.
- User: PK = `USER#<createdAt>#<userId>`, SK = `PROFILE`. The profile page URL is /users/<userId>.
- Admin page lists all users: Scan with FilterExpression begins_with(PK, 'USER#').
- GSI1: partition key `assigneeId`, sort key `SK` (the base SK), for 'my tasks'.
- Membership: PK = `project#<projectId>`, SK = `MEMBER#<userId>`, GSI `byUser` on userId. When we grant access we write the membership and then immediately check access with a Query on byUser.
- Audit log: every change writes PK = `AUDIT`, SK = `<timestamp>#<uuid>`. We expect about 2,000 changes per second at peak.
