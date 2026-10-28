# Global Codex Instructions

## Project instructions in Claude format

Some repositories (the Stukans monorepo among them) have no `AGENTS.md`; their instructions live
in `CLAUDE.md` files and `.claude/rules/*.md`. Treat them as this repository's AGENTS.md: read the
root `CLAUDE.md` and the `CLAUDE.md` of each directory you work in, and apply every
`.claude/rules/*.md` whose `paths:` frontmatter matches a file you touch or review.

For any code review or re-review in such a repository, use the `$review-all` skill.

## Pull Request Review Labels

A pull request carries exactly one label: `review: requested` (waits for a reviewer),
`review: changes-requested` (findings wait for the author), `review: ci-failed` (the review passed,
failing CI waits for the author) or `review: approved` (a person may merge). The reviewer sets the
verdict labels through the `$pr-review` skill.

As the author, set `review: requested` after you open a pull request (a draft: when you mark it
ready), after you push fixes for review findings or failing CI, and after you answer the
reviewer's findings or questions in comments:

```bash
node "$HOME/.codex/skills/pr-review/scripts/pr-review.mjs" request-review --pr <n>
```

It creates the label when missing and removes the other review labels. Never run it as the reviewer.
Full rule: `~/.claude/rules/pr-review-labels.md`.

## No Local Builds

Do not run builds, test suites or linters on this host: Maven/Gradle (`mvn`, `mvnd`, `gradlew`),
npm/npx test, build or lint scripts, `vitest`, `jest`, `playwright test`, and `./scripts/dev.sh`
in any form — not even one narrowed test. One host serves many agents; a single vitest run held
every core for minutes. Push the branch and read CI instead: `gh pr checks <n> --watch`, then
`gh run view <run-id> --log-failed` for a red check. Allowed: `npm install`/`npm ci`, formatting
one file, `git`, `gh`, and any command the user explicitly asks for. Full rule:
`~/.claude/rules/no-local-builds.md`.

## Git Workflow

- Reference issue numbers with `Ref #123` or `Part of #123`
- **Never auto-close an issue from a PR or a commit.** Do not put a closing keyword
  (`close`/`closes`/`closed`, `fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved`)
  in front of an issue number, anywhere in a commit message or a PR body. Do not link the
  issue through the PR sidebar **Development** panel — that link closes on merge too.
  Do not run `gh pr create --fill` when branch commits contain such a keyword.
  Why: trunk-based development with feature flags means one issue spans several PRs, and
  testing sends work back to coding. A merged PR is not finished work. The GitHub project
  board owns the lifecycle; a human closes the issue once testing passes.

- Commit messages: imperative mood, max 72 chars on the first line
- Include a body for non-trivial changes
- Never mention AI or agent authorship in commit or PR messages: no `Co-Authored-By`
  trailers, no model names, no vendor names, no "generated with" notes. Describe what
  changed and why only.
