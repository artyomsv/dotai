---
name: pr-review
description: Register a code review on a GitHub pull request — one inline thread per finding, verification and resolution of fixed findings on re-review, and a final approve or request-changes verdict. Use after reviewing a pull request, or when asked to re-check a pull request whose review findings were addressed.
---

# PR review registration

`scripts/pr-review.mjs` (next to this file) does all GitHub writes. It runs as whichever account
`gh` is logged in as, so it works the same for a person and for a machine account. Every comment it
writes carries a hidden `<!-- dotai-review … -->` marker; that is how any agent account finds the
threads an agent opened, and why it never touches a thread a person wrote.

Run it with Node: `node <this skill's folder>/scripts/pr-review.mjs <command> --repo <owner/name> --pr <n>`.
Each command prints JSON. Exit code 3 means "refused" (read the reason), 1 means an error.

Post by default whenever the review target is a pull request. Skip posting only when the user
says so ("local only", "don't post").

## First review of a pull request

1. Do the review itself with your review workflow. Pin the PR head SHA and review that exact ref.
2. Write the findings to a JSON file outside the repository:

   ```json
   {
     "summary": "Two to five sentences: what the change does and the overall assessment.",
     "findings": [
       {"id": "security/H-1", "severity": "HIGH", "path": "src/Foo.java", "line": 42,
        "title": "Imperative one-line title",
        "body": "Scenario: input or state → wrong result.\n\nFix: the concrete change."}
     ]
   }
   ```

   `severity` is `CRITICAL`, `HIGH`, `MEDIUM` or `LOW`. `path` is repository-relative, `line` is the
   line in the PR head. A finding outside the diff still gets a thread (on the nearest changed line,
   with a note naming its real location), so give the true path and line, never a nearby one.
3. `post --findings <file>`. One review, one thread per finding. It refuses to post twice for the
   same head and account; `--force` only if the user asks for a second copy.
4. `verdict --decision request-changes` if any CRITICAL, HIGH or MEDIUM finding was posted, else
   `verdict --decision approve`.

## Re-review after fixes

1. `status`. It lists the agent threads (`threadId`, `id`, `severity`, `isResolved`, `path`,
   `line`), `lastReview.head` (the head the previous review covered), and what still blocks approval.
2. For every open agent thread, verify the fix at the new head: read the code, and run the test that
   proves it when one exists. "The author says it is fixed" is not verification. Write:

   ```json
   [{"threadId": "PRRT_…", "fixed": true,  "note": "Guard added at Foo.java:48; FooTest#rejectsNull covers it."},
    {"threadId": "PRRT_…", "fixed": false, "note": "Still reachable through Bar.update(): …"}]
   ```

   `resolve --verifications <file>` replies on every thread and resolves the fixed ones. It refuses
   any thread without an agent marker.
3. Review what changed since `lastReview.head` (`git diff <lastReview.head> <head>`) for new
   defects; a fix can introduce one. Post new findings with `post`, continuing the numbering
   (`code-quality/H-2`, not a second `H-1`).
4. Verdict as in the first review. `approve` is refused while an agent thread with CRITICAL, HIGH or
   MEDIUM severity is open, or a CI check is failing; it prints why. Do not pass `--force`
   unless the user explicitly tells you to approve anyway. LOW findings do not block.

## When CI is not green

`verdict --decision approve` checks CI itself, so you never decide on CI by hand:

- CI running: it waits (up to `--wait-minutes`, default 15), then decides on the result.
- CI green: it approves, label `review: approved`.
- A check failed: it requests changes, headed "❌ CI FAILED" with the failing checks, label
  `review: ci-failed`. The return value has `status: posted` and `event: REQUEST_CHANGES`.

The wait is longer than a foreground tool call may last. Claude Code: run it with
`run_in_background: true` and wait for the notification. Codex: set the command timeout to at
least 16 minutes (`timeout_ms: 960000`).

- `refused` with `checks still running`: run the same `verdict` again once. If CI still runs,
  report "not approved yet: CI still running".
- `refused` with `new commits arrived`: re-review the new commits first.

Never report a pull request as approved unless `verdict` returned `status: posted` and
`event: APPROVE` (or `COMMENT` with label `review: approved`). A text "approved" without the
review and the label is not a verdict.

## What the verdict looks like

- Reviewer account ≠ PR author: a real GitHub **Approve** or **Request changes**.
- Reviewer account = PR author: GitHub forbids both, so the verdict is a comment headed
  "✅ APPROVED", "❌ CHANGES REQUESTED" or "❌ CI FAILED".
- Always: the label `review: approved`, `review: changes-requested` or `review: ci-failed`. The
  other review labels, `review: requested` among them, are removed.

## Review labels

A pull request carries exactly one `review: …` label. It tells everyone who acts next.

| Label | Set by | Means |
|---|---|---|
| `review: requested` | the author agent, with `request-review` | the code waits for a reviewer |
| `review: changes-requested` | the reviewer, with `verdict` | findings wait for the author |
| `review: ci-failed` | the reviewer, with `verdict` | the review passed; failing CI waits for the author |
| `review: approved` | the reviewer, with `verdict` | a person may merge |

The author agent runs `request-review` after each of these, even without this skill loaded:

- it opens a pull request (a draft gets the label when it is marked ready);
- it pushes fixes for review findings or for failing CI;
- it answers the reviewer's findings or questions in comments, with or without new code.

`request-review` creates the label when the repository lacks it and removes the others. The
reviewer never runs it.

## Never

- Merge, close or reopen the pull request, or dismiss another account's review.
- Edit, resolve or reply to a thread a person opened.
- Approve with `--force` on your own judgement.

Report to the user: the review URL, how many threads were posted or resolved, the verdict and
whether it was a real Approve/Request changes or the comment fallback.
