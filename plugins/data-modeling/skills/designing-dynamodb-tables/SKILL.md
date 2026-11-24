---
name: designing-dynamodb-tables
description: Designs and reviews Amazon DynamoDB data models. Uses current AWS guidance as the default, and applies the single-table patterns of The DynamoDB Book where they remove requests or capacity. Covers access patterns, table boundaries, primary keys, GSIs, overloaded keys, relationships, denormalisation, uniqueness, counts, sorting, pagination, hot partitions and migrations. Produces an entity chart and a query pattern library that records how each entity is read and written. Use this skill whenever a task designs, reviews or changes how data is stored in DynamoDB, even if the user does not say "data model". Examples are adding an entity or a query, choosing PK, SK or GSI keys, deciding between one table and several, fixing a throttled key or a slow Scan, and planning a backfill. Do not use it for DynamoDB operations that do not change the model, such as IAM policies, backups, alarms or a CDK table definition with keys that are already decided.
---
# Designing DynamoDB tables

This skill guides the design of a DynamoDB data model.
It uses two sources of patterns:

- **AWS guidance** is the current best practice. It sets each default in this skill.
- **The DynamoDB Book** (Alex DeBrie, 2020) gives the design process and the single-table patterns. Use a book pattern when it gives a stated saving over the AWS default.

The aim is the design that serves each access pattern with the fewest requests and the least capacity.
DynamoDB serves only the reads that its keys were designed for, and a key cannot change after items exist.
Thus, design from the access patterns, and validate the design before any code is written.

## Terms

Use these terms with these meanings only.

- **Entity**: a type of object that the application stores, for example `Member` or `Loan`.
- **Access pattern**: one read or one write that the application makes, with the inputs that the request has.
- **Item collection**: all items in a table or in an index that have the same partition key value.
- **Overloaded key**: a key attribute that holds values for more than one entity type, for example `PK` with `MEMBER#<id>` and `TITLE#<id>`.
- **Index attribute**: an attribute that exists only to build a key. An **application attribute** holds data that the application uses.
- **Query pattern library**: the record of each access pattern and the exact request that serves it. It states how the entities are designed to be used.

## Workflow

Copy this checklist into your answer or your notes, and mark each step when it is complete.

```
Model progress:
- [ ] 1. Entities and relationships
- [ ] 2. Access patterns
- [ ] 3. Operational needs
- [ ] 4. Table boundaries
- [ ] 5. Aggregates and relationships
- [ ] 6. Primary keys
- [ ] 7. Secondary indexes
- [ ] 8. Artefacts
- [ ] 9. Validation
```

**Step 1. Entities and relationships.**
List each entity and its main attributes.
For each relationship, write its type: one-to-one, one-to-many or many-to-many.
Write the business rules that affect storage: unique values, upper limits, required order.

**Step 2. Access patterns.**
Write every read and every write that the application makes.
Find them from each API operation, or from each screen and its URL.
For each pattern, write its inputs, the items it returns, its peak rate, its consistency and its authorization scope.
The authorization scope is the identifier that the request must prove before it reads or writes, for example a tenant.
If the user did not give the patterns, write the patterns that you assume and ask the user to confirm them.
Do not design keys before this list exists, because a key that serves no known pattern is a guess.

**Step 3. Operational needs.**
For each entity, find its needs for point-in-time restore, streams consumers, TTL, encryption key, IAM scope, replication and capacity mode.
Ask the user for these needs.
If the user cannot answer, write the defaults as assumptions, and do not split tables on an assumption.

**Step 4. Table boundaries.**
Decide which entities share a table.
Read [table-boundaries.md](references/table-boundaries.md).

**Step 5. Aggregates and relationships.**
For each relationship, decide: embed the children in the parent item, put them in an item collection, or store them apart.
Decide which values to copy between items, and the update path of each copy.
Read [relationships.md](references/relationships.md).

**Step 6. Primary keys.**
Put each unique value in a primary key first, because DynamoDB enforces uniqueness only on the primary key.
Put the authorization scope in the partition key.
Then use the remaining freedom to serve the patterns that read many items.
Read [keys-and-indexes.md](references/keys-and-indexes.md). For a table with more than one entity type, also read [single-table-patterns.md](references/single-table-patterns.md).

**Step 7. Secondary indexes.**
Add a GSI only for a pattern that the primary keys cannot serve.
By default, give each GSI one job, a descriptive name and descriptive key attributes.
Overload a GSI only when the test in the next section passes.

**Step 8. Artefacts.**
Write the entity chart and the query pattern library with the templates below.
Read [pattern-library.md](references/pattern-library.md).

**Step 9. Validation.**
Do each check in the validation list below.
If a check fails, go back to step 4.
Continue only when all checks pass, or when the artefacts state the reason for each exception.

## When a book pattern replaces the AWS default

Use a book pattern only when you can state its saving as a number, against the named AWS alternative.
Write the saving in the notes of the entity chart.

| Book pattern                                | Use it when                                                                                                          | Saving to state                                         | AWS default otherwise                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Several entity types in one item collection | One pattern reads a parent and its children, or two related types, together                                          | Requests for each call, for example 2 serial to 1       | One entity type for each collection; a `GetItem` and a `Query` in parallel |
| Overloaded GSI, `GSI1PK` and `GSI1SK`       | One pattern reads several entity types together through an index, because the base collection serves another pattern | Requests for each call                                  | A dedicated GSI with descriptive multi-attribute keys                      |
| Inverted index on relationship items        | A many-to-many pattern reads one entity with its related items, in both directions                                   | Requests for each call                                  | One inverse GSI on the relationship items, with descriptive keys           |
| Shared key format for two entity types      | Two types must have unique names in one namespace, for example users and organizations                               | One uniqueness item and one transaction for each create | A uniqueness item in a transaction                                         |

