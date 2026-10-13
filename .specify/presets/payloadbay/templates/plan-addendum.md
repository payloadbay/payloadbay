
## Explanation and validation plan

Explain the intended change in plain language, including component roles and
the end-to-end flow where relevant. Identify the smallest deliverable slice.

Inspect the actual test tooling. Record verified commands in the repository-owned
TDD profile if using the TDD extension; do not copy another project's commands.

| Level | Applicability and exact command | Expected evidence |
| --- | --- | --- |
| Inner loop | Smallest whole-file/scenario check; no full coverage | Observed meaningful Red, then Green |
| Affected feedback | Verified selection base and dependency scope | Changed behavior plus affected boundaries |
| Final validation | All applicable suites and quality gates | Complete applicable evidence before completion |

- Verify that an empty selection or a nonexistent test cannot count as a pass.
- Define what falls back to broader validation when affected selection is uncertain.
- Map each acceptance criterion and material edge case to its owning test/suite.
  Reuse one artifact for overlapping behavior and acceptance evidence when valid.
- State applicable lint, format, type, coverage, integration, smoke and build
  gates; retain existing thresholds. Explain any gate that is not applicable.
- Use independent lanes only when resource isolation permits them. Shared
  databases, native builds and race-sensitive work need explicit ownership and
  concurrency limits. Merge coverage once, verify expected test/report inventory,
  and enforce thresholds against the combined report before a successful gate.
- Draft checks may be scoped; ready/merge checks must enforce the complete gate.
- Keep evidence in the plan/tasks and linked command or CI output by default.
  Add separate reports only when the feature needs them. Do not invent timings,
  coverage baselines, traceability IDs or results.
