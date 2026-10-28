# Pull Request Review Labels

A pull request carries exactly one `review: …` label. It says who acts next:

| Label | Set by | Means |
|---|---|---|
| `review: requested` | the author | the code waits for a reviewer |
| `review: changes-requested` | the reviewer | the code waits for the author |
| `review: approved` | the reviewer | a person may merge |

## When you are the author

Set `review: requested` after each of these:

- you open a pull request (a draft: when you mark it ready for review);
- you push fixes for review findings;
- you answer the reviewer's findings or questions in comments, with or without new code.

```bash
node ~/.claude/skills/pr-review/scripts/pr-review.mjs request-review --pr <n>
```

It creates the label when the repository lacks it, and removes `review: approved` and
`review: changes-requested`. A push without review findings to address (more work on a pull
request nobody reviewed yet) needs no new call: the label is already there.

## When you are the reviewer

The `pr-review` skill sets the verdict label with `verdict`. Never run `request-review` as the
reviewer, and never set a verdict label on your own work.

Why: a person scanning the pull request list sees what each one waits for, without opening it.
