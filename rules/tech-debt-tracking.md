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

## Behavior

- **Proactive**: Create debt files automatically whenever you spot issues — no user confirmation needed
- **Non-blocking**: Mention created debt files in your response, but don't let debt tracking interrupt the primary task
- **Duplicate-aware**: Before creating a new file, check if a similar debt already exists in `techdebt/`. Update the existing file instead of creating a duplicate

## Folder

Place all debt files in `<project-root>/techdebt/`. Create the folder if it doesn't exist.

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
├── 1-1-missing-auth-check-on-admin-endpoint.md
├── 1-3-sql-injection-in-search-query.md
├── 2-2-order-service-missing-unit-tests.md
├── 2-4-missing-dao-pattern-studio-service.md
├── 3-2-hardcoded-stripe-webhook-url.md
├── 3-3-inconsistent-error-handling-payments.md
├── 4-1-unused-import-in-profile-service.md
└── 4-5-migrate-deprecated-http-client.md
```

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
