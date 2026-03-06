# dotai

Personal [Claude Code](https://docs.anthropic.com/en/docs/claude-code) configuration — rules, agents, commands, and preferences that define my AI-assisted development workflow.

## Usage

Clone into your home directory as `~/.claude`:

```bash
git clone https://github.com/stukans/dotai.git ~/.claude
```

Or symlink if you keep dotfiles elsewhere:

```bash
git clone https://github.com/stukans/dotai.git ~/dotai
ln -s ~/dotai ~/.claude
```

## What's excluded

Runtime data that doesn't belong in version control — see [.gitignore](.gitignore):

- Credentials and secrets
- Session history, caches, and telemetry
- Per-project context and task state
- Plugin binaries (reinstalled per machine)
- Debug artifacts and backups

## License

[MIT](LICENSE)
