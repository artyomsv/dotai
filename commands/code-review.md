---
allowed-tools: Bash(git:*), Read, Glob, Grep, Task
description: Code review orchestrator — spawns security-officer, code-reviewer, rules-compliance, and qa agents in parallel and produces a combined report.
argument-hint: [--staged | --all | path] [--severity=high|medium|all]
---

# Code Review (Orchestrator)

Orchestrate a comprehensive code review by spawning four specialized agents in parallel.

## Arguments (all optional)
- `--staged` - Review only staged changes (default)
- `--all` - Review all uncommitted changes (staged + unstaged)
- `path` - Review specific file or directory
- `--severity=high` - Show only HIGH severity issues
- `--severity=medium` - Show HIGH and MEDIUM severity issues
- `--severity=all` - Show all issues (default)

Arguments can be in any order.

## Excluded Files (auto-detected)

Skip these file patterns — do not review them or include them in the report:
- `**/.run/**` — IntelliJ run configurations
- `**/components/ui/**` — shadcn/ui managed components
- `*.lock` — lockfiles
- `*.md` — documentation files (unless explicitly included via path)
- `**/__pycache__/**` — Python cache
- `**/node_modules/**` — npm packages
- `**/target/**` — Maven build output

## Current Context

### Git Status
!`git status --short`

### Staged Changes (file list)
!`git diff --staged --name-only`

### All Changes (file list)
!`git diff --name-only`

### Staged Diff Summary
!`git diff --staged --stat`

## Your Task

### 1. Parse Arguments

Identify scope and severity filter from: $ARGUMENTS
- Default: `--staged` and `--severity=all`

### 2. Gather File List and Diff Context

Based on scope:
- `--staged`: Run `git diff --staged --name-only` for file list, `git diff --staged --stat` for diff summary
- `--all`: Run `git diff --name-only` for file list, `git diff --stat` for diff summary
- `path`: Use the specified path directly

**Exclude** files matching patterns in the "Excluded Files" section above.

Also gather recent commit messages:
```bash
git log --oneline -5
```

Store the resulting **file list**, **diff summary**, and **recent commits** as text — you will pass these to the agents.

### 3. Spawn All Four Agents in Parallel

Use the **Task tool** to launch all four agents **simultaneously in a single message** (four parallel Task calls). Pass each agent the gathered context so they don't need to re-discover changes.

#### Agent A: security-officer

```
subagent_type: security-officer
model: opus
```

Prompt must include:
- The scope (staged/all/path)
- The full file list
- The diff summary
- Instruction: "Review these changed files for security vulnerabilities following your security review process. You do NOT need to run git commands to discover files — use the file list provided."

#### Agent B: code-reviewer

```
subagent_type: code-reviewer
model: opus
```

Prompt must include:
- The scope (staged/all/path)
- The severity filter (high/medium/all)
- The full file list
- The diff summary
- Instruction: "Review these changed files for code quality, best practices, and potential issues. You do NOT need to run git commands to discover files — use the file list provided. Severity filter: {severity}."

#### Agent C: rules-compliance

```
subagent_type: rules-compliance
model: sonnet
```

Prompt must include:
- The scope (staged/all/path)
- The full file list
- The diff summary
- Recent commit messages
- Instruction: "Check these changed files against project rules in `.claude/rules/` and global rules in `~/.claude/rules/`. You do NOT need to run git commands to discover files — use the file list provided."

#### Agent D: qa

```
subagent_type: qa
model: sonnet
```

Prompt must include:
- The scope (staged/all/path)
- The full file list
- Instruction: "Verify test coverage and run tests for these changed files. You do NOT need to run git commands to discover files — use the file list provided."

### 4. Combine Reports

After ALL four agents return, combine their reports into a single unified output:

```
# Combined Code Review Report

## Summary
- **Scope**: [staged / all / path]
- **Files reviewed**: [count]
- **Security issues**: [count by severity from security-officer]
- **Code quality issues**: [count by severity from code-reviewer]
- **Rules violations**: [count by severity from rules-compliance]
- **Test coverage gaps**: [count from qa]
- **Test results**: [pass/fail summary from qa]

---

## Security Review
[Paste the security-officer agent's full report here]

---

## Code Quality Review
[Paste the code-reviewer agent's full report here]

---

## Rules Compliance
[Paste the rules-compliance agent's full report here]

---

## QA Report
[Paste the qa agent's full report here]

---

## Action Items

Consolidated list of all findings that require action, ordered by severity:

### Must Fix (Critical / High)
- [ ] [Finding from any agent — include source agent name]

### Should Fix (Medium)
- [ ] [Finding from any agent]

### Consider (Low / Suggestions)
- [ ] [Finding from any agent]
```

## Rules

- **Always spawn all four agents in parallel** — use a single message with four Task tool calls
- **Pass context to agents** — agents should not need to re-run git commands for file discovery
- **Do not duplicate agent work** — do not perform your own code analysis; rely on the agents
- **Respect severity filter** — when consolidating, filter the final Action Items list by the requested severity level
- **If an agent fails**, include a note in its section: "Agent failed: [reason]" and continue with the other reports
