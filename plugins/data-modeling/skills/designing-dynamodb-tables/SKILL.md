---
name: designing-dynamodb-tables
description: Designs and reviews Amazon DynamoDB data models. Covers entities, access patterns, table boundaries, primary keys, sort keys, global secondary indexes, relationships, uniqueness, counts, sorting, pagination, hot partitions and migrations. Produces an entity chart and an access-pattern chart, and checks the design against current AWS limits. Use this skill whenever a task designs, reviews or changes how data is stored in DynamoDB, even if the user does not say "data model". Examples are adding an entity or a query, choosing PK, SK or GSI keys, deciding between one table and several, fixing a throttled key or a slow Scan, and planning a backfill. Do not use it for DynamoDB operations that do not change the model, such as IAM policies, backups, alarms or a CDK table definition with keys that are already decided.
---
# Designing DynamoDB tables

This skill guides the design of a DynamoDB data model.
DynamoDB serves only the reads that its keys were designed for.
A key cannot change after items exist, so a design error is expensive to fix later.
Thus, design from the access patterns, and validate the design before any code is written.

## Terms

Use these terms with these meanings only.

- **Entity**: a type of object that the application stores, for example `Patient` or `Appointment`.
- **Item**: one record in a table.
- **Access pattern**: one read or one write that the application makes, with the inputs that the request has.
- **Base table**: the table itself, not an index.
- **Item collection**: all items in the base table or in an index that have the same partition key value.
- **GSI**: global secondary index. **LSI**: local secondary index.
- **Index attribute**: an attribute that exists only to build a key. An **application attribute** holds data that the application uses.
- **Entity chart** and **access-pattern chart**: the two outputs of this skill. Their templates are below.

## Workflow

Copy this checklist into your answer or your notes, and mark each step when it is complete.

```
Model progress:
- [ ] 1. Entities and relationships
- [ ] 2. Access patterns
- [ ] 3. Table boundaries
- [ ] 4. Primary keys
- [ ] 5. Secondary indexes
- [ ] 6. Charts
- [ ] 7. Validation
```

**Step 1. Entities and relationships.**
List each entity.
For each relationship, write its type: one-to-one, one-to-many or many-to-many.
Write the business rules that affect storage: unique values, upper limits, required order.

**Step 2. Access patterns.**
Write every read and every write that the application makes.
Find them from each API operation, or from each screen and its URL.
For each pattern, write its inputs, how often it runs, and how many items it returns.
Write the peak request rate and the expected item size where you know them, because they decide the partition design.
If the user did not give the access patterns, write the patterns that you assume and ask the user to confirm them.
Do not design keys before this list exists, because a key that serves no known pattern is a guess.

**Step 3. Table boundaries.**
Decide which entities share a table.
Read [table-boundaries.md](references/table-boundaries.md).

**Step 4. Primary keys.**
For each table, design the partition key and the sort key of each entity.
Put each unique value in a primary key first, because DynamoDB enforces uniqueness only on the primary key.
Then use the remaining freedom to serve the access patterns that read many items.
Read [keys-and-indexes.md](references/keys-and-indexes.md), and the strategy files that the table below names.

**Step 5. Secondary indexes.**
Add a GSI only for an access pattern that the primary keys cannot serve.
Read the GSI section of [keys-and-indexes.md](references/keys-and-indexes.md).

**Step 6. Charts.**
Write the entity chart and the access-pattern chart with the templates below.

**Step 7. Validation.**
Do each check in the validation list below.
If a check fails, go back to step 4.
Continue only when all checks pass, or when the chart states the reason for each exception.

## Chart templates

Use these templates exactly, because reviewers and later sessions read the charts to find each key.

Entity chart, one row for each item type:

