---
description: Capture, mine, or promote blog-worthy material (capture | mine | promote)
argument-hint: "capture [topic] | mine [scope] | promote <note-path>"
---

# /blog — blog material capture

**Configured central vault (`BLOG_VAULT`):** `E:\Projects\blog`
*(Single place to change if the blog repo moves.)*

Read `~/.claude/rules/blog-material-capture.md` first — it defines the note
format, the four categories, and the **mandatory sanitization** rules. Every
mode below produces **publish-safe** output: no client names, no secrets, no
real PII, no exact prod identifiers.

Dispatch on the first word of `$ARGUMENTS`: `capture`, `mine`, or `promote`.
If `$ARGUMENTS` is empty or the first word is none of these, print this usage
block and stop:

```
/blog capture [topic]   — distill the current work/conversation into a tier-1 note now
/blog mine [scope]      — sweep existing artifacts into deduped tier-1 notes
/blog promote <note>    — expand a tier-1 note into a tier-2 seed in the blog repo
```

---

## Mode: capture  —  `/blog capture [topic]`

Distill the **current conversation / work context** into one tier-1 note.

1. Pick the angle: identify which of the four categories applies and the
   one-line hook. If `[topic]` is given, focus on that; else infer from the
   recent work in this session.
2. Determine `project` = current repo/app name. Compute the note folder
   `docs/blog-source/notes/` relative to the current project root.
   **Create `docs/blog-source/notes/` if it does not exist** (lazy init), and
   create `docs/blog-source/INDEX.md` with this header if missing:
   ```markdown
   # Blog Source — <project>

   Tier-1 blog notes captured in this project. Newest-first.

   | Date | Category | Status | Title | Note |
   |------|----------|--------|-------|------|
   ```
3. Build the note per the rule's **Tier-1 note format**. Fill `sources:` with
   real repo-relative paths, commit SHAs (`git rev-parse --short HEAD` if
   relevant), plan files, incident entries, issue numbers you actually touched.
4. **Sanitize** every line (see the rule). Generalize anything sensitive.
5. Choose a slug (kebab-case from the hook) and write
   `docs/blog-source/notes/<today>-<slug>.md`. Use today's date in `YYYY-MM-DD`.
6. Prepend a row to the **local** `docs/blog-source/INDEX.md` table.
7. Prepend a row to the **master** index `E:\Projects\blog\source\INDEX.md`:
   `| <date> | <project> | <category> | note | <hook> | (<project>) docs/blog-source/notes/<file> |`
8. Report: the note path, the category, and the index lines added.

---

## Mode: mine  —  `/blog mine [scope]`

Sweep **existing artifacts** in the current project for blog-worthy items and
emit deduped tier-1 notes. `[scope]` optionally narrows to one source
(`plans` | `incidents` | `reviews` | `commits`); default = all.

1. Gather candidates from the current project:
   - `.claude/plans/**/*.md`
   - `docs/operations/incidents/*.md` (skip `INDEX.md`)
   - code-review output if present (`docs/**/review*.md` or session artifacts)
   - recent commits: `git log --oneline -50`
2. **Dedupe:** read existing notes under `docs/blog-source/notes/`. Skip any
   candidate whose primary source ref (path or commit SHA) already appears in an
   existing note's `sources:` block, or whose slug already exists.
3. For each *new* blog-worthy candidate, build a tier-1 note exactly as in the
   `capture` mode (steps 3–7), sourcing `sources:` from the artifact you mined.
   Lazy-create the folder/index as in capture step 2.
4. **Sanitize** every note.
5. Report a summary table: created notes, and skipped candidates with the reason
   (`already captured` / `not blog-worthy`). Never silently drop — list skips.

---

## Mode: promote  —  `/blog promote <note-path>`

Expand a tier-1 note into a tier-2 structured seed in the blog repo.

1. Read the note at `<note-path>` (relative to current project, or absolute).
   Error out clearly if it does not exist or `status:` is not `note`.
2. Resolve `origin_repo` = `<project-name> @ <absolute-project-root>` and
   `origin_note` = the note path relative to the project root. These keep the
   note's repo-relative `sources:` resolvable from the blog repo.
3. Write `E:\Projects\blog\seeds\<same-slug>.md` with this structure (carry the
   note's `category`, `sources`, `related`; add `audience`, `working-title`):
   ```markdown
   ---
   date: <note date or today>
   project: <project>
   origin_repo: "<name> @ <absolute path>"
   origin_note: "docs/blog-source/notes/<file>.md"
   category: [ ... from note ... ]
   status: seed
   audience: "<who this post is for>"
   working-title: "<draft title>"
   sources: [ ... from note ... ]
   related: [ ... from note ... ]
   ---

   # <working title>

   ## Hook
   ## Context
   ## Tension
   ## Resolution
   ## Lesson
   ## Takeaways
   ```
   Fill each section from the note + the linked sources (read them as needed).
   **Sanitize** — seeds live in the publishable repo.
4. Prepend a `seed` row to the master index `E:\Projects\blog\source\INDEX.md`:
   `| <date> | <project> | <category> | seed | <working-title> | (blog) seeds/<file> |`
   Leave the original `note` row in place (do not delete the note).
5. Report: the seed path and the index line added.
