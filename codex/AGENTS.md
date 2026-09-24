# Global Codex Instructions

## Project instructions in Claude format

Some repositories (the Stukans monorepo among them) have no `AGENTS.md`; their instructions live
in `CLAUDE.md` files and `.claude/rules/*.md`. Treat them as this repository's AGENTS.md: read the
root `CLAUDE.md` and the `CLAUDE.md` of each directory you work in, and apply every
`.claude/rules/*.md` whose `paths:` frontmatter matches a file you touch or review.

For any code review or re-review in such a repository, use the `$review-all` skill.

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
