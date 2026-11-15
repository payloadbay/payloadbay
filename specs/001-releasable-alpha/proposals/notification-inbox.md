# Notification inbox architecture and rollout

Confirmed direction2026-10-14; design only, no inbox implementation. The alpha uses one real notification backbone from the start, not conditional warning markup that must later be replaced. Delivery alert rules are absent/disabled by default. Version checks and active endpoint health probes are later producers. Confirmed icon library: `@tabler/icons-react` (2026-10-14), pending installation during UI implementation; no icon CDN or paid icon dependency.

## Product vocabulary

Project → ingress route → destination. An ingress route is the receiving address/script pair (for example Clipify → Stripe); a destination is an outgoing configured HTTP target (Application or Discord). Use ingress route in UI/copy; the existing Endpoint domain/API name maps to it and is not destructively renamed here. Reserve notification inbox for user-facing alerts. Do not name incoming webhooks a notification inbox. Future SMTP ingestion can extend the receiving-source concept without claiming SMTP ingress ships now.

## Backbone and producer contract

Notification producers submit a typed condition to the shared server-only notification service:

```ts
interface NotificationCondition {
  kind: string;                 // Registered/versioned producer identity.
  scope: { type: "instance" | "workspace" | "project"; id: string };
  subject: { type: "installation" | "ingress-route" | "destination"; id: string };
  conditionKey: string;         // Stable identity, not one row per polling tick.
  severity: "info" | "warning" | "critical";
  active: boolean;
  revision: string;             // Relevant policy/config identity.
  summary: string;              // Redacted, validated text.
  details: Record<string, unknown>; // Kind-specific validated metadata.
}
```

The notification service owns persistence, authorization, incident reconciliation, per-user read/dismiss state, SSE updates, severity/count aggregation and optional channel dispatch. Producers own detection and kind-specific validated data. Renderers own titles/actions/instructions; neither templates nor producer code inserts raw HTML or arbitrary links. The React control reads authorized notifications, not process.env.PAYLOADBAY_EXECUTOR_RUNTIME directly.

active=true creates/updates one durable active incident; repeating the same conditionKey/revision updates lastSeen/details without flooding the inbox. active=false resolves it rather than merely hiding DOM. A later new incident generation can notify again. No generalized plugin runtime or arbitrary notification code is required: a small typed registry inside the application is sufficient.

Example initial producer: configured runc emits an instance-scoped additional-isolation advisory. Configured runsc resolves that advisory, with configured/unverified mode stated honestly; it does not assert host attestation. Executor unavailability is a distinct health condition. Installing runsc alone does not change the selected deployment. No required Docker socket. This architecture separates condition detection from storage and display from the first alpha.

## Recipients and presentation

The control sits beside profile/context switching. Empty: neutral bell. Ordinary unread notices: HeroUI/Payload Bay accent bell with count. Highest active undismissed warning: warning triangle; critical incident: danger octagon/exclamation. Accessible name includes count/severity; colour is not the only signal. Inbox supports scope/severity filtering, read, dismiss and authorized navigation. No permanent global banner or repeated login modal.

Installation/runtime notices and later update notices are instance-admin-only. Project/workspace operators receive only alerts permitted by their current inherited scope grants. Use the existing Owner/Admin/custom permissions, not a new Manager role. Separate rule management from reading/subscription. Recheck rights for API lists/details, SSE/backfill and queued email recipients. Do not include webhook bodies, credentials or arbitrary response contents in alerts/emails.

## Individual delivery rules: no active defaults

No project or route gets a failure rule automatically; no global five-failures-per-minute policy. Users explicitly create a rule scoped to a project or narrowed to an ingress route and optional destination. Example: Project Clipify / ingress route Stripe / destination Application; count >=1 failed managed delivery in the chosen window; warning or critical; notification inbox plus optional SMTP recipient.

