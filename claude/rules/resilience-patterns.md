---
paths:
  - "**/*Service.java"
  - "**/*Client.java"
  - "**/*Gateway.java"
  - "**/*.py"
  - "**/*.go"
---

# Resilience Patterns for External Calls

Every outbound call — HTTP, messaging, DB, cache — is a point where your service's availability depends on someone else's. Without explicit resilience policies, one slow downstream takes out the calling service under load.

## The Four Rules (mandatory on every outbound call)

1. **Timeout** — no call runs longer than a bounded time
2. **Retry policy** — bounded attempts, exponential backoff with jitter
3. **Circuit breaker** — after N consecutive failures, stop calling for a cooldown window
4. **Bulkhead** — one slow downstream cannot exhaust the thread pool for unrelated work

Missing any of these on a hot path is a production incident waiting to happen.

## Timeouts — mandatory

Every HTTP client, DB query, cache call, and message-send MUST have an explicit timeout. The framework default is usually "infinite" or "very long" — both are wrong.

**Java (Feign + Spring):**
```yaml
feign:
  client:
    config:
      default:
        connect-timeout: 2000     # 2s TCP
        read-timeout: 5000        # 5s end-to-end
      products-client:
        read-timeout: 10000       # override per client if needed
```

**Java (JDBC / Hibernate):**
```yaml
spring:
  datasource:
    hikari:
      connection-timeout: 5000
  jpa:
    properties:
      jakarta.persistence.query.timeout: 10000   # 10s per query
```

**Python (httpx):**
```python
client = httpx.AsyncClient(timeout=httpx.Timeout(connect=2.0, read=5.0, write=5.0, pool=10.0))
```

**Go:**
```go
ctx, cancel := context.WithTimeout(parent, 5*time.Second)
defer cancel()
resp, err := client.Do(req.WithContext(ctx))
```

Timeout values are configurable per-environment but must never be unset.

## Retry Policy

Retry only **idempotent** calls (GET requests, UPSERTs with a unique key, message handlers with idempotency keys). Never retry a non-idempotent POST unless an idempotency key is present.

**Parameters to set explicitly:**
- Max attempts: typically 3
- Backoff: exponential (base 2), starting at ~100ms, capped at ~10s
- Jitter: ±25% random — prevents synchronized retry storms across replicas
- Retry-on: connection errors, 5xx, 408, 429 — NOT on 4xx (they won't succeed next time)

**Java (Resilience4j):**
```java
@Retry(name = "products-client", fallbackMethod = "fallback")
public Product fetchProduct(Long id) { ... }
```
```yaml
resilience4j:
  retry:
    instances:
      products-client:
        max-attempts: 3
        wait-duration: 100ms
        exponential-backoff-multiplier: 2
        retry-exceptions:
          - java.net.SocketTimeoutException
          - feign.RetryableException
```

**Python (tenacity):**
```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_random_exponential(multiplier=0.1, max=10),
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.ConnectError)),
)
async def fetch_product(id: int): ...
```

## Circuit Breaker

Open the circuit after N failures in a rolling window; half-open to probe after a cooldown; close when probes succeed. Prevents the calling service from spinning on a dead dependency.

**Resilience4j:**
```yaml
resilience4j:
  circuitbreaker:
    instances:
      products-client:
        failure-rate-threshold: 50         # open at 50% failures
        minimum-number-of-calls: 10        # over the last 10 calls
        wait-duration-in-open-state: 30s
        permitted-number-of-calls-in-half-open-state: 3
        sliding-window-size: 20
```

Every `@FeignClient` in this monorepo MUST have a circuit-breaker config entry. If the client is not critical, still set loose thresholds — the point is explicit policy, not no-policy.

## Bulkhead

A slow call to service A should not block threads from serving requests that call service B. Separate thread pools (or semaphores for non-blocking code) per downstream.

**Java (Resilience4j semaphore bulkhead — low overhead):**
```yaml
resilience4j:
  bulkhead:
    instances:
      products-client:
        max-concurrent-calls: 20
        max-wait-duration: 100ms
```

For blocking calls, use `THREADPOOL` bulkheads with a dedicated executor.

## Idempotency for mutating calls

Every mutating call that may be retried MUST carry an idempotency key. The receiver deduplicates by storing processed keys. See `stripe-integration.md` for the reference pattern; apply the same discipline to any service-to-service mutation that crosses a timeout boundary.

## Fail-open vs fail-closed — always explicit

When a dependency is down and the retry/circuit-breaker policy has exhausted, the code must make a deliberate choice:

- **Fail-open** — degrade gracefully, return partial or empty data, log a WARN, keep the user flow alive. Appropriate for: recommendations, enrichment, analytics, cosmetic UI data.
- **Fail-closed** — propagate the error, let the user see a 503, refuse the operation. Appropriate for: payments, auth, data-integrity operations.

**This choice is documented in code**, not inferred:

```java
// BAD — hidden fail-open
public List<Recommendation> recommend(Long userId) {
    try { return recommenderClient.fetch(userId); }
    catch (Exception e) { return List.of(); }   // silent degradation
}

// GOOD — explicit, traceable
public List<Recommendation> recommend(Long userId) {
    try {
        return recommenderClient.fetch(userId);
    } catch (CallNotPermittedException | FeignException e) {
        // Fail-open: recommendations are enhancement, not core. Prod incident: see INCIDENT-123.
        log.warn("recommendations_unavailable", kv("userId", userId), e);
        meterRegistry.counter("recommendations_fail_open").increment();
        return List.of();
    }
}
```

## What NOT to do

- Do not set timeouts only on "production" configs and leave dev as "infinite" — a bug the local dev test misses is still a bug.
- Do not retry 4xx responses.
- Do not retry non-idempotent mutations without an idempotency key.
- Do not `Thread.sleep` in retry logic — use the framework's backoff so it cooperates with the circuit breaker and doesn't starve thread pools.
- Do not swallow `CallNotPermittedException` (circuit open) as if the call had succeeded with empty data unless that's an explicit fail-open decision.
- Do not use retries as a substitute for fixing an underlying flaky dependency.
