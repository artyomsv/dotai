---
paths:
  - "**/*Resource.java"
  - "**/*Controller.java"
  - "**/router.py"
  - "**/routes/*.py"
  - "**/openapi.yaml"
  - "**/openapi.json"
---

# API Versioning & Contracts

REST APIs are contracts. A contract breakage that ships before its consumers migrate breaks production for someone else. This rule defines when versioning is required, how to signal deprecation, and what counts as backward-compatible.

## When to bump the version

Version the URL (`/api/v1/...` → `/api/v2/...`) when:

- A response field is **removed** or **renamed** (not just reordered)
- A response field's **type** changes (`string` → `integer`, `array` → `object`)
- A request field becomes **required** where it was optional before
- A request field's **validation** tightens (e.g., stricter regex, lower max length)
- An endpoint is **removed** (always break with deprecation first — see below)
- Response **semantics** change even if the shape is the same ("status=200 used to mean X, now means X+Y")

Do NOT bump the version for:
- Adding a new response field (consumers should ignore unknown fields)
- Adding a new optional request field (with safe default)
- Adding a new endpoint
- Fixing a bug that was returning garbage
- Performance improvements that don't change shape

## URI versioning

Convention: `/api/v{N}/...` — integer, starts at `v1`. Omit `v` prefix is **not** allowed (`/api/1/...` is wrong).

For the three-tier access pattern in this monorepo (`public/protected/internal` — see `api-resources.md`), version after the tier:
- `/api/v1/orders` — protected
- `/api/public/v1/products` — public
- `/api/internal/v1/feature-flags` — internal

Header-based versioning (`Accept: application/vnd.app.v2+json`) is NOT used in this monorepo. URL versioning is easier to test, cache, and audit.

## Deprecation protocol

When an endpoint (or field) is being replaced:

1. **Ship the replacement** alongside the old one.
2. **Mark the old endpoint deprecated** in OpenAPI (`"deprecated": true`) and in code comments.
3. **Add response headers** on every call to the old endpoint:
   ```
   Deprecation: true
   Sunset: Wed, 01 Jul 2026 00:00:00 GMT
   Link: </api/v2/resource>; rel="successor-version"
   ```
4. **Log a WARN** every time a deprecated endpoint is called, with the caller's identity (user ID or service name).
5. **Monitor** that log for call volume. Do not delete until the number hits zero for at least one deploy cycle.
6. **Delete** only after the `Sunset` date has passed and call volume is zero.

Minimum deprecation window: **one full release cycle of the consuming services** (typically 90 days in this monorepo). For external consumers: 6 months.

## OpenAPI as the source of truth

Every service exposes its OpenAPI spec at `/v3/api-docs` (SpringDoc default). Service-to-service consumers that use generated Feign clients should regenerate when a contract changes.

- The spec should be generated from annotations + code, not hand-written.
- `@Operation`, `@ApiResponse`, `@Schema` annotations are REQUIRED on every public and internal REST endpoint.
- Every DTO field uses `@Schema(description = "...")` — no silent fields.
- Validate the spec in CI: reject PRs that regress the OpenAPI surface without a version bump.

## Additive changes (the safe path)

These are non-breaking and can ship without a version bump:

- New optional fields on requests (with server-side default)
- New fields on responses (consumers ignore unknown)
- New query parameters (with default behavior matching the old call)
- New endpoints
- Loosening validation (accepting more values than before)
- Returning additional response codes in cases that previously returned 500

## Enum safety

Enum values in responses are particularly dangerous. Consumers often `switch` exhaustively on enums.

- **Adding** an enum value is a breaking change for consumers that don't have a default branch. Protect by documenting: "consumers MUST handle unknown enum values as a safe default."
- **Removing** an enum value is always breaking.
- **Renaming** an enum value is always breaking.

When introducing a new enum response, default to an `OTHER` / `UNKNOWN` sentinel value to give consumers a migration path.

## Consumer-driven contract tests

For critical inter-service contracts (payments ↔ orders, ingestion → ai, workflows → anywhere), maintain consumer-driven contract tests using Spring Cloud Contract, Pact, or equivalent. A consumer service defines the shape it expects; the provider's CI runs those contracts against its actual endpoints.

Without contract tests, the first signal of a breakage is a prod incident.

## What NOT to do

- Do not delete a field "because nobody seems to use it" — add deprecation headers, wait, verify, then delete.
- Do not reuse a URL path for a different resource after deletion. `/api/v1/invoices` deleted, then later added back meaning something else, causes cache and client poisoning.
- Do not change the **status code** of an endpoint without a version bump (e.g., `200` → `201` on a `POST` is breaking for clients that strict-match the code).
- Do not return a different error shape from a handler that used to return RFC 7807 Problem responses — the error shape is part of the contract.
