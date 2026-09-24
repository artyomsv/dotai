---
paths:
  - "**/*Dto.java"
  - "**/*View.java"
  - "**/*Payload.java"
  - "**/*Request.java"
  - "**/*Response.java"
  - "**/dto/**"
  - "**/payload/**"
  - "**/web/rest/**/*.java"
---

# DTO / View / Payload Naming

When introducing a new transport type, pick from exactly three names. Don't invent a fourth.

## The three names

### `*Dto` — the default

Use for request bodies, response bodies, and cross-tier carriers (controller → service → repository or vice versa). Mutable or immutable. Includes `*Request` / `*Response` as the conventional names when paired with a specific endpoint.

`*Dto` is the safe default. If you can't decide, name it `*Dto` and move on.

### `*View` — read-only projection

Use this name only when **both** are true:

- The type is intentionally narrower than the underlying entity (subset of columns / fields), AND
- It is read-only on every code path (no setters, no mutation, no builders that produce a different shape).

A type with setters is a `*Dto`, even if its current callers only read it. A type that round-trips back to the wire as a request body is a `*Dto`. `*View` is reserved for "I just want these five columns of `User` for the recruiter dashboard."

### `*Payload` — RabbitMQ envelope inner

Use exclusively for the record carried inside `DomainEventEnvelope<T>` for RabbitMQ events. The wrapper is `DomainEventEnvelope`, the inner is `*Payload`. Wire shape. Pair file lives in `messaging/payload/` per service.

## Tiebreaker

When in doubt, default to `*Dto`. The cost of an extra `*Dto` is zero — the cost of an over-promoted `*View` that later grows a setter is a rename PR.

## Renames

Renames to align existing code with this rule **go in their own commit**, never bundled with feature work. Mixed-purpose commits make the rename invisible in code review and break `git blame` on unrelated lines.