```markdown
| Entity | Table | Partition key | Sort key | GSI keys | Notes |
|---|---|---|---|---|---|
| Appointment | clinic | `PRACTITIONER#<practitionerId>` | `APPT#<startTime>#<appointmentId>` | `byPatient`: patientId, startTime | Immutable after booking, except status |
```

Access-pattern chart, one row for each access pattern:

```markdown
| # | Access pattern | Inputs | Frequency | Operation | Table or index | Key condition | Notes |
|---|---|---|---|---|---|---|---|
| 3 | Practitioner's appointments for one day | practitionerId, date | Each calendar view | Query | clinic | PK = `PRACTITIONER#<id>`, SK begins_with `APPT#<date>` | Ascending |
```

An item type that exists only for a rule, such as a uniqueness marker, gets its own row in the entity chart.
An entity that is stored as an attribute of another item gets no row, and the notes of its parent say so.

## Validation

Do each check for each row of the access-pattern chart and the entity chart.

1. Each access pattern uses one request. If it uses more, the notes state why.
2. No access pattern uses Scan, unless it is an export, a table that stays small, or a sparse index made for a scan.
3. The request can build each key value from the inputs of its access pattern.
4. No primary key contains a value that changes.
5. Each unique value is in a primary key, and each write that creates it has a condition expression.
6. Each list or map attribute that grows has a stated upper limit, well below the item size limit.
7. Each read that must see its own write uses the base table with a strongly consistent read.
8. No partition key can receive more traffic than one partition can serve. If one can, the design shards it.
9. Each filter expression has a stated reason.
10. Each copy of a value has a stated update path, and the notes name it.
11. Each string key that sorts on a number or a time has a fixed width.
12. The limits in [limits.md](references/limits.md) hold for the largest item, transaction and page.

## Strategy files

Read only the files that the task needs.

| Situation                                                                             | File                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Decide which entities share a table                                                   | [table-boundaries.md](references/table-boundaries.md)                     |
| Design a partition key, a sort key or a secondary index                               | [keys-and-indexes.md](references/keys-and-indexes.md)                     |
| Model a one-to-many or a many-to-many relationship                                    | [relationships.md](references/relationships.md)                           |
| Return a subset of items: by status, by type, by range                                | [filtering.md](references/filtering.md)                                   |
| Return items in an order, return the latest N items, or page a list                   | [sorting-and-pagination.md](references/sorting-and-pagination.md)         |
| Enforce a unique value, keep a count, write several items together, make a retry safe | [writes-and-integrity.md](references/writes-and-integrity.md)             |
| Handle high traffic on one key, or choose a capacity mode                             | [scaling.md](references/scaling.md)                                       |
| Add an entity, an attribute or an access pattern to an existing table                 | [migrations.md](references/migrations.md)                                 |
| Write the data access code for the model                                              | [implementation.md](references/implementation.md)                         |
| Review an existing design                                                             | [anti-patterns.md](references/anti-patterns.md), then the validation list |
| Check a limit, a price or a quota                                                     | [limits.md](references/limits.md)                                         |

## Frequent errors

Each error links to its fix in [anti-patterns.md](references/anti-patterns.md).

- A design that starts from the entities, with no list of access patterns.
- A read that gets one item, then queries with a value from it, when one query could get both.
- A Scan, or a filter expression that discards most of what it reads, in a request path.
- A primary key that contains a value that changes, for example an update time or a status.
- A key value that the request cannot build, for example a creation time that only the item knows.
- Uniqueness that depends on a read before the write, not on a condition expression.
- A count that a query calculates on each read.
- A list attribute with no upper limit.
- One partition key for all items of a type, such as a static `ALL` value, under high write traffic.
- A string key with a number or a time of variable width, or with mixed letter case.

## Answer format

Give the design in this order:

1. The assumptions and the access patterns, with any questions for the user.
2. The table boundaries, with the reason for each separate table.
3. The entity chart.
4. The access-pattern chart.
5. The decisions, each with its alternative and the reason for the choice.
6. The result of each validation check, and each exception with its reason.

Limits, prices and quotas change.
Use [limits.md](references/limits.md), and verify a value in the AWS documentation before a design depends on it.
