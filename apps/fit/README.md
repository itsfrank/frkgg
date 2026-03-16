# fit

`fit` can be developed in two modes:

- standalone mode, which runs only the fit app and fit API
- integrated mode, which runs inside the full subdomain/auth stack

## Standalone mode

Run these commands from [`apps/fit`](/Users/frk/dev/frkgg/apps/fit):

```bash
bun install
bun run dev
```

This starts:

- the Vite app on `http://localhost:3002`
- the fit API on `http://localhost:3003`

In standalone mode, the API uses a fixed mock authenticated user by default:

- username: `dev-user`
- email: `dev-user@example.com`

Optional overrides:

```bash
FIT_STANDALONE_USERNAME=coach FIT_STANDALONE_EMAIL=coach@example.com bun run dev:api
```

## Integrated mode

From the repo root:

```bash
bun run dev
```

That starts Caddy, auth, site, and fit together. The fit app and API run in integrated mode, where fit expects Caddy to forward:

- `X-Auth-User`
- `X-Auth-Email`

You can also run only fit's integrated processes directly:

```bash
bun run --filter fit dev:integrated:api
bun run --filter fit dev:integrated:app
```

## Other commands

From [`apps/fit`](/Users/frk/dev/frkgg/apps/fit):

```bash
bun run test
bun run typecheck
bun run build
```
