# Synthetic upgrade-test history — not release migrations

These three SQL fixtures describe deliberately different historical database states.
They exist only to test ordered upgrades, checksum protection, and atomic rollback.
They are never included in operator migration images or applied by the default
production migration command. Database tests opt into this directory explicitly.

Actual release migrations belong in `packages/domain/drizzle/`. CI generates one
migration per merged schema/runtime change; development uses `bun run db:push`.
No release migration has been generated for this alpha yet.
