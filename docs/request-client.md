# Route request tools

Payload Bay uses one HeroUI/Monaco request composer for the published route playground
and synthetic draft tests. Both offer method selection, headers and body tabs,
JSON/XML/text formats, and validation before execution. The route is already the
working context; receiving URL and operational controls belong to its overview.

Published requests use the browser directly against that route, omit application
credentials, reject redirects and have a deadline. No external request proxy is
configured. Synthetic tests run unsaved code with sample secrets, optional effective
middleware and simulated delivery. Response checks compare the decision, HTTP
status and body text; these are immediate checks, not saved/scheduled regression
suites or arbitrary JavaScript assertion programs. Neither dry execution nor a
passing response check proves that an external receiver handled a real delivery.

## Embeddable-client research — 2026-10-18

[Scalar's React client](https://github.com/scalar/scalar/tree/main/packages/api-client-react)
is a verified MIT option. Its documented hook creates a Vue application attached
to the document for the lifetime of the page, preserves state across navigation,
and accepts an OpenAPI document. Its proxy setting is optional.
[The underlying client](https://github.com/scalar/scalar/tree/main/packages/api-client)
also supports a directly mounted application and modal with a workspace store.

The integration trade-off is lifecycle and scope ownership: a persistent client
needs explicit cleanup/reset on sign-out and customer-context changes, and a full
request workspace introduces another interaction/theming layer. This is an
engineering inference from the documented lifecycle, not a reported Scalar flaw.
A route-specific editor also needs to represent dry worker inputs and sample
secrets, which differ from an ordinary HTTP request.

For this version, retain the small shared HeroUI composer and the existing Scalar
API documentation. Hoppscotch remains a UX reference; no unsupported React embed
package is assumed or installed. A larger embedded client remains possible if the
product later needs request collections, OAuth helpers or a general API workspace.
Such an integration must keep request state scoped and avoid a third-party proxy.
