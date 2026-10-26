---
name: docs-reset
description: This skill should be used when the user asks to migrate a repository to the documentation reset piloted in asteroid-computing/orca, phrased as "/docs-reset", "retire the ADRs", "move the ADRs into .claude/rules", "make the issue the brief", "clean the decision citations out of the comments", or "check this repo still follows the docs reset". Walks the repository, in small reviewable PRs that each stop for the owner, from ADRs and citation-heavy comments to rules files per area, comments that say what the code is, and issues that are the complete brief for a session.
disable-model-invocation: true
---
# Documentation reset

This skill moves a repository to the way of writing things down that AJ piloted in [asteroid-computing/orca](https://github.com/asteroid-computing/orca) on 2026-10-22 and then took into [ajbeck/obby](https://github.com/ajbeck/obby).

The reset exists because ADRs did two jobs at once: they were the history of how things were chosen and the live spec of what holds now.
They grew long append-only amendments, and code comments cited bare decision numbers that linked nowhere, so readers kept asking "but why".

When the reset is done, the repository has:

- **no ADRs**: history stays in git, issues and PRs;
- **rules files**: the rules that apply now, one file per area in `.claude/rules/<area>.md` with `paths:` frontmatter, each rule a statement, one "Because" sentence and links to its issues and PRs, edited in place;
- **comments that say what**: what the code is and what a caller needs, never why it was chosen, its history, or a citation of an issue, PR or decision;
- **the issue as the brief**: each issue holds everything its session needs, from a template, with the owner's answers in its Decided section;
- **an AGENTS.md** that says all of this, lists the few real architecture constraints, and points to the rules files;
- **a PR reviewer** that checks each PR against the brief and the rules, so the repository does not drift back.

## How to run it

- **Small PRs, never one rewrite.**
  Each step below is one PR, or several for the rules files and the comments, made with the repository's own process: its branch names, commit style, gate and hand-back as its AGENTS.md says.
  A PR that both moves rules and rewrites comments cannot be reviewed for loss.
- **Stop for the owner at every decision**, including which ADR decisions are still live.
  Present each decision with a recommendation ("Recommend: … because …"), the reasoning and the pros and cons of each option, then wait.
  Never decide one yourself, and never build on an answer the owner has not given.
  Ask the way the repository's AGENTS.md says a session asks; if it says nothing, ask in the session's closing message.
- **Move information, never drop it.**
  A reason given in an ADR or a comment either becomes a rule's "Because" sentence or is confirmed by the owner as history before the text that held it is removed.
  This fixes the order of the PRs: rules files before comment cleanup, and the ADRs retired last.
- **Check claims at the source**: read the code before calling a rule live, and read the issue or PR before linking it.
- **One sentence per line** in everything this skill writes ([semantic linefeeds](https://rhodesmill.org/brandon/2012/one-sentence-per-line/)), unless the repository's own rule differs.
- **If the repository has an orchestrator** (`.claude/orchestrator.json` and the orchestrator skill), each PR below is an issue on its board written as a brief, and a worker session takes it; this skill then plans and writes those issues.
  Otherwise do the PRs one at a time here, each merged before the next one that depends on it starts.

## Step 0: where the repository stands

Before proposing anything, find out which steps are already done, so that a migrated repository is audited rather than migrated again.

```bash
ls docs/adr docs/decisions doc/adr 2>/dev/null          # ADRs still present?
ls .claude/rules .github/ISSUE_TEMPLATE .claude/agents 2>/dev/null
wc -l AGENTS.md CLAUDE.md 2>/dev/null
git grep -nE '\bADR[- ]?[0-9]+|\b[Dd]ecisions? [0-9]+|\(#[0-9]+\)|as amended' -- ':!docs/adr' | wc -l
```

Then read AGENTS.md (or CLAUDE.md) for where it says decisions, rules and comments are written.
Report the state to the owner as one line per step below: done, partly done (with what is missing), or not started.

- A repository with no ADRs, rules files and a brief template (asteroid-computing/ilttu is one) is **audited**: run the [reviewer's checks](references/pr-reviewer.md) over the repository as it is, and propose PRs only for what fails.
- A repository mid-migration (ajbeck/obby is one: new decisions already go in issues, the ADRs still describe what was built) continues from the first step not done.
- A repository with ADRs and nothing else starts at step 1.

## The steps

Read each step's reference file before doing that step; the templates are in `templates/`, next to this file.

| Step               | PR                                                                                                                                                                                       | Reference                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1. Stop the drift  | AGENTS.md: new decisions go in the issue's Decided section and `.claude/rules`, never an ADR; new comments cite no issue, PR or decision; where a rules file exists it wins over an ADR. | [references/where-decisions-go.md](references/where-decisions-go.md), [references/agents-md.md](references/agents-md.md) |
| 2. The reviewer    | `.claude/agents/pr-reviewer.md` checks acceptance criteria, the Decided section, the rules files for the changed paths, and the comment rule.                                            | [references/pr-reviewer.md](references/pr-reviewer.md)                                                                   |
| 3. The brief       | `.github/ISSUE_TEMPLATE/brief.md`, and AGENTS.md's "Working in a session" says the issue is the brief.                                                                                   | [references/issue-brief.md](references/issue-brief.md)                                                                   |
| 4. The inventory   | No PR: an epic issue that classifies every ADR decision as live, history or superseded, for the owner to settle.                                                                         | [references/inventory.md](references/inventory.md)                                                                       |
| 5. Rules files     | One PR per area: the live rules from the inventory, as `.claude/rules/<area>.md`.                                                                                                        | [references/rules-files.md](references/rules-files.md)                                                                   |
| 6. Comments        | One PR per package or area: comments say what, with no citations or history; only comment lines change.                                                                                  | [references/comments.md](references/comments.md)                                                                         |
| 7. Retire the ADRs | Delete the ADR directory; AGENTS.md gets its short architecture list and its pointers to the rules files, and drops every mention of ADRs.                                               | [references/agents-md.md](references/agents-md.md)                                                                       |

Steps 1 to 3 change only how new work is written, so they can start at once and stop new citations and amendments while the rest is done.
Steps 1 and 2 may share a PR if the owner prefers; obby did them as [#401](https://github.com/ajbeck/obby/pull/401) and [#418](https://github.com/ajbeck/obby/pull/418).
Step 4's answers are needed before step 5, and every step 5 PR for an area merges before that area's step 6 PR, because the comment PR removes reasons that the rules file must already hold.
Step 7 comes last, because the reviewers of steps 5 and 6 read the ADRs to check that nothing was lost.

## Done

The reset is done when:

- no ADR directory exists, and AGENTS.md says "There are no ADRs";
- every live rule from the inventory is in a rules file, and every superseded or historical decision was confirmed as such by the owner;
- `git grep` for citations in comments finds only external facts (for example `golang/go#22682`) and words that are not citations;
- every open issue that a session will take follows the brief template;
- AGENTS.md is under 200 lines, the size Claude Code's documentation recommends for an instruction file ([How Claude remembers your project](https://code.claude.com/docs/en/memory)).

## The pilot, as worked examples

- [asteroid-computing/orca#4](https://github.com/asteroid-computing/orca/pull/4): AGENTS.md, five rules files, the brief template and the reviewer in one docs PR, for a new repository with no code history of its own.
- [asteroid-computing/orca#12](https://github.com/asteroid-computing/orca/pull/12): every comment in 54 files made to say what, with no code changed.
- [ajbeck/obby#401](https://github.com/ajbeck/obby/pull/401): an existing repository's AGENTS.md sends new decisions to issues and rules files, while its ADRs still describe what was built.
- [ajbeck/obby#418](https://github.com/ajbeck/obby/pull/418): the reviewer checks acceptance criteria, Decided sections and rules files, and that new comments cite no issue or decision.
- orca's [AGENTS.md](https://github.com/asteroid-computing/orca/blob/main/AGENTS.md), [rules](https://github.com/asteroid-computing/orca/tree/main/.claude/rules), [brief template](https://github.com/asteroid-computing/orca/blob/main/.github/ISSUE_TEMPLATE/brief.md) and [reviewer](https://github.com/asteroid-computing/orca/blob/main/.claude/agents/pr-reviewer.md) are the finished shape.
