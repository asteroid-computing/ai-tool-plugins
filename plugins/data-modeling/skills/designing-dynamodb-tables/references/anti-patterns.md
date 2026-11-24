# Anti-patterns

Use this file to review a design, or to check your own design before step 9.
Each entry gives the error, why it fails, and the fix.

## Contents

- Design process
- Keys
- Reads
- Writes
- Scale
- Structure

## Design process

**A design from the entities, with no list of access patterns.**
Why it fails: DynamoDB serves only the reads that its keys were designed for. A key that serves no known pattern is a guess.
Fix: write the access patterns first (SKILL.md, step 2).

**One table for each entity, by habit.**
Why it fails: a page that shows two entities then needs two requests, often one after the other.
Fix: put entities that an access pattern reads together in one table. See [table-boundaries.md](table-boundaries.md).

**All entities in one table, by habit.**
Why it fails: unrelated entities then share one backup policy, one encryption key, one table class and one stream.
Fix: separate them when no access pattern reads them together. See [table-boundaries.md](table-boundaries.md).

**A table split on an assumed operational need.**
Why it fails: the split costs a request on each read that needs both tables, for a need that nobody stated.
Fix: ask for the needs. If no one can answer, write the defaults as assumptions and keep the entities together.

**No query pattern library, or code that reads the table outside it.**
Why it fails: nobody can see how the entities are designed to be used. New code then adds reads that the keys do not serve, such as a Scan or a filter.
Fix: write the library, and serve each entry with one named data access function. See [pattern-library.md](pattern-library.md).

## Keys

**A value that changes in a primary key**, for example `updatedAt`, a score or a status.
Why it fails: DynamoDB cannot update a key attribute. Each change needs a delete and a put, and other items can point to the old key.
Fix: use a stable identifier in the primary key, and put the changing value in a GSI key. See [keys-and-indexes.md](keys-and-indexes.md).

**A partition key that is not the authorization scope**, for example comments keyed by a card identifier from the URL when the request proves only the board.
Why it fails: a caller who learns a child identifier from another tenant can read that child's data. A check in each request is easy to forget on one path.
Fix: put the authorization scope in the partition key, and the child identifier in the sort key. See [keys-and-indexes.md](keys-and-indexes.md).

**A key that the request cannot build.** For example, a creation time in the key of an item that a URL finds by its identifier.
Why it fails: each read must first find the missing value, often with a second request or a Scan.
Fix: build keys only from the inputs of the access pattern. See [keys-and-indexes.md](keys-and-indexes.md).

**Mixed letter case in keys.**
Why it fails: uppercase letters sort before lowercase letters, so the order is wrong and a prefix condition can miss items.
Fix: use one case in keys. Keep the original text in an application attribute.

**A time or a number of variable width in a string key.** Examples are `2026-3-4`, a time format that removes trailing zeros, and an unpadded `42`.
Why it fails: strings sort one byte at a time, so `10` sorts before `9`.
Fix: use a fixed width. See [sorting-and-pagination.md](sorting-and-pagination.md).

**Code that parses a key to read a value.**
Why it fails: a change to the key format then breaks each reader.
Fix: store each value as an application attribute too. See [implementation.md](implementation.md).

**One attribute as the key of two indexes**, for example the base table `SK` used as a GSI sort key.
Why it fails: a later entity can need different values in the two indexes.
Fix: give each index its own key attributes.

## Reads

**A join in the application**: get one item, then query with a value from it.
Why it fails: the requests run one after the other, and the delay adds up.
Fix: put the items in one item collection, or copy the needed fields. If two requests are necessary, run them in parallel, or use one `BatchGetItem`, and state why. See [relationships.md](relationships.md).

**A Scan in a request path.**
Why it fails: its cost and time grow with the table.
Fix: serve the pattern with a key or a sparse GSI. Keep Scan for exports, backfills, small tables, and sparse indexes made for a scan.

**A filter expression that removes most of what it reads.**
Why it fails: the request pays for each item read. Pages stop at 1 MB before the filter, so a page can be empty. `Limit` counts items read, so the page size is unpredictable.
Fix: move the condition into a key or a sparse index. See [filtering.md](filtering.md).

