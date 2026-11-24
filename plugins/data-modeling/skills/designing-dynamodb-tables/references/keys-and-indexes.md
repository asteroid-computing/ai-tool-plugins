# Keys and indexes

Use this file for step 6 and step 7: design primary keys and secondary indexes.

## Contents

- Primary key type
- Partition key
- Sort key
- Key values
- Global secondary indexes
- Overloaded GSIs
- Concatenated keys
- How the guidance changed
- Local secondary indexes
- Projections

## Primary key type

A composite primary key has a partition key and a sort key. A simple primary key has a partition key only.
Use a composite primary key when an access pattern reads more than one item or more than one entity type.
Use a simple primary key only for a table with one entity that each access pattern reads by its identifier.
The key schema of a table cannot change, so choose a composite key when you are not sure.

## Partition key

The partition key does two jobs:

- It groups the items that one Query reads. A Query reads one item collection only.
- It spreads the load. DynamoDB hashes the partition key to choose a partition, and each partition has a fixed throughput limit. See [scaling.md](scaling.md).

Choose a value with many distinct values and even traffic, for example a customer, a device or a venue identifier.
Do not choose a value with few distinct values, unless the traffic is low. Examples are a status, a date or a constant.

Put the authorization scope in the partition key. This is the identifier that the request proves before it reads or writes, for example a tenant, an account or a board.
Then a request for a partition that the caller cannot prove returns nothing, and a guessed child identifier cannot reach another tenant's data.
Do not key data under a child identifier from the URL when the request proves a different scope.
Data that must cross tenants goes in its own table, with its own access rules.

## Sort key

The sort key orders the items in an item collection, and a Query can select a range of them.
A key condition on the sort key can use `=`, `<`, `<=`, `>`, `>=`, `BETWEEN` and `begins_with`.
It cannot use `contains` or a suffix match, because the items are in sorted order and a Query reads one contiguous range.
`begins_with` does not work on a Number sort key.
`BETWEEN` includes both ends. For one day or one month, use `begins_with` with a fixed-width date, such as `2026-03-14`. Or end the range one unit before the next period starts.

Design the sort key for the order and the ranges that the access patterns need.
For the order rules, read [sorting-and-pagination.md](sorting-and-pagination.md).

## Key values

- **Build each key from the request inputs.** A key must come from a value that the request has: an identifier in the URL, a token, a message field. Some keys need a value that only the item has, such as its creation time. Then each request must first find that value. Put such a value in a key only when the item that points to this item also stores it.
- **Start each key value with the entity type** in a table with more than one entity type, for example `RECIPE#<recipeId>`. Use `#` between the parts.
- **Use one letter case** in every key, because uppercase letters sort before lowercase letters. Keep the original text in an application attribute.
- **Keep a value that can contain `#` at the end of the key**, or encode it. Never split a key to read data back. Store each part as an application attribute too.
- **Put no value that changes in a primary key.** DynamoDB cannot update a key attribute. A change needs a delete and a new put, and other items can point to the old key. Put a value that changes in a GSI key. DynamoDB moves the index entry when the value changes.
- **Make each identifier unique in its item collection.** Two items with the same primary key are one item: a second put replaces the first, unless a condition stops it.

## Global secondary indexes

Add a GSI for an access pattern that the primary keys cannot serve. Examples are a read by a different attribute, or in a different order.

Default design:

- Give each GSI one job and a descriptive name, for example `byCopy` or `openTicketsByVenue`.
- Use multi-attribute keys. A GSI partition key and a GSI sort key can each have up to four attributes. Use the application attributes directly, for example a partition key of `venueId` and a sort key of `status`, then `startTime`.
- A Query on a multi-attribute key must give each partition key attribute with `=`. It can give sort key attributes from left to right only, with no gap. Only the last condition can be a range.
- Put the attribute that a Query always gives with `=` first in the sort key, and the range attribute last.
- Number attributes in a multi-attribute key sort as numbers, so they need no padding.
- The key attributes of a GSI cannot change after you create it. Design them from the access patterns, not for a future use.

Rules for every GSI:

