---
paths:
  - "**/*.py"
  - "**/router.py"
  - "**/service.py"
  - "**/models.py"
---

# Backend Rules (FastAPI)

## Project Structure

- Keep routers thin — business logic in service layer, data access in repository layer
- Cross-cutting concerns (auth, pagination, exceptions) go in a shared module

## REST API Design

- Use correct HTTP verbs: GET (read), POST (create), PUT (full replace), PATCH (partial update), DELETE (remove)
- Plural nouns for collection endpoints (`/api/risks`, not `/api/risk`)
- Version API when introducing breaking changes (`/api/v1/...`)
- Consistent naming: lowercase, hyphen-separated paths
- Return correct status codes: 200 (OK), 201 (created), 204 (no content), 400/404/409/422/500 for errors

## Pydantic Models & Validation

- Separate schemas per operation: `Create` (input), `Update` (partial, all Optional), `Response` (output)
- Use `Field()` with `min_length`, `max_length`, `pattern`, `ge`, `le` for validation
- Use `StrEnum` for string enumerations (Python 3.11+)
- Add `field_validator` for custom business rules (Pydantic v2)
- Add `examples` to `Field()` for auto-generated OpenAPI docs
- Use `model_config = {"from_attributes": True}` when mapping from ORM models
- Use `model_dump(exclude_unset=True)` for partial updates

## Dependency Injection

- Use `Depends()` for shared logic (db sessions, auth, config) — avoid global mutable state
- Chain dependencies: dependencies can depend on other dependencies
- Use dependencies for data validation against DB (e.g., check resource exists before operating on it)
- Prefer `async` dependencies for I/O-bound operations

## Async / Sync

- Use `async def` for routes doing I/O (DB queries, HTTP calls, file I/O)
- Use `def` (sync) for CPU-bound or blocking library calls — FastAPI runs these in a threadpool automatically
- Never call blocking code inside `async def` — it freezes the event loop
- Use `run_in_threadpool` from Starlette if you must call sync code from async context

## Middleware

- Use middleware for cross-cutting concerns: request ID, logging, timing, CORS
- Keep middleware lightweight — heavy processing belongs in dependencies or services
- Order matters: outermost middleware executes first on request, last on response

## Background Tasks

- Use `BackgroundTasks` for fire-and-forget work (emails, notifications, cleanup)
- Don't use background tasks for critical operations — they have no retry/guarantee
- For important async work, use a task queue (Celery, Redis Queue, etc.)

```python
@router.post("/risks", status_code=201)
async def create_risk(risk: RiskCreate, background_tasks: BackgroundTasks):
    created = await risk_service.create(risk)
    background_tasks.add_task(send_notification, created.id)
    return created
```

## Error Handling

- Use `HTTPException` with appropriate status codes
- Create helper functions for common lookups that raise 404
- Let Pydantic handle input validation errors (422) automatically
- For custom error response formats, use `@app.exception_handler()` decorators

## Testing

- Use `pytest` with `httpx.AsyncClient` or `TestClient` for integration tests
- Use `app.dependency_overrides` for mocking dependencies
- Structure tests mirroring app structure: `tests/api/`, `tests/services/`
- Test both success paths and error cases (400, 404, 422)

## Configuration

- Use Pydantic `BaseSettings` for env-based config
- Split settings by domain as the app grows
- Never hardcode secrets or connection strings

## Route Documentation

- Add `response_model`, `status_code`, `summary`, and `description` to route decorators
- Add `tags` to routers for grouping in Swagger UI
- Add `examples` to Pydantic model fields for rich OpenAPI docs
