# Code comments

Comments say what the code is and what its reader needs.
They never say why the project chose it, who decided it, or what it used to be, and they never cite an issue, a PR, an ADR or a decision number.
That reasoning lives in the rules files' "Because" sentences, which link to the issues and PRs.

## What the sources say

Read these at the source before cleaning a repository's comments; the quotes below were checked on 2026-10-26.

- **Go Doc Comments**, [go.dev/doc/comment](https://go.dev/doc/comment):
  - a package comment introduces the package and "provides information relevant to the package as a whole" ([#package](https://go.dev/doc/comment#package));
  - "A type's doc comment should explain what each instance of that type represents or provides", and states any concurrency guarantee stronger than single-goroutine use ([#type](https://go.dev/doc/comment#type));
  - "A function's doc comment should explain what the function returns or, for functions called for side effects, what it does", with its special cases, "detailing what the caller needs to know" ([#func](https://go.dev/doc/comment#func));
  - "Doc comments should not explain internal details such as the algorithm used in the current implementation. Those are best left to comments inside the function body." ([#func](https://go.dev/doc/comment#func)).
- **Google Go Style Guide, Decisions**, [Doc comments](https://google.github.io/styleguide/go/decisions#doc-comments): doc comments "should be written for anyone using the package", as full sentences that begin with the name of the thing described.
- **Google Go Style Guide, Best Practices**, [Documentation](https://google.github.io/styleguide/go/best-practices#documentation): document the error-prone or non-obvious parameters, the context and concurrency behaviour that differs from the default, cleanup the caller must do, and the errors a caller can handle; do not restate what the signature already says.
- **Google Engineering Practices**, [What to look for in a code review: Comments](https://google.github.io/eng-practices/review/reviewer/looking-for.html#comments): "Usually comments are useful when they explain why some code exists, and should not be explaining what some code is doing", and "comments are for information that the code itself can't possibly contain, like the reasoning behind a decision"; it adds that documentation of classes, modules and functions "should instead express the purpose of a piece of code, how it should be used, and how it behaves when used".

## How this skill reads them together

The Google review guide's "why" and this skill's "never why" are about different things, so do not pretend the guide agrees word for word.

- **Doc comments** (package, type, function, field) follow go.dev/doc/comment and the review guide's own exception for documentation: what it is, how to use it, how it behaves.
  This is most of the comment text in a Go repository.
- **A comment in a function body** may say what a step that is not obvious from the code guards against, written as a fact about the code: "the check is made under the same mutex, so two writers that race cannot both ask".
  That is the review guide's "why some code exists" at the level of the code, and it stays.
  If the code could be made clear enough to need no comment, the guide prefers that, but that is a code change and outside a comment PR.
- **The reasoning behind a project decision** (why this design, which options were rejected, who chose it and when) is the review guide's "reasoning behind a decision".
  This reset moves it out of comments into the rule's "Because" sentence, with links to the issue and PR, because a comment cannot link to a discussion that stays current, and decision numbers in comments linked nowhere.
- **History** (what the code used to do, when it changed, what was amended) is in git, never in a comment.

## What to remove, and what stays

Remove:

- citations: `(ADR 0004, decision 2)`, `(#285)`, `decision 10`, `see issue 42`, issue and PR URLs, `as amended 2026-10-21`, question or ticket IDs, `(AJ, 2026-10-15)`;
- history: "used to", "no longer", "was changed to", "now that", "since the migration", "previously", "for now", "the old …";
- provenance: who asked for it, who decided it, which session or PR wrote it;
- a sentence that only gives the project's reason ("because the owner wanted it on the LAN"): turn it into what the code does, or drop it if the rule's "Because" already says it.

Keep:

- what the code is and does, its special cases, units, error values, concurrency guarantees and cleanup duties;
- a body comment that says what a non-obvious step guards against, stated as a fact about the code;
- an external fact the code depends on, named so a reader can open it: a Go issue such as `golang/go#22682`, an RFC section, a vendor's documented limit;
- words that are not citations: a UI label "decision", a test fixture's numbers, an event name.

Before and after, from [asteroid-computing/orca#12](https://github.com/asteroid-computing/orca/pull/12):

```diff
-// Package eventlog keeps what Orca cannot rebuild: an append-only event log, compacted into a snapshot, and the state replayed from them (ADR 0004, decision 6).
+// Package eventlog keeps what Orca cannot rebuild: an append-only event log, compacted into a snapshot, and the state replayed from them.
-// A Stop hook's "Waiting on AJ" fallback ([SourceFallback]) is asked only if its session has no question open at all, under the same mutex, for the same reason (#260).
+// A Stop hook's "Waiting on AJ" fallback ([SourceFallback]) is asked only if its session has no question open at all, under the same mutex, for the same reason.
-	// Repo is the absolute path of obby's repository; only events from sessions working in it or a directory inside it are kept (decision 10).
+	// Repo is the absolute path of obby's repository; only events from sessions working in it or a directory inside it are kept.
```

The reasons stayed ("under the same mutex, for the same reason"); the citations went.

## Cleaning a repository's comments

Do this only after the area's rules file has merged (step 5), because a reason a comment loses must already be in the rule's "Because" or be confirmed by the owner as history.

1. **Find them.**
   ```bash
   git grep -nE '\bADR[- ]?[0-9]+|\b[Dd]ecisions? [0-9]+|\(#[0-9]+\)|#[0-9]{2,}\b|issues/[0-9]+|pull/[0-9]+|as amended|\b(used to|no longer|previously|for now)\b' -- ':!docs/adr' ':!CHANGELOG.md' ':!.claude/rules'
   ```
   Then read each match in context: the pattern finds candidates, and only a reader can tell a citation from a fixture.
   Comment syntax differs by language (`//`, `#`, `/* */`, `{{/* */}}` in Go templates, `<!-- -->`), so check templates, CSS, JS, shell and YAML as well as the main language.
2. **Slice it.** One PR per package or area, small enough for a reviewer to read every line; orca's single 54-file PR worked only because the repository was new and every comment was fresh.
   Each PR closes its own brief issue from the inventory epic.
3. **Rewrite, don't just delete.**
   Remove the citation and keep the sentence when it still says what the code does.
   When a sentence only gave a history or a project reason, state the behaviour instead, or drop it if nothing is lost.
   When a comment names a thing indirectly ("obby's timeouts"), name it directly ("the server's ReadHeaderTimeout").
4. **Change words only.**
   No code, no strings, no test data, no renames, and no rewrapping of lines the PR does not otherwise change; follow the repository's own line rule for the lines it does change.
   A rewrapped paragraph hides the one word that changed.
5. **Verify.**
   - The repository's gate passes (for a walle repository, `./walle check`).
   - Every changed line is a comment: read `git diff` with that question alone, or for Go, check that `gofmt -l` is clean and the build and tests pass with no other change.
   - Re-run the grep, and list in the PR body each remaining match and why it stays, as orca#12 did: "the remaining matches are the UI word 'decision', test-data numbers and `golang/go#22682`".
   - Say what was not verified, for example a reader's pass over every rewritten package doc.

## Keeping it clean

- AGENTS.md says the rule in its rules for all work (see [agents-md.md](agents-md.md)), because a reviewer's check alone came too late in obby: sessions kept adding citations to new comments while AGENTS.md did not forbid them.
- The reviewer checks every new or changed comment in each PR (see [pr-reviewer.md](pr-reviewer.md)).
