---
paths:
  - "**/*.java"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.py"
---

# Clean Code — General (All Languages)

## Naming

- **Intent-revealing**: name describes what, not how. `remainingRetries` not `r` or `count`.
- **No abbreviations** except well-known: `ID`, `URL`, `API`, `DTO`, `HTTP`, `UUID`.
- **Booleans**: prefix with `is`, `has`, `should`, `can` — e.g., `isActive`, `hasPermission`.
- **Methods/functions**: start with a verb — `calculateTotal()`, `fetchOrders()`, `validateInput()`.
- **Collections**: plural nouns — `orders`, `activeUsers`, `pendingPayments`.

```java
// BAD
int d; // elapsed time in days
boolean flag;
void process();

// GOOD
int elapsedDays;
boolean isExpired;
void processRefund();
```

## Comments

- Explain **why**, never **what**. Code should be self-documenting for "what".
- **TODOs must reference a GitHub issue**: `// TODO #123: migrate to new pricing API`
- **No commented-out code** — delete it; git has history.

```java
// BAD
// increment counter
counter++;

// GOOD
// Rate limit resets at midnight UTC per Stripe docs
counter = 0;
```

## Function/Method Length

- Keep functions short and focused — ideally under 20 lines, max 30.
- Each function does ONE thing at ONE level of abstraction.
- If you describe a function and use **"and"**, it does too much — split it.

## File Organization

- Order: imports → constants/types → main implementation → helpers
- Group related functions together.
- Keep files under ~300 lines — split when they grow larger.

## Error Messages

- Error messages should be **actionable**: say what went wrong AND what to do.
- Include relevant context (IDs, values, expected vs actual).

```java
// BAD
throw new RuntimeException("Invalid state");

// GOOD
throw new IllegalStateException("Order " + orderId + " is CANCELLED, expected PENDING. Cannot process payment.");
```

## DRY — Don't Repeat Yourself

- **3+ identical lines** appearing in **2+ places** → extract to a shared method/function/component.
- Tolerate minor duplication if extraction creates unclear abstractions.

## Hardcoded Configuration

- **Java**: use `@Value("${...}")` or `application.yml` properties.
- **TypeScript**: use environment variables or config files.
- **Python**: use `BaseSettings` (Pydantic) or environment variables.
- Never hardcode URLs, API keys, feature flags, or environment-specific values.

## Single Responsibility

- If you describe a class/function/component and use **"and"**, it does too much — split it.
- One reason to change per unit of code.

## Return Early

- Prefer guard clauses over nested `if/else`. Reduces indentation and cognitive load.
- Max 2 levels of nesting inside a method.

```typescript
// BAD
function getDiscount(user: User) {
  if (user) {
    if (user.isPremium) {
      return 0.2;
    } else {
      return 0;
    }
  }
  return 0;
}

// GOOD
function getDiscount(user: User) {
  if (!user) return 0;
  if (!user.isPremium) return 0;
  return 0.2;
}
```

## Law of Demeter

- Don't chain through multiple objects: `order.getCustomer().getAddress().getCity()`.
- Instead, ask the immediate collaborator: `order.getShippingCity()`.
