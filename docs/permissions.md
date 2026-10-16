# Permissions

Payload Bay admits users to an instance separately from granting resource access. Admission by itself grants no global role. Every API request checks current admission and the relevant grants; neither session caching nor a token snapshot preserves removed rights.

Positive grants apply down the hierarchy: instance → workspace → project. Workspace grants do not reach sibling workspaces, and project grants do not reach sibling projects. Child permissions add to inherited permissions; there is no child deny rule. An instance administrator therefore retains its inherited project access.

| Preset | Default permissions |
|---|---|
| Owner | All permissions, including ownership transfer |
| Admin | All permissions except ownership transfer |
| Operator | Metadata, payloads, replay, pause, code read and test, job read, notifications |
| Viewer | Metadata and notifications |
| Custom | Explicit selected permissions |

Preset selection supplies initial permissions; saved permissions are authoritative. Owners retain all permissions so a nominal owner cannot accidentally lose the ability to maintain ownership. Reading metadata does not imply reading payloads, code, secrets, or job details. Testing code does not imply permission to enable real effects.

A member administrator can grant only rights they currently hold at the selected scope. Ownership changes also require `ownership.transfer`. Membership writes serialize per scope and use the current membership version. The last active local owner cannot be demoted. Changing a workspace or project owner updates its owner reference and writes append-only audit history in the same transaction.

Creating a workspace or project establishes full local ownership. The current alpha service therefore requires both the corresponding create permission and ownership-transfer authority on its parent. This is separate from inviting an already admitted user into a project.

API tokens have an explicit scope, selected permissions, and expiry. The secret is returned once; the database stores only its SHA-256 hash. Authorization intersects the stored token permissions with the user's current inherited rights. Token scope applies downward only. Revocation, expiry, or inactive admission invalidates access immediately. A supplied invalid bearer token does not fall back to a browser cookie. Token listing never returns the secret or hash.

Browser sessions expire after 30 days without renewal. Authenticated API use renews the session at most once per day and forwards the refreshed HTTP-only cookie to the browser. Admission and permission checks still run on each request, so renewal does not preserve revoked access. Signing out invalidates the session. Disposable preview rebuilds reset the database and therefore invalidate existing sessions regardless of this lifetime.

Cookie-authenticated commands require the installation's configured origin and the `x-payloadbay-csrf: 1` header. Tokens are intended for external API clients and do not depend on a browser origin. All commands still pass through the same domain permission checks.

Implementation status: inherited authorization, membership demotion protection, scoped creation, token handling, and their database tests exist. Public routes and dashboard administration are being implemented; this document is not a release-completion claim.
