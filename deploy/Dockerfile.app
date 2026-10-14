# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS base
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
USER node
EXPOSE 3000
# Test the already verified local standalone build without forwarding local CLI credentials.
FROM base AS smoke
COPY --chown=node:node apps/web/.next/standalone/ ./
CMD ["node", "apps/web/server.js"]
# Clean CI build requires a BuildKit secret, never an ARG or copied credential file.
FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS build
COPY --from=oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN --mount=type=secret,id=heroui_auth_token,required=true \
    cd apps/web && HEROUI_AUTH_TOKEN="$(cat /run/secrets/heroui_auth_token)" bun x heroui-pro@1.0.0-beta.14 install react --yes --skip-peers --no-trust-patch
RUN bun run web:build
FROM base AS app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone/ ./
CMD ["node", "apps/web/server.js"]
