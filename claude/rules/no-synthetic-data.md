# No Synthetic Data

**Never fabricate data that can be confused with real data.** Not in databases, fixtures,
frontend stubs, API responses, or rendered doc examples. If a user sees a row, chart or
number in the app, it must come from a real observation of the real world.

Why: plausible fake data misleads decisions, silently corrupts every aggregate computed over
the table, and destroys trust the moment one fake row is found. This rule exists because
plausible test trades (`ETH @ $3500`) once blended into a real ledger indistinguishably.

## Forbidden
- `INSERT` of plausible rows into any table the user queries. Not "temporarily", not "for a UI check".
- Seed or fixture files that populate user-visible tables (`sample_trades.sql`, `demo_signals.json`).
- Hardcoded realistic mock API responses that render as real values.
- Market prices or other figures recalled from memory. They look real now and lie later.
- Fallback data shown as live when the backend is down. Show an error state or `—`.

## Allowed
- Real data read from live APIs or the real DB.
- Pure-function unit tests with hardcoded inputs that never become user-visible state.
- Bootstrap config with real references (real tickers, real URLs, real endpoints).
- Obviously synthetic placeholders: `$0.00`, `$0.01`, `TEST`, `CANARY`, ids prefixed `TEST-` / `CANARY-`, timestamp `1970-01-01`.
- HTML `placeholder=""` hints and honest empty states (`—`, `No data yet`, spinners).

## If you must smoke-test with data
1. Best: wait for real data to arrive.
2. Good: fetch a real row from the live endpoint and pipe that through the feature.
3. Acceptable: self-labelling rows (`TEST-` ids, `symbol='TESTUSDT'`, `strategy='DEBUG-SMOKE'`),
   announced to the user in the same message with the exact `DELETE`, removed in the same session.
   User-facing queries must filter such rows out by default (WHERE clause, separate schema, or flag).
4. Never: memory-recalled plausible values.

Cleanup must be one simple WHERE clause the user can paste, for example
`DELETE FROM signal_outcomes WHERE signal_id LIKE 'TEST-%';`.

When in doubt: if you cannot name the real-world source of a value, do not write it. Ask or wait.
