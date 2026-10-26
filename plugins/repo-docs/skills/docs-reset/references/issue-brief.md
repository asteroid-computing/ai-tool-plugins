# The issue as the brief

A session is given the issue number and nothing else, so the issue holds everything the work needs that AGENTS.md and the rules files do not.
The test: a session that has never seen the conversation that planned the work can do it from the issue alone.

## The template

Add [`templates/brief.md`](../templates/brief.md) as `.github/ISSUE_TEMPLATE/brief.md`, the one copy of the brief's sections in the repository:

- **Outcome**: what is true when the work is done, in one or two sentences.
- **Context**: links only: the rules files and headings it touches, the design boards, and the issues and PRs it builds on.
- **Scope**: In (the files, packages or behaviour it changes) and Out (what it does not touch, with the issue that has it).
- **Acceptance criteria**: checkboxes, each observable by a reviewer: a test, a command's output, a page in the browser.
- **Decided**: what the owner decided for this issue, in words, with the date (owner, YYYY-MM-DD).
- **Open for AJ**: each choice the issue leaves open, for the session to present with a recommendation.
  The heading names the repository's owner; orca and ilttu say "AJ", and a repository with another owner uses that owner's name.
- **Ships as**: `type(scope): subject`, the PR title, which a squash merge makes the commit subject; drop the section in a repository that does not squash-merge with Conventional Commit titles.

Leave a section out only when it has nothing to say.
Write links as links: an issue or PR as `owner/repo#N` or a URL, a rule by its file and heading, a design board by its URL and page name.
Never cite something a reader cannot open, such as a question ID, a session's notes folder or a decision number.
Branch names, the gate and the hand-back are AGENTS.md's rules, so a brief does not repeat them.

## Readiness

- An issue is ready when the test above passes and everything it builds on has merged.
- Readiness is the project board's **Ready** status, set only then; a session starts only on a Ready issue.
- When something it builds on merges, or something it needs is learnt, edit the issue before its session starts.
  When something is learnt while its session works, edit the issue, then tell the session "#N updated: …" with what changed.
- If the repository has no project board, ask the owner how readiness is marked; do not invent a label or a field.

## The session prompt

Every session that takes an issue is started with this prompt, and nothing else:

> Take #N in owner/name (URL). The issue body is the brief, and AGENTS.md's 'Working in a session' binds you.

Anything else the session should know goes into the issue first.

## AGENTS.md's "Working in a session"

Add or change these lines, adapted to the repository, in the PR that adds the template:

```markdown
- **The issue body is the brief.**
  Read it with `gh issue view N`, with every rule file and design board it links to.
  If the brief is not enough to do the work, ask; do not fill the gap yourself.
- **Scope stays the issue's.**
  Anything found along the way becomes a follow-up issue (`gh issue create --label follow-up`, its body naming the source issue and PR); do not widen the PR.
- **A change to a rule** is proposed in the PR as an edit to its `.claude/rules` file, and listed in the hand-back as a choice for the owner.
```

The rest of that section (the hand-back, who merges, how a question for the owner is asked) is the repository's own and stays as it is.

## Existing issues

Open issues written before the template are rewritten as briefs only when they come up to be worked on, not all at once.
An issue that cites "decision 14" gets that decision in words in its Context or Decided section, or a link to the rules file and heading that now holds it.
