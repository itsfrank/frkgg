# auth

To install dependencies from the workspace root:

```bash
bun install
```

To run:

```bash
bun run dev
```

Set local secrets before starting the server:

```bash
cp dev.env.example dev.env
set -a
. ./dev.env
set +a
```

For local development, the auth app is expected to sit behind `auth.frk.localhost`,
with cookies scoped to `frk.localhost` so they work across subdomains.

Run tests from this package or the workspace root:

```bash
bun run test
```
