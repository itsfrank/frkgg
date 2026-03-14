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

Run tests from this package or the workspace root:

```bash
bun run test
```
