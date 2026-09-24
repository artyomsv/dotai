# Posting a review to a GitHub PR

Only when the user asked for it.

- Post ONE review: `POST repos/{owner}/{repo}/pulls/{n}/reviews` with `commit_id` = the reviewed head
  SHA, `event: "COMMENT"` (the author may be the same account, which cannot `REQUEST_CHANGES`), a
  summary `body`, and `comments: [{path, line, side: "RIGHT", body}]`.
- Start every comment body with the finding id and severity, e.g. `**[security/H-1] HIGH**`, so the
  author can answer per id.
- Each `line` must fall inside a RIGHT-side hunk, or the whole call fails with 422. Find hunks with
  `git diff <base>...<head> -U0 -- <path>` and read the `@@ -a,b +c,d @@` headers. The batch endpoint
  has no file-level comments (`subject_type: file` is rejected): anchor such a finding on the file's
  first changed line.
- A 504 on a large review can still have created it. Before retrying, list
  `gh api repos/{owner}/{repo}/pulls/{n}/reviews` and count the comments, or you post twice.
- Just before posting, re-check that the PR head still equals the reviewed SHA.
- Never approve, merge, close or resolve threads unless the user asked for that exact action.
