# Scaling

Use this file for a key with high traffic, an item type with no natural partition key, or a capacity mode.
DynamoDB spreads a table over partitions by the hash of the partition key.
Each partition has a fixed limit on reads and writes per second.
Thus, the traffic on one partition key value has a limit, and the design must stay below it.

## Contents

- The limit on one key
- Partition key choice
- Write sharding
- Hot reads
- All items of one type
- Capacity modes

## The limit on one key

One partition serves at most 3,000 read units and 1,000 write units each second, in both capacity modes.
One item always stays on one partition, so the limit applies in full to each item.
When the table has no LSI, DynamoDB can split a busy item collection across partitions by sort key.
It cannot do this when the writes go to a sort key that always increases or always decreases, such as a time. Then one key value keeps the limit of one partition.
Item size counts. A strongly consistent read of a 20 KB item costs 5 read units. Thus, one item can serve about 600 such reads each second.
A write costs one write unit for each 1 KB, rounded up, and a write in a transaction costs double. Thus, a 2 KB item in a transaction costs 4 write units.
Count these units, not requests, when you compare a key with the limit.
Check the current values in [limits.md](limits.md).

Adaptive capacity moves capacity to a busy partition, and can put a busy item on its own partition.
It does not raise the limit of one partition.

## Partition key choice

For each access pattern, estimate the peak requests each second on one partition key value.
If the peak can approach the limit, change the design before you write code.

- Use a value with many distinct values and even traffic, for example a user or a device.
- Do not use a constant, a date, a status or a type as a partition key for a high write rate.
- A partition key for a time series, such as one sensor, receives all its writes. Check the write rate of the busiest one.

## Write sharding

When one logical key needs more writes than one partition serves, split it over N partition key values.
Each shard must have its own partition key value. N sort key values under one partition key are not shards.

- **Random suffix**: append a number from 1 to N to the key, for example `VOTES#<pollId>#7`. A read must query all N keys and combine the results. Use this for counts and totals.
- **Calculated suffix**: append `hash(<itemId>) mod N`. A read of one known item calculates its key and needs one request. A read of all items still queries all N keys.
- **Time bucket**: put a period in the partition key, for example `EVENTS#2026-03-14`. Choose the period from the write rate, so that each bucket stays below the limit. A "latest N" read starts at the current bucket and goes back one bucket at a time. Set a maximum number of buckets for one read. Then a quiet period cannot make the read continue for a long time.

Choose N from the peak rate, with a margin.
Let readers handle a larger N than the writers use, so that you can increase N later.
Store N in configuration, not in each request.

## Hot reads

When many clients read the same item, for example a list of today's top scores:

- Cache the result in the application, or use DAX.
- Or store N copies of the item with keys `TOPSCORES#1` to `TOPSCORES#N`, and read one copy at random. Write all copies when the data changes, for example from a stream consumer.

## All items of one type

An access pattern such as "every member" has no natural partition key.

- Do not put all items of the type under one constant partition key when the type has many writes. That key becomes a hot partition and a large collection.
- For a rare job, use a sparse GSI that holds only that type, and scan the GSI. See [filtering.md](filtering.md).
- For a small and bounded set, such as 50 categories, use one item that holds the list. Or use one collection under a constant key.
- For a list in order, use time buckets as above.

## Capacity modes

Use on-demand capacity by default.
AWS recommends it for most workloads, and its price fell by half in November 2024.
On-demand mode has a default limit for each table, and you can set a maximum to control cost.

Use provisioned capacity with auto scaling when the traffic is steady and predictable and the cost difference matters.
You can change a table from provisioned to on-demand mode up to four times in 24 hours.

For a planned peak, such as a product launch, raise the warm throughput of the table and its GSIs before the event.
A new on-demand table can serve a fixed rate at once, and DynamoDB scales it as traffic grows. Check the current numbers in [limits.md](limits.md).

<details>
<summary>Older pattern: start on-demand, then move to provisioned capacity to save cost</summary>

Guidance from before November 2024, including The DynamoDB Book (2020), treated on-demand capacity as more expensive for each request.
It advised moving a table to provisioned capacity once the traffic was known.
After the November 2024 price change, AWS states that on-demand capacity costs less for most workloads.
Source: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/capacity-mode.html

</details>
