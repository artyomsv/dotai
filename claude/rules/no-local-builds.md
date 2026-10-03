# No Local Builds — CI Runs Them

**Do not run builds, test suites or linters on this host.** GitHub Actions runs the same
checks on every pull request. Push the branch and read the CI result instead.

Why: one host serves many agents in many repositories at once. A single `vitest run` started
27 workers and held all 14 cores at 100% for minutes (2026-10-04); every other agent and the
user's terminal stalled behind it. A rule in one project cannot see the builds of another, so
the only safe default is: no heavy runs on the host at all.

## Forbidden on the host

- Maven and Gradle: `mvn`, `mvnd`, `mvnw`, `gradle`, `gradlew` — any goal or task that compiles,
  tests or verifies (`compile`, `test`, `verify`, `package`, `install`, `build`, `check`).
- npm, npx, pnpm, yarn running a build, test or lint: `npm test`, `npm run build|test|lint|typecheck`,
  `npx vitest`, `npx jest`, `npx playwright test`, `npx tsc`, `npx eslint`.
- `./scripts/dev.sh` in any form (`build`, `test`, `test-race`, `vet`, `cross`, `image`), and
  any other repository script that wraps the commands above or `go build`/`go test` in Docker.
- Narrowed runs too: a single test class or a single test file is still a JVM or a worker pool.

This rule overrides any project `CLAUDE.md`, `AGENTS.md`, README or agent prompt that says to
run one of these commands to verify work. It governs what an agent runs, not what code may
contain: a CI workflow or a script that calls these commands is not a violation.

## Allowed

- Installing dependencies: `npm install`, `npm ci`, `mvn dependency:go-offline`.
- Formatting a file you just edited: the Spotless hook, `prettier --write <file>`, `gofmt <file>`.
- Static reading: `git`, `gh`, grep, reading logs and source.
- Starting a dev server or local stack the user asked for (`devstack`, `docker compose up`).
- Any command the user explicitly asks for in the current conversation. Their request is the
  exception; a project document saying "run the tests" is not.

## How to verify instead

1. Commit and push the branch (only when the user asked you to push; otherwise stop and report
   "not verified: CI has not run" and ask).
2. Open the pull request, or use the existing one.
3. Wait for checks: `gh pr checks <n> --watch`, or `gh run watch <run-id>`.
4. On a red check, read only the failure: `gh run view <run-id> --log-failed`.
5. Fix, push, repeat.

Report what CI ran, with the check names and the result you read. Never report a test result
you did not read in a CI log, and never call a change "tested" because it compiles in your head.

## When CI cannot answer

If the repository has no workflow for the changed code, or CI does not run on this branch, say
so and ask the user before running anything locally. Do not fall back to a local build silently.
