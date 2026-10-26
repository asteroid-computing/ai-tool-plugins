# The PR reviewer

The reviewer is a subagent, `.claude/agents/pr-reviewer.md`, that reviews one PR against its issue and the rules, and reports; it never pushes, comments, approves or merges.
Its checks are what keep the repository from drifting back to amendments and citations once the migration is done.
Start from [`templates/pr-reviewer.md`](../templates/pr-reviewer.md), and keep the repository's own checks (its correctness hot spots, privacy, device constraints, the gate, CI) alongside the ones below.

## The checks the reset adds

1. **The brief.**
   Each acceptance criterion is met, the change keeps the issue's Decided section, and it does no more than the issue's scope.
2. **The rules for the paths it changes.**
   The reviewer reads every `.claude/rules/*.md` whose `paths:` match a file in the diff, itself: Claude Code loads a path-scoped rule when a session reads or edits a matching file ([Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)), and a reviewer that reads `gh pr diff` touches no file in the repository.
   The change keeps every such rule, or edits the rule in the same PR and lists the edit as a choice for the owner.
3. **Rules are edited in place.**
   A changed rule states what holds now, with one "Because" sentence and links to issues and PRs; no amendment note, no date in the rule, no "previously", no ADR or decision number.
   A rule whose code the PR removed is deleted.
4. **No new ADR, no amendment.**
   The PR adds no file under the ADR directory and changes no ADR, unless it is the step 7 PR that deletes them.
5. **Comments say what.**
   Every new or changed comment says what the code is or does and cites no issue, PR, ADR, decision or question, and none tells the history.
   A quick pass: `gh pr diff N | grep '^+' | grep -E '\bADR[- ]?[0-9]+|\b[Dd]ecisions? [0-9]+|\(#[0-9]+\)|as amended|\b(used to|no longer|previously)\b'`, then read the diff for what the pattern cannot see.
6. **Decisions in words.**
   Where the session asks the owner for a choice, its hand-back states it with a recommendation; where it claims the owner agreed, the reviewer reports the claim for the orchestrator or the owner to confirm, never as fact.

## While the ADRs still exist

The reviewer also reads the ADR decisions the issue cites, because they still describe what was built in areas with no rules file yet.
Where a rules file covers the area, the rules file wins, and a conflict between the two is a finding for the owner.
For a rules-file PR (step 5) or a comment PR (step 6), the reviewer checks that every reason the PR removes from an ADR or a comment is in a rule's "Because" or was settled by the owner as history in the inventory epic.

After step 7, drop the ADR lines from the reviewer, as part of that PR.
