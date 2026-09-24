---
paths:
  - "**/*.py"
---

# Clean Code — Python

This rule covers Python-specific conventions. General principles (naming, SRP, DRY, comments, return early) are in `clean-code-general.md`.

## PEP 8 Formatting

- 4-space indentation (no tabs)
- Max line length: 79 characters (or 88 with black)
- Two blank lines between top-level definitions, one between methods
- Imports on separate lines, grouped: stdlib → third-party → local
- Use `isort` for import ordering, `ruff` or `black` for formatting

## Functions

- Max 2-3 arguments — use dataclasses/dicts for more
- No boolean flag arguments — split into separate functions instead
- Avoid side effects — don't modify global state, return new values
- One level of abstraction per function — extract lower-level ops to helpers
- Use default parameter values instead of None-checks inside the body

## Type Hints

- Add type hints to all function signatures (args + return)
- Use `from __future__ import annotations` for modern syntax
- Use `Optional[X]` or `X | None` explicitly — don't rely on implicit None
- Validate with `mypy` or similar static type checker

## Data Structures

- **`dataclass`**: mutable data containers with default behavior (equality, repr)
- **`@dataclass(frozen=True)`**: immutable value objects
- **`NamedTuple`**: lightweight immutable tuples with named fields (prefer for simple cases)
- **`TypedDict`**: typed dictionaries for JSON-like structures or API responses

```python
# Simple value — NamedTuple
class Point(NamedTuple):
    x: float
    y: float

# Rich domain object — dataclass
@dataclass
class Risk:
    id: str
    name: str
    severity: Severity
    score: float = 0.0

# API response shape — TypedDict
class RiskResponse(TypedDict):
    id: str
    name: str
    severity: str
```

## Match Statements (Python 3.10+)

Use `match` for multi-branch dispatching instead of `if/elif` chains:

```python
# BAD
if status == "critical":
    handle_critical(risk)
elif status == "high":
    handle_high(risk)
elif status == "medium":
    handle_medium(risk)
else:
    handle_low(risk)

# GOOD
match status:
    case "critical":
        handle_critical(risk)
    case "high":
        handle_high(risk)
    case "medium":
        handle_medium(risk)
    case _:
        handle_low(risk)
```

## Error Handling

- Catch specific exceptions — never bare `except:` or `except Exception:`
- Minimize code inside `try` blocks — only wrap what can actually raise
- Use custom exception classes for domain-specific errors
- Don't use exceptions for control flow
- Always clean up resources with `finally` or context managers (`with`)

## Pythonic Patterns

- Use list/dict/set comprehensions over manual loops when readable
- Use context managers (`with`) for resource handling (files, connections)
- Use generators (`yield`) for lazy iteration over large datasets
- Use `enumerate()` instead of manual index tracking
- Use `zip()` to iterate over parallel sequences
- Prefer `in` operator for membership tests
- Use f-strings for string formatting

## Classes & SOLID

- **Single Responsibility**: one reason to change per class
- **Open/Closed**: extend via inheritance, don't modify base code
- **Liskov Substitution**: subtypes must preserve parent behavior
- **Interface Segregation**: small focused ABCs over monolithic interfaces
- **Dependency Inversion**: depend on abstractions, not concretions
- Keep classes small — prefer composition over deep inheritance

## Tooling

- Formatter: `ruff format` or `black`
- Linter: `ruff check` or `flake8`
- Type checker: `mypy`
- Import sorting: `isort` (or `ruff` with isort rules)
