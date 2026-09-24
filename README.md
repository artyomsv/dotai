# dotai

My configuration for AI coding tools: rules, agents, commands, skills and output styles for
[Claude Code](https://docs.anthropic.com/en/docs/claude-code) and
[Codex](https://github.com/openai/codex).

The repository lives anywhere. Install scripts link its content into each tool's home folder, so
an edit in either place is an edit to the repository.

## Install

```powershell
# Windows (PowerShell). Folder links need nothing; the one file link (Codex AGENTS.md) needs
# Developer Mode: run `start ms-settings:developers` and turn it on.
git clone https://github.com/artyomsv/dotai.git E:\Projects\dotai
E:\Projects\dotai\scripts\install.ps1 -DryRun
E:\Projects\dotai\scripts\install.ps1
```

```bash
# Linux / macOS
git clone https://github.com/artyomsv/dotai.git ~/Projects/dotai
~/Projects/dotai/scripts/install.sh --dry-run
~/Projects/dotai/scripts/install.sh
```

The installer never deletes anything: whatever is in the way is moved to
`~/.dotai-backup/<timestamp>/`, outside every folder a tool loads. Run it again after a pull that
adds links. `-Uninstall` /
`--uninstall` removes only the links that point into this repository and restores the newest
backup. Both scripts also turn on the secret-scanning pre-commit hook.

## Layout

| Path | What |
|---|---|
| `claude/` | Claude Code: `agents/`, `commands/`, `rules/`, `hooks/`, `output-styles/` |
| `codex/` | Codex: global `AGENTS.md` and `skills/` |
| `shared/` | Content every tool reads in the same format, linked into each: `skills/pr-review` (post inline findings on a GitHub PR, resolve verified fixes, approve or request changes) |
| `links/<tool>.links` | One line per link: `<path in repo>  <link to create>` |
| `scripts/` | `install.ps1`, `install.sh`, `check-secrets.sh` |

**Adding another AI tool** is one new `links/<tool>.links` file plus a folder for its content. The
scripts need no change.

The Codex `review-all` skill reads its checklists from the Claude agents in `~/.claude/agents/`,
so install both when you use it.

## What stays out

Anything machine-specific or private stays in the tool's home folder and is never linked:
settings, credentials, sessions, history, caches, agent memory, and Codex `config.toml` and
`rules/`. Values a command needs but must not publish (hosts, user names) live in
`~/.config/dotai/` — see `claude/commands/fix-kubectl.md`.

This repository is public. `scripts/check-secrets.sh` runs as a pre-commit hook and in CI, and
blocks private IPs, private hostnames, emails, keys and tokens.

## License

[MIT](LICENSE)
