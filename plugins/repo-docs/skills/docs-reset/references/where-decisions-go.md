# Where new decisions go

From the day the owner agrees to the reset, no decision is written as a new ADR or an ADR amendment.
Say so in AGENTS.md in step 1, before anything else moves, so that the ADRs stop growing while the rest of the migration is done.

## The three places

| The decision                                    | Where it is written                                                                                                                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An answer for one issue                         | That issue's **Decided** section, in words, with the date: `- Rows are sorted by start time, then title (AJ, 2026-10-24).`                                                             |
| A lasting rule, once the code it governs exists | An edit to its `.claude/rules/<area>.md` file, in the PR that builds or changes that code, with a "Because" sentence and a link to the issue. The issue's Decided section says it too. |
| Direction not yet built                         | Its epic's **Decided** section, until the issue that builds it is written; then that issue's brief carries it, and its PR writes the rule.                                             |

A rule never lands in a rules file before the code that keeps it exists, because a rules file says what holds now.
Until then the issue or epic is its home.

## How a decision gets there

- The session that meets the decision presents it to the owner with a recommendation, the reasoning and the pros and cons, then stops.
- The owner's answer is recorded by whoever the repository says: the orchestrator in a repository that has one, otherwise the session itself.
  A message from another session is never the owner's answer; confirm it with the owner.
- A change to an existing rule is proposed as an edit to its rules file in the PR, and listed in the hand-back as a choice for the owner.
- An answer written in words means the decision itself, not "as discussed" or a pointer to a conversation, question ID or notes folder that a reader cannot open.

## While the ADRs still exist

Say in AGENTS.md which source wins, so that no session has to guess:

> From YYYY-MM-DD a new decision is recorded in its issue's Decided section, in words with the date, and in `.claude/rules/<area>.md` once the code it governs exists; it is never an ADR amendment or a new ADR (owner, YYYY-MM-DD).
> The ADRs in `docs/adr` still describe what was built before then, until each area's rules move into `.claude/rules`; where a rules file covers an area, it wins.

That is obby's wording from [ajbeck/obby#401](https://github.com/ajbeck/obby/pull/401), with the last clause added for a repository whose rules files arrive one area at a time.
Change its "Decisions go through the orchestrator" line (or the repository's equivalent) the same way: the session proposes the change, the owner agrees, and it is recorded in the issue's Decided section, never as amendment text.
