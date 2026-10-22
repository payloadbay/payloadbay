# Route request protection

## Approved expansion (2026-10-22)

The maintainer approved a visual, nested AND/OR/NOT condition builder, field-aware
operators (including negated comparisons, sets, wildcard and bounded regex),
editable templates reached through Add rule, and real handle-only touch/keyboard
ordering. A readable expression preview shares the executable condition tree;
configuration is never JavaScript evaluated on the request path.

Policies belong to organization, workspace, project or route. Parent filters and
quotas cannot be bypassed by children. Skip stops only remaining filters at its
own scope. Inherited configuration values are not exposed to child-only admins.
Counters can be shared across the scope or separate per route. Token bucket,
strict rolling window and fixed window are distinct modes. PostgreSQL serializes
reservations across application processes; all applicable quotas must admit the
request before any capacity is consumed. Blocked requests remain inspectable.

Source-IP grouping is unavailable until the HTTP transport provides a verified
client address; arbitrary forwarded headers are not trusted as sender identity.
Editable text expressions are deferred; the visual tree remains the sole source
of truth. Tests must cover precedence, missing headers, regex safety, concurrency,
tenant boundaries, inherited restrictions and real mobile drag gestures.

## Evaluation and editing

Request protection appears under Settings for organizations, workspaces, projects
and ingress routes. Parent policies run first. Filters run before middleware and
configured ingress code; blocked requests are stored as rejected events with the
responsible policy and rule, without creating a processing execution.

Within a policy, the first enabled matching filter blocks with HTTP 403 or skips
remaining filters at that scope. The configured default applies when no rule
matches. Skip never bypasses ancestor policies, quotas or script validation.
Rate rules have independent enabled states.

The visual editor groups conditions with All (AND) or Any (OR), with optional NOT
for a whole group. Nest groups to state precedence explicitly. Fields include
headers, HTTP method, URL path, content type and body size. String comparisons
support equality, containment, prefixes/suffixes, membership, wildcard and regex,
including negated forms; body size uses numeric comparisons. Case sensitivity is
an explicit option. Header names are case-insensitive. Present includes an empty
header; Missing means absence. A negative comparison matches a missing header:
combine Present AND Does not contain when presence is required.

Wildcards match the entire field and use `*`; regex searches within the field.
Regex uses the nonbacktracking RE2JS engine, with bounded source and program
sizes. Backreferences and lookaround are unavailable. Trees have bounded depth,
node counts and value sizes. Neither expressions nor regex execute JavaScript.

Add rule offers scratch or template creation. Templates open in the regular
editor for changes before applying. Browser templates check navigation metadata
or browser client hints/names, rather than treating Mozilla alone as proof.
These are spoofable heuristics, not authentication. Keep provider signatures and
business validation in ingress code.

Token bucket refills continuously with a separate burst capacity. Rolling window
counts admitted requests in the preceding interval. Fixed window starts with its
first admitted request. Database time and locked counter rows coordinate all app
processes. A request exceeding any applicable limit returns HTTP 429 with
Retry-After and consumes no other applicable quota. Editing a policy starts new
counter state. Rolling quotas cap their configured request count to bound storage.

GET/PUT `/api/v1/{organizations|workspaces|projects|endpoints}/{id}/protection`
require `endpoints.configure` at that resource. PUT includes `expectedVersion` and
`policy`; stale writes return 409. Policies are encrypted with the instance key.
Audit records contain counts, enabled state and version, never condition values.
Child-only administrators receive inherited summaries, not ancestor conditions.
POST to the corresponding `/protection/test` evaluates the draft and ancestors
without running scripts, sending requests or consuming quota. It stops at the
first blocking scope and lists matching rate rules without claiming capacity.

## Reference

The operator vocabulary was checked against Cloudflare's official
[operators](https://developers.cloudflare.com/ruleset-engine/rules-language/operators/),
[expression builder](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/edit-expressions/)
and [rate-rule parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/).
This is Payload Bay's own bounded condition tree, not Cloudflare expression syntax
or a promise of Cloudflare operator/plan parity.

# Managed script HTTP

Route scripts cannot use direct `fetch`. The workerd outbound service remains
denied; all route HTTP uses the managed broker and a configured destination
pinned in the route publication. Notification modules use a separate restricted
HTTP transport.

```ts
// Uses the configured default destination and its configured method.
const response = await ctx.destinations.send({ body: ctx.event.body });

// Explicit method, still using the default destination.
const health = await ctx.destinations.get();

// A second configured destination, with a stable identity for this operation.
await ctx.destinations.post("Team webhook", {
    operationId: "team-notification",
    body: JSON.stringify({ text: "Received a purchase" }),
    headers: { "content-type": "application/json" },
});
```

The client exposes get, post, put, patch, delete, head and options. Send also
accepts an explicit method. GET and HEAD cannot have request bodies. Omitting an
operation ID derives a stable ID from the destination and method. Give separate
operations their own stable IDs; reusing an ID with changed input is rejected.
Successful operations are reused on retry. At-least-once delivery still requires
receiver-side deduplication when a network failure leaves remote receipt unknown.

Instance shared-code pages are unavailable. Customer helpers and middleware
remain within their organization boundary. An instance role alone grants no
customer-code or customer-payload access.
