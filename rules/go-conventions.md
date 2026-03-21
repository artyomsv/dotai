---
paths:
  - "**/*.go"
---

# Go Conventions

## Error Handling

- Always check errors — never assign to `_` unless explicitly justified with a comment
- Wrap errors with context: `fmt.Errorf("doing X: %w", err)`
- Use `errors.Is()` / `errors.As()` for comparison — never `==` on error values
- Return errors, don't panic — reserve `panic` for truly unrecoverable states
- Sentinel errors: `var ErrNotFound = errors.New("not found")` at package level

## Naming

- `MixedCaps` / `mixedCaps` — never `snake_case`
- Acronyms stay uppercase: `IPC`, `PTY`, `JSON`, `HTTP` (not `Ipc`, `Pty`)
- Getters: `Name()` not `GetName()` — Go convention
- Interfaces: name by method (`Reader`, `Writer`) or behavior (`Closer`), not `IReader`
- Unexported by default — only export what the consumer needs

## Interfaces

- Keep small: 1-2 methods preferred
- Define at the consumer, not the provider
- Accept interfaces, return concrete types
- Don't create interfaces preemptively — wait until you have 2+ implementations or need testability

## Goroutines & Concurrency

- Always pair goroutines with `context.Context` for cancellation
- Never launch a goroutine without a clear shutdown path (`defer cancel()`, done channel)
- Use `sync.WaitGroup` or `errgroup.Group` for fan-out
- Prefer channels for communication, mutexes for state
- Use `select` with `context.Done()` for cancellable operations
- Run `go test -race ./...` to catch data races

## Platform-Specific Code

- Use `//go:build` constraint tags (not old `// +build` syntax)
- One file per platform variant: `foo_unix.go`, `foo_windows.go`
- Keep platform-agnostic logic in shared files
- Test on both platforms in CI when possible

## Packages

- `internal/` for private implementation — prevents external imports
- Short, lowercase package names — no underscores, no mixedCaps
- No `util`, `helpers`, `common` packages — put functions where they belong
- One responsibility per package

## Functions

- Keep functions short and focused — if it scrolls, split it
- Use named return values only when they clarify the API signature
- `defer` for cleanup (file close, mutex unlock, temp file removal)
- No `init()` functions — prefer explicit initialization from `main` or constructors

## Config & State

- Config as structs with `Default()` constructor — no global mutable state
- Pass dependencies explicitly (constructor injection), not via globals
- Use `sync.Once` if lazy initialization is truly needed

## Formatting

- `gofmt` is mandatory — never override its decisions
- Go files: tabs for indentation
- YAML, TOML, JSON: 2 spaces
- LF line endings, UTF-8, final newline
