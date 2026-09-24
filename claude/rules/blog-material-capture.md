---
paths:
  - "**/docs/blog-source/**"
  - "**/.claude/plans/**"
  - "**/docs/**"
  - "**/.claude/rules/**"
  - "**/CLAUDE.md"
---

# Blog Material Capture

## Purpose

Capture blog-worthy substance from real work — across **all** projects — into
reusable, publish-safe notes, so future blog posts start from accumulated raw
material instead of a blank page. Complements `infra-kb-capture` (incident KB)
and `tech-debt-tracking`: a war-story note may *link to* an incident entry, but
is framed as a story with an angle, not an ops runbook.

## Best-effort caveat

This rule is `paths:`-scoped, so it is only in context when matching files are
touched. **Proactive capture is therefore best-effort.** The reliable capture
path is the `/blog` command (`capture` / `mine` / `promote`). Do not assume
proactive notes are exhaustive — periodically run `/blog mine`.

## What counts as blog-worthy (four categories)

Capture when you hit one of these; tag `category:` accordingly (one or more):

- **architecture** — a non-obvious technical choice, a tradeoff, why-X-not-Y, a
  pattern that emerged, something that surprised you.
- **war-story** — a hard-won fix, a misleading symptom, an incident, a
  "this took days and here's the real cause" narrative.
- **journey** — the human/process arc: solo-founder grind, building with AI
  agents, workflow evolution, a frustration→insight moment, a shipping lesson.
- **domain** — insight about the problem space (maritime recruitment,
  multi-tenant SaaS), product/market reasoning, business lessons.

Skip the routine: anything already fully captured by a commit message, a
techdebt file, or an incident KB entry with no story angle of its own.

## Two tiers

- **Tier-1 note** (`status: note`) — cheap, high-volume. Written by proactive
  capture, `/blog capture`, and `/blog mine`. Lives in the **project** at
  `docs/blog-source/notes/YYYY-MM-DD-slug.md`.
- **Tier-2 seed** (`status: seed`) — promoted on demand via `/blog promote`.
  A ~60%-of-a-draft structured starting point. Lives in the **blog repo** at
  `E:\Projects\blog\seeds\YYYY-MM-DD-slug.md`.

## Tier-1 note format

```markdown
---
date: YYYY-MM-DD
project: <repo-or-app-name>
category: [war-story]          # architecture | war-story | journey | domain
status: note
sources:                       # backlinks INTO the live history (repo-relative)
  - "path/to/source/File.java"
  - ".claude/plans/<plan>.md"
  - "docs/operations/incidents/<entry>.md"
  - "commit:<sha>"
  - "issue:#<n>"
related:                       # [[wikilinks]] to sibling note/seed slugs
  - "<other-slug>"
---

# <one-line hook — the angle that makes this worth reading>

**Why interesting:** the surprise / tension / stakes that make it blog-worthy.

**Substance:** 2–4 sanitized sentences — enough to remember the story later.

## Sources
- `path/to/File.java:42` — what's here / why it matters
- `.claude/plans/<plan>.md` — the plan that drove it
- `docs/operations/incidents/<entry>.md` — the full diagnosis
- commit `<sha>` — the fix
```

The `sources:` block + **Sources** section make the note an index *into* the
repo, so a future AI can follow the links for full detail instead of relying on
the summary.

## Sanitization — publish-safe by default (MANDATORY)

Every captured entry, every mode, must be safe to publish as-is:

- **No** client / company / customer names — generalize ("a maritime-recruitment client").
- **No** secrets, API keys, tokens, connection strings, credentials.
- **No** real PII (candidate names, emails, CV contents, personal data).
- **No** exact production identifiers — hostnames, tenant UUIDs, internal IPs,
  cluster node names. Generalize or redact.

See `no-synthetic-data` and `secrets-and-env-handling`. When unsure whether a
detail is safe, generalize it.

## Where files go

- Tier-1 notes → `<current-project>/docs/blog-source/notes/` (folder created lazily).
- Local per-project index → `<current-project>/docs/blog-source/INDEX.md`.
- Tier-2 seeds → `E:\Projects\blog\seeds\`.
- Master aggregate index → `E:\Projects\blog\source\INDEX.md`.

Every capture/promote appends a pointer line to the master aggregate index.

## The /blog command

Use `/blog capture [topic]`, `/blog mine [scope]`, `/blog promote <note>`.
The command is global and available in every project; see
`~/.claude/commands/blog.md`.