- A GSI is eventually consistent. A Query on a GSI can miss a write that completed less than a second ago. A read that must see its own write must use the base table.
- An item enters a GSI only when it has all the key attributes of that GSI. Use this to make a sparse index. See [filtering.md](filtering.md).
- A GSI keyed on attributes that every item of a type has holds every item of that type. For a sparse index, use a key attribute that only the matching items have. For example, set `blockedAt` only on blocked tasks, and remove it when a task is no longer blocked.
- Each GSI that a write changes costs its own write units. An index with many entries on a frequently written entity increases write cost.
- A change to a GSI key value is a delete and a put in the index, so it costs two index writes. Do not key a GSI on a value that changes on most writes.
- GSI key values do not have to be unique. A GSI cannot enforce uniqueness.
- A table can have 20 GSIs by default. See [limits.md](limits.md).

## Overloaded GSIs

An overloaded GSI holds more than one entity type. Its key attributes are strings, such as `GSI1PK` and `GSI1SK`, and each entity fills them differently.

Use an overloaded GSI when one Query on the index must return several entity types. This happens when the base item collection already serves a different pattern.
For example, the base table pre-joins a venue with its upcoming events, and a second page reads the venue with its reviews. The reviews and the venue share an item collection in `GSI1`.
State the saving in the entity chart: the requests that it removes for each call. See the test in SKILL.md and the patterns in [single-table-patterns.md](single-table-patterns.md).

When a GSI is overloaded:

- Name the attributes by number: `GSI1PK` and `GSI1SK` for `GSI1`.
- Give each index its own attributes. Do not use the base table `SK` as a GSI sort key, even when the values are the same. A later entity can need a different value.
- Put the entity type at the start of each value, as in the base table.
- Write a chart for the index, with one row for each entity type that it holds.

Do not overload a GSI only to have fewer indexes. Each GSI write costs the same in one index or in two, and a dedicated GSI is easier to read and to change.

## Concatenated keys

A concatenated key puts several values in one string, for example `OPEN#2026-03-14T09:30:00.000Z`.
Use one in the base table and in an LSI, because their sort keys have one attribute.
Also use one in an overloaded GSI, and for a key with more than four parts.
In a dedicated GSI, use a multi-attribute key, because it needs no new attribute and no backfill.

## How the guidance changed

The DynamoDB Book (2020) overloaded a small number of GSIs for all entities, with generic `GSI<n>PK` and `GSI<n>SK` attributes and concatenated values.
The practice came from a time with a lower GSI quota, capacity that was provisioned for each index, and GSI keys of one attribute.
The quota is now 20, on-demand capacity shares capacity across indexes, and since November 2025 each GSI key part accepts up to four attributes.
AWS now prefers a dedicated GSI for each access pattern. The book's overloaded GSI is still the best design when one Query must return several entity types.
Sources:
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.DesignPattern.MultiAttributeKeys.html
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-gsi-overloading.html

## Local secondary indexes

An LSI has the same partition key as the base table and a different sort key.

Use an LSI only when both conditions are true:

- An access pattern needs a strongly consistent read in a different order of the same item collection.
- Each item collection stays well below 10 GB, including its LSI entries.

Before you add an LSI, know these restrictions:

- You can create an LSI only when you create the table.
- A table with an LSI limits each item collection to 10 GB. A write that makes a collection larger fails.
- A table with an LSI keeps each item collection on one partition. DynamoDB cannot split a hot collection across partitions.
- An LSI sort key has one attribute only.

In all other cases, use a GSI.

## Projections

A projection decides which attributes DynamoDB copies into an index.
Each projection includes the index keys and the base table keys. Thus, a Query on a GSI always returns the primary key of each item.

- `ALL` copies every attribute. The read needs no second request, but storage and write cost increase.
- `KEYS_ONLY` copies the keys. Use it when the access pattern needs only the identifiers, or when it reads the full items with `BatchGetItem` after the Query.
- `INCLUDE` copies the keys and the attributes that you name. Use it to keep a large attribute out of a list read.

Start with `ALL` unless the items are large or the write rate is high.
You cannot change the projection of an existing GSI, so a change needs a new index.
