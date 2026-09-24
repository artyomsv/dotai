---
allowed-tools: Bash(git:*), Read, Glob, Grep, Agent, SendMessage, Write
description: Code review orchestrator — spawns security-officer, code-reviewer, rules-compliance, and qa agents in parallel and produces a combined report. Tracks per-service-and-feature review state across rounds.
argument-hint: [--staged | --all | --branch | path] [--severity=high|medium|all] [--service=<name>] [--feature=<slug>] [--force-round] [--full-sweep] [--with-it]
---

# Review All (Orchestrator)

Orchestrate a comprehensive code review by spawning four specialized agents in parallel, with per-feature state tracking so successive rounds skip already-resolved findings.

Named `/review-all`, not `/code-review`, so it does not shadow the built-in `/code-review` (and `/code-review ultra`).

## Arguments (all optional)
- no scope flag - Auto (default): see "Scope resolution" in step 2
- `--staged` - Review only staged changes
- `--all` - Review all uncommitted changes: staged + unstaged + untracked
- `--branch` - Review everything on this branch since it forked from `origin/master`, including uncommitted and untracked files
- `path` - Review specific file or directory
- `--severity=high` - Show only HIGH severity issues
- `--severity=medium` - Show HIGH and MEDIUM severity issues
- `--severity=all` - Show all issues (default)
- `--service=<name>` - Override the auto-derived service name (see "State Tracking" below). Use this for cross-service reviews (`--service=global`) or when path-derivation gets the wrong service.
- `--feature=<slug>` - Override the auto-derived feature slug. Use this when reviewing multiple features against the same service on the same branch.
- `--force-round` - Run even when the state file already shows `Rounds completed: 2` or more (see "Round cap").
- `--full-sweep` - Ask security-officer to scan ALL tracked files for leaked secrets/topology, not just the changed files. Slow. Off by default.
- `--with-it` - Let qa run the failsafe `*IT` integration tests. Off by default because they are slow; without it qa runs `verify -DskipITs` and lists the ITs as not run.

Arguments can be in any order.

## Agents and models

Models and reasoning effort are set in each agent's frontmatter under `~/.claude/agents/`. That frontmatter is the single source of truth. **Do not pass a `model` parameter to the Agent tool** — a command-side override silently wins over the frontmatter and the two drift apart.

Current values, for reference only (edit the agent file, not this table):

| Agent | model | effort | Job |
|---|---|---|---|
| security-officer | opus | high | Vulnerabilities, secrets, tenant-isolation chain, Semgrep |
| code-reviewer | opus | high | Bugs, edge cases, design, readability |
| rules-compliance | opus | high | `.claude/rules/` + `~/.claude/rules/` conformance |
| qa | opus | high | Test coverage, test-pattern compliance, runs the build |

## Excluded Files (auto-detected)

Skip these file patterns — do not review them or include them in the report:
- `**/.run/**` — IntelliJ run configurations
- `**/components/ui/**` — shadcn/ui managed components
- `*.lock` — lockfiles
- `*.md` — documentation files (unless explicitly included via path), EXCEPT these, which are reviewed because they change agent or app behaviour: `CLAUDE.md` at any depth, `.claude/rules/**`, `.claude/agents/**`, `.claude/commands/**`, and any `.md` under `src/main/resources/` (prompts)
- `.claude/reviews/**` — review state files and saved reports, always
- `**/__pycache__/**` — Python cache
- `**/node_modules/**` — npm packages
- `**/target/**` — Maven build output

## Current Context

### Git Status
!`git status --short`

### Staged Changes (file list)
!`git diff --staged --name-only`

### Unstaged Changes (file list)
!`git diff --name-only`

### Untracked Files
!`git ls-files --others --exclude-standard`

### Uncommitted Diff Summary (staged + unstaged vs HEAD)
!`git diff HEAD --stat`

### Current Branch
!`git rev-parse --abbrev-ref HEAD`

## State Tracking

Per-service-and-feature review state lives at `.claude/reviews/<service>/<feature>.md` in the project root. The two-level layout groups review state for one service together so it is never loaded when reviewing another service.

File format — plain markdown with three sections: a header, a Resolved list, and a Dismissed list:

