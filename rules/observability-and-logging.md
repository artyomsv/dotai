# Observability & Logging

Logs, metrics, and traces are the only source of truth when something breaks in production. A service that fails silently is a service that takes an hour to diagnose.

## Structured JSON logging — always

Every backend service emits JSON-structured logs. Never string-concatenate contextual data — use MDC / structured fields so logs can be queried.

**Java (Logback + Logstash encoder):**
```java
// BAD — contextual data locked inside a string
log.info("Order " + orderId + " charged " + amount + " cents for user " + userId);

// GOOD — structured fields via MDC
MDC.put("orderId", orderId.toString());
MDC.put("userId", userId.toString());
try {
    log.info("Order charged");
} finally {
    MDC.remove("orderId");
    MDC.remove("userId");
}
```

Prefer `StructuredArguments.kv(...)` or equivalent when a single event has many fields — keeps MDC clean.

**Python (structlog or similar):**
```python
log.info("order_charged", order_id=order_id, user_id=user_id, amount_cents=amount)
```

**TypeScript (Node backend):**
```ts
log.info({ orderId, userId, amountCents }, 'order_charged');
```

## Mandatory MDC keys

Every log line MUST carry these fields when available:

| Key | Source | Purpose |
|---|---|---|
| `correlationId` / `traceId` | W3C traceparent header, OTel span | Cross-service request tracing |
| `userId` | JWT `sub` claim | Per-user debugging |
| `organizationId` / `tenant` | `OrganizationContext` or JWT claim | Multi-tenant isolation |
| `service` | Static config | Log aggregation filtering |
| `env` | `spring.profiles.active` or equivalent | dev / uat / prod |

`durationMs`, `httpStatus`, `endpoint`, `method` are added by HTTP access filters, not by application code.

## Log level discipline

| Level | When | Example |
|---|---|---|
| `TRACE` | Per-row processing inside a loop. Off in prod. | "scanning file 42/1000" |
| `DEBUG` | Diagnostic detail useful when investigating. Off in prod. | "Feign response status=200, body-length=1247" |
| `INFO` | Business-meaningful events. One per request/consumer message max. | "order_created", "invoice_sent" |
| `WARN` | Recoverable problem, someone should see it eventually. | "retrying Feign call after timeout (attempt 2/3)" |
| `ERROR` | Unrecoverable failure that affects a user or dropped a message. | "DLQ: permanent failure processing invoice 123" |

Rules:
- No `INFO` inside a tight loop — use `DEBUG` or `TRACE`.
- No `ERROR` for expected domain outcomes (e.g., "user not found" on a lookup isn't an ERROR — it's a 404).
- Every `ERROR` log must include the exception as a second argument, not `e.getMessage()` (`log.error("failed", e)` — NOT `log.error("failed: " + e.getMessage())`).
- `WARN` without an action implied is just noise — either suppress or promote to `ERROR`.

## Never log

- **Secrets**: API keys, passwords, JWT tokens, session IDs, webhook secrets, OAuth refresh tokens.
- **PII**: full card numbers, full SSN/NINO, full email, unredacted addresses, date of birth, phone number, passport number.
- **Raw request bodies** on endpoints that accept the above.
- **User-provided content** that could include the above — no logging of full emails, full chat messages, or full file contents.

Redact or hash at the log-call site:
```java
log.info("User authenticated", kv("emailHash", sha256(email.substring(0,6) + "...")));
```

## Tracing

- Use OpenTelemetry (or the JHipster-shipped `spring-cloud-sleuth` equivalent) — already wired in this monorepo via the `zipkin` profile.
- Span name format: `<service>.<method>` (e.g., `payments.chargeOrder`, `ai.generateCharacter`). Never include dynamic data (user IDs, order IDs) in span name — put those in attributes.
- Every outbound HTTP call propagates `traceparent` automatically through Feign / `httpx` / `fetch`. Verify this by inspecting a downstream request's headers in any trace.
- Feign interceptors MUST NOT strip the `traceparent` header when copying other headers.

## Metrics

- Prefer declarative Micrometer / `prometheus_client` counters and histograms over ad-hoc log parsing.
- Counter names use `_total` suffix (`orders_charged_total`), histograms use `_seconds` (`http_request_duration_seconds`).
- Tag cardinality MATTERS: never tag by `userId`, `orderId`, or any unbounded value — only by small enums (status, method, endpoint template).

## Health & readiness endpoints

| Endpoint | Purpose | Must return |
|---|---|---|
| `/management/health/liveness` | "is the process alive" | 200 if the event loop is responsive |
| `/management/health/readiness` | "can it handle traffic" | 200 only if DB reachable, message broker reachable, downstream-critical services reachable |
| `/management/info` | Build/version info | Git commit, version, build time |

Readiness MUST fail when a hard dependency is down. A "green" readiness that actually depends on a broken DB will cause the orchestrator to keep routing traffic to a doomed pod.

## What NOT to do

- Do not `System.out.println` — ever — in production code.
- Do not swallow an exception with only a log; either rethrow, wrap, or handle.
- Do not change log level via `println` or manipulate `Logger` at runtime from application code.
- Do not log "entering method X" / "exiting method X" — that's what tracing spans are for.
- Do not emit the same event at multiple levels ("ERROR: failed" immediately followed by "WARN: retrying") — pick one, convey the state change clearly.
