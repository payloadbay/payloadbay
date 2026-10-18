# Permissions

Payload Bay admits users to an instance separately from granting resource access. Admission by itself grants no global role. Every API request checks current admission and the relevant grants; neither session caching nor a token snapshot preserves removed rights.

Instance grants stop at the platform boundary in both self-hosted and hosted installations. Customer/department authority starts with an explicit organization, workspace or project grant. Organization grants inherit into its workspaces/projects; workspace grants inherit into its projects. There is no child deny rule: use separate owners and scoped memberships for departments that must be private from each other. An organization owner intentionally has organization-wide authority. Instance administration alone grants no customer resource visibility, self-membership, secret access or customer audit access. Customer invitations may explicitly grant staff ordinary scoped membership; acceptance and later revocation are enforced normally. An account holding both platform and organization ownership retains the latter authority independently. Setup explicitly creates both memberships for the first owner; transfer organization ownership and remove that membership when separating infrastructure operators from business owners.

Instance-scoped API keys are for instance operations, not customer APIs. Personal keys can target an explicitly authorized organization, workspace or project. Resource lists, direct IDs, membership lists, live updates and tokens use the same current customer boundary. Instance audit contains platform actions only. A customer audit query requires audit.read on its requested organization, workspace or project and includes only its descendants; private diffs and event/secret content are excluded.

Configured customer middleware and helper/secret dependencies start at the organization boundary. Instance middleware is not executed for customer events, including old snapshots. Old compiled helpers outside that boundary block execution until the customer owner republishes; no immutable history is rewritten. Old instance-secret bindings must be replaced with customer-scoped secrets before republishing. Pending work and event history are retained.

Authentication emails always use trusted SMTP handling; editable notification code never receives real login codes or invitation links. Custom alert subscriptions pin the exact version accepted by the recipient. Later platform module changes do not update an existing subscription; legacy subscriptions without a pin require renewed opt-in. Runtime checks also protect already queued authentication and alert jobs. SMTP deployment credentials remain outside dashboard control.

Platform notification adapters may fetch public HTTP/HTTPS destinations only.
DNS answers are checked and pinned to the actual connection; redirects are not
followed. Loopback, link-local and metadata destinations stay blocked. Operators
who deliberately need an internal notification service can configure exact
hostnames using `PAYLOADBAY_NOTIFICATION_ALLOWED_HOSTS` on the executor process.
This deployment-only allowlist is not editable through an instance administrator
account. Customer destination routing keeps its separately configured private
network behavior; this is not a substitute for hosted executor network isolation.

The boundary protects against a compromised application administrator account.
It does not protect against an operator controlling the database, host, deployed
code, SMTP service or encryption keys. A hosted release still needs independent
security review and deployment network/sandbox validation. Self-hosted setup
creates one person with two explicit roles; those roles must be separated when
that person should administer infrastructure without customer access.

| Preset | Default permissions |
|---|---|
| Owner | All permissions, including ownership transfer |
| Admin | All permissions except ownership transfer |
| Operator | Metadata, payloads, replay, pause, code read and test, job read, notifications |
| Viewer | Metadata and notifications |
| Custom | Explicit selected permissions |

Preset selection supplies initial permissions; saved permissions are authoritative. Owners retain all permissions so a nominal owner cannot accidentally lose the ability to maintain ownership. Reading metadata does not imply reading payloads, code, secrets, or job details. Testing code does not imply permission to enable real effects.

A member administrator can grant only rights they currently hold at the selected scope. Ownership changes also require `ownership.transfer`. Membership writes serialize per scope and use the current membership version. The last active local owner cannot be demoted. Changing an organization, workspace or project owner updates its owner reference and writes append-only audit history in the same transaction.

Creating an organization, workspace or project establishes full local ownership. The current alpha service therefore requires both the corresponding create permission and ownership-transfer authority on its parent. This is separate from inviting an already admitted user into a project.

API tokens have an explicit scope, selected permissions, and expiry. The secret is returned once; the database stores only its SHA-256 hash. Authorization intersects the stored token permissions with the user's current inherited rights. Token scope applies downward only. Revocation, expiry, or inactive admission invalidates access immediately. A supplied invalid bearer token does not fall back to a browser cookie. Token listing never returns the secret or hash.

Browser sessions expire after 30 days without renewal. Authenticated API use renews the session at most once per day and forwards the refreshed HTTP-only cookie to the browser. Admission and permission checks still run on each request, so renewal does not preserve revoked access. Signing out invalidates the session. Disposable preview rebuilds reset the database and therefore invalidate existing sessions regardless of this lifetime.

Cookie-authenticated commands require the installation's configured origin and the `x-payloadbay-csrf: 1` header. Tokens are intended for external API clients and do not depend on a browser origin. All commands still pass through the same domain permission checks.

Implementation status: inherited authorization, membership demotion protection, scoped creation, token handling, and their database tests exist. Public routes and dashboard administration are being implemented; this document is not a release-completion claim.

## Customer onboarding and invitations

`PAYLOADBAY_REGISTRATION_POLICY=invite_only` is the default. Public email login
does not provision unknown identities in that mode. An operator can explicitly
select `organization` to allow verified customers to create their first
organization/default workspace. Before provisioning, their verified session can
use only the narrow onboarding endpoint; ordinary domain APIs require admission.
Concurrent/repeated provisioning returns the same organization and workspace and
never grants an instance role. This foundation does not certify a public hosted
service or implement payments.

Organization administrators with `members.admit` can invite a new identity to
their authorized scope. Existing inactive instance admission cannot be restored
by invitation. Invitations grant no resource access until verified acceptance;
project-only invitees are not forced to create another organization.


## Optional sign-in information

Operators may set `PAYLOADBAY_LOGIN_HINT` at container runtime to show a short,
public plain-text note on the email-entry step of `/login`. Newlines are preserved;
HTML and Markdown are not interpreted. An unset, empty or whitespace-only value
renders nothing. This setting works independently of preview mode and does not
create identities, choose an account, enable registration, change roles or bypass
OTP. Do not put secrets in public sign-in information.

For a demo, the note can list existing example accounts and what they can access.
Use only the roles/scopes actually configured on those identities. For example:

```yaml
environment:
  PAYLOADBAY_LOGIN_HINT: |-
    Try this demo using a sign-in code from its public test mailbox.
    Instance owner: owner@example.test
    Project viewer: viewer@example.test
```

Normal installations leave this unset. A future hosted product can use the same
login flow and optionally supply its own text; this setting is not a separate
deployment mode or billing feature. Changing the runtime setting requires
recreating the app container, but not rebuilding its image.
