# Account Crawler

## Usage

Install dependencies and build the workspace, then start the local binary:

```sh
mise run install
mise run build
pnpm --filter server start
```

This starts a local HTTP server and opens the dashboard in your default browser.
In the **Sources** tab, define how to read your bank's statement files. In the
**Upload** tab, choose a source, upload one or more statement files, and review
the parsed transactions before confirming.

For local development (with hot reload), run the server and dashboard dev
servers in separate terminals:

```sh
pnpm --filter server dev
pnpm --filter dashboard dev
```

and open the dashboard dev server's URL (Vite proxies `/api` requests to the
server).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information.
