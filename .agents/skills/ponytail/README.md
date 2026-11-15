# Ponytail for Payload Bay

Six project-local skills are vendored unchanged from
[DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), commit
[`09c434ab73ca43761c5d8b0c5d341926c2fba710`](https://github.com/DietrichGebert/ponytail/tree/09c434ab73ca43761c5d8b0c5d341926c2fba710/skills).
They are distributed under the upstream [MIT license](LICENSE), which applies to
all six `ponytail*` skill directories. Payload Bay's existing agent guidance is
preserved; `AGENTS.local.md` activates the main guidance for coding work.

## Project skills

Codex discovers project skills under `.agents/skills`. They should be available
on the next turn; start a new thread if the client has not refreshed its skill
list. Invoke the standalone skills by name:

- `$ponytail` or `$ponytail full`, `$ponytail lite`, `$ponytail ultra`, `$ponytail off`
- `$ponytail-review` for a specified diff, branch or PR
- `$ponytail-audit` for a repository review
- `$ponytail-debt` for deferred shortcut comments
- `$ponytail-gain` for the upstream published benchmark, not measured Payload Bay savings
- `$ponytail-help` for upstream command guidance

The vendored skills are the fallback for clients without plugin support. Their
mode switching is conversational. Benchmark references in the gain skill point
to the upstream repository at the pinned revision.

## Full Codex plugin

`.agents/plugins/marketplace.json` declares the upstream plugin as installed by
default, pinned to the same commit. `.codex/config.toml` enables it for this
project. Supporting Codex clients discover the repo marketplace and can install
or refresh the plugin when the project is trusted. This does not execute an
installer when Git pulls the repository. Client support and administrator policy
can affect automatic installation.

Review the plugin hooks shown in `/hooks`, trust them if appropriate, then start
a new thread. Hook trust belongs to each developer's Codex installation; the
repo configuration cannot grant it. Plugin commands use names such as
`$ponytail:ponytail-review`. Prefer the plugin's main skill when loaded; use the
vendored copy otherwise, and do not run both copies of the same review.

If a client does not discover the repo marketplace, register it once and install
the pinned declaration from the project root. This fallback was required by the
validated Codex CLI 0.163.0 installation:

```bash
codex plugin marketplace add .
codex plugin add ponytail@payloadbay-repo
```

The original upstream global installation remains documented in
[INSTALL.md](https://github.com/DietrichGebert/ponytail/blob/09c434ab73ca43761c5d8b0c5d341926c2fba710/INSTALL.md#codex).

## Updating

Review the upstream diff, replace the six SKILL.md files and license together,
and update the pinned commit in this README and the repo marketplace. Keep the upstream skill files unchanged so their
origin and updates stay verifiable. No npm dependency is added to the product.
