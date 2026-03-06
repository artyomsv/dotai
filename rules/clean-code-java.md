---
paths:
  - "**/*.java"
---

# Clean Code — Java

## Method Size
- **Max 30 lines** (ideal ≤20). Extract helper methods for distinct logic blocks.
- Each method does ONE thing at ONE level of abstraction.

## Class Size
- **Max 300 lines**. Split into collaborators, strategies, or inner services.

## Parameters
- **Max 3 parameters**. For 4+, introduce a parameter object (record or DTO).
- **No boolean flag params** — split into two named methods instead.

```java
// BAD
void export(Order order, boolean includeDetails) { ... }

// GOOD
void exportSummary(Order order) { ... }
void exportWithDetails(Order order) { ... }
```

## Optional Handling

- Always use `orElseThrow()` instead of `get()` when dereferencing Optional values
- Never use `Optional` as a method or constructor parameter
- Use `@Autowired(required = false)` for optional Spring beans
- Prefer `orElseThrow(() -> new NotFoundException("..."))` with a descriptive message

```java
// BAD
Optional<User> user = findUser(id);
String name = user.get().getName();

// GOOD
String name = findUser(id)
    .orElseThrow(() -> new NotFoundException("User not found: " + id))
    .getName();
```

- Use `map`/`flatMap` for chained transformations instead of nested `isPresent()` checks:

```java
// BAD
Optional<Order> order = findOrder(id);
if (order.isPresent()) {
    Optional<Address> addr = order.get().getShippingAddress();
    if (addr.isPresent()) {
        return addr.get().getCity();
    }
}
return "unknown";

// GOOD
return findOrder(id)
    .flatMap(Order::getShippingAddress)
    .map(Address::getCity)
    .orElse("unknown");
```

## Records vs Classes

- Use `record` for immutable data carriers (DTOs, value objects, parameter objects)
- Use `class` when you need mutability, inheritance, or complex behavior
- Records are ideal for: API request/response types, Event Bus messages, configuration groups

```java
// Parameter object — perfect for record
record OrderFilter(String status, LocalDate from, LocalDate to) {}

// Mutable entity — use class
class Order { ... }
```

## Exception Handling
- Catch **specific** exceptions, never bare `Exception` or `Throwable`.
- Never swallow exceptions (log-only without rethrow). Either handle, rethrow, or wrap.

```java
// BAD
try { ... } catch (Exception e) { log.error("failed", e); }

// GOOD
try { ... } catch (StripeException e) {
    throw new PaymentProcessingException("Charge failed for order " + orderId, e);
}
```

## Magic Values
- Extract magic strings and numbers to `static final` constants or enums.
- Allowed literals: `0`, `1`, `""`, `true/false`, collection initializers.

```java
// BAD
if (status.equals("PENDING_REVIEW")) { ... }

// GOOD
private static final String PENDING_REVIEW = "PENDING_REVIEW";
if (status.equals(PENDING_REVIEW)) { ... }
// or better: use an enum
```

## Variable Scope
- Declare variables as close to first usage as possible.
- Prefer loop-scoped variables over method-scoped ones.

## Guard Clauses
- Return early to reduce nesting depth. Max 2 levels of nesting inside a method.

```java
// BAD
void process(Order order) {
    if (order != null) {
        if (order.isPaid()) {
            // 20 lines of logic
        }
    }
}

// GOOD
void process(Order order) {
    if (order == null) return;
    if (!order.isPaid()) return;
    // 20 lines of logic
}
```

## Stream Pipelines
- Max 5 chained operations. Extract intermediate results for longer chains.
- Name complex lambdas — extract to a method reference or named variable.
