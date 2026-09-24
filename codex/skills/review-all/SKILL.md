---
name: review-all
description: Multi-lens code review (security, correctness, project rules, tests) of a PR, branch, commit or uncommitted change in a repository that keeps its conventions in CLAUDE.md and .claude/rules. Use for any code review or re-review request there, including "review PR 1165".
---

# Review All

A review here is four lenses over one change, run with the same checklists and accumulated lessons
as the Claude reviewers of this repository. Those checklists live in `~/.claude/agents/*.md` and are
the single source of truth; read them, do not work from memory of them.

A single "does this regress?" pass reliably misses what this repository cares about most: project
rule violations, the tenant-isolation chain, tests that cannot fail, and lessons already paid for in
earlier reviews. Run every lens even after the first finding. "No findings" is a valid result only
after every lens reports what it checked.

## 1. Pin the target

- PR: `gh pr view <n> --json number,title,body,baseRefName,baseRefOid,headRefName,headRefOid`. Make
  sure the checked-out `HEAD` equals `headRefOid`; if it does not, say so and review the PR head with
  `git show <headRefOid>:<path>`, never whatever is on disk.
- Branch: `BASE=$(git merge-base origin/master HEAD)` (fall back to `origin/main`). Pin the SHA once
  and use it for every diff; another worktree's fetch can move `origin/master` mid-review. Do not use
  local `master`; it is often stale and drags other people's commits into the diff.
- Re-review of a commit: `git show <sha>` is the change, but still read the files it touches in full.
- Uncommitted: `git diff HEAD` plus `git ls-files --others --exclude-standard`.

Read the PR body and linked issue (`Ref #N`): intent defines what "wrong" means.

For a PR, run the `$pr-review` skill's `status` first. If it lists agent threads, this is a
re-review: verify every open agent thread at the new head (the `$pr-review` re-review steps), and
review what changed since `lastReview.head` in full with the lenses below.

## 2. Load the context the Claude reviewers get automatically

1. Root `CLAUDE.md` and the `CLAUDE.md` of every service the diff touches.
2. **Project rules.** For every `.claude/rules/*.md` and `~/.claude/rules/*.md`, read its `paths:`
   frontmatter and match it against the changed files (`*` = one segment, `**` = any depth). A rule
   with no `paths:` applies to every file. Read every matching rule in full. List the rules you
   applied in the report. `~/.claude/rules/no-synthetic-data.md` always applies.
3. **Lessons.** Read `~/.claude/agent-memory/<lens>/MEMORY.md` for each of the four lenses, and
   `~/.claude/projects/E--Projects-Stukans-monorepo/memory/MEMORY.md`. Open the entries whose
   one-line hook names a touched service, library or pattern; entries marked **START HERE** first.
   These are defects that already shipped once here; checking for them is the cheapest real finding.
4. **Prior review state.** Derive the service from the path (`applications/test-me-ai/<name>/` →
   `<name>`, `applications/services/<name>/` → `<name>`, `libs/java/<name>/` → `<name>`, other
   `applications/<app>/<name>/` → `<app>-<name>`; several services → `global`) and the feature from
   the branch name without its `feat/`/`fix/` prefix. If `.claude/reviews/<service>/<feature>.md`
   exists, do not re-raise its Resolved items; re-raise a Dismissed item only prefixed `[ESCALATED]`
   with the new reason. Do not read other state files.

## 3. Run the four lenses

For each lens, read its Claude agent file and apply its checklist to the diff. Skip the parts that
are Claude plumbing: the Agent/SendMessage tools, "the orchestrator", writing agent memory.

| Lens | Checklist | Finding id |
|---|---|---|
| security | `~/.claude/agents/security-officer.md` (incl. the data-isolation chain in its Step 4) | `security/<SEV>-<n>` |
| correctness and design | `~/.claude/agents/code-reviewer.md` | `code-quality/<SEV>-<n>` |
| project rules | `~/.claude/agents/rules-compliance.md` (rule loading is step 2 above) | `rules/<SEV>-<n>` |
| tests and build | `~/.claude/agents/qa.md` (build commands: section 4 below) | `qa/<SEV>-<n>` |

`<SEV>` is `C`, `H`, `M` or `L` (CRITICAL, HIGH, MEDIUM, LOW), matching the ids in the state files.

Across all lenses, do the work a checklist alone does not force:

- Read every changed hunk line by line, then the whole changed method and its callers. Grep the
  call sites of every changed signature, return value or exception.
- A new enum value, field, status or config key: find every switch, mapper, hand-written list,
  frontend label table and test fixture that must learn it.
- For each new or changed test, decide whether it fails on the pre-change code. A test that passes
  either way is a finding.
- A rule with "must", "never", "always" or "do not" that the diff breaks is a finding even when the
  code runs correctly. Project rules are not style nits.

Report a finding only with: file and line in the reviewed ref, the concrete scenario (input or state
→ wrong result), and the fix. Drop anything you cannot tie to the diff. Merge a defect that two
lenses both found into one entry naming both.

## 4. Build and test (tests-and-build lens only)

Read first, build second: do not let a long build or a browser probe replace reading the diff.

- Maven is `E:\Tools\mvnd\bin\mvnd.exe` (no `mvn`, no `mvnw`). Always `clean`: without it, stale
  `target/test-classes` hides compile errors in untouched tests.
- Always pass `-Dspotless.apply.skip=true`; otherwise the build reformats the author's sources.
- Pass `-DskipITs` unless the user asked for integration tests. If failsafe runs and every
  `@IntegrationTest` errors on a Docker-environment lookup (e.g. "Previous attempts to find a Docker
  environment failed", followed by a cascade of `BeanCreationException`s), report the ITs as
  "not run: no Docker", not as a failure of the change.
- Frontend: `npm test` / `npx vitest run` from PowerShell in the gateway directory.
- One build at a time. Report exactly which modules and phases ran, with the counts you read in the log.

## 5. Stay read-only

Do not edit, create or delete any file inside the repository, `target/` included. Probes (a copied
module, a mutation, a Playwright script, a Semgrep scan) go under `$env:TEMP\review-<id>\`. No
`git checkout`, `stash`, `restore`, `reset`, `clean`, commits, pushes or branch changes.

## 6. Report

```
# Review: <PR #n / branch / commit>
Reviewed ref: <sha>   Base: <sha>   Service/feature: <service>/<feature>
Rules applied: <file list>   Lessons consulted: <memory files opened>

## Findings (most severe first)
### [security/H-1] <imperative title> — path/to/File.java:123
Scenario: ...   Fix: ...

## Per-lens result
- security: <n findings, or "clean" + what was checked; Semgrep: scanned N files / skipped: reason>
- correctness: ...
- rules: ...
- tests and build: <coverage gaps; modules, phases and counts that ran>

## Residual risk
<what you could not verify and why>
```

## 7. Register the review on the pull request

When the target is a PR, register the review with the `$pr-review` skill unless the user said
"local only": the findings above become its findings file (same ids, severities, paths and lines;
the body carries the scenario and the fix), then `post`, `resolve` on a re-review, and `verdict`.
Add the review and verdict URLs to the report.