A smaller number of indexes is not a saving by itself.
Do not put unrelated patterns in one GSI to save an index, unless the table is near its GSI quota.
Make an attribute name generic only when it holds values for more than one entity type. For example, keep `boardId` as the partition key, and make only `SK` generic.

When two rules conflict, apply them in this order:

1. Correctness: the authorization boundary, consistency, atomic writes and safe retries.
2. Operational needs that the user stated: different restore, stream, replication or capacity needs.
3. Cost and performance: fewer requests, fewer read and write units, fewer index writes.
4. Style: names and the number of tables.

## Artefact templates

Use these templates exactly, because reviewers and later sessions read them to find each key.

Entity chart, one row for each item type in each table:

```markdown
| Entity | Table | Partition key | Sort key | GSI keys | Notes |
|---|---|---|---|---|---|
| Loan | library | `MEMBER#<memberId>` | `LOAN#<loanedAt>#<loanId>` | `loansByCopy`: copyId, loanedAt | Shares the member's collection: member page is 1 Query, not 2 |
```

For an overloaded GSI, add a chart with one row for each entity type that it holds: `| Entity | GSI1PK | GSI1SK |`.
An item type that exists only for a rule, such as a uniqueness marker, gets its own row.
An entity that is stored as an attribute of another item gets no row, and the notes of its parent say so.

The query pattern library has one row for each read and each write. The full template and the rules are in [pattern-library.md](references/pattern-library.md).

```markdown
| # | Pattern | Function | Inputs | Request | Target | Key and condition | Order and limit | Returns | Peak/s | Units | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R3 | Member page | getMemberWithLoans | memberId | 1 Query | library | PK = `MEMBER#<id>`, SK <= `MEMBER#<id>` | Descending, limit 21 | Member, 20 loans | 50 | 1 RCU | Member sorts last |
```

## Validation

Do each check for each entry of the library and each row of the entity chart.

1. Each access pattern uses one request. If it uses more, the notes state why, and the requests run in parallel where they can.
2. No access pattern uses Scan, unless it is an export, a table that stays small, or a sparse index made for a scan.
3. The request can build each key value from the inputs of its access pattern.
4. The partition key of each item holds its authorization scope, or the notes state why not.
5. No primary key contains a value that changes.
6. Each unique value is in a primary key, and each write that creates it has a condition expression. Each update of an existing item has `attribute_exists(PK)`, so that it cannot create a partial item.
7. Each list or map attribute that grows has a stated upper limit, well below the item size limit.
8. Each read that must see its own write uses the base table with a strongly consistent read.
9. No partition key can receive more traffic than one partition can serve. If one can, the design shards it.
10. Each filter expression has a stated reason.
11. Each copy of a value has a stated update path.
12. Each overloaded key and each overloaded GSI states its saving against the AWS default.
13. Each string key that sorts on a number or a time has a fixed width.
14. Each table boundary has a stated reason, and no split depends on an assumed operational need.
15. The limits in [limits.md](references/limits.md) hold for the largest item, transaction and page.

## Strategy files

Read only the files that the task needs.

| Situation                                                                             | File                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Decide which entities share a table                                                   | [table-boundaries.md](references/table-boundaries.md)                     |
| Design a partition key, a sort key or a secondary index                               | [keys-and-indexes.md](references/keys-and-indexes.md)                     |
| Put several entity types in one table or one index                                    | [single-table-patterns.md](references/single-table-patterns.md)           |
| Model a relationship, or decide what to copy between items                            | [relationships.md](references/relationships.md)                           |
| Write the entity chart and the query pattern library                                  | [pattern-library.md](references/pattern-library.md)                       |
| Return a subset of items: by status, by type, by range                                | [filtering.md](references/filtering.md)                                   |
| Return items in an order, return the latest N items, or page a list                   | [sorting-and-pagination.md](references/sorting-and-pagination.md)         |
| Enforce a unique value, keep a count, write several items together, make a retry safe | [writes-and-integrity.md](references/writes-and-integrity.md)             |
| Handle high traffic on one key, or choose a capacity mode                             | [scaling.md](references/scaling.md)                                       |
| Add an entity, an attribute or an access pattern to an existing table                 | [migrations.md](references/migrations.md)                                 |
| Write the data access code for the model                                              | [implementation.md](references/implementation.md)                         |
| Review an existing design                                                             | [anti-patterns.md](references/anti-patterns.md), then the validation list |
| Check a limit, a price or a quota                                                     | [limits.md](references/limits.md)                                         |

## Answer format

Give the design in this order:

1. The assumptions, the access patterns and the operational needs, with any questions for the user.
2. The table boundaries, with the reason for each separate table and each shared table.
3. The entity chart, and a chart for each overloaded GSI.
4. The query pattern library, with reads and writes.
5. The decisions, each with its alternative and the reason. Give the saving for each book pattern that you used.
6. The result of each validation check, and each exception with its reason.

Limits, prices and quotas change.
Use [limits.md](references/limits.md), and verify a value in the AWS documentation before a design depends on it.
