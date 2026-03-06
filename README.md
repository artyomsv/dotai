# dotai

Personal [Claude Code](https://docs.anthropic.com/en/docs/claude-code) configuration — rules, agents, commands, and preferences that define my AI-assisted development workflow.

## What's inside

```
.claude/
├── CLAUDE.md              # Global preferences (indentation, git style, etc.)
├── settings.json          # Plugin & feature configuration
├── keybindings.json       # Custom keyboard shortcuts
├── rules/                 # Development standards & conventions
│   ├── backend-fastapi.md
│   ├── clean-code-general.md
│   ├── clean-code-java.md
│   ├── clean-code-react.md
│   ├── docker-infrastructure.md
│   ├── documentation-maintenance.md
│   ├── git-workflow.md
│   ├── local-environment.md
│   ├── python-clean-code.md
│   ├── python-testing.md
│   ├── seo-react.md
│   └── spring-services.md
├── commands/              # Custom slash commands
│   ├── changelog.md
│   ├── code-review.md
│   └── fix-kubectl.md
├── agents/                # Agent definitions
│   ├── code-reviewer.md
│   ├── qa.md
│   ├── rules-compliance.md
│   └── security-officer.md
└── memory/                # Persistent cross-session memory
```

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
