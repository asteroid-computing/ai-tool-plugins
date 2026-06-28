---

name: go-review
description: This skill should be used when the user asks to review, audit, lint, check, or critique existing Go code against the go-rules ruleset — phrased as "/go-review", "review my Go code", "audit this Go package", "lint my Go", "check this Go diff", "is this idiomatic Go", or "are my Go dependencies up to date". Spawns parallel reviewer sub-agents, classifies findings by severity with rule citations, validates dependency freshness, and produces a prioritised report. Use it to EVALUATE existing Go; for WRITING new Go, use the go-rules skill directly.
disable-model-invocation: true
---

# Go Review Skill

This skill reviews existing Go code against the go-rules ruleset. It spawns five parallel reviewer sub-agents, runs deterministic tool checks (`go vet`, dependency freshness), classifies findings by severity, and produces a prioritised report with rule citations. Default scope is files changed vs `main`; `--apply` opts into auto-fixing mechanical and complete-local fixes. Always report-only without `--apply`.

This skill is **explicit-invoke only** (`disable-model-invocation: true` for Claude Code; `agents/openai.yaml` sets `allow_implicit_invocation: false` for Codex). It runs when the user explicitly invokes or selects `go-review`, not automatically. Use it to _evaluate_ existing Go code; to _write_ new Go, use the go-rules skill directly.

**Rules version:** Go 1.26 target.

**Rule sources:** the ruleset is bundled in the sibling `go-rules` skill. Every rule file named in this document (`core.md`, `errors.md`, …) lives under the installed plugin root at `skills/go-rules/references/` (for Claude Code, `${CLAUDE_PLUGIN_ROOT}/skills/go-rules/references/`). Read them from there.

---

## Skill Identity

The skill's value is _grounded review against an explicit ruleset_ — not generic Go opinions. Every code finding cites a rule file and section. If a finding can't be traced to a rule, it doesn't belong in the report. (Dependency-freshness findings are the one exception — they come from deterministic tooling, not the ruleset, and are tagged `[deps]`.)

Three things make this skill different from a generic linter:

1. **Severity classification mapped to action.** Critical = "would I block a PR on this?"; Major = "fix this iteration"; Minor = "fix when touching"; Polish = "modernise"; Strength = "keep doing this." The user reads severity and knows what to do.
2. **Rule citations on every code finding.** Each finding names the rule file and section, so the user can trace the recommendation back to the codified standard, not the agent's intuition.
3. **Code-specific rationale.** Each finding carries a short explanation referencing the actual identifiers in the user's code — not a restatement of the rule.

---

## Invocation

```
/go-tools:go-review [--all|--scope <path|ref>] [--base <ref>] [--apply]
           [--severity <min>] [--no-deps] [--verbose] [--pr-snippet]
```

| Flag           | Default                               | Effect                                                                                               |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `--all`        | off                                   | Whole module. Equivalent to `--scope ./...`. Mutually exclusive with `--scope`.                      |
| `--scope`      | `--diff` (changed vs base)            | Path (`./internal/auth`), ref (`HEAD~5`), or `--diff` explicitly. Disambiguated via `git rev-parse`. |
| `--base`       | `main` → `master` → `origin/HEAD` | Base branch for diff comparison. Uses `git merge-base HEAD <base>`, not tip.                         |
| `--apply`      | off                                   | Run `go fix` first, then auto-apply mechanical and complete-local fixes. See "Apply Mode" below.     |
| `--severity`   | `minor`                               | Minimum severity shown. `critical` / `major` / `minor` / `polish`. Strengths are always shown.       |
| `--no-deps`    | off                                   | Skip the dependency-freshness check (which queries the module proxy over the network).               |
| `--verbose`    | off                                   | Expand the Polish section in full (collapsed to a one-line summary by default).                      |
| `--pr-snippet` | off                                   | Append a copy-pasteable PR description block at the end of the report.                               |

