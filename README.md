# Account Crawler

## Usage

Install dependencies and build the workspace, then start the local binary:

```sh
mise run install
mise run build
pnpm --filter server start
```

This starts a local HTTP server and opens the dashboard in your default browser.
From the **Home** tab you can run any registered crawler individually or click
**Run All** to run every crawler in series; results stream into the **Results**
tab as they're collected.

For local development (with hot reload), run the server and dashboard dev
servers in separate terminals:

```sh
pnpm --filter server dev
pnpm --filter dashboard dev
```

and open the dashboard dev server's URL (Vite proxies `/api` requests to the
server).

### Adding a new crawler

Crawlers live in `packages/crawlers/src` and implement the `Crawler` interface
from `crawler-core` (`id`, `name`, `description`, and an async generator `run()`
that yields `Transaction` objects). See `packages/crawlers/src/mock.ts` for a
reference implementation, and register new crawlers in
`packages/crawlers/src/index.ts`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information.
