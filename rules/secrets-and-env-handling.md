# Secrets & Environment Variables

Secrets (API keys, passwords, JWT signing keys, database credentials, OAuth client secrets) and environment-specific configuration (URLs, feature flags, timeouts) travel different paths from source code. Confusing them leaks prod credentials into git or ships hardcoded dev URLs to production.

## Secrets — where they live

| Environment | Storage | How services read it |
|---|---|---|
| Local dev | `.env` files (gitignored) + Docker compose `env_file:` | Process env var |
| CI | GitHub Actions secrets (`${{ secrets.X }}`) | Injected at job runtime |
| Kubernetes (UAT/PROD) | Kubernetes `Secret` resources (ideally SealedSecrets, ExternalSecrets, or Vault) | Env var via `envFrom:` or `valueFrom.secretKeyRef:` |

Never acceptable:
- `.env` with real values in git
- Hardcoded secrets in `application.yml`, `application-prod.yml`, `docker-compose.yml`
- Secrets in image layers (`ENV API_KEY=...`, `ARG API_KEY`, `COPY .env`)
- Secrets in Liquibase changelogs, SQL scripts, seed data
- Secrets in source comments ("TODO: rotate this key")

## The `.env.example` contract

Every service that reads env vars ships a `.env.example` at the repo root of its directory. Every key that exists in any `.env` must be present in `.env.example` — with a **safe placeholder**, never the real value:

```bash
# Good .env.example
STRIPE_API_KEY=sk_test_REPLACE_ME
DATABASE_PASSWORD=CHANGE_ME
OPENAI_API_KEY=sk-REPLACE_ME

# Bad — leaks real values
STRIPE_API_KEY=sk_live_51H...actualKey
```

The example file is the contract: "here are all the env vars you must set." Running a service against a checked-out repo without a filled-in `.env` must fail fast with a clear error — see the "no defaults" rule below.

## No Default Values on Env Var Reads — fail fast

Never provide a fallback/default when reading a secret or environment-specific config. A missing value must produce a startup error pointing at the exact variable, not a silent fallback that only misbehaves in production.

**Java (Spring):**
```java
// BAD — silent fallback masks misconfiguration
@Value("${app.stripe.key:sk_test_default}")
private String stripeKey;

// GOOD — missing env var → BeanInitializationException at startup
@Value("${app.stripe.key}")
private String stripeKey;
```

**FastAPI (Pydantic):**
```python
# BAD
class Settings(BaseSettings):
    stripe_key: str = "default"

# GOOD
class Settings(BaseSettings):
    stripe_key: str  # no default — Pydantic raises ValidationError if missing
```

**TypeScript (Vite / Node):**
```ts
// BAD
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// GOOD
const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) throw new Error('VITE_API_URL is required');
```

Defaults are acceptable ONLY for true feature flags and tuning knobs where a safe default is genuinely desired in all environments (e.g., `app.pagination.default-size:20`). For anything that is environment-specific (URLs, credentials, quotas), no default.

## Rotation

- Prod credentials rotate on a schedule (quarterly for API keys, annually for JWT signing keys, immediately on suspected leak).
- Rotation procedure: provision new credential → deploy app reading both old + new → invalidate old → remove old-credential reading code.
- Document the rotation in a runbook, not in code comments.

## If a secret leaks into git

1. Revoke the credential immediately (rotate at the issuer — Stripe dashboard, Keycloak realm, etc.) — rewriting git history does NOT recover leaked values that have been cloned.
2. Rotate the credential everywhere it is referenced.
3. Remove from history with `git filter-repo` or BFG (on a coordinated branch — warn collaborators before rewriting shared history).
4. Post-mortem: what check should have caught this? Add pre-commit hooks (gitleaks, trufflehog) or CI scans.

## Detection

- Run `gitleaks detect` or `trufflehog` in CI on every PR.
- `.gitignore` must list: `.env`, `.env.local`, `.env.*.local`, `credentials.json`, `*.pem`, `*.key`.
- Never add `!.env.example` exceptions that accidentally include a real `.env`.

## What NOT to do

- Do not base64-encode secrets and commit them — base64 is encoding, not encryption.
- Do not store secrets in browser localStorage, React state, or session cookies without `httpOnly` + `secure` flags.
- Do not log secrets — redact at the logger level (see `observability-and-logging.md`).
- Do not interpolate secrets into URLs for logging or error messages.
- Do not use `echo $API_KEY` in shell scripts that may end up in CI logs.
