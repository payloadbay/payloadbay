# Embedded Supabase

This is the pinned Supabase foundation used by a self-hosted Payload Bay
installation. It is an internal product component, not a public Supabase
endpoint and not a replacement for an operator's TLS reverse proxy.

## First local start

From this directory, create an operator-local environment file and generate its
secrets before starting containers:

```bash
cp .env.example .env
sh utils/generate-keys.sh
sh utils/add-new-auth-keys.sh
```

Set the public URLs, dashboard credentials, SMTP settings, and any other
operator-specific values in `.env`. Never use the example values to expose a
deployment.

Then start and inspect the stack:

```bash
sh run.sh start
docker compose ps
sh run.sh logs
```

`sh run.sh stop` stops the stack without deleting data. The upstream helper
also supports targeted logs and service recreation. The vendored Functions
runtime includes Supabase's internal `main` dispatcher; it is not a Payload Bay
function. Product migrations and Payload Bay Edge Functions are introduced by
their own implementation work.

Registration, email signup, phone signup, and Function JWT verification are
safe by default. The future installation-owner bootstrap and public webhook
ingress work will make their required exceptions explicitly rather than
inheriting an open default.
