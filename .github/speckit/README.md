# Payload Bay SpecKit setup

Shared source lives in `payloadbay/.github` under `.github/speckit/`.
Repository Baseline distributes these files to explicitly eligible repositories.
Each repository initializes SpecKit separately and owns its project content.

## What the preset does

The `payloadbay` preset appends four core templates and wraps six core commands.
It establishes small deliverable flows, explanations in plain language,
meaningful test-first cycles, scoped development feedback and complete applicable
final validation. It uses SpecKit's composition mechanism instead of copying
core commands. It introduces no runtime dependency or application test framework.

Clippify's configuration informed this policy:

- [Test-first governance preset v1.3.0](https://github.com/TheDanniCraft/clipify/blob/master/.specify/presets/test-first-governance/preset.yml)
- [TDD extension v1.1.2](https://github.com/TheDanniCraft/clipify/blob/master/.specify/extensions/tdd/extension.yml)
- [Current scoped and full validation policy](https://github.com/TheDanniCraft/clipify/blob/master/.specify/memory/tdd-profile.md)

The Payload Bay preset is authored here, rather than a fork of those packages.
It adopts the testing principles without Clippify's Jest, Next.js, browser, native
runner, historical timing or report contracts. Project-specific test stacks and
commands must be verified locally.

Graphify is supported for broad architecture and dependency navigation when the
project already has a graph and the tool/skill is available. Findings must be
checked against current source; `rg` remains the exact-search and missing/stale
graph fallback. This does not install Graphify or create a graph automatically.
Project graph artifacts and their maintenance remain local. No search-speed
improvement is claimed without measurement.

## Ownership

| Centrally synchronized source | Repository-owned content |
| --- | --- |
| `.github/speckit/presets/payloadbay/` | `.specify/memory/constitution.md` |
| `.github/speckit/setup.json` | `.specify/memory/tdd-profile.md` |
| This setup guide | `specs/`, test configuration and commands |
| Shared policy and pinned setup choices | SpecKit registry, feature state and generated agent files |

Synchronization distributes source assets. It does not execute SpecKit or
install dependencies downstream. Generated `.specify/`, `.agents/` and `.claude/`
files are produced by the pinned CLI in each project, not copied by the baseline.
Keep project-specific overrides in `.specify/templates/overrides/` when needed;
those take precedence over installed presets. Do not edit synchronized source.

## Initialize an eligible repository

The supported setup choices are pinned in `setup.json`. Use Python 3.11+ and `uv`.
The Python interpreter used by the agent's generated helpers needs
`PyYAML==6.0.3` for preset template composition. Installing the CLI through `uvx`
alone does not install this dependency into that interpreter. Prefer a project
virtual environment and launch the coding agent from its activated environment:

```text
uv venv .venv
uv pip install --python .venv PyYAML==6.0.3
```

Activate with `source .venv/bin/activate` on Linux or
`.venv\Scripts\Activate.ps1` in Windows PowerShell. Add `.venv/` to the project's
ignore file. These activation commands select the Python environment; SpecKit's
workflow scripts remain Python on both platforms.
Run from the product repository root after the shared assets have arrived:

```text
uvx --from specify-cli==1.1.3 specify init --here --integration codex --script py --non-interactive --force
uvx --from specify-cli==1.1.3 specify preset add --dev .github/speckit/presets/payloadbay --priority 10
```

`--force` permits initialization in an existing repository. These are first-setup
commands: inspect existing `.specify/` and agent files before using them in an
already initialized project. Review generated changes before committing them.
The scripts selected for agent execution are Python, on Linux and Windows.
SpecKit may also ship shell fallback files; their presence does not change the
selected script engine. Use `python` or `py` on Windows if `python3` is not an
available interpreter alias.

Then create or amend the project's constitution using `speckit-constitution`.
Review it against the shared principles and repository architecture. Specify,
plan and task workflows consume the preset without a separate generic governance
preset. Installation alone does not populate a verified test profile.

## TDD extension

The extension drives the loop; the preset defines the policy. Install the pinned
extension in the project using a reviewed catalog entry for
[`d0whc3r/spec-kit-tdd`](https://github.com/d0whc3r/spec-kit-tdd):

```text
uvx --from specify-cli==1.1.3 specify extension add tdd --version 1.1.2
```

If the catalog is not install-enabled or lacks that version, inspect and resolve
the catalog/source explicitly; do not silently install a different release.
The upstream community catalog is discovery-only. The reviewed direct release
source is pinned in `setup.json`; install its packaged archive when needed:

```text
uvx --from specify-cli==1.1.3 specify extension add tdd --from https://github.com/d0whc3r/spec-kit-tdd/releases/download/v1.1.2/tdd-1.1.2.zip
```

Confirm the known upstream source when SpecKit prompts. Use the packaged release,
not the repository source ZIP, which contains a symlink rejected by SpecKit.
Run `speckit-tdd-setup` to verify the project's actual commands, then use
`speckit-tdd-plan`, `speckit-tdd-run` and `speckit-tdd-verify` for behavior work.
Inspect `.specify/extensions.yml`: hook enablement is project-owned. Clippify
currently disables its automatic TDD hooks and supplies explicit workflow policy;
that configuration is not copied here. This preset remains usable without the
extension, with the same test-first evidence obligations.

## Claude compatibility

The preset has no agent-specific paths or command spelling. Codex is the initial
default. To add Claude to the same initialized project:

```text
uvx --from specify-cli==1.1.3 specify integration install claude --script py
uvx --from specify-cli==1.1.3 specify integration use claude
```

Use `specify integration use codex` through the same pinned `uvx` invocation to
switch back. SpecKit composes preset commands for the active integration. Switch
to each integration after a refresh if both sets of generated skills need updating.
Invoke the installed skill names exposed by the active agent.

## Refresh after synchronization

Source synchronization does not refresh the installed preset copy or agent skills.
Review the new source, then run:

```text
uvx --from specify-cli==1.1.3 specify preset update payloadbay --dev .github/speckit/presets/payloadbay --priority 10
```

SpecKit updates a preset by removing and reinstalling it. Keep local changes
committed before refreshing and review the generated diff. Project-specific
customization belongs in local overrides, not the installed preset copy.
Reconcile an existing constitution through the project's amendment process;
refreshing shared policy is not approval to rewrite it.

Version changes update `setup.json`, `preset.yml` and this guide together. New
source files must also be listed in the central baseline's eligible file group.
No organization-wide package or lockfile automation is introduced.

## Validation

The central workflow runs the synchronizer tests and an isolated installation
check for both integrations. The latter verifies actual preset registration,
template resolution and Python script selection using the pinned CLI. It does
not execute a coding agent, the optional TDD extension, or product tests. Run it
with a Python environment containing the pinned CLI and PyYAML:

```text
python .github/scripts/test-speckit.py
```

This validation script belongs only to the central repository.

The central repository is itself initialized with this preset and TDD extension.
Core is the first downstream eligible project. Brand remains outside the group.
