# Dashboard navigation

The hierarchy is **instance → workspace → project → ingress route**. Use
“workspace” consistently rather than alternating with organization. Account
settings belong to the person.

Desktop keeps a contextual sidebar; mobile puts the same destinations in the
burger drawer. The opaque header contains the brand, scoped notification inbox
and avatar account menu. The avatar exposes account security, personal email
notification preferences and sign-out.

| Context   | Working destinations                                                                                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instance  | Traffic overview, projects, workspaces, all accessible events, instance members, instance shared code/middleware                                      |
| Workspace | Workspace overview/projects, members, shared code/middleware, workspace-wide notification rules                                                       |
| Project   | Routes/destinations, events, shared code/middleware, members, project notification rules, workspace link                                              |
| Route     | Scripts with native helper imports, middleware, secrets, dry test, published-request playground, route events, publication history; back to project/all projects |
| Person    | Display name, passkeys, personal SMTP preferences                                                                                                     |

Do not add placeholder settings links. Workspace/project configuration is exposed
through working operational pages rather than an empty general settings screen.
Method dispatch belongs to the editable ingress file; the project can contain
multiple ingress routes with independent published handlers.

## Access

Only list resources returned by authorized APIs. Instance grants inherit to all
workspaces/projects; workspace grants inherit to their projects; project grants
stay within that project. Navigation visibility supplements server authorization.
Member tables include inherited rights, and local edits cannot remove them.
Invitations remain pending until the matching verified identity accepts; they can
assign selected projects without granting the containing workspace or instance.
Instance admission is separate from resource permissions.

Workspace notification rules count across its projects. Project rules can target
a specific route or destination. Personal settings subscribe the current person
to selected rule emails; they do not change shared thresholds. Version checks and
endpoint health checks are deferred, with no placeholder menu entries.

## Approved composition follow-up

The current workspace/project/route replaces the global list with its own grouped
controls. There is no Browse hierarchy block: breadcrumbs expose ancestry, and a
Back control changes only the menu scope. Global navigation appears at instance scope. Settings groups
follow task intent (Settings, Observe and troubleshoot, Publish and history,
Automation), and groups start open. Mobile hierarchy browsing changes
the drawer context without navigating the working page; explicit page links and
search results navigate. Breadcrumbs show navigable ancestors. Search includes
authorized workspace/project destinations, current settings and personal pages.
The document owns main-page scrolling; the preview notice and header remain
coordinated sticky chrome. The drawer scrolls within the visual viewport and updates
on viewport resize/scroll so keyboard closure cannot retain a stale reduced height. Creation dialogs preserve the collection behind them.


Scripts import real helper exports using `import { describe } from
"@shared/DemoHelpers"` or a default import where the module exports one. Monaco
loads authorized module sources for types/export completion and suggests module
paths. Draft saving resolves a newly imported name to the nearest authorized scope,
pins its immutable revision and preserves existing pins. There is no separate
Helper imports navigation page or prerequisite binding form.
