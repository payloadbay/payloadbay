
## Payload Bay shared development principles

Include these principles in the project's constitution, adapted to its actual
stack. Keep project architecture, tools, commands and thresholds repository-owned.

1. **Explain the outcome.** Before substantial changes, explain what will change,
   why it helps, and how it will be checked in plain language. For architecture
   changes, explain each component's role, the request/data flow, and the main
   tradeoff. Report results and remaining uncertainty without claiming unbuilt
   features or unexecuted checks work.
2. **Deliver small, working flows.** Prefer one coherent, independently verifiable
   product flow. Add abstractions, repositories, services and tooling when a real
   requirement needs them. Follow repository architecture and agreed issue scope;
   propose changes to those boundaries before implementing them.
3. **Test behavior first.** For new or changed runtime behavior, observe a
   meaningful failing test before implementation, make the smallest change that
   passes, then refactor while relevant tests stay green. Regression fixes must
   first reproduce the defect. Infrastructure changes use equivalent executable
   checks; prose-only changes do not need artificial tests.
4. **Separate feedback from completion.** Use the smallest verified whole-file or
   scenario command during Red/Green, without full-suite coverage overhead. Use
   affected suites for broader feedback. Before declaring completion, run all
   applicable final gates. An unknown dependency boundary requires broader
   validation; a scoped pass cannot establish release readiness.
5. **Make evidence honest and economical.** Map acceptance criteria and important
   error/recovery cases to executable evidence at the highest practical real
   boundary. Give each test one execution owner; it may support several criteria.
   Avoid duplicate scenarios and reports. Record commands, observed outcomes and
   evidence locations; missing evidence is not a pass.
6. **Keep tests isolated and checks intact.** Use deterministic fixtures and
   isolated local services. Never require production credentials or mutable
   shared state. Clean up owned resources. Preserve established thresholds,
   scenarios and checks; test speed comes from selection, isolation and safe
   parallel lanes. Validate high-risk behavior with negative tests and targeted
   mutation or deliberate fault checks when useful.

Shared preset files are centrally maintained. The project constitution,
`.specify/memory/tdd-profile.md`, feature documents, test configuration and
machine-local state belong to this repository. Updating a preset does not itself
approve an architecture change or an amendment to an existing constitution.

Use SpecKit's Python workflow helpers with the project's verified interpreter.
On Windows, use `python` or `py` if `python3` is unavailable. Do not replace the
selected Python helpers with Bash or PowerShell workflow scripts.

For broad codebase navigation, use Graphify when a repository graph and the tool
are available. Check its freshness and source locations, query for relevant
relationships, then verify claims against current source before editing. Use
`rg` for exact symbol/text searches and when the graph is missing, stale or lacks
coverage. Follow the installed Graphify skill for queries and scoped updates;
do not rebuild the whole graph for every small change or make graph generation
a prerequisite for delivery. Graph artifacts belong to the project, not the
centrally synchronized preset.
