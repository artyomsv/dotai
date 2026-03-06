# Local Environment — Docker-First Tooling

## Philosophy

Prefer Docker for all tooling to avoid bloating the system with a zoo of tools. Keep the host machine clean — only install what's absolutely necessary.

## Locally Installed (Exceptions)

Only three tools are installed directly on this Windows machine:

| Tool | Why local |
|---|---|
| **Java 21 + Maven** | Primary backend development, fast iteration cycle |
| **Docker** | Container runtime — everything else runs through this |
| **Node.js** | Available locally, but prefer Docker for consistency when possible |

## Everything Else: Use Docker

All other runtimes, linters, formatters, and test runners should run via Docker containers.

### Python

```bash
# One-off Python command
docker run --rm -v "E:/Projects/path/to/backend:/backend" -w //backend python:3.12-slim \
  bash -c "pip install -q -r requirements.txt 2>/dev/null && python -c 'your code here'"

# Run tests
docker run --rm -v "E:/Projects/path/to/backend:/backend" -w //backend python:3.12-slim \
  bash -c "pip install -q -r requirements.txt pytest pytest-asyncio httpx 2>/dev/null && python -m pytest tests/ -v"

# Run ruff
docker run --rm -v "E:/Projects/path/to/backend:/backend" -w //backend python:3.12-slim \
  bash -c "pip install -q ruff 2>/dev/null && ruff check app/"
```

### General Template

```bash
# Pattern for running any tool via Docker
docker run --rm -v "/host/project/path:/workspace" -w //workspace <image> \
  bash -c "<install commands> && <run command>"
```

## Docker Path Notes (Windows + Git Bash)

- Use absolute Windows paths for volume mounts: `-v "E:/Projects/.../backend:/backend"`
- Double-slash the workdir to prevent MSYS path translation: `-w //backend`
- Do **not** use `$(pwd)` — it produces MSYS-mangled paths on Windows