Rule fields: enabled, scope/projectId, optional endpointId (UI ingress route), optional destinationId, signal, threshold comparator >=, positive count, positive rolling window, severity, recovery condition, cooldown and subscribed channels/recipients. A count1 rule triggers on the first qualifying failure. A countN rule does not trigger at N-1, does at N. A positive count/window is validated; no invented universal policy value is applied when absent.

Signals distinguish failed delivery attempts from terminal execution failure. For distinct failed-managed-delivery count, identity is executionId+operationId; retry failures for the same operation count once per rolling window. Attempt totals remain a separate metric. The operator selects the signal intentionally, so an initial temporary failure and an exhausted delivery are not silently treated the same. This covers tracked sends; arbitrary user fetch failures do not automatically enter the rule metric. User code determines its processing result.

The evaluator opens one incident per rule/scope/subject, updates recurring failures and resolves on the configured recovery condition. Cooldown and hysteresis are versioned rule policy, tested at boundaries before coding; no rule means no failure incident/email. Changing a rule does not fabricate historic notifications unless the documented evaluation policy explicitly requests backfill. Low-priority evaluation/mail must not consume reserved ingress/critical-delivery capacity.

## Read, dismiss and SMTP

Read/dismiss are persisted per user, not global removal. Dismissal survives normal restarts. The same unchanged isolation advisory does not reappear on every login/restart; materially changed relevant configuration or a newly opened incident can create renewed attention. Settings retain factual mode/status even when an advisory is dismissed. Dismissal is not incident resolution.

Optional email uses operator SMTP and existing trusted Graphile mail jobs, not an additional service. Deduplicate by incident generation/recipient/channel and check current grants/preferences before sending. Summary/link only. Bounded retry and uncertain-send duplication are explicit SMTP limits. Sending email must not recursively produce an endless email-failure notification loop.

## Persistent records and integration

NotificationRule stores opt-in scoped policy. NotificationIncident stores conditionKey/revision/generation, kind/scope/subject/severity/status/firstSeen/lastSeen/resolvedAt and redacted data. NotificationRecipientState stores incident/user/readAt/dismissedAt. NotificationDispatch stores incident generation/recipient/channel/status and durable mail identity. Append-only migrations/foreign-key scope validation follow the existing domain rules. Publication/delivery event histories remain separate from notifications. ChangeRecord/SSE uses the same transaction as visible incident changes.

Future producers register against the same service: optional version availability, active endpoint probes, later operator-defined failure-rate metrics with explicit denominators/minimum samples. They do not introduce separate banners, inboxes or SMTP pipelines. No update polling or active probes are part of alpha.

## Acceptance requirements

- With no explicit failure rule, failing deliveries produce no threshold incident/email.
- For an explicitly configured rule count1, the first matching failure opens an incident; another route/destination outside its filter cannot trigger it.
- For countN, N-1 stays below threshold and N opens exactly one incident; retries do not inflate distinct-operation count.
- Repeated active conditions update one incident; resolved conditions leave history; subsequent incidents receive new generations.
- API/SSE/email deny cross-scope access and exclude installation notices from project-only users.
- Read/dismiss state is per-user and survives restart; unchanged runc does not repeatedly nag a dismissing administrator.
- runc advice arrives through the producer/service/inbox path; runsc resolves it without asserting unverifiable host security.
- Highest-undismissed severity selects bell/triangle/danger icon with accessible text/count, not colour alone.
- SMTP respects opt-in, revocation, incident/channel dedupe and low-priority capacity.
- Version checks and endpoint probes remain absent until separately implemented producers.

## Icons: researched recommendation

Portfolio source: https://github.com/TheDanniCraft/Portfolio/blob/master/package.json and lib/site-content.ts use @gravity-ui/icons for UI and @icons-pack/react-simple-icons for brand logos.

The user confirmed `@tabler/icons-react` on 2026-10-14. Use locally bundled static React imports, outline icons by default, and filled variants where available for emphasis. Not every icon has both variants. Notification severity must also have accessible text; icon/color alone is insufficient. Install the package during the UI task. No additional icon family, runtime CDN or paid icon dependency is required.
