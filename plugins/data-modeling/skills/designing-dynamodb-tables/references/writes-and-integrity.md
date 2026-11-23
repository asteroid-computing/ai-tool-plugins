# Writes and integrity

Use this file to enforce a unique value, keep a count, write several items together, guard a state change, or make a retry safe.
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
- **Two or more unique values**, for example a username and an email address: keep the entity item keyed by one value. Add a marker item for each other value, for example `PK = EMAIL#<address>`, `SK = EMAIL#<address>`. Write the entity item and the marker items in one transaction, each with `attribute_not_exists(PK)`. If any value is in use, the whole transaction fails.
- **A change of a unique value**: in one transaction, delete the old marker item, put the new marker item with its condition, and update the entity item.

Give a marker item only the attributes that identify its owner.
Do not copy the entity's data to it, because then each update of the entity must be a transaction.

Two entity types that share one name space, for example people and teams that share handles, need one key format for both, so that the key enforces uniqueness across both.

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

## Transactions

`TransactWriteItems` writes up to 100 items as one unit: all writes occur, or none.
It accepts `Put`, `Update`, `Delete` and `ConditionCheck`.
A `ConditionCheck` checks an item that the transaction does not write, for example that a user is an administrator of a team.

Know these limits before a design depends on a transaction:

- Up to 100 actions and 4 MB in total. Two actions cannot use the same item.
- Each item costs two write units, or two read units, and the cost applies when the transaction fails too.
- All items must be in one account and one Region.
- A transaction fails when another transaction writes one of its items at the same time. Retry it.

If an operation can write more than 100 items, such as an order with an unlimited number of lines, it cannot be one transaction.
Limit the number of items, or split the write into steps that can resume.

`BatchWriteItem` is not a transaction.
Each put or delete in a batch succeeds or fails separately, a batch cannot update an item, and it accepts no condition.

## Sequential numbers

Use a sequential number only when users need one, for example ticket number 42 of a project.
Otherwise, use a random or time-sorted identifier.

1. Update the parent item with `SET lastNumber = lastNumber + :one` and `ReturnValues` set to `UPDATED_NEW`.
2. Put the new item with the returned number and `attribute_not_exists(PK)`.

These are two requests.
If the second request fails, the number is not used, so the sequence can have gaps.

## Singleton items

A singleton item has a fixed key, for example `PK = CONFIG`, `SK = CONFIG`.
Use it for state that is global to the application: a setting, a limit on jobs in progress, a short list for a home page.
Keep it small and bounded.
A singleton that each request reads can become a hot key. See [scaling.md](scaling.md).

## Retries and duplicate delivery

SDKs retry failed requests, and queues and streams can deliver a message more than once.
Thus, make each write safe to repeat.

- A put with `attribute_not_exists(PK)` is safe: the repeat fails its condition.
- An update that sets values is safe. An update that adds to a number is not.
- For a count driven by events, write a marker item keyed by the event identifier, in the same transaction as the count update, with `attribute_not_exists(PK)`. A repeated event then fails and changes nothing. Give the marker a TTL longer than the time in which a repeat can arrive.
- `TransactWriteItems` accepts a `ClientRequestToken`. A repeat with the same token in the next 10 minutes does not write again. It does not protect against a repeat after that time.
