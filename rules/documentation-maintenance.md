# Documentation Maintenance

## Scope

This rule governs two levels of documentation:

### Project-level `<project>/.claude/CLAUDE.md`
Update when introducing or changing:
- **New pages/routes** — add to the pages/routes list
- **New components directory** — add to component structure
- **New context/hooks** — add to hooks/context descriptions
- **New backend routers/endpoints** — add to backend structure
- **New models/schemas** — add to models description
- **New environment variables** — add to config section
- **Changed ports or URLs** — update commands and architecture sections
- **New dependencies or tools** — mention in the relevant framework/stack section
- **New data sources or integrations** — update data flow section
- **Changed conventions** — update conventions section

### Global `~/.claude/CLAUDE.md`
Update when:
- **Personal workflow preferences** change (indentation, naming, tools)
- **Machine constraints** change (new runtimes installed, tools removed)
- **Cross-project conventions** are established or revised

### Rules files (`<project>/.claude/rules/` and `~/.claude/rules/`)
Update when:
- A **pattern is confirmed** across multiple interactions — promote to a rule
- An existing rule is **wrong or outdated** — fix or remove it
- A project-specific rule becomes **universal** — move to global rules

## Rules

- Update docs in the **same commit** as the feature change
- Keep descriptions concise — match the style of existing entries
- Don't remove existing entries unless the feature is fully deleted
- If a section grows too large, consider whether a dedicated `.claude/rules/` file is more appropriate

## Automation

- Use `/claude-md-management:revise-claude-md` to automatically capture session learnings into CLAUDE.md
- Use `/claude-md-management:claude-md-improver` for periodic quality audits of all CLAUDE.md files
- The rules above define **what** to keep updated; the plugin helps **execute** updates
