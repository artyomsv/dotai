# Docker & Infrastructure Rules

## Dockerfile General

- Use slim/alpine base images (`python:3.12-slim`, `node:20-alpine`)
- Pin base image versions — avoid `latest` tag
- Use `WORKDIR` with absolute paths — never `RUN cd`
- Prefer `COPY` over `ADD` (unless extracting tarballs or fetching URLs)
- Use exec-form for CMD: `CMD ["uvicorn", "app.main:app"]` — not shell form
- One `EXPOSE` per service with the conventional port
- Keep Dockerfiles readable — comment non-obvious instructions

## Layer Caching

- Order instructions from least to most frequently changed
- Copy dependency files first, install, then copy source:
  ```dockerfile
  COPY requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY app/ ./app/
  ```
- Combine `apt-get update && apt-get install -y --no-install-recommends` in one RUN
- Clean up in the same layer: `rm -rf /var/lib/apt/lists/*`
- Sort multi-line package lists alphabetically

## Multi-Stage Builds

- Name stages with `AS` (`FROM node:20-alpine AS builder`)
- Build stage: install deps + compile; final stage: copy only runtime artifacts
- Final image should have no build tools, source maps, or dev dependencies
- Use separate base images per stage when beneficial (e.g., node for build, nginx for serve)

## .dockerignore

- Always include `.dockerignore` in every service directory
- Exclude: `.git`, `node_modules`, `__pycache__`, `.env`, `.venv`, `dist`, `.pytest_cache`, `.ruff_cache`, `tests/`, `target/`

## Security

- Run as non-root user — add `USER` instruction after setup
- Create user with explicit UID/GID for deterministic builds
- Never store secrets in image layers (ENV, COPY, or ARG)
- Use `--no-cache-dir` for pip installs
- Don't install unnecessary packages

## Health Checks

```dockerfile
# Backend API
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

# PostgreSQL
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD pg_isready -U $POSTGRES_USER || exit 1

# Nginx
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -f http://localhost/ || exit 1
```

## docker-compose

- One service per concern (frontend, backend, database)
- Use `depends_on` with `condition: service_healthy` for startup ordering
- Add healthchecks for databases (`pg_isready`) and APIs (`curl /health`)
- Use named volumes for data persistence (`pgdata:/var/lib/postgresql/data`)
- Load config from `.env` file — never hardcode credentials in compose files
- Prefix all env vars consistently (e.g., `POSTGRES_`, `VITE_`)

## Logging

- Use `json-file` driver (default) for local development
- Set `max-size` and `max-file` to prevent disk exhaustion:
  ```yaml
  services:
    backend:
      logging:
        driver: json-file
        options:
          max-size: "10m"
          max-file: "3"
  ```
- For production: consider `fluentd` or `gelf` drivers for log aggregation

## Dev vs Prod

- Use `docker-compose.dev.yml` override for development-specific config
- Dev: bind-mount source dirs for live reload, add `--reload` flags
- Prod: multi-stage build, no source mounts, optimized images
- Run with: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`
- Keep prod compose as the base, dev as the override
