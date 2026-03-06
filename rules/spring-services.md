---
paths:
  - "**/*Service.java"
  - "**/*ServiceImpl.java"
  - "**/*Resource.java"
  - "**/*Controller.java"
  - "**/*Configuration.java"
---

# Spring Service & Controller Rules

## Dependency Injection

- **Constructor injection only** — no field injection with `@Autowired`
- Spring auto-wires single-constructor classes — no `@Autowired` annotation needed
- Use `@Autowired(required = false)` only for genuinely optional beans

```java
// BAD — field injection
@Autowired
private OrderRepository orderRepository;

// GOOD — constructor injection (auto-wired by Spring)
private final OrderRepository orderRepository;

public OrderService(OrderRepository orderRepository) {
    this.orderRepository = orderRepository;
}
```

## Stereotype Annotations

- `@Service` — business logic classes
- `@Component` — generic Spring-managed beans (utilities, adapters)
- `@Repository` — data access (Spring translates persistence exceptions)
- `@RestController` — REST endpoints
- Don't use `@Component` when `@Service` or `@Repository` is more specific

## Transaction Management

- Use `@Transactional` at service layer, not repository layer
- Use `@Transactional(readOnly = true)` for read-only operations
- Keep transactional methods short — don't wrap entire service methods unnecessarily

## Spring Profiles

- Use `@Profile("dev")` / `@Profile("prod")` for environment-specific beans
- Configuration properties in `application-{profile}.yml`
- Never hardcode environment detection — rely on active profiles

## Code Style

- Java 21, 4-space indentation
- UTF-8 encoding, LF line endings
- Checkstyle enforces NoHttp (no insecure HTTP URLs)
