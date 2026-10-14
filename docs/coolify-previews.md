# Coolify preview deployment setup

Configured on 2026-10-14. This records deployment configuration, not a successful
preview deployment.

- Instance: `https://cloud.thedannicraft.de`
- Private management destination: `100.72.180.95`, preserving the instance
  hostname and HTTPS certificate verification.
- Project: `Payload Bay`, UUID `vye2znf0fmih1sqoz8roy3eb`.
- Environment: `previews`, UUID `dzp1ufe9glyg6uchd47wxnzq`.
- Server: `hel1-node1`, UUID `xsgws8k884so8ksw4o848c8k`.
- GitHub source: `paylaodbay`, UUID `tfsut6qcaterwk5iwphos86i`, installed
  in the `payloadbay` organization with access to `payloadbay/payloadbay`.
- Application: `Payload Bay PR previews`, UUID `hn6zpt6p4zq5y87ngm0skgyw`.
- Source branch: `master`; build pack: `dockercompose`.
- Expected Compose path: `/deploy/compose.preview.yml`.
- PR previews enabled; external-contributor automatic previews disabled.
- Ordinary push auto-deployment disabled; no deployment started during setup.
- Preview URL template: `{{pr_id}}.{{domain}}`.

The native `/mcp` connection supports inspection and deployment operations.
REST was explicitly authorized for project/application configuration that the
installed MCP server does not expose. Credentials remain outside the repository.

## Remaining work

The preview Compose file has not been implemented or pushed, and the supported
prebuilt application/worker/executor images have not been published. The existing
`compose.dev.yml` provides disposable test fixtures and must not be used as the
deployed product stack. Previews need their own database, keys and SMTP settings;
they must not use production data or credentials.

After the real stack is verified and available on GitHub, load its Compose file
in Coolify and map service `app` to
`https://payloadbay-preview.cloud.thedannicraft.de:3000`. Both that hostname and
`42.payloadbay-preview.cloud.thedannicraft.de` resolved to the deployment host
during setup. Domain assignment currently returns validation error 422 because
Coolify requires a loaded Compose definition first.

Then verify an actual PR deployment, GitHub webhook delivery, isolated service
state, application health, login and event delivery, and close/merge cleanup.
The settings alone do not establish that automatic PR previews work.
