# Embedded Supabase upstream

This directory vendors the official Supabase Docker bundle as the basis for
Payload Bay's embedded self-hosted deployment.

- Source: <https://github.com/supabase/supabase/tree/0e71933ce3fad9b1dc8595207950cc9754f54a77/docker>
- Imported revision: `0e71933ce3fad9b1dc8595207950cc9754f54a77`
- Upstream license: Apache-2.0

Keep the bundle pinned. Update it only in a dedicated review that compares the
new upstream Docker directory, image versions, configuration requirements, and
Payload Bay's documented local changes.

Payload Bay changes from the imported bundle are deliberately small:

- the Compose project name is `payloadbay-supabase`;
- the unused imgproxy service and image-transformation configuration are
  removed;
- the upstream `hello` Edge Function is not shipped; Supabase's internal
  Functions-runtime dispatcher remains because the runtime requires it.

No generated `.env` file, operator secret, database data, storage data, or
locally created Function source belongs in Git.
