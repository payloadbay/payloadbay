# Dashboard navigation draft

The application hierarchy is **instance → workspace → project → route**.
“Organization” in the discussion means a workspace; use one label consistently
in the UI. Account settings belong to the person, outside that hierarchy.

Desktop uses a sidebar; mobile uses the same navigation inside HeroUI's drawer.
The top bar keeps the brand, mobile menu, scoped notifications and account avatar.
Selecting a navigation item closes the mobile drawer. The avatar owns account
settings and sign-out; it should not become a second full navigation tree.

## Proposed structure and current coverage

| Scope | Navigation | Current coverage |
| --- | --- | --- |
| Personal | Account settings; sign out | Working avatar actions; display-name editing |
| Instance | Workspaces/overview; members; shared code and middleware; settings | Overview, members and instance code exist. General instance settings need a page. |
| Workspace | Projects; members and roles; shared code/middleware; settings | Project list can filter by workspace. Dedicated workspace management pages/navigation still need implementation. |
| Project | Overview/routes and destinations; events; code/middleware; members; notification rules; settings | Existing project pages cover these operational areas; routes/destinations currently live in the overview. General settings need a dedicated page. |
| Route | Ingress and processing scripts; publications/test; delivery configuration | Route editor exists; keep route context visible rather than listing every route in the global sidebar. |

The sidebar should evolve toward a workspace selector, that workspace's projects,
and contextual navigation for the selected project. Project context should show
its workspace and a clear way back to the project list. Instance administration
belongs in a separate permission-gated group, rather than mixing it into project
operations. Do not add placeholder settings links before their pages work.

## Permission behavior

Only list resources returned by the authorized API. Scope actions to the selected
instance, workspace or project; project membership alone must not expose instance
administration. Effective roles inherit downwards as specified in the alpha
permission model. Navigation visibility supplements server authorization and is
never an authorization boundary. Permission-gate each management action, not just
the whole settings area.

## Implementation order

1. Fix and test the mobile drawer using the existing working destinations.
2. Add scope switching and project navigation using existing pages, with clear
   active states and names instead of IDs.
3. Implement actual workspace/project settings and membership flows against the
   existing authorization contracts, then expose their links.

This is an information-architecture draft, not a claim that settings pages or
workspace administration have already been implemented.
