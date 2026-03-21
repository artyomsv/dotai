---
paths:
  - "**/*_test.go"
  - "**/*.go"
---

# Go Testing

## File Naming

- Test file: `foo_test.go` alongside `foo.go` in the same package
- Black-box tests: `package foo_test` (tests public API only)
- White-box tests: `package foo` (tests internal logic)

## Test Naming

- Format: `TestFunctionName_Scenario_Expected`
- Examples: `TestReadMessage_EmptyInput_ReturnsError`, `TestConfig_DefaultValues`
- Subtests: use `t.Run("description", func(t *testing.T) { ... })`

## Table-Driven Tests

Prefer table-driven tests for functions with multiple input/output combinations:

```go
tests := []struct {
    name    string
    input   string
    want    int
    wantErr bool
}{
    {"empty input", "", 0, true},
    {"valid input", "hello", 5, false},
}
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        got, err := Fn(tt.input)
        if (err != nil) != tt.wantErr {
            t.Errorf("error = %v, wantErr %v", err, tt.wantErr)
        }
        if got != tt.want {
            t.Errorf("got %d, want %d", got, tt.want)
        }
    })
}
```

## Test Helpers

- Use `t.Helper()` in helper functions so failures report the caller's line
- Use `t.TempDir()` for temporary directories (auto-cleaned)
- Use `t.Setenv()` for env var overrides (auto-restored)
- Use `t.Cleanup()` for teardown that must happen even on failure
- Use `t.Parallel()` for tests that don't share state

## Assertions

- Use stdlib: `t.Errorf`, `t.Fatalf`, `t.Logf`
- `t.Fatalf` stops the test immediately — use for setup failures
- `t.Errorf` continues — use for assertion failures (lets other checks run)
- Compare structs with `reflect.DeepEqual` or field-by-field
- No external assertion libraries unless the project already uses one

## Mocking

- Define small interfaces at the consumer
- Write manual fakes/stubs — no mocking frameworks
- Inject dependencies via constructors, not globals

## Race Detection

- CI must run `go test -race ./...`
- Fix all data races — they are bugs, not warnings

## Integration Tests

- Guard with build tag: `//go:build integration`
- Or skip with: `if testing.Short() { t.Skip("skipping integration test") }`
- Run separately: `go test -tags=integration ./...`

## What to Test

| Source type | Test expectation |
|---|---|
| `internal/*/` packages | Unit tests for public functions |
| `cmd/*/main.go` | Skip — entry point, tested via integration |
| Pure functions | Table-driven tests |
| Stateful types | Setup → act → assert per method |
| Platform-specific (`_unix.go`, `_windows.go`) | Test on matching platform only |

## What NOT to Test

- Trivial getters/setters with no logic
- Third-party library behavior
- `main()` functions directly
