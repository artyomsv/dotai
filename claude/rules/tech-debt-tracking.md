---
paths:
  - "**/techdebt/**"
  - "**/.claude/commands/techdebt-add.md"
  - "**/TECHDEBT*"
  - "**/.claude/rules/**"
  - "**/CLAUDE.md"
---

# Tech Debt Tracking

## Purpose

Proactively identify and track technical debt during any work — code reviews, feature development, debugging, refactoring. When tech debt is spotted, immediately create a tracking file so it is never forgotten.

## When to Create a Debt File

Create a debt file whenever you encounter any of these during your work:

1. **Missing test coverage** — classes or methods without unit tests, especially in critical paths
2. **Wrong RBAC configuration** — incorrect `@PreAuthorize`, missing role checks, overly permissive access
3. **Unfinished code review findings** — issues identified during review but not yet resolved
4. **Swallowed exceptions** — empty catch blocks, overly broad `catch (Exception e)`, logging without re-throwing when appropriate
5. **Hardcoded values** — magic numbers, URLs, credentials, config values that should be externalized
6. **N+1 query problems** — lazy-loaded collections causing excessive DB round-trips in loops
7. **Missing database indexes** — slow queries on frequently filtered/sorted columns without indexes
8. **Deprecated API/library usage** — using methods or libraries marked `@Deprecated` or scheduled for removal
9. **Missing input validation** — no validation at system boundaries (REST controllers, message consumers, file uploads)
10. **Dead code** — unused classes, methods, imports, Maven/npm dependencies
11. **Missing resilience patterns** — no circuit breaker, retry, or timeout on external service calls (Feign, HTTP, messaging)
12. **Insufficient logging/observability** — missing structured logging in critical flows, no correlation IDs, silent failures
13. **Tight coupling** — direct DB access across service boundaries, God classes doing too much, circular dependencies
14. **Missing data isolation pattern** — user-owned entities without proper access control (e.g., missing DAO pattern)
15. **Inconsistent error responses** — mixed error formats across endpoints, missing error codes, non-RFC 7807 responses

## Where to record it — check the project first

**Before creating a file, determine how this project tracks debt:**

1. If the project has a `/techdebt-add` command, **use it**. That is the project's chosen
   mechanism and it will file the debt wherever the project actually looks.
2. If `techdebt/README.md` exists, read it — it says where debt lives.
3. Otherwise, fall back to the file convention described below.

Projects increasingly track debt as issues in their tracker rather than as files. A debt
file created in a project that has migrated to issues is invisible: nobody reads that
directory any more.

## Behavior

- **Proactive**: Record debt automatically whenever you spot issues — no user confirmation needed
- **Non-blocking**: Mention what you recorded, but don't let debt tracking interrupt the primary task
- **Duplicate-aware**: Check whether similar debt already exists before adding a new entry — search the tracker if the project uses one, or scan the target service folder AND `techdebt/global/` if it uses files. Update the existing entry rather than duplicating it

---

# Fallback: the file convention

Everything below applies **only** when the project has no `/techdebt-add` command and no
`techdebt/README.md` redirecting elsewhere.

## Folder Layout — Group by Service

Place all debt files under `<project-root>/techdebt/`, then into a **per-service subfolder** named after the affected service/module directory (e.g., the Maven module folder name in a backend monorepo, or the package/workspace name in a frontend monorepo).

| Scope of the debt | Destination |
|---|---|
| Affects exactly one service/module | `techdebt/<service>/` |
| Requires coordinated changes in 2+ services/modules to fix | `techdebt/global/` |
| Affects infrastructure, CI/CD, build tooling, or cross-cutting conventions | `techdebt/global/` |

Rules:
- Use the **exact folder name** of the service as it appears in the repository root (e.g., `techdebt/ingestion/`, `techdebt/fairy-book-gateway/`, `techdebt/organizations/`). Do not invent abbreviations or alternate spellings.
- Create the service folder if it does not yet exist.
- Only use `techdebt/global/` when the fix genuinely requires editing 2+ services. A debt that is *about* a cross-service pattern but whose fix lives in a single shared module goes under that module's folder, not `global/`.
- A debt that spans a service + its gateway (e.g., backend API change + frontend hook change in the app's own gateway) goes under the service folder that owns the root cause, not `global/`. Use `global/` only when the coordination genuinely spans multiple independently-deployed services.

If the project has no clear multi-service structure (single-service repo), omit the per-service grouping and place files directly in `techdebt/`.

## File Naming

Format: `{criticality}-{complexity}-{kebab-case-description}.md`

### Criticality (primary sort — most critical first)

| Prefix | Level | When to use |
|--------|-------|-------------|
| `1` | Critical | Security vulnerabilities, data loss risks, production breakage potential |
| `2` | High | Bugs waiting to happen, missing tests for critical paths, wrong access control |
| `3` | Medium | Code quality issues, missing patterns, inconsistencies across services |
| `4` | Low | Nice-to-have improvements, cosmetic issues, minor inconsistencies |

### Complexity (secondary sort — easiest fixes first)

| Prefix | Level | Estimated effort |
|--------|-------|------------------|
| `1` | Trivial | < 30 min, single file change |
| `2` | Small | 1-2 hours, few files |
| `3` | Medium | Half day, multiple files/components |
| `4` | Large | 1-3 days, cross-cutting changes |
| `5` | Epic | 3+ days, architectural changes |

### Examples

```
techdebt/
├── global/
│   ├── 1-3-jwt-role-extraction-drift-across-services.md
│   ├── 2-2-add-version-to-all-jhipster-entities.md
│   └── 3-2-jhipster-hashcode-pattern-degradation.md
├── orders/
│   ├── 2-2-order-service-missing-unit-tests.md
│   └── 4-1-unused-import-in-order-resource.md
├── payments/
│   ├── 3-2-hardcoded-stripe-webhook-url.md
│   └── 3-3-inconsistent-error-handling-payments.md
├── studio/
│   └── 2-4-missing-dao-pattern-studio-service.md
└── ingestion/
    └── 1-1-missing-auth-check-on-admin-endpoint.md
```

Filenames do NOT repeat the service name — the containing folder already conveys that. Prefer `2-2-order-service-missing-unit-tests.md` → `orders/2-2-missing-unit-tests.md` when creating new entries. Existing files may retain service names in their filenames for backward compatibility.

## Debt File Template

```markdown
# [Short descriptive title]

| Field | Value |
|-------|-------|
| Criticality | Critical / High / Medium / Low |
| Complexity | Trivial / Small / Medium / Large / Epic |
| Location | `service/path/to/File.java:42` |
| Found during | [task context: feature dev, code review, debugging, etc.] |
| Date | YYYY-MM-DD |

## Issue

[Detailed description of the technical debt. What is wrong, what pattern is violated, what is missing. Include code snippets if helpful.]

## Risks

[What could go wrong if this is not addressed. Be specific — data leaks, performance degradation, production incidents, maintenance burden, etc.]

## Suggested Solutions

[1-3 concrete approaches to resolve this. Include trade-offs if relevant.]
```