```markdown
# Code Review State: <service> / <feature>

Last reviewed: 2026-05-27
Rounds completed: 2

## Resolved (fixed in code; do not re-raise)
- [security/M-3] maven-wrapper distributionSha256Sum pinned — round 1
- [code-quality/H1] EncryptionEnv reads System.getProperty before System.getenv — round 1

## Dismissed (acknowledged, will not fix; agents may escalate with explicit justification)
- [code-quality/L8] BlindIndexTokenizer regex allocation — perf cost not justified at current scale (round 2)
```

**Service derivation order:**
1. `--service=<name>` argument if provided
2. If a directory `.claude/reviews/<candidate>/` already exists for the service the changed files belong to, reuse that exact name — past runs are the canonical spelling.
3. Otherwise derive from the path:
   - `libs/java/<name>/...` → `<name>` (e.g. `encryption-common`)
   - `applications/services/<name>/...` → `<name>` (e.g. `ai`, `communications`)
   - `applications/test-me-ai/<name>/...` → `<name>` (e.g. `ingestion`, `candidates`, `invoicing`)
   - `applications/<other-app>/<name>/...` → `<app>-<name>` (e.g. `fairy-book-orders`, `fairy-book-gateway`)
   - `applications/legacy/<name>/...` → `<name>`
   - Bare folder name given as the path argument (e.g. `encryption-common`) → use it directly
4. If the path argument matches none of the above, map every changed file through the rules in 3 (ignoring files that map to no service):
   - all mapped files belong to ONE service → that service
   - they span TWO OR MORE services → `global`
5. Else (no changed file maps to a service) → `unscoped`

Print the resolved `(service, feature)` pair at the top of the report. Do not stop to ask for confirmation — the user corrects it with `--service=` on the next run if it is wrong.

**Feature derivation order:**
1. `--feature=<slug>` argument if provided
2. If current branch is not `master`/`main`, the sanitised branch name (lowercase, `/` → `-`, strip `feature/`/`fix/`/etc. prefix)
3. Else if a `path` argument was supplied AND it points deeper than the service root, the basename of that path (lowercase, kebab-case)
4. Else the service name itself (i.e. the "whole-service review" case yields `<service>/<service>.md`)

**Round cap (hard stop).** Read `Rounds completed: N` from the state file. If `N >= 2` and `--force-round` was NOT passed: do not spawn any agent. Print the `(service, feature)` pair, the state-file path, `N`, and this text, then stop:

> Round cap reached: this feature has completed N review rounds. LLM review agents drift toward subjective polish findings on round 3+. Re-run with `--force-round` only if a structural change since the last round warrants a fresh pass.

If `--force-round` was passed, run normally and prepend the same warning to the final report.

The `.claude/reviews/` directory is project-local and SHOULD be committed (review state survives across collaborators). Do not gitignore it.

## Your Task

### 1. Parse Arguments

Identify scope, severity filter, service, feature slug, `--force-round`, `--full-sweep` and `--with-it` from: $ARGUMENTS
- Default scope: auto (see "Scope resolution" in step 2)
- Default severity: `--severity=all`
- Default service: derive per the service-derivation order above.
- Default feature: derive per the feature-derivation order above.

The state-file path is `.claude/reviews/<service>/<feature>.md`. Print the resolved `(service, feature)` pair near the top of the report so the user can confirm the derivation was correct.

### 2. Gather File List and Diff Context

**Scope resolution** (when no scope flag or path was given):
- Current branch is not `master`/`main` → `--branch`.
- Otherwise, if there are unstaged or untracked files → `--all`. A default of `--staged` reviews zero files for anyone who does not stage before reviewing.
- Otherwise, if only staged changes exist → `--staged`.
- Otherwise print "Nothing to review: no uncommitted changes on master." and stop.

Print the resolved scope next to the `(service, feature)` pair.

