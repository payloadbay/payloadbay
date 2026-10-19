# Pre-merge naming and interruption audit (2026-10-19)

This is a focused tracked-source naming and unfinished-work audit, not a new
full functional/security certification or a release approval.

## CI naming

The workflow is now `.github/workflows/ci.yml`, displayed as CI. Owning checks,
concurrency and new artifacts use CI/ci names. Release-candidate eligibility
looks up this workflow, and policy tests/current deployment instructions follow
the renamed path. Current task references were updated without rewriting the
old cycle log or downloaded artifact names in historical evidence.

The repository's live baseline ruleset requires Anti-Slop, Branch Name,
Conventional Commits and Conventional PR Title. It does not require an
Alpha-named status, so no ruleset/baseline change is needed for this rename.

Ordinary CI and candidate builds no longer reference an environment. External
approval uses `ci-external-review` with its previous reviewer settings and
`deployment: false`, so approval is not presented as application deployment.
Configuration lives in `.github/ci-external-review.json`. The old external
environment is retained only until old default-branch references disappear
after merge; required-reviewer protection must not be removed prematurely.

## Remaining alpha references

Audited tracked text across application, packages, workflows, scripts, tests,
deployment, documentation and planning files. Remaining references describe:

- The historical `specs/001-releasable-alpha` feature and review/test evidence.
- Unpublished release status and incomplete operator release verification.
  Merging is not publishing. Public API metadata uses `0.1.0`; the manifest
  records an unpublished candidate without an alpha nickname.
- Legacy external-review environment references needed during the merge transition.
- Dependency versions in the locked vendor graph, historical schema fixtures,
  test-only example domains and the pre-organization compatibility SQL comment.

These are meaningful references, not leftover user-facing CI branding. Current
README/web/bootstrap copy no longer depends on an unmerged/draft branch state.
The enterprise-unavailable message no longer refers to a release nickname.

## Work still open after the interruption

The icon fix48448fa and latest-attempt fix97b3234 are committed, pushed and
verified in the deployed preview. Installation-policy work439293c is also
committed/deployed. This audit did not find those changes stranded locally.

Six older local Docker/cache drafts remain uncommitted: `.dockerignore`,
`.github/workflows/database-migrations.yml`, `deploy/Dockerfile.app`,
`deploy/Dockerfile.app.dockerignore`, `deploy/Dockerfile.executor` and
`deploy/Dockerfile.worker`. They are outside the CI rename. In particular the app
draft changes the licensed installer path; it must be deliberately validated
before inclusion, not swept into this commit.

Recent discussion also contains unfinished behavior: snooze expiry preserves
records but does not reset read state; accepted synthetic request bytes are
displayed as numbered properties; the32-key import cap is still implemented
(the recommendation to remove it has not been implemented). These are explicit
follow-ups, not completed changes.

Full CI coverage and published-image install/upgrade/restore gates remain
independent. See `docs/releases/readiness.md` and the current CI run for actual status.

## Validation

CI authorization policy7/7, release-candidate policy5/5 and contract unit31/31
pass after the rename. These exercise external review rejection, immutable SHA
pinning, complete coverage gating and release eligibility; no gate was relaxed.
Scoped ESLint/Prettier pass. The previous97b3234 GitHub run still had Node and
browser owners in progress when this audit was recorded; it is not represented
as a completed green run.
