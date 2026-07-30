# Payload Bay

> A safe landing place for every event.

Payload Bay is an open-source, self-hosted webhook gateway for receiving,
verifying, storing, routing, retrying, and replaying events.

This is the canonical product repository. It will contain the Supabase backend,
dashboard, shared API contract, public SDK, and official integrations that ship
as the Payload Bay product.

## Repository boundaries

```text
supabase/                  Backend schema, Edge Functions, queues, and Cron
apps/dashboard/            Dashboard application
packages/api-contract/     Versioned API and generated types
packages/sdk-node/         Public Node.js SDK
packages/integration-sdk/  Integration authoring contract
packages/integrations/     Official provider integrations
deploy/                    Self-hosting and deployment material
scripts/                   Product build and release tooling
```

The [Payload Bay Runner](https://github.com/payloadbay/runner) is intentionally
a separate repository. It is a CLI and native-binary product with independent
releases and a tested compatibility relationship to Payload Bay server releases.

## Related repositories

- [Brand](https://github.com/payloadbay/brand)
- [Documentation](https://github.com/payloadbay/docs)
- [Website](https://github.com/payloadbay/website)
- [Organization standards](https://github.com/payloadbay/.github)

Payload Bay is in early development. This repository currently establishes the
product workspace; it does not yet contain an implementation.
