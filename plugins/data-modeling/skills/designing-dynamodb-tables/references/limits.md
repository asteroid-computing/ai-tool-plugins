# Limits, quotas and prices

Use this file to check a design against DynamoDB limits.
These values were checked in the AWS documentation on 2026-11-19.
AWS changes limits and prices.
Before a design depends on a value, open its source and check it.

## Contents

- Items and keys
- Reads
- Writes and transactions
- Indexes
- Throughput
- Expiry, streams and storage
- Changes that affect older designs

## Items and keys

| Limit                               | Value                              | Source                                                                              |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| Item size, attribute names included | 400 KB                             | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html   |
| Partition key value                 | 1 to 2,048 bytes                   | Same page                                                                           |
| Sort key value                      | 1 to 1,024 bytes                   | Same page                                                                           |
| Nested attribute depth              | 32 levels                          | Same page                                                                           |
| Empty string or binary              | Allowed, except in a key attribute | Same page                                                                           |
| Empty set                           | Not allowed                        | Same page                                                                           |
| Table size                          | No practical limit                 | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html |

## Reads

| Limit              | Value                                                                           | Source                                                                                           |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Query or Scan page | 1 MB of read data, before a filter expression                                   | https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html                    |
| `Limit` parameter  | Counts items read, not items returned                                           | Same page                                                                                        |
| Read unit          | One strongly consistent read, or two eventually consistent reads, of up to 4 KB | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html                |
| `BatchGetItem`     | 100 items and 16 MB; returns `UnprocessedKeys` for the rest                     | https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html             |
| GSI reads          | Eventually consistent only; a consistent read on a GSI is an error              | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html |

## Writes and transactions

| Limit                                     | Value                                                                      | Source                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Write unit                                | One write of up to 1 KB                                                    | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html      |
| `TransactWriteItems`                      | 100 actions, 4 MB, each action on a different item, one account and Region | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html |
| Transaction cost                          | Two units for each item, also when the transaction fails                   | Same page                                                                              |
| `ClientRequestToken`                      | Makes a repeat of a transaction safe for 10 minutes                        | Same page                                                                              |
| `BatchWriteItem`                          | 25 puts or deletes and 16 MB; no updates and no conditions                 | https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html |
| `PutItem` and `DeleteItem` `ReturnValues` | `NONE` or `ALL_OLD` only                                                   | https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html        |
| Expression                                | 4 KB; 300 operators or functions; 100 operands for `IN`                    | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html      |

## Indexes

| Limit                       | Value                                                              | Source                                                                                                     |
| --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| GSIs for each table         | 20 by default; you can request more; vector indexes count          | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html                        |
| GSI key attributes          | Up to 4 for the partition key and 4 for the sort key               | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.DesignPattern.MultiAttributeKeys.html |
| LSIs for each table         | 5; only when you create the table                                  | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html                        |
| Item collection with an LSI | 10 GB                                                              | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html                                  |
| Projected attributes        | 100 named attributes across all indexes of a table                 | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html                        |
| GSI projection              | Cannot change after you create the index; a change needs a new GSI | https://aws.amazon.com/blogs/database/evolve-your-amazon-dynamodb-tables-data-model/                       |

## Throughput

| Limit                    | Value                                                                                     | Source                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| One partition            | 3,000 read units and 1,000 write units each second                                        | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html |
| On-demand table          | 40,000 read and 40,000 write request units each second by default; you can request more   | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html           |
| New on-demand table      | 4,000 writes and 12,000 reads each second at once; up to double the previous peak at once | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode.html |
| Change to on-demand mode | 4 times in a rolling 24 hours                                                             | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/capacity-mode.html           |
| Provisioned decreases    | 4 at the start of a UTC day, then 1 each hour, up to 27 a day                             | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ServiceQuotas.html           |
| Prices                   | See the pricing page; they differ by Region                                               | https://aws.amazon.com/dynamodb/pricing/                                                      |

## Expiry, streams and storage

| Limit                                     | Value                                                                                                 | Source                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| TTL attribute                             | A Number in epoch seconds; other types are ignored                                                    | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html                            |
| TTL deletion                              | Usually within a few days of the time; reads return the item until then; deletion uses no write units | Same page                                                                                            |
| TTL time more than five years in the past | Ignored                                                                                               | Same page                                                                                            |
| Stream records                            | Kept for 24 hours                                                                                     | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html                        |
| Standard-IA table class                   | About 60% lower storage price, higher read and write prices; applies to the table and its indexes     | https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithTables.tableclasses.html |

## Changes that affect older designs

Designs and books from before these dates can contain advice that these changes replace.

| Date    | Change                                                                          | Effect on a design                                           |
| ------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 2020-11 | Export to S3 from point-in-time recovery, with no table capacity                | A Scan is not necessary to export a table                    |
| 2021-11 | Lambda event filters on DynamoDB streams                                        | One stream for many entity types costs less                  |
| 2021-12 | Standard-IA table class                                                         | A reason to keep cold data in its own table                  |
| 2022-08 | Import from S3 into a new table                                                 | A key schema change can use export and import                |
| 2022-09 | Transactions of 100 items, from 25 (and from 10 in some older texts)            | Larger multi-item writes fit in one transaction              |
| 2023-06 | `ReturnValuesOnConditionCheckFailure` on single writes                          | A failed condition returns the item, with no second read     |
| 2024-11 | On-demand price cut by half; on-demand is the default                           | Use on-demand unless the traffic is steady                   |
| 2025-06 | Strong consistency across Regions for global tables                             | A multi-Region design can read its own writes in each Region |
| 2025-11 | GSI keys of up to 4 + 4 attributes                                              | Fewer concatenated keys and backfills                        |
| 2026-11 | Bulk put of items from S3 into an existing table                                | Faster backfills that replace whole items                    |
| Undated | TTL deletion "within a few days", not "within 48 hours"                         | Check expiry in code                                         |
| Undated | Item collections split across partitions when the table has no LSI              | A large collection is not a size problem without an LSI      |
| Undated | Zero-ETL integrations with Redshift, OpenSearch Service and SageMaker Lakehouse | Analytics need not read the table design                     |