The model interprets the user's natural-language phrasing into these flags. "Review my auth package" → `--scope ./internal/auth`. "Check the whole codebase" → `--all`. "Just the critical stuff" → `--severity critical`. "Skip the dependency check" → `--no-deps`.

---

## The Classification System

This is the bar every sub-agent applies and every finding is ranked against.

| Level             | Criterion                                                                                                                                     | Action expectation                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 🔴 **Critical** | A careful reviewer would block the PR until it's fixed. Plausible failure under inputs the public API accepts or under foreseeable refactors. | Fix before merge / before next release.        |
| 🟠 **Major**    | Code is fragile — works today but will break under foreseeable conditions: concurrency, scale, version bumps, refactors.                    | Fix this iteration.                            |
| 🟡 **Minor**    | Code is unidiomatic — works correctly, won't break, but reads confusingly or fights Go conventions.                                         | Fix when touching the file.                    |
| 🔵 **Polish**   | Older patterns with cleaner Go-1.21+ replacements. Mostly mechanical (`go fix` handles many of them).                                         | Run `go fix ./...` first; consider in passing. |
| ✅ **Strength**  | A pattern worth flagging because the team should keep doing it. Capped at ~5 in the report. Always cited to the relevant rule.                | None — celebrate, optionally cite in PRs.    |

### Calibration: what's Critical vs Major

The bar for Critical is "would I block a PR on this?" — high but pragmatic. Don't require proof of a reachable failure path; do require that the failure is _plausible_ under inputs the public API accepts or foreseeable changes to the call site.

**Examples of Critical:**

- `math/rand` used in a function whose name or surrounding code suggests security context (`Token`, `Session`, `auth`, `password`, `secret`, `key`).
- Goroutine spawned with no exit path under cancellation in production code.
- `nil` map write in a code path the public API can reach.
- `panic` in library code that escapes the package boundary.
- Returning a concrete error type from a function whose signature says `error` (the interface-vs-typed-nil bug).
- Copied `sync.Mutex` / `sync.WaitGroup` / `bytes.Buffer` (`go vet` catches most of these; we still report them).
- A dependency with a known vulnerability (`govulncheck`) reachable from the code under review. (Tagged `[deps]` at Critical severity, but rendered in the Dependencies section — not the code-Critical list. See Report Format.)

**Examples that are NOT Critical (these are Major or below):**

- `math/rand` in a clearly-non-security context (a randomised retry jitter, test data generation).
- A theoretical race the current code structure prevents.
- A `Get` prefix on a getter — confusing, not broken.
- An older pattern (`interface{}`, manual `min`/`max`) — that's Polish.
- A dependency a patch or minor version behind with no known CVE — that's Polish.

When ambiguous, the agent flags the higher severity and explains the assumption: _"Critical IF this path is security-relevant; please verify. Marked Critical because the surrounding function is named `generateUserKey`."_

---

## Sub-Agent Decomposition

Five focus areas, dispatched in parallel using the host's sub-agent mechanism (Claude Code `Agent` calls with `subagent_type: "general-purpose"`; Codex multi-agent tools when available). Each agent loads a subset of rule files from the sibling `go-rules/references/` directory but only reports issues within its focus area.

| Agent                    | Loads                                                   | Focus                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `correctness-reviewer`   | `core.md`, `errors.md`, `concurrency.md`                | Runtime bugs, panics, leaks, races, security, nil-deref hazards, error-handling correctness. Issues that could cause production failures.                      |
| `api-design-reviewer`    | `types.md`, `functions.md`, `naming.md`, `imports.md`   | Public surface design: receiver kinds, exported-vs-unexported, package boundaries, repetition, option-struct vs variadic, Input/Result patterns.               |
| `idiom-reviewer`         | `naming.md`, `control-flow.md`, `commentary.md`         | Idiomatic Go: naming, control-flow shape, doc comments on exported names, formatting verbs, generic placeholder names. Code that works but reads non-Go-ishly. |
| `modernisation-reviewer` | `core.md`, `control-flow.md`, `errors.md`, `testing.md` | Older patterns with cleaner Go-1.21+ replacements: `min`/`max`/`clear`, `any`, integer range, iterators, `errors.AsType`, deprecated APIs.                     |
| `test-quality-reviewer`  | `testing.md`, `naming.md`                               | Test correctness: change-detector tests, assertion-library use, missing `t.Helper()`, missing test context, table-test naming, test-double naming.             |