Based on scope:
- `--staged`: Run `git diff --staged --name-only` for file list, `git diff --staged --stat` for diff summary. The **ref under review** is the staged content (`git show :<path>`).
- `--all`: File list is `git diff HEAD --name-only` (staged + unstaged — plain `git diff` shows unstaged only) plus `git ls-files --others --exclude-standard` (untracked). Diff summary is `git diff HEAD --stat`; list untracked files under it by name. The **ref under review** is the working tree on disk.
- `path`: Use the specified path directly. The **ref under review** is the working tree on disk.
- `--branch`: Compute the fork point ONCE and pin it as a SHA: `BASE=$(git merge-base origin/master HEAD)` (fall back to `origin/main`; use local `master` only if no remote ref exists, and say so in the report — a local `master` that was never pulled drags other people's commits into the diff). Do not `git fetch`. File list is `git diff $BASE --name-only` (commits + staged + unstaged) plus `git ls-files --others --exclude-standard`; diff summary is `git diff $BASE --stat`. Pass `$BASE` to the agents as the SHA, never as `origin/master` — another worktree's fetch can move that ref mid-review. The **ref under review** is `HEAD` (`git show HEAD:<path>`) when the tree is clean, else the working tree on disk.

**Exclude** files matching patterns in the "Excluded Files" section above.

Also gather recent commit messages:
```bash
git log --oneline -5
```

Store the resulting **file list**, **diff summary**, **ref under review**, and **recent commits** as text — you will pass these to the agents.

### 3. Load Prior Review State

Read `.claude/reviews/<service>/<feature>.md` if it exists. Parse:
- `Rounds completed: N`
- Bullet list under "## Resolved"
- Bullet list under "## Dismissed"

If the file does not exist, treat this as round 1 with empty Resolved/Dismissed lists.

Apply the **Round cap** rule above before doing anything else.

Do NOT read sibling review files (other features in the same service folder, or other services entirely). The two-level layout exists precisely so each review run loads only the state relevant to the current `(service, feature)` — touching other state files inflates context and risks bleeding unrelated dismissals into this run's prompt.

Format the loaded state into a `<prior-review-state>` block to inject into each agent prompt:

```
<prior-review-state>
This feature has been reviewed before. The following findings have already been addressed in code — do NOT re-raise them:

Resolved:
- [security/M-3] maven-wrapper distributionSha256Sum pinned
- ...

The following findings were considered and explicitly dismissed by the user — do NOT re-raise unless you can articulate a NEW reason that escalates severity. If you re-raise a dismissed item, prefix with "[ESCALATED]" and explain why the prior dismissal rationale is wrong:

Dismissed:
- [code-quality/L8] BlindIndexTokenizer regex allocation — perf cost not justified at current scale
- ...
</prior-review-state>
```

If `Rounds completed: N` is ≥ 2 (only reachable with `--force-round`), also include this instruction in each agent prompt:

```
This is round N+1 of code review for this feature. Diminishing-returns mode: ONLY report findings of severity HIGH or above, OR a finding that names a concrete bug / security issue / spec violation. Suppress subjective polish, Javadoc nits, "consider extracting", "cosmetic" — those produce noise on late rounds and waste the user's time. If you have nothing of substance to report, return "No high-confidence findings on this round."
```

### 4. Build the shared `<review-contract>` block

Every agent prompt carries this block verbatim (fill in the two placeholders). It exists because agents have, on real runs, reverted uncommitted work with `git checkout`, graded a file on disk that a peer was mid-editing, and reported "Semgrep clean" after scanning zero files.

```
<review-contract>
Ref under review: {ref-under-review}. Quote code from that ref (e.g. `git show HEAD:<path>` or `git show :<path>`), not from whatever is on disk, unless the ref IS the working tree.

The working tree belongs to the user and may be mid-edit. You are read-only:
- Do not Write, Edit or NotebookEdit any file under the repository. There is no exception: your memory directory is `~/.claude/agent-memory/<your-agent-name>/`, outside every repository.
- Do not run `git checkout`, `git stash`, `git restore`, `git reset`, `git clean`, or `git show <ref>:<path> > <path>`.
- Do not run a build or test command that shares a `target/`, `node_modules/` or `dist/` directory with another agent's build. qa is the only agent that runs Maven or npm.
- If you want to probe a change (revert a fix and re-run a test, mutate a line, run Semgrep on a worktree), copy the files or the module into `{scratchpad}` and probe the copy there. Never in the worktree.

Deliver your findings as text with file:line references and inline patch suggestions. End with the full report as your final message. If you are running as an agent-team teammate, also send the report to the lead with SendMessage — a bare "idle" is not a report.
</review-contract>
```

`{scratchpad}` is this session's scratchpad directory from the system prompt. `{ref-under-review}` comes from step 2; for `--branch` it also carries the pinned base, e.g. "working tree, diffed against base 1a2b3c4 (`git diff 1a2b3c4 -- <path>`)".

### 5. Spawn All Four Agents in Parallel

Use the **Agent tool** to launch all four agents **simultaneously in a single message** (four parallel Agent calls). Do not pass `model`. Pass each agent the gathered context AND the `<review-contract>` block AND the `<prior-review-state>` block AND (when round ≥ 2) the diminishing-returns instruction so they don't need to re-discover changes and don't re-raise resolved items.

#### Agent A: security-officer

```
subagent_type: security-officer
```

Prompt must include:
- The scope (staged/all/path/branch)
- The full file list
- The diff summary
- The `<review-contract>` block
- The `<prior-review-state>` block
- (When round ≥ 2) the diminishing-returns instruction
- `--full-sweep` flag state: "Full tracked-files sweep: ON" or "Full tracked-files sweep: OFF — check leaked-secret patterns in the changed files only."
- Instruction: "Review these changed files for security vulnerabilities following your security review process. You do NOT need to run git commands to discover files — use the file list provided. Do NOT re-raise items listed in <prior-review-state>. State the Semgrep scanned-file count in your report; zero scanned is an invalid scan, not a clean one."

#### Agent B: code-reviewer

```
subagent_type: code-reviewer
```

Prompt must include:
- The scope (staged/all/path/branch)
- The severity filter (high/medium/all)
- The full file list
- The diff summary
- The `<review-contract>` block
- The `<prior-review-state>` block
- (When round ≥ 2) the diminishing-returns instruction
- Instruction: "Review these changed files for code quality, best practices, and potential issues. You do NOT need to run git commands to discover files — use the file list provided. Severity filter: {severity}. Do NOT re-raise items listed in <prior-review-state>."

#### Agent C: rules-compliance

```
subagent_type: rules-compliance
```

Prompt must include:
- The scope (staged/all/path/branch)
- The full file list
- The diff summary
- Recent commit messages
- The `<review-contract>` block
- The `<prior-review-state>` block
- (When round ≥ 2) the diminishing-returns instruction
- Instruction: "Check these changed files against project rules in `.claude/rules/` and global rules in `~/.claude/rules/`. You do NOT need to run git commands to discover files — use the file list provided. Do NOT re-raise items listed in <prior-review-state>."

#### Agent D: qa

```
subagent_type: qa
```

Prompt must include:
- The scope (staged/all/path/branch)
- The full file list
- The `<review-contract>` block
- The `<prior-review-state>` block
- (When round ≥ 2) the diminishing-returns instruction
- `--with-it` flag state: "Integration tests: ON" or "Integration tests: OFF — run `verify -DskipITs` and list the ITs as not run."
- Instruction: "Verify test coverage and run tests for these changed files. You do NOT need to run git commands to discover files — use the file list provided. Do NOT re-raise items listed in <prior-review-state>. Run module builds one at a time, never two in parallel. Pass `-Dspotless.apply.skip=true` to every Maven build so the build cannot rewrite the user's sources. Report exactly which modules and test phases ran."

### 6. Wait for all four, then combine

Do not write the combined report until every agent has either delivered a report or failed with an explicit error. **Silence is not a clean result.** On one real run the security agent stayed quiet for 25 minutes after the other three had reported, and then delivered a HIGH finding; a combined report written in the meantime would have said "no security findings". If an agent has not answered when the others have, ask it for its report (SendMessage) and keep waiting. Each agent section in the report must be exactly one of:

- the agent's full report, or
- `Agent failed: <the exact error text>`, or
- `Agent did not return a report; result unknown` (only after a direct request for the report also went unanswered).

Never write "no findings" in a section for an agent that did not deliver a report.

Combine into a single unified output:

```
# Combined Code Review Report

**Service:** <service>
**Feature:** <feature>
**State file:** `.claude/reviews/<service>/<feature>.md`
**Round:** N (loaded from the state file, defaulted to 1 if absent)
**Ref under review:** <ref>
<If --force-round was used, add: "⚠️ Round cap overridden: this is round N. LLM review agents tend to manufacture findings on late rounds. Treat anything below HIGH severity with skepticism on this run.">

## Summary
- **Scope**: [staged / all / path / branch]
- **Files reviewed**: [count]
- **Security issues**: [count by severity from security-officer]
- **Semgrep**: [N files scanned, M findings / skipped: reason / INVALID: 0 files scanned]
- **Code quality issues**: [count by severity from code-reviewer]
- **Rules violations**: [count by severity from rules-compliance]
- **Test coverage gaps**: [count from qa]
- **Test results**: [pass/fail summary from qa, with which modules and phases ran]

---

## Security Review
[security-officer's full report, or the failure line]

---

## Code Quality Review
[code-reviewer's full report, or the failure line]

---

## Rules Compliance
[rules-compliance's full report, or the failure line]

---

## QA Report
[qa's full report, or the failure line]

---

## Action Items

Consolidated list of all findings that require action, ordered by severity. When two or more agents report the same defect at the same file:line, list it once, name every source agent, and use the highest severity any of them gave. Items prefixed with [ESCALATED] are previously-dismissed items that an agent has re-raised with a new argument — review the agent's rationale before treating the prior dismissal as final.

### Must Fix (Critical / High)
- [ ] [Finding from any agent — include source agent name]

### Should Fix (Medium)
- [ ] [Finding from any agent]

### Consider (Low / Suggestions)
- [ ] [Finding from any agent]
```

### 7. Suggest State-File Update

At the end of the report, output a `## Suggested state-file update` block the user can apply by typing "apply" or by editing `.claude/reviews/<service>/<feature>.md` manually. The block must contain:

```
## Suggested state-file update

If you accept all Must-Fix and Should-Fix items above and intend to fix them now, OR if you intend to dismiss them, append the entries below to `.claude/reviews/<service>/<feature>.md` (create the directory and file if absent). Tell me which finding IDs to mark Resolved vs Dismissed and I will write the file for you.

Proposed Resolved entries (assumes you will fix in this session):
- [security/H-1] <one-line summary>
- [code-quality/M2] <one-line summary>
- ...

Proposed Dismissed entries (only if you tell me which):
- (none until you confirm)

Round bump: N → N+1
Last reviewed: YYYY-MM-DD (today, from $env or system date)
```

If the user replies "apply" / "fix all" / "yes record these" or similar, then write `.claude/reviews/<service>/<feature>.md` with:
- The header (service / feature, last reviewed date, incremented round count)
- The merged Resolved list (existing + newly resolved)
- The merged Dismissed list (existing + newly dismissed)

The Write tool creates the `.claude/reviews/<service>/` directory if it does not exist.

If the user dismisses specific items, capture their stated reason verbatim in the Dismissed entry.

## Rules

- **Always spawn all four agents in parallel** — use a single message with four Agent tool calls
- **Never pass `model` to the Agent tool** — the agent frontmatter decides
- **Pass context to agents** — agents should not need to re-run git commands for file discovery
- **Always inject the `<review-contract>` block** into every agent prompt
- **Always inject the `<prior-review-state>` block** into every agent prompt, even when the state file does not yet exist (in that case the block is empty but its presence anchors the agents' attention on the convention)
- **Honour the round cap** — `Rounds completed >= 2` without `--force-round` means no agents are spawned
- **Honour the diminishing-returns instruction on round ≥ 2** — pass it to every agent
- **Do not duplicate agent work** — do not perform your own code analysis; rely on the agents
- **Respect severity filter** — when consolidating, filter the final Action Items list by the requested severity level
- **Merge duplicate findings** across agents in Action Items — one line per defect, all source agents named
- **Wait for every agent** — an unanswered agent gets a direct request for its report before its section is marked unknown; never "no findings" from silence
- **If an agent fails**, include `Agent failed: <reason>` in its section and continue with the other reports
- **Always emit the "Suggested state-file update" block** so the user has a clear path to record outcomes
- **Never modify `.claude/reviews/<service>/<feature>.md` without an explicit user instruction** ("apply", "record these", or manually-specified items)
