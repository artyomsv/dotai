---
allowed-tools: Bash(git:*), Bash(gh:*), Read, Glob, Grep, Write, Edit
description: Generate changelog entry from code changes. Auto-detects project structure (monorepo services vs backend/frontend). Optionally fetches GitHub issue for context.
argument-hint: [#ticket] [FEATURE|TASK|BUG_FIX] [area-name]
---

# Changelog Entry Generator

Generate a changelog entry based on code changes, optionally using a GitHub issue for context.

## Arguments (all optional)
- Ticket number (e.g., #123 or 123) - if provided, fetches GitHub issue for context
- Change type: FEATURE, TASK, or BUG_FIX - if not provided, infer from changes or ticket labels
- Area name - if not provided, detect from changed file paths

Arguments can be in any order. The command will detect:
- Numbers or #-prefixed values as ticket numbers
- FEATURE/TASK/BUG_FIX as change types
- Other strings as area/service names

## Current Context

### Git Status
!`git status --short`

### Recent Commits
!`git log --oneline -10`

### Changed Files (staged and unstaged)
!`git diff --name-only HEAD~5`

### Staged Changes Summary
!`git diff --staged --stat`

## Your Task

1. **Parse arguments**: Identify ticket number, change type, and area from: $ARGUMENTS
2. **If ticket number provided**: Fetch GitHub issue using `gh issue view <number> --json title,body,labels`
3. **Detect project structure** by examining top-level directories:
   - **Monorepo** (multiple service dirs with `pom.xml` or `build.gradle`): detect affected services from file paths
   - **Backend/Frontend split** (e.g., `backend/` + `frontend/` dirs): detect backend vs frontend areas
   - **Single project**: treat the whole project as one area
4. **Analyze the code changes** to understand what was implemented
5. **Determine the change type**:
   - `FEATURE` - New functionality
   - `TASK` - Improvements, refactoring, chores
   - `BUG_FIX` - Bug fixes
   - Infer from: explicit argument > ticket labels > commit messages > ask user
6. **Detect ALL affected areas** from changed file paths
7. **Generate changelog entries for EACH affected area** following the format below

## Changelog Entry Format

```
## [{VERSION}] - {DATE}

### [CHANGE_TYPE] #TICKET_NUMBER - Short Title
- Brief description of what changed
- Another change point if needed

**Author:** @username
```

If no ticket number is provided, omit the `#TICKET_NUMBER` part:
```
## [{VERSION}] - {DATE}

### [CHANGE_TYPE] - Short Title
- Brief description of what changed

**Author:** @username
```

## Output Instructions

1. **Detect affected areas** from changed file paths
2. **Write to the correct changelog file(s)**:
   - **Monorepo**: Create `changelog.new` in each affected service directory
   - **Backend/Frontend split**: Write to `backend/CHANGELOG.md` and/or `frontend/CHANGELOG.md`
   - **Single project**: Write to root `CHANGELOG.md`
3. Use placeholders `{VERSION}` and `{DATE}` — CI replaces them during version bump
4. Keep descriptions concise but informative
5. Reference the ticket number for traceability (if available)
6. If the changelog file already has entries, insert the new entry at the top (below the heading)
7. If the changelog file does not exist, create it with a `# Changelog` heading followed by the entry
8. Exclude areas that only have non-functional changes (IDE configs, devops files) unless that IS the change
9. **After creating all changelog entries**, suggest a short commit message (1 line, under 72 chars)
