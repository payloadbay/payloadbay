# Route request protection

Each ingress route has **Request protection** under Settings. It applies before
configured ingress code and middleware. Requests blocked by filters or a quota
are still recorded as rejected events, without a processing execution.

Header filters are optional and ordered. The first enabled match either blocks
with HTTP 403 or skips the remaining filters. If no rule matches, the configured
default applies. Skip does not bypass the route quota or script validation.
Header names are case-insensitive; Equals compares the exact value and Contains
ignores case. Present matches even an empty header; Missing matches absence.

The browser-request template adds checks for browser navigation and a typical
browser user agent. This is a configurable heuristic, not authentication. Headers
can be forged. Keep provider signatures and business validation in ingress code.

The optional rate limit is route-wide, across every sender and application
process. A database-time fixed window starts with its first request. Exceeding
the configured count returns HTTP 429 with Retry-After. Header-blocked requests
do not spend the quota. Authorized configuration changes start a new quota
version; expired windows reset atomically.

GET and PUT `/api/v1/endpoints/{endpointId}/protection` require
`endpoints.configure` on the route's project. PUT includes `expectedVersion` and
`policy`; stale writes return 409. Rules are encrypted with the instance key.
Audit entries include enabled state, rule count and version, never header values.

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