Rule files are _shared_ across agents (e.g. `core.md` appears in three agents' lists). Each agent's _focus prompt_ constrains what it reports — `correctness-reviewer` reads `core.md` looking for runtime hazards; `idiom-reviewer` reads it for naming/format. The focus prompt is what enforces exclusivity; the rule file overlap is intentional.

**Dependency freshness is _not_ a sub-agent.** It is a deterministic main-turn check (workflow step 5) — module versions come from `go list -m -u all` and `govulncheck`, which are authoritative; an LLM adds nothing to "what is the latest version." The agents above review _code_; the deps check reviews _go.mod_.

---

## Main-Turn Workflow

The skill executes this sequence in the main turn:

````
1. Resolve scope
   - Parse user flags. Disambiguate --scope path-vs-ref via `git rev-parse --verify`.
   - If on the base branch with no --scope override: error with suggestion.
   - Run `git diff --name-only $(git merge-base HEAD <base>)..HEAD` (or
     enumerate files for --all / --scope <path>).
   - Identify the union of packages those files belong to.
   - List every .go file in those packages (including pre-existing files).

2. Apply scope guards
   - Skip files matching the generated-code heuristic (`// Code generated by`
     in the first 3 lines).
   - If file count > 100, ask for confirmation: "Resolved scope is N files
     in M packages (~estimated time). Continue? [y/N/narrow]"
   - Tag each file [NEW] (touched by current diff) or [PRE-EXISTING] (in scope
     but not touched).

3. Per-package compile filter
   - For each package in scope, run `go build ./<pkg>`.
   - Skip packages that fail to compile; remember them for the report's
     "not reviewed: compile errors" footer.

4. Run `go vet ./<pkg-list>...`
   - Parse output into pre-classified Critical findings tagged [vet].
   - These will go through the same dedupe/cluster pipeline as agent findings.

5. Dependency freshness check (skip if --no-deps or no go.mod in the module)
   - Run `go list -m -u all`. Each line with a parenthesised "[newer]"
     version (e.g. `example.com/x v1.2.0 [v1.4.0]`) is an outdated module.
   - If `govulncheck` is on PATH, run `govulncheck ./...`; each reported
     vulnerability reachable from the code is a Critical [deps] finding.
   - Read the `go` directive from go.mod; if it trails the latest stable Go
     release, emit one informational [deps] finding. (This is distinct from the
     version-skew note in step 11: this one fires when the codebase is BEHIND
     the latest Go release; step 11 fires when it is AHEAD of the rules' target.)
   - Classify [deps] findings:
       known vulnerability (govulncheck) -> Critical (fix_kind: design)
       >= 1 major version behind         -> Major   (fix_kind: design)
       minor/patch behind                -> Polish  (fix_kind: mechanical,
                                                      fix: `go get -u <module>`)
   - These flow through the same dedupe/report pipeline as [vet] findings and
     are summarised in a dedicated Dependencies section of the report.
   - Network note: this step queries the module proxy. If it is unreachable,
     do NOT fail the review — record "dependency freshness: not checked
     (module proxy unreachable)" in the coverage notes and continue.

6. (--apply only) Run `go fix ./<pkg-list>...`
   - Pre-applies Polish modernisations. Reduces noise from sub-agents.

7. Detect coverage notes
   - Scan files for protobuf (`google.golang.org/grpc` import), cgo
     (`import "C"`), and non-default build tags. Collect transparency notes
     for the report.

8. Read all rule files in parallel
   - From the sibling `go-rules/references/` directory under the installed plugin root. The union
     across all five agents — typically all 10 rule files, since every file
     is loaded by at least one agent.
   - If these files are unreadable, abort before dispatch (see Failure Modes:
     "Ruleset not found").

9. Dispatch the five sub-agents in parallel
   - Use the host's parallel sub-agent facility. In Claude Code, send a single
     message containing five `Agent` tool calls with `subagent_type:
     "general-purpose"`. In Codex, use the available multi-agent tools with the
     same five focus prompts. Each agent gets the prompt template (below) with its
     focus, its rules inlined, and the file list with origin tags.

10. Aggregate findings
    - Collect JSON from each agent (extract last fenced ```json block).
    - Merge with go-vet and dependency findings.
    - Verify each CODE finding's snippet appears within ±2 lines of the cited
      line (whitespace-tolerant). Drop unverified; track count. (Deps findings
      have no code snippet and skip this check.)
    - Deduplicate on (file, line, rule_section); union the rationales/suggestions.
    - Cluster findings by file within each severity section.

11. Compute version-skew note
    - Read `go` directive from go.mod.
    - If go.mod version > rules version + 1: add a one-line warning to the
      report.

12. (--apply only) Apply qualifying fixes
    - Findings with severity in (critical, polish) AND fix_kind == "mechanical":
      apply.
    - Findings with severity in (critical, polish) AND fix_kind == "local" AND
      complete suggestion: apply.
    - All others: leave for report. (Deps findings are fix_kind design or a
      `go get -u` command; the mechanical ones may be applied, then run
      `go mod tidy`.)
    - After applying: run `go vet ./...` and `go build ./...`. If either fails,
      surface the failure and recommend `git restore`.
    - Annotate findings in the report: [applied] / [skipped: design].

13. Render the report
    - Strengths first (top-of-report, capped at 5).
    - If scope > 3 packages: package index (severity-weighted).
    - Severity sections, file-clustered.
    - Dependencies section (outdated modules + govulncheck result).
    - Coverage notes, version-skew note, dropped-finding count, footer.
    - If --pr-snippet: append copy-pasteable PR description block.

14. Print report to the conversation. No files written.
````

---

## Sub-Agent Prompt Template

Each of the five `Agent` calls receives a prompt built from this template:

````
You are reviewing Go code against the go-rules ruleset (Go 1.26 target).

# Your Focus

<focus prompt for this agent — see Sub-Agent Decomposition above>

Other agents cover the other focus areas; do NOT report issues outside your focus,
even if you notice them.

# Rule Content

The rules below are inlined verbatim. Cite them by file and section in every finding.

## File: <rule-file-1>.md
<verbatim content>

## File: <rule-file-2>.md
<verbatim content>

(...one section per rule file the focus loads...)

# Files to Review

For each file:
- Read it with the Read tool. Line numbers in your findings MUST come from the
  cat -n output the Read tool produces.
- Findings can be on lines that pre-date the diff ([PRE-EXISTING] tag) — the
  diff scopes WHICH files to look at; review covers EVERYTHING in those files.

Files (origin tags indicate diff status):
- <path>  [NEW|PRE-EXISTING]
- ...

# Classification Bar

A finding is **Critical** if a careful reviewer would block the PR until it's
fixed. Pragmatic bar: don't require proof of a reachable failure path, but do
require the failure is plausible under inputs the public API accepts or
foreseeable refactors.

**Major** = fragile, will break under foreseeable conditions.
**Minor** = unidiomatic, works correctly.
**Polish** = older Go pattern with a cleaner replacement.
**Strength** = a pattern worth flagging so the team keeps doing it (cap your
output to your single strongest observation; the main turn aggregates and
caps at 5 across all agents).

When ambiguous, flag the higher severity and explain the assumption in the
rationale.

# Hallucination Guards

Every finding MUST include:

- `snippet`: the literal text from the offending line (whitespace as-written).
  The main turn verifies this string exists near the cited line; mismatches
  are dropped.
- `rule_file` and `rule_section`: the file and section heading from the rules
  above. Findings without a rule citation will be discarded.

DO NOT invent line numbers. DO NOT report issues you cannot point at with a
specific snippet from a specific line.

# Fix Kind

Each finding includes `fix_kind`:

- `mechanical`: a find/replace within one file with no API surface change.
  Examples: `interface{}` → `any`; `[]string{}` → `var t []string`;
  `errors.As` → `errors.AsType[T]`.
- `local`: confined to one function or short region; no signature change.
  Provide a complete `suggestion` if the user could apply it without
  thought.
- `design`: touches an API surface, multiple files, or requires judgment
  about callers. Always reported, never auto-applied.

# Output Format

After your analysis, return findings as a SINGLE fenced JSON block at the
end of your response:

```json
{
  "findings": [
    {
      "severity": "critical|major|minor|polish|strength",
      "file": "path/from/repo/root.go",
      "line": 42,
      "snippet": "exact text from the line",
      "origin": "new|pre-existing",
      "rule_file": "errors.md",
      "rule_section": "In-Band Errors",
      "fix_kind": "mechanical|local|design",
      "finding": "One-line headline of the issue.",
      "rationale": "Code-specific explanation referencing the actual identifiers in the file. Do NOT restate the rule; explain why THIS code triggers it.",
      "suggestion": "Concrete fix shape. For mechanical/local fix_kind, this should be applyable as-is."
    }
  ]
}
```

If you found nothing in your focus area: return an empty findings array.
````

The shared preamble (Hallucination Guards, Fix Kind, Output Format) is identical across all five agents. Only the Focus, Rule Content, and Files lists differ.

---

## Apply Mode

`--apply` runs the full review, then auto-applies the subset of findings safe to apply mechanically. The decision tree:

```
For each finding:
  if severity in (critical, polish) and fix_kind == "mechanical":
    apply
  elif severity in (critical, polish) and fix_kind == "local"
       and suggestion is a complete diff:
    apply
  else:
    skip (report-only)
```

After applying, the skill runs `go vet ./...` and `go build ./...`. If either fails, the skill surfaces the failure and recommends `git restore` to roll back. The user is the safety net, not the harness.

`--apply` always runs `go fix ./...` _first_, before the sub-agents dispatch. This pre-empts most Polish findings (so the agents see post-modernizer code) and means the review is faster and cleaner in `--apply` mode.

`--apply` never auto-applies Major or Minor findings, even if they're tagged `mechanical`. Those severities require user judgment about scope and timing; auto-applying them turns a review tool into a bulldozer.

Dependency updates are never auto-applied beyond a mechanical `go get -u <module>` for a Polish-severity patch/minor bump (followed by `go mod tidy`). Major-version bumps and anything `govulncheck` flags always go through the user — they may carry breaking changes.

---

## Report Format

### Small scope (≤ 3 packages)

```markdown
# Go Review: <scope description>

Reviewed N files in M package(s). Reviewed against go-rules (Go 1.26 target).

Findings: X Critical, Y Major, Z Minor, W Polish.
Strengths: K.

[Optional one-line: Note: rules target Go 1.26; your codebase targets Go X.Y...]
[Optional one-line: Skipped P generated files; T files had compile errors and were not reviewed.]

## ✅ Strengths

- `path/file.go:LINE` — `rule_file.md` "Section": short description.
  (up to 5 entries)

## 🔴 Critical (X)

### path/file.go
- **Line LINE** — `rule_file.md` "Section": one-line finding.
  Suggestion: ...
  <details><summary>Why this matters</summary>
  Code-specific rationale referencing actual identifiers.
  </details>

(repeat per file)

## 🟠 Major (Y)
(same shape)

## 🟡 Minor (Z)
(same shape, severity gated by --severity)

## 🔵 Polish (W)
(collapsed to one-line summary by default; --verbose to expand)

## 📦 Dependencies

govulncheck: <K vulnerabilities | clean | not run>. N of T modules behind latest.

| Module               | Current | Latest  | Severity |
| -------------------- | ------- | ------- | -------- |
| `example.com/x`      | v1.2.0  | v2.0.1  | Major    |
| `example.com/y`      | v1.4.3  | v1.4.5  | Polish   |

To update minor/patch bumps: `go get -u ./... && go mod tidy`. Review changelogs
before major-version bumps. Dependency findings render in this section only —
they are NOT added to the top-line "Findings: X Critical…" tally and are NOT
gated by `--severity`. (Section omitted with `--no-deps`.)

---

Coverage:
- internal/auth/proto.go — generated; skipped.
- internal/auth/handlers.go uses gRPC patterns; reviewed for general Go,
  not against gRPC-specific conventions.

3 findings dropped during snippet verification.
```

### Large scope (> 3 packages or `--all`)

```markdown
# Go Review: --all (247 files in 18 packages)

Findings: 12 Critical, 47 Major, 89 Minor, 23 Polish. Strengths: 5.

## 📋 Package Index

Sorted by severity-weighted finding count (Critical × 10 + Major × 3 + Minor × 1 + Polish × 0.5):

| Package              | Critical | Major | Minor | Polish |
| -------------------- | -------- | ----- | ----- | ------ |
| `internal/auth`      | 5        | 12    | 18    | 4      |
| `internal/session`   | 3        | 8     | 14    | 6      |
| `internal/store`     | 2        | 9     | 11    | 3      |
| `internal/handlers`  | 1        | 7     | 16    | 5      |
| ...                  |          |       |       |        |

(Severity body follows the small-scope shape, including the Dependencies section.)

For very large reviews (>20 packages or >100 findings), Minor and Polish
sections are summarised in the index but not enumerated. Pass
`--scope <pkg> --verbose` for details.
```

### `--pr-snippet` appendix

````markdown
---

## 📋 PR Description Snippet

Copy the block below into your PR description:

```markdown
### Pre-merge review

**Critical issues:** N (none blocking | N remaining)
**Major issues addressed:** M
- Fixed <description> ([file.go:line](#))
- ...

**Remaining recommendations:**
- K Minor (idiomatic improvements; non-blocking)
- L Polish (Go 1.21+ modernisations)
- Dependencies: N modules behind; govulncheck <clean | K issues>.

Reviewed against the go-rules ruleset (Go 1.26 target).
```
````

If `--pr-snippet` is passed without `--apply` or evidence of prior fix work, the snippet section says: "No fixes applied yet. Run `--apply` or address findings manually before generating a PR snippet."

---

## Failure Modes

### Scope resolution fails

- **On the base branch with no `--scope`:** error and suggest `--scope <path>` or branch switch.
- **`git diff` returns no files:** report "no files changed vs <base>; nothing to review" and exit cleanly.
- **`--scope` argument is neither a valid path nor a valid git ref:** error with the offending value.

### Ruleset not found

The five sub-agents cite rules read from the sibling `go-rules/references/` directory under the installed plugin root. Before dispatching them (workflow step 8), confirm those files are readable. If the directory is missing or empty — the `go-rules` skill was removed, renamed, or never installed — abort with a clear message ("go-rules ruleset not found under the installed plugin root at `skills/go-rules/references/` — install or enable the go-rules skill") rather than dispatching agents that would produce uncitable findings. The `go vet` and dependency-freshness checks don't depend on the ruleset; report them if they ran and surfaced anything useful.

### Sub-agent fails or times out

Render whatever sub-agents completed; mark missing focus areas:

```
**Coverage:** 4 of 5 focus areas reviewed.
- Skipped: test-quality-reviewer (interrupted).
```

The user can rerun with narrower scope or check the logs for what failed. The skill does not retry automatically — if an agent fails on a real review, retrying is unlikely to help and just spends more tokens.

### Dependency check can't reach the network

`go list -m -u all` and `govulncheck` need the module proxy / vuln DB. If they fail, the skill does not abort: it records "dependency freshness: not checked (module proxy unreachable)" in the coverage notes and reviews the code as normal.

### Snippet verification drops findings

Track the count, surface in the report:

```
3 findings were dropped during verification (the cited code did not appear
near the reported line — likely fabrication).
```

This is informative, not alarming. A small drop count is normal; a large one is a signal that the agent prompts need tightening.

### Compile errors in scope

Per-package compile filter (workflow step 3) handles this. Skipped packages get a footer:

```
2 packages were not reviewed due to compile errors:
- `internal/wip` — fix the build before reviewing.
- `internal/migration` — fix the build before reviewing.
```

### Version skew between rules and codebase

If `go.mod`'s `go X.Y` directive is more than one minor version ahead of the rules' target version, the report includes:

```
Note: rules target Go 1.26; your codebase targets Go 1.28. Patterns
introduced in Go 1.27+ are not reviewed.
```

If the codebase is on a version _behind_ the rules (e.g. `go 1.22` with rules at 1.26), no warning. The skill won't suggest features the user can't use.

---

## What This Skill Doesn't Do

- **Doesn't write new Go code.** For writing, use the `go-rules` skill directly.
- **Doesn't run tests.** `go test` is the user's job.
- **Doesn't post to GitHub.** `--pr-snippet` produces text the user pastes; the skill never invokes `gh`.
- **Doesn't manage git state.** No branches, no commits, no `git restore`. `--apply` writes to the working tree only; the user reviews `git diff` and decides.
- **Doesn't upgrade dependencies for you.** The deps check _reports_ what's behind and (in `--apply`) may run a mechanical `go get -u` for patch/minor bumps; major-version and security upgrades are surfaced for the user to drive.
- **Doesn't review domain-specific patterns the rules don't cover.** gRPC streaming semantics, cgo correctness, embedded SQL injection — out of coverage. The report says so via coverage notes; the user knows to engage other tools.
- **Doesn't fetch fresh rules.** The skill reads the bundled `go-rules` references; the maintainer updates them and re-syncs.

---

## Self-Discipline

When generating findings or rendering the report, the skill enforces:

1. **Every code finding cites a rule file and section.** No exceptions. If the agent can't cite a rule, the finding is dropped. (Deps findings cite the tool — `go list -m -u` or `govulncheck` — instead.)
2. **Snippet verification is mandatory** for code findings. No "trust the agent" path. If the snippet doesn't appear near the cited line, the finding is dropped (with the count surfaced).
3. **Severity calibration is honest.** "Would I block a PR on this?" is the test. Inflation kills the report's value; deflation hides bugs. When ambiguous, flag the higher severity and explain.
4. **Rationale is code-specific.** "Goroutines without cancellation can leak" is the _rule_; "fetch() blocks on `work`; ctx is in scope but unused" is the _rationale_. The agent's prompt insists on the latter.
5. **Strengths are capped.** 5 maximum. The point is celebration, not exhaustive enumeration.
6. **Auto-apply is conservative.** Only mechanical and complete-local code fixes, plus patch/minor `go get -u`. Design changes and major/security dependency bumps always go through the user.
7. **The report prints to the conversation.** No files. No GitHub. No external state.

---

## Versioning

This skill targets the same Go version as the ruleset: **Go 1.26**.

When the ruleset is bumped to a new target, update this file's `**Rules version**` line and re-run the eval suite (see `eval/` once it exists). Re-run end-to-end against the workspace as the final acceptance test.
