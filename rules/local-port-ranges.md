# Local Port Ranges — Strict Rule

## Core rule

For any service, database, cache, or tool **exposed to the host machine** (via `docker run -p`, `docker compose ports:`, or a native process listening on a TCP port), the host-side port **must be in the range `30000-49999`**.

**Forbidden ranges for host-exposed ports:**

| Range | Why forbidden |
|---|---|
| `80xx` (8000–8099) | Conflicts with Tomcat / Spring Boot / Quarkus defaults, gcloud emulators (8085 is the datastore emulator), Jaeger (8086), Node dev servers (8000) |
| `8xxx` (8000–8999) | Same family — broad conflict zone with every Java/Python web framework on the planet |
| `9xxx` (9000–9999) | Prometheus (9090), Node debug (9229), SonarQube (9000), Minio (9000), Gerrit (8080/9418), Portainer (9000), many CI agents |

Also avoid (even though not in the ranges above):
- `3000` (Create React App, Next.js, Grafana)
- `3306` (MySQL)
- `5432` (PostgreSQL)
- `5672` / `15672` (RabbitMQ)
- `6379` (Redis)
- `27017` (MongoDB)
- Any port under `1024` (privileged)

## Allowed range

**`30000–49999`** — this range is effectively unused by mainstream dev tools. Pick any sub-range per project and document it in the project's README.

## Scope clarification

**The rule applies to HOST-EXPOSED ports only.** Internal container ports (the right side of a Docker `ports:` mapping) can and should stay on conventional values — they live in the container's own network namespace and never conflict with the host.

### Example

```yaml
# BAD — host port 8081 collides with any local 8081 listener
services:
  api:
    ports:
      - "8081:8081"

# GOOD — host port 31081, container still listens on 8081 internally
services:
  api:
    ports:
      - "31081:8081"
```

This means you do NOT need to change `application.properties`, `server.port`, `EXPOSE` directives in Dockerfiles, or inter-service URLs (`http://api:8081`) when migrating to the new range. Only the left side of `ports:` and any host-facing client URLs change.

## Per-project namespacing convention

Pick a unique `3xxxx` base for each project so ports don't collide when you run multiple projects simultaneously:

| Project | Base | Example allocation |
|---|---|---|
| `projectr-x` (CryptoRadar) | `310xx` / `31xxx` | 31000 frontend, 31080 gateway, 31081–31086 services, 31432 postgres, 31379 redis |
| `project-y` | `320xx` / `32xxx` | 32000 frontend, 32080 gateway, 32432 db, 32379 redis |
| `project-z` | `330xx` / `33xxx` | similar |

Recommended in-project allocation pattern (mnemonic: last 3 digits echo the conventional port):

| Category | Suffix | Example |
|---|---|---|
| Frontend / nginx | `000` (or the web port) | `31000` |
| API gateway / reverse proxy | `080` | `31080` |
| Backend services | `081` … `089` | `31081`, `31082`, … |
| PostgreSQL / TimescaleDB | `432` / `433` | `31432`, `31433` |
| Redis | `379` | `31379` |
| RabbitMQ | `672` | `31672` |
| Kafka | `092` | `31092` |
| Elasticsearch | `200` | `31200` |
| Grafana | `300` | `31300` (not 3000!) |
| Prometheus | `090` | `31090` |

The mnemonic means `3XYYY` where `X` is the project number and `YYY` echoes the conventional service port — easy to remember at a glance.

## Environment variables

Always define host ports as env vars with the new-range default:

```yaml
# docker-compose.yml
services:
  api-gateway:
    ports:
      - "${GATEWAY_PORT:-31080}:8080"
```

```bash
# .env
GATEWAY_PORT=31080
MARKET_DATA_PORT=31081
# ...
```

That way the defaults themselves comply with the rule, and env-var overrides (for CI or a second instance) also stay in the safe range.

## How to check before you commit

```bash
# Find anything that looks like a conflict-prone port in your compose files
grep -E '"[0-9]{4}:' docker-compose.yml | grep -Ev '"(3[0-4][0-9]{3}):'
```

Any result is a violation. Expected empty output.

## Why this rule exists

Development machines routinely run other tools that compete for the same low-numbered dev ports:

- **gcloud** spawns emulators on `8080`, `8085`, `8086`, `9080`, etc. — and they're started automatically by gradle plugins like `com.google.cloud.artifactregistry.gradle-plugin` at Gradle evaluation time, silently holding the ports.
- **IntelliJ / VS Code** debuggers listen on `5005`, `9229`.
- **Minikube / Docker Desktop** reserves a handful of low ports.
- **Kubernetes `kubectl port-forward`** defaults to whatever you pick, and people pick 8080.
- **Random frameworks** default to 3000, 4000, 5000, 8000, 8080, 9090.

The cost of a port conflict is not just "app didn't start" — it's "app started, bound to the wrong port, partially worked, and you spent an hour figuring out why `localhost:8080` was returning a 404 from the wrong service." By pushing everything into `30xxx-49xxx`, you get:

1. **Zero overlap** with any tool shipped in the last decade
2. **Project isolation** — `31xxx` (cryptoradar), `32xxx` (other project) can coexist
3. **Mnemonic clarity** — `31432` is obviously "TimescaleDB for cryptoradar"
4. **Faster onboarding** — new contributors don't fight port wars on their first `docker compose up`
