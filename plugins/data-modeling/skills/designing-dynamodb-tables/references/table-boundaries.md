# Table boundaries

Use this file for step 4: decide which entities share a table.
This file follows the current AWS guidance.
The number of tables is a result of the design, not a target. Do not aim for one table, or for one table for each entity.

## The rule

Put entities in one table only when a request reads or writes them together.
A shared business area, such as "billing data", is not a reason to share a table.
Put entities in separate tables when no request reads them together, or when their operational needs differ.

## Decision steps

1. **Find the groups that a request reads together.** For example, a board and its cards on one page.
   Each group must share a table, because only one item collection returns several entity types in one request.
   This is the only strong reason to share a table. See [single-table-patterns.md](single-table-patterns.md).
2. **Split a group that one of these conditions applies to.** Apply them in this order, because a higher condition wins over a lower one.
   - **Authorization boundary.** Data that crosses tenants goes in its own table, with its own access rules. Do not weaken the tenant key of the main table for it.
   - **Different operational needs that the user stated.** Examples are a different restore period, stream consumer, replication Region, capacity mode or encryption key.
   - **Restore granularity.** Point-in-time restore applies to a whole table. Entities that are never restored together do not share a table.
   - **Service ownership.** Each service owns its tables. Do not share a table across services, because the teams must then agree on each key and index change.
   - **IAM scope.** A role that must write one entity but not another needs separate tables. The alternative, a condition on key prefixes, is easy to get wrong.
   - **Cold or short-lived data.** Large, cold data can use the Standard-IA table class, which applies to the whole table. Short-lived data, such as an idempotency cache, can turn off point-in-time restore.
3. **Prefer separate tables for groups with no shared request** in these cases:
   - The access patterns still change often. A shared table with overloaded keys is harder to change.
   - Each entity is read on its own, for example by GraphQL resolvers or an object mapper with one class for each table. A shared table then gives no read benefit.
4. **Write the result** in the `Table` column of the entity chart. Write the reason for each separate table and each shared table in the answer.

## Operational needs: ask, do not assume

A difference in operational needs is a reason to split only when the user states it.
For each entity, ask about restore, streams, TTL, encryption, IAM scope, replication and capacity mode.
If the user cannot answer, use the defaults and write them as assumptions:

- Point-in-time restore on, with deletion protection.
- Encryption with the AWS owned key.
- On-demand capacity.
- No streams, unless a stated consumer needs them.

Do not split a table on an assumed difference. List the question in the answer instead.

## Example of the conflict order

Members and their loans are read together on the member page, so they could share a table.
The user states that loans need 35 days of point-in-time restore and an audit stream, and that members need neither.
The stated operational difference wins over the shared read.
Put loans and members in separate tables, and read them with two parallel requests.
State the cost in the library: the member page uses 2 parallel requests, not 1.

## Inside a shared table

When a table holds more than one entity type, read [single-table-patterns.md](single-table-patterns.md).
It gives the key formats, the `Type` attribute and the overloaded-index rules.

When a table holds one entity type, use descriptive key names, for example `memberId`.

## How the guidance changed

The DynamoDB Book (2020) and other guidance from about 2019 to 2022 used one table for each application or service as the default.
AWS now treats single-table and multi-table design as equal starting points. It uses single-table design as a tactic for entities that are read together.
The book's main reason for one table, one request for several entity types, is still correct, and step 1 keeps it.
Its other reasons are weaker now. On-demand capacity removed most of the capacity-sharing benefit. Per-table encryption keys, table classes, IAM and restore give reasons to split.

Sources:
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-foundations.html
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-modeling-nosql-B.html
