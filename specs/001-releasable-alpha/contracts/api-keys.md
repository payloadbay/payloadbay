# API-key management — confirmed 2026-10-17

Account settings exposes personal API keys. Organization settings exposes keys
issued within that organization. Creation requires explicit permissions, name,
expiry and scope. An organization scope may cover all descendant workspaces or an
explicit nonempty workspace allowlist; a workspace scope covers only that workspace
and its descendant projects. Project scope remains available for least privilege.

A token's effective rights are the intersection of its persisted permission set
and its issuer's current grants at the requested scope. Restrictions are enforced
in shared domain authorization, including aggregates and live reads, not just UI.
A restricted organization token cannot read organization-wide aggregates or
modify organization-wide resources merely because its parent scope is the
organization. A token cannot mint or edit another token with a broader scope.

Use an accessible metadata table and a bounded create modal. Display the generated
secret exactly once and provide copy; persist only its hash. Never return secrets
or hashes in lists, audits or notifications. Revocation takes effect immediately.

These are user-issued credentials, even when created from organization settings;
the UI must name the issuer and make that lifetime clear. Organization-owned
service identities independent of a person's admission require a distinct future
principal model and are not implied by a different screen location.
