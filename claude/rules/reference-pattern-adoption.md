---
paths:
  - "**/pom.xml"
  - "**/package.json"
  - "**/.github/workflows/*.yml"
  - "**/.github/workflows/*.yaml"
  - "**/Makefile"
  - "**/mvnw"
  - "**/mvnw.cmd"
  - "**/Jenkinsfile"
  - "**/.gitlab-ci.yml"
---

# Reference Pattern Adoption

When you copy a pattern (CI step, config layout, test harness, build command, directory scaffolding) from one service or file to another, **match the receiver's existing discipline, not the reference's**. Copying structure and copying strictness are separate tasks — bundling them turns a small onboarding into a mass cleanup.

## The failure mode

You are onboarding service B by mirroring service A. Service A runs `npm run ci:backend:test:{profile}` (which also executes javadoc + checkstyle). Service B has historically run `mvn verify` (no javadoc, no nohttp checkstyle). You "align B with A" by adopting A's chain verbatim as part of the onboarding.

CI now fails on B because B's baseline never had to satisfy javadoc or checkstyle. You are left with two bad choices:

- Fix every violation in B as part of onboarding — scope has blown up far beyond "add app support."
- Revert and reinstate B's lean command — which is what you should have done from the start.

The failure is real even when every step you copied is correct in isolation. **Correctness is relative to what the receiver has already invested in.**

## The rule

When adapting a reference pattern for a new target:

1. **Copy structure, not strictness.** Match the files, envs, wiring, profile names, deploy jobs, and kustomize layout. Do NOT also enable linting, javadoc gates, test coverage thresholds, or stricter Maven/npm chains that the receiver never ran before.
2. **Match the receiver's existing command as literally as possible.** If the target uses `mvn verify -P-webapp`, the new variant is still `mvn verify -P{new-profile} -P-webapp`, not `npm run ci:backend:test:{new-profile}` even when the reference uses the npm form.
3. **If the receiver's baseline is weaker than the reference's, file tech-debt — don't pay it mid-onboarding.** The alignment cleanup is a separate, testable PR with its own review scope.
4. **When CI breaks on steps that weren't previously run, assume a discipline mismatch — not a real regression.** Revert the step, don't patch the surface-level symptom and hope the next run passes.

## Revert vs fix-forward

When CI breaks after an "alignment" change and the errors look simple:

| Question | Revert if… | Fix-forward if… |
|---|---|---|
| Was the failing step running in CI before? | No — the debt is pre-existing | Yes — it's a real regression from your change |
| Will fixing error #1 likely surface errors #2..N from the same class? | Yes (one javadoc bug implies more) | No (isolated typo) |
| Is the user's task blocked by the revert? | No — move on, file tech-debt | Yes — and the fix is bounded |

Fix-forward only when the breakage is a real regression from your intended change, not collateral from bundling "adopt structure" and "adopt quality gates" into the same PR.

## When in doubt, ask

If the reference and receiver clearly differ in CI discipline and you're unsure whether to adopt the stricter form, name the trade-off to the user before changing it: *"AI runs javadoc+checkstyle in CI; communications does not. Do you want me to align or keep communications' current lean chain?"* Decide together, then execute — don't silently upgrade.

## Examples

### BAD — overreach
Task: add test-me-ai support to communications service's publish workflow. Copy AI's `npm run ci:backend:test:{profile}` chain verbatim because "that's what AI does." Break CI because communications' javadoc baseline is not clean. Fix one bug, hope the rest pass.

### GOOD — scope-disciplined
Task: add test-me-ai support. Keep communications' existing `./mvnw verify -P{profile} -P-webapp --batch-mode ...` form, duplicate it for the new profile. File a tech-debt entry noting the chain could be aligned with AI once javadoc and checkstyle baselines are clean.

## Related

- `tech-debt-tracking.md` — where the deferred alignment work gets recorded
- Keep "match structure + wiring" and "enforce stricter quality gates" in separate PRs, always
