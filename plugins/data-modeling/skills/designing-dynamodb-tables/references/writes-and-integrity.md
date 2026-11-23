# Writes and integrity

Use this file for unique values, counts, writes of several items together, state changes and safe retries.
DynamoDB has no foreign keys, no unique constraints except the primary key, and no triggers in the write path.
Thus, the write itself must carry each rule, as a condition expression or a transaction.

## Contents

- Condition expressions
- Unique values
- State changes
- Counts
- Transactions
- Sequential numbers
- Singleton items
- Retries and duplicate delivery

## Condition expressions

A condition expression makes DynamoDB check the current item before a write.
If the check fails, DynamoDB does not write, and returns `ConditionalCheckFailedException`.
Use a condition, not a read before the write, because another request can change the item between the read and the write.

- **Create only**: `attribute_not_exists(PK)` on a put. Without it, a put silently replaces an item with the same key.
- **Update only an existing item**: `attribute_exists(PK)` on an update. Without it, an update creates a new item.
- **A rule on a value**: for example `balance >= :amount` before a debit.

Set `ReturnValuesOnConditionCheckFailure` to `ALL_OLD` to get the current item when the check fails, with no second read.

## Unique values

DynamoDB enforces uniqueness only on the primary key of the base table.
A GSI cannot enforce it.

- **One unique value**: put it in the primary key, and create the item with `attribute_not_exists(PK)`.
- **Two or more unique values**, for example a member handle and a phone number: keep the entity item keyed by one value. Add a marker item for each other value, for example `PK = PHONE#<number>`, `SK = PHONE#<number>`. Write the entity item and the marker items in one transaction, each with `attribute_not_exists(PK)`. If any value is in use, the whole transaction fails.
- **A change of a unique value**: in one transaction, delete the old marker item, put the new marker item with its condition, and update the entity item.

Give a marker item only the attributes that identify its owner.
Do not copy the entity's data to it, because then each update of the entity must be a transaction.

Two entity types can share one name space, for example people and teams that share handles. Give them one key format, so that the key enforces uniqueness across both.

## State changes

When a write moves an entity from one state to another, put the expected current state in the condition.
For example, a booking moves from `HELD` to `CONFIRMED` with the condition `#status = :held`.
Without this, two requests that read the same state can both write, and the later write can move the entity backwards.

For optimistic locking of a whole item, store a `version` number.
Each write adds one to it, with the condition `version = :readVersion`.

## Counts

Do not count related items with a Query on each read, because the read cost grows with the count.
Store the count as an attribute on the parent item.

To add a related item and its count together, use one transaction:

1. Put the related item with `attribute_not_exists(PK)`. For example, the item that records one user's vote on one poll.
2. Update the parent with `SET voteCount = voteCount + :one`, or `ADD voteCount :one`, with `attribute_exists(PK)`.

If the user already voted, the put fails, the transaction fails, and the count does not change.
Remove a related item and lower the count in the same way.

An update that adds to a number is not idempotent.
A retry of the same update adds again.
The condition on the related item is what makes the transaction safe to retry.

`ADD` takes one value.
When a user edits a rating, the sum changes by a difference. Calculate the difference in the application, and use `SET ratingSum = ratingSum + :delta`.

Change a count only with `UpdateItem`.
A `PutItem` of the whole parent item replaces the count with the value that the application read earlier.
If the parent item is often saved whole, keep the counts in a separate item, for example `SK = STATS`.

## Transactions

`TransactWriteItems` writes up to 100 items as one unit: all writes occur, or none.
It accepts `Put`, `Update`, `Delete` and `ConditionCheck`.
A `ConditionCheck` checks an item that the transaction does not write, for example that a user is an administrator of a team.

Know these limits before a design depends on a transaction:

- Up to 100 actions and 4 MB in total. Two actions cannot use the same item.
- Each item costs two write units, or two read units, and the cost applies when the transaction fails too.
- All items must be in one account and one Region.
- A transaction fails with `TransactionCanceledException` when another transaction writes one of its items at the same time. Its `CancellationReasons` show the conflict. Retry a conflict with backoff in the application, and test that the code does it.
- Many transactions on one item at the same time fail often. A count that many requests change each second needs the sharding in [scaling.md](scaling.md), not a single item.

An operation that can write more than 100 items cannot be one transaction. An example is a playlist import with no limit on its tracks.
Limit the number of items, or split the write into steps that can resume.

`BatchWriteItem` is not a transaction.
Each put or delete in a batch succeeds or fails separately, a batch cannot update an item, and it accepts no condition.

## Sequential numbers

Use a sequential number only when users need one, for example invoice number 1042 of a company.
Otherwise, use a random or time-sorted identifier.

1. Update the parent item with `SET lastNumber = lastNumber + :one` and `ReturnValues` set to `UPDATED_NEW`.
2. Put the new item with the returned number and `attribute_not_exists(PK)`.

These are two requests.
If the second request fails, the number is not used, so the sequence can have gaps.

## Singleton items

A singleton item has a fixed key, for example `PK = CONFIG`, `SK = CONFIG`.
Use it for state that is global to the application: a setting, a global rate limit, or the current price list.
Keep it small and bounded.
A singleton that each request reads can become a hot key. See [scaling.md](scaling.md).

## Retries and duplicate delivery

SDKs retry failed requests, and queues and streams can deliver a message more than once.
Thus, make each write safe to repeat.

- A put with `attribute_not_exists(PK)` is safe: the repeat fails its condition.
- An update that sets values is safe. An update that adds to a number is not.
- For a count driven by events, write a marker item keyed by the event identifier. Put it in the same transaction as the count update, with `attribute_not_exists(PK)`. A repeated event then fails and changes nothing. Give the marker a TTL longer than the time in which a repeat can arrive.
- `TransactWriteItems` accepts a `ClientRequestToken`. A repeat with the same token in the next 10 minutes does not write again. It does not protect against a repeat after that time.
- A repeat with the same token must send the same request, or it fails with `IdempotentParameterMismatchException`. Choose each random value, such as a shard number, before the first attempt, and use the same value in each retry.
- Make one token for each user action, not for each user. For example, a token from `pollId` and `viewerId` alone fails when the viewer changes the vote. The second request has a different option.
