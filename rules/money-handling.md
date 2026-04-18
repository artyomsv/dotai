# Money Handling

## All monetary amounts must be stored as cents (long)

- Store prices, fees, totals, and any monetary values as **integer cents** (`long` in Java, `number` in TypeScript)
- Never use `BigDecimal`, `double`, or `float` for money storage or transfer
- Display formatting (e.g., `$29.00`) happens **only** at the presentation layer (frontend or API response serialization)

### Java

```java
// BAD
@Column(precision = 12, scale = 2)
private BigDecimal priceMonthly;  // 29.00

// GOOD
@Column(nullable = false)
private Long priceMonthly;  // 2900 (cents)
```

### TypeScript

```typescript
// BAD
interface Plan {
  price: number; // 29.99 — floating point
}

// GOOD
interface Plan {
  priceCents: number; // 2999
}
```

### Database (Liquibase)

```xml
<!-- BAD -->
<column name="price" type="decimal(12,2)"/>

<!-- GOOD -->
<column name="price_monthly" type="bigint"/>
```

### Naming Convention

- Column/field names should include the unit when ambiguous: `priceMonthly` (if context is clear it's cents) or `priceMonthlyCents` (if mixed contexts exist)
- Avoid suffixing everything with `Cents` when the entire domain uses cents — it's implied

### Arithmetic

- Perform all arithmetic in cents — no conversion to decimals mid-calculation
- Round **once** at the final display step, not during intermediate calculations
- For percentage-based discounts: `discountedPrice = price * (100 - discountPercent) / 100`

### Millicents for sub-cent precision

For values too small for cents (e.g., AI request costs, per-token pricing), use **millicents** (1/1000 of a cent, 1/100,000 of a dollar):

| Unit | Multiplier | Example: $0.00015/token |
|------|-----------|------------------------|
| Dollars | 1 | 0.00015 |
| Cents | 100 | 0.015 |
| Millicents | 100,000 | 15 |

```java
// AI usage tracking — millicents
@Column(nullable = false)
private Long costMillicents;  // 15 = $0.00015

// Converting millicents to display dollars
double displayDollars = costMillicents / 100_000.0;
```

- Suffix fields with `Millicents` to distinguish from cents: `costMillicents`, `tokenPriceMillicents`
- Convert millicents → cents only at aggregation/billing boundaries: `totalCents = totalMillicents / 1000`

### Exceptions

- Third-party APIs that require decimal format (e.g., Stripe `amount` is already in cents, but some APIs use decimals): convert at the boundary only
- Currency display: format at the frontend using `Intl.NumberFormat` or equivalent
