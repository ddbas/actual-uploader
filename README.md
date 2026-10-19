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

Before uploading, enter your Actual server URL, server password, sync ID and
(optionally) end-to-end encryption password under **Settings → Actual**. The
header shows whether the connection works. The server uses the official
`@actual-app/api` package, so its version should match your Actual server's
version; a mismatch shows up as the reason next to "Not connected".

Persisted data (sources, Actual settings, Actual cache) is stored in
`~/.account-crawler` by default. Override it with the `ACCOUNT_CRAWLER_DATA_DIR`
environment variable or, taking precedence, the `--data-dir` option:

```sh
pnpm --filter server start -- --data-dir /path/to/data
```

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
