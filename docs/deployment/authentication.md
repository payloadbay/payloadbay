# Authentication operations

SMTP and deployment keys remain environment-owned. OAuth client configuration is
managed in installation settings and encrypted with the instance encryption key.
A provider's identity configuration is pinned after its first successful save,
including removal and later re-addition. Client secrets can rotate in the UI;
changing the client ID, issuer/pool, tenant or environment requires a controlled
identity migration. Removing a provider does not silently transfer its existing
account bindings to a different authority.

Social sign-in does not automatically link an existing account by matching email.
Customers link a provider from their own authenticated session, created within
the last ten minutes. Email-code sign-in remains available independently.

Provider access and refresh tokens are encrypted using Better Auth's supported
storage mechanism and the deployment-owned authentication secret. Authentication
initialization protects existing plaintext tokens without changing account
bindings or active sessions. Unreadable/ambiguous legacy token material is
invalidated, requiring provider reauthentication; ID tokens are not retained.
Keep the authentication secret with recovery configuration. Do not replace it as
a database recovery shortcut.

For pre-release upgrades, stop old web processes before starting the updated
version so an old writer cannot restore plaintext token material after the
startup conversion. Rolling compatibility with unreleased versions is not
certified. A database restore uses the original deployment secrets and performs
the same initialization before serving authentication.

OTP requests retain the existing per-email cooldown and five-minute quota.
Protective alpha defaults also limit new quota identities to 1,000 per five
minutes and total quota state to 10,000 rows. Repeated requests for an existing
identity do not consume the new-identity allocation budget. Expired address
state is removed in bounded batches after ten minutes, both during requests and
by trusted worker recovery. Responses remain independent of whether an address
belongs to an admitted account. Forwarded client-IP headers are not trusted.
