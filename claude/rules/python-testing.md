---
paths:
  - "**/*.py"
  - "**/test_*.py"
  - "**/conftest.py"
---

# Python Testing (pytest)

## Test Classification

Properly classifying tests prevents confusion and wasted debugging time.

### Unit Tests
- **Fast, no I/O, no DB, no network.** Mock all external dependencies.
- No special marker needed — they are the default.
- File: `test_*.py` in `tests/` mirroring app structure.

### Integration Tests
- **Touch DB, network, filesystem, or external services.**
- **MUST** be marked with `@pytest.mark.integration`.
- Can live in `tests/integration/` or co-located with `@pytest.mark.integration`.

### E2E Tests
- **Full stack through a live running server.**
- **MUST** be marked with `@pytest.mark.e2e`.

### Decision Guide

| Test uses... | Classification |
|---|---|
| `app.dependency_overrides` with mocked DB | Unit |
| `TestClient`/`httpx.AsyncClient` with real DB session | **Integration** |
| Calls a live running server over HTTP | **E2E** |
| Reads/writes real files or network calls | **Integration** |
| Pure function with in-memory data | Unit |

### Running by Classification

```bash
pytest                          # All tests
pytest -m "not integration"     # Unit tests only (fast)
pytest -m integration           # Integration tests only
pytest -m e2e                   # E2E tests only
```

### Marker Registration (`pyproject.toml`)

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_functions = ["test_*"]
addopts = "-v --strict-markers --import-mode=importlib"
markers = [
    "integration: tests requiring database or external services",
    "e2e: end-to-end tests through the full stack",
]
```

## Test Structure — AAA Pattern

- **Arrange**: set up data, fixtures, preconditions
- **Act**: execute the code under test (single action)
- **Assert**: verify the expected outcome
- Keep one logical assertion per test — easier to diagnose failures

## Naming

- Files: `test_<module>.py` (pytest discovery convention)
- Functions: `test_<function>_<scenario>_<expected_result>`
  - e.g. `test_create_risk_with_valid_data_returns_201`
- Classes: `Test<Feature>` (no `__init__`) — group related tests
- Names should read as documentation — anyone can understand what's tested

## Test Principles

- **Fast** — mock external I/O; slow tests discourage frequent runs
- **Independent** — no shared mutable state; each test starts clean
- **Deterministic** — same input → same result; use fixed seeds if randomness needed
- **Single responsibility** — one behavior per test; if the name has "and", split it
- **Test behavior, not implementation** — verify what the code does, not how

## Project Layout

```
backend/
  app/
    ...
  tests/
    conftest.py          # shared fixtures
    api/
      test_risks.py
      test_health.py
    services/
      test_risk_service.py
    integration/
      conftest.py        # DB fixtures, test containers
      test_risk_repository.py
```
- Mirror the app structure in `tests/`
- Use `conftest.py` at each level for scoped fixtures

## Fixtures

- Use `@pytest.fixture` for reusable setup/teardown — not manual setup in each test
- Use `yield` fixtures for cleanup (teardown after yield)
- Scope fixtures appropriately: `function` (default), `class`, `module`, `session`
- Define shared fixtures in `conftest.py` — pytest discovers them automatically
- Keep fixtures small and composable — chain them for complex setup

## Parametrize

- Use `@pytest.mark.parametrize` to test multiple inputs with one function
- Avoids copy-pasting near-identical tests for different data

```python
@pytest.mark.parametrize("severity", ["critical", "high", "medium", "low"])
def test_create_risk_accepts_all_severities(client, severity):
    response = client.post("/api/risks", json={"name": "Test", "severity": severity})
    assert response.status_code == 201
```

## Async Tests

- Use `pytest-asyncio` for async test functions
- Mark async tests with `@pytest.mark.asyncio`
- Use `httpx.AsyncClient` for testing async FastAPI endpoints

```python
@pytest.mark.asyncio
async def test_fetch_risks_returns_list(async_client):
    response = await async_client.get("/api/risks")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

## Mocking

- Use `unittest.mock.patch` or `pytest-mock` (`mocker` fixture)
- Mock at system boundaries: external APIs, databases, file I/O, time
- Don't over-mock — test real logic, mock only what you can't control
- For FastAPI: use `app.dependency_overrides` to swap dependencies
- Patch where the thing is used, not where it's defined

## Assertions

- Use plain `assert` — pytest provides rich failure diffs automatically
- Use `pytest.raises(ExceptionType)` for expected exceptions
- Use `pytest.approx()` for floating point comparisons
- Avoid multiple unrelated assertions in one test

## FastAPI Integration Tests

- Use `TestClient` (sync) or `httpx.AsyncClient` (async) from FastAPI
- Test the full request/response cycle through the router
- Verify status codes, response body shape, and error responses
- Override dependencies for isolated testing:

```python
app.dependency_overrides[get_db] = lambda: mock_db
```

## What to Test

- Happy paths — expected inputs produce correct outputs
- Edge cases — empty inputs, boundary values, None/null
- Error cases — invalid input (400/422), missing resources (404)
- Authorization — if applicable, verify access control
- Don't test framework internals (Pydantic validation, FastAPI routing)

## What NOT to Do

- Don't test multiple behaviors in one test
- Don't depend on test execution order
- Don't use real external services (DB, APIs) in unit tests
- Don't ignore flaky tests — fix the root cause
- Don't write tests that pass even when code is broken (over-mocking)
- Don't skip tests without a documented reason (`@pytest.mark.skip(reason="...")`)
- Don't forget to mark integration tests — this causes confusion when running `pytest -m "not integration"`

## Coverage

- Use `pytest-cov` to measure coverage: `pytest --cov=app --cov-report=term-missing`
- Aim for high coverage on business logic; don't chase 100% on boilerplate
- Coverage ≠ correctness — focus on meaningful tests over line count
