# Git & PR Workflow

## Commit Messages (Conventional Commits)

Format:
```
<type>(scope): description

[optional body]

[optional footer]
```
- **Types**: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `ci`, `style`, `perf`
- Imperative mood: "add feature" not "added feature"
- Subject line max 72 characters
- Blank line between subject and body
- Body wraps at 72 characters — explain "why", not "what"
- Breaking changes: `feat!: description` or `BREAKING CHANGE:` footer
- Reference issues when applicable: `Closes #42`

## Branch Naming

- Format: `<type>/<short-description>` — lowercase, hyphen-separated
- Examples: `feature/docker-setup`, `fix/cors-config`, `chore/update-deps`
- Include issue number when applicable: `feature/PROJ-123-risk-crud`
- Common prefixes: `feature/`, `fix/`, `chore/`, `docs/`, `refactor/`, `hotfix/`
- Keep branch names short but descriptive

## Merge Strategy

- **Squash-merge to main** for clean history — one commit per logical change
- **Rebase** feature branches onto main before merging to avoid merge commits
- Delete feature branches after merge

## Pull Requests

- Title follows Conventional Commits format: `feat(backend): add risk CRUD endpoints`
- Description includes:
  - **Summary**: 1-3 bullet points of what changed and why
  - **Test Plan**: how to verify the changes
- One logical concern per PR — don't mix unrelated changes
- Keep PRs small and reviewable (< 400 lines when possible)

## Tags & Releases

- Use semantic versioning: `v1.2.3` (major.minor.patch)
- Tag releases on main branch only
- Include changelog in release notes

## What NOT to Commit

- `.env` files — use `.env.example` as template
- IDE configs: `.idea/`, `.vscode/` (unless team-shared settings)
- `node_modules/`, `__pycache__/`, `.venv/`, `dist/`, `target/`
- Secrets, API keys, credentials, tokens
- Large binary files
- OS-generated files (`.DS_Store`, `Thumbs.db`)

## General

- Commit early, commit often — small atomic commits
- Don't rewrite published history (no force-push to shared branches)
- Pull/rebase before pushing to avoid unnecessary merge commits
- Write meaningful commit messages — your future self will thank you