**A count calculated by a Query on each read.**
Why it fails: the read cost grows with the number of items. A Query with `Select` set to `COUNT` also stops at 1 MB of read data, so a large count needs every page.
Fix: store the count on the parent and change it in the same transaction as the items. See [writes-and-integrity.md](writes-and-integrity.md).

**A read through a GSI that must see its own write**, for example a permission check right after a grant.
Why it fails: a GSI is eventually consistent.
Fix: read the base table with a strongly consistent read.

**Pages by offset.**
Why it fails: the read pays for each skipped item.
Fix: page by key. See [sorting-and-pagination.md](sorting-and-pagination.md).

**Trust in TTL for correctness.**
Why it fails: DynamoDB deletes an expired item up to a few days after its time. Until then, reads return it.
Fix: check the expiry time when you read the item, or remove expired items with a filter expression.

## Writes

**A unique value checked by a read before the write.**
Why it fails: two requests can read at the same time, and both write.
Fix: put the value in a primary key and write with a condition. See [writes-and-integrity.md](writes-and-integrity.md).

**A put with no condition on a create.**
Why it fails: a put replaces an existing item with the same key, with no error.
Fix: add `attribute_not_exists(PK)`.

**A state change with no condition on the current state.**
Why it fails: a request that read an old state can move the entity backwards.
Fix: put the expected state in the condition.

**An update that adds to a count, with retries or duplicate messages.**
Why it fails: each repeat adds again.
Fix: pair the count with a conditional put of a marker item in one transaction. See [writes-and-integrity.md](writes-and-integrity.md).

**A transaction that can grow without a limit**, for example all lines of an order.
Why it fails: a transaction has a maximum number of items.
Fix: set a limit, or write in steps that can resume. See [limits.md](limits.md).

## Scale

**One partition key for all items of a type**, for example `TYPE#MEMBER` or a constant `ALL`, under high write traffic.
Why it fails: each write goes to one partition, which has a fixed limit.
Fix: use a sparse GSI for rare jobs, time buckets for ordered lists, or write sharding. See [scaling.md](scaling.md).

**A partition key with few values under high traffic**, for example a date or a status.
Why it fails: the traffic collects on a few partitions.
Fix: choose a key with many values, or shard it. See [scaling.md](scaling.md).

**An LSI on item collections that grow without a limit.**
Why it fails: a table with an LSI limits each collection to 10 GB, and a write past it fails.
Fix: use a GSI. See [keys-and-indexes.md](keys-and-indexes.md).

## Structure

**A list or map attribute that grows without a limit**, for example all comments on a post.
Why it fails: an item has a 400 KB limit, and each read and write of the item costs more as it grows.
Fix: store each child as its own item. See [relationships.md](relationships.md).

**A copy of a value that changes often, in many items.**
Why it fails: each change must update every copy, and a missed copy is stale.
Fix: copy only values that do not change, or read the source item. See [relationships.md](relationships.md).

**A GSI for each access pattern, when the primary keys can serve some of them.**
Why it fails: each GSI adds write cost and an eventually consistent copy.
Fix: serve as many patterns as possible with the base table keys first.

**A "sparse" GSI keyed on attributes that every item of the type has.**
Why it fails: the index holds every item, so it filters nothing and costs a write on each change.
Fix: key the index on an attribute that only the matching items have. See [filtering.md](filtering.md).

**An overloaded key or GSI with no stated saving**, for example two unrelated patterns in `GSI1` to save an index.
Why it fails: generic attributes and concatenated values make the keys hard to read and to change. New attributes need backfills. The saving is zero, because each index write costs the same in one GSI or in two.
Fix: use a dedicated GSI with descriptive multi-attribute keys. Overload only when one Query returns several entity types. See the test in SKILL.md.

**Generic key names on a table or index that holds one entity type.**
Why it fails: `PK`, `SK` and `GSI1PK` hide what the key holds, with no benefit.
Fix: name the key for its value, for example `memberId` or `loansByCopy`.
