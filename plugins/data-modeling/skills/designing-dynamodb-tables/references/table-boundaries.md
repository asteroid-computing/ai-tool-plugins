# Table boundaries

Use this file for step 3: decide which entities share a table.

## The rule

Put entities in the same table when an access pattern reads them together.
Put entities in separate tables when no access pattern reads them together, or when their operational needs differ.

Keep the number of tables small, because each table adds alarms, permissions and capacity settings.
But do not force unrelated entities into one table. One table has one backup policy, one encryption key, one table class and one stream.

## Decision steps

1. Group the entities that an access pattern reads in one request. For example, a venue and its upcoming events on one page.
   Each group must share a table, because only one item collection can return several entity types in one request.
2. Join groups that a transaction writes together, if the transaction must be in one table for a simple design.
   A transaction can include items from several tables in the same account and Region, so this is a preference, not a requirement.
3. Separate a group into its own table when one of these conditions is true:
   - It needs a different backup or restore policy. Backups and point-in-time restore apply to the whole table.
   - It needs a different encryption key, for example one key for each tenant.
   - It is large, cold data, such as an archive. The Standard-IA table class can then cut its storage cost, and the class applies to the whole table and its indexes.
   - It is high-volume time series data with a short life, such as telemetry. A separate table, often one table for each period, makes deletion and capacity simple.
   - Its stream consumers are different. One table has one stream for all its entities. Lambda event filters remove most of this cost, so use this reason only when the consumers are very different.
   - Its access is resolved one entity at a time, for example by GraphQL resolvers. A shared table then gives no read benefit.
4. Write the result in the entity chart, in the `Table` column, and write the reason for each separate table in the answer.

## Inside a shared table

When a table holds more than one entity type, apply these rules.

- Name the base table keys `PK` and `SK`, because different entity types put different values in them.
- Start each key value with the entity type, for example `VENUE#<venueId>`. This prevents two entity types from writing the same key, and makes each item easy to identify.
- Give each item a `Type` attribute with its entity name. Migrations and exports use it to find items of one type.
- Use the strategies in [relationships.md](relationships.md) to put related items in one item collection.

When a table holds one entity type, use descriptive key names, for example `patientId`.

## How the guidance changed

AWS now presents single-table design and multiple-table design as two valid starting points.
The choice depends on the access patterns that read entities together, and on the operational needs above.
The DynamoDB developer guide page "Data modeling foundations" describes both:
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-foundations.html

<details>
<summary>Older pattern: one table for each application, always</summary>

Guidance from about 2019 to 2022, including The DynamoDB Book (2020), made one table for each application or service the default.
It accepted a separate table only for exceptions, for example GraphQL or an early product whose access patterns change often.
The main reason, one request for several entity types, is still correct, and step 1 above keeps it.
Other reasons for one table are weaker now.
On-demand capacity removed most of the capacity sharing benefit.
Zero-ETL integrations and export to S3 reduce the analytics cost of a complex table.
Table classes and per-table encryption keys added reasons to separate tables.

</details>
