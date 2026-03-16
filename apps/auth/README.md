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

GitHub OAuth configuration:

- start login at `https://auth.frk.localhost/login/github`
- create a GitHub OAuth app with callback URL `https://auth.frk.localhost/oauth/github/callback`
- update [`src/github-allowed-users.ts`](/Users/frk/dev/frkgg/apps/auth/src/github-allowed-users.ts) with the GitHub usernames allowed to sign in
- keep `DOMAIN=frk.localhost`; the app derives `https://frk.localhost` and `https://auth.frk.localhost` from it and uses the same domain for cross-subdomain cookies

Run tests from this package or the workspace root:

```bash
bun run test
```
