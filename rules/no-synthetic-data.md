# No Synthetic Data — Strict Rule

## Core principle

**Never fabricate data that can be confused with real data.** Not in databases, not in test fixtures, not in frontend stubs, not in API responses, not in documentation examples that get rendered.

If a user opens the app and sees a row, a chart, a number, or a record, they must be able to trust that it came from a real observation of the real world — not something made up to "show what the feature would look like."

## Why this rule exists

Fabricated data that *looks* real but *isn't* real causes three concrete harms:

1. **Misleads the user.** They make decisions (trading, investing, medical, legal, operational) against numbers that don't correspond to reality.
2. **Contaminates measurement.** Win rates, hit rates, activity metrics, dashboards — any aggregate computed over a dataset that mixes real and fake data is wrong, and the error is invisible.
3. **Destroys trust.** Once the user discovers one fake row they didn't know about, they stop trusting every other row.

This rule exists because I once inserted "plausible-looking" test rows (`ETH @ $3500`, `SOL @ $150`) into a trade-tracking DB to verify a UI rendered, and they blended into the real ledger indistinguishably. The user caught it and rightly flagged it as a trust violation.

## What is forbidden

Do NOT, under any circumstance:

- **Insert "plausible" rows into a database** the user will query. This includes `INSERT` statements with round-number prices, memory-recalled market values, or "roughly what the market looked like" numbers.
- **Seed production-shaped tables with fabricated historical data** ("here's what a week of signals might look like") — even temporarily, even for "UI verification."
- **Hardcode realistic mock API responses** in frontend code that get rendered as if they were real. If a component would show "$42,153.18" as a real price, it must not show "$42,153.18" from a fake source.
- **Use historical market prices from memory** when generating test values. Market prices from 2022 look real in 2024 and lie in 2026.
- **Ship fallback data** that masquerades as live data when the backend is down. Show an error state or `—`, not a stale-looking "last known value" that was never known.
- **Commit seed/fixture files** that populate tables the user will read through the normal UI (sample_trades.sql, demo_signals.json, etc.).

## What is allowed

- **Reading from real live APIs** before any demo. If you need sample data to verify a UI, `curl` the live endpoint and use whatever it returns — that's real data by definition.
- **Pure-function unit tests** with hardcoded inputs/outputs. `assertEquals(100.0, calculatePressure(1000000, 0))` is fine because those numbers never become user-visible state; they only drive a formula assertion in an isolated test JVM.
- **Bootstrap configuration** that contains real references: real ticker symbols, real RSS URLs, real exchange endpoints, real default intervals. A list of `["BTCUSDT", "ETHUSDT", ...]` is not fake data — those pairs exist.
- **Obviously-synthetic placeholders** that cannot possibly be mistaken for real values: `$0.01`, `$0.00`, `TEST`, `CANARY`, IDs prefixed with `TEST-` or `CANARY-`, timestamps set to `1970-01-01`.
- **HTML `placeholder=""` hints** on empty form inputs — those are UX affordances, not data.
- **Empty states** in the UI (`—`, `No data yet`, spinners). These are *honest* about the absence of data.

## If you genuinely need to smoke-test a feature with data

Follow this protocol, in order of preference:

1. **Best: wait for real data to arrive.** If the feature is a signal tracker, let the signal engine fire a real signal. Patience over fabrication.
2. **Good: fetch live data and pipe it through the feature.** `curl /api/market/prices` → take a real row → use THAT real row to verify the UI. Read-only real data is not synthetic data.
3. **Acceptable: use obviously-synthetic markers with cleanup on success.** If you must insert rows:
   - Prefix every ID with `TEST-` or `CANARY-` so it's self-labeling
   - Use values that clearly cannot be real (`$0.01`, `symbol='TESTUSDT'`, `strategy='DEBUG-SMOKE'`)
   - Tell the user in the same message what you inserted, where, and the exact `DELETE` command to remove it
   - Delete immediately after verification, in the same session
   - Never leave it for "the user to clean up later"
4. **Unacceptable: memory-recalled plausible values** like `ETH $3500`. This is the specific failure mode the rule exists to prevent.

## Visibility rule for any unavoidable test data

If test data exists in a real table during development, **the UI must filter it out by default**. Either:
- A `WHERE strategy NOT LIKE 'DEBUG-%'` clause at the query layer, or
- A separate DB schema (`test.signal_outcomes`) that production queries don't hit, or
- A feature flag (`showDebugRows: false`) that hides it from normal views.

The default state of any user-facing query must return zero fabricated rows.

## Cleanup contract

Any test data you create must be removable by a **single simple WHERE clause** the user can copy-paste. If it can't be cleaned up with one command, it shouldn't have been created.

Example acceptable cleanup:
```sql
DELETE FROM signal_outcomes WHERE signal_id LIKE 'TEST-%';
```

Not acceptable: "delete these 5 specific rows by composite key, but be careful not to touch the other 3."

## When in doubt

If you're about to insert, write, or render a value and can't answer *"where did this number come from, and can I point to its real-world source?"* — **don't write it.** Ask the user instead, or wait for real data.

The cost of waiting for real data is seconds. The cost of polluted data is trust.
