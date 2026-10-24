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

### PDF sources

Many banks only provide PDF statements. When creating a source, choose **PDF**,
upload an example statement and pick an extraction _approach_ (the select lists
every available one). The only approach today is **Aligned columns**, for tables
laid out by alignment rather than drawn borders:

1. Place vertical dividers over the page (they are suggested from the text, and
   apply to every page). Removing a divider merges two columns.
2. Map the columns to transaction fields with the same controls as CSV. Only
   lines whose date column holds a date become transactions.
3. If the dates have no year (`03 09`), click the text on the page that contains
   the year. It is taken to be the year of the last row, and earlier rows roll
   back across a year boundary.
4. For amounts such as `113,83CR`, set the **credit marker** (`CR`): marked
   amounts are inflows and unmarked ones outflows. This option is available for
   CSV sources too.

Scanned (image-only) and password-protected PDFs are not supported. When a PDF
yields nothing, the Upload tab shows a warning such as "No transactions found".

Before uploading, enter your Actual server URL, server password, sync ID and
(optionally) end-to-end encryption password under **Settings → Actual**. The
header shows whether the connection works. The server uses the official
`@actual-app/api` package, so its version should match your Actual server's
version; a mismatch shows up as the reason next to "Not connected".

Actual rate-limits logins per IP, so the server keeps its Actual session open
and reuses it (closing it after 5 minutes idle, on failure, or when settings
change) and caches the status for 15 seconds. If Actual answers
`too-many-requests`, the server stops contacting it for 60 seconds and the
header shows "Actual is rate-limiting logins; retrying in N s."

The Actual connection can also be preconfigured with environment variables:
`ACTUAL_SERVER_URL`, `ACTUAL_SERVER_PASSWORD`, `ACTUAL_SYNC_ID` and (optional)
`ACTUAL_ENCRYPTION_PASSWORD`. Empty values count as unset. Each provided value
overrides the one saved in the dashboard for that field, is kept in memory only
(never written to disk), and is shown read-only. Fields that are not provided
stay editable. An invalid `ACTUAL_SERVER_URL` (not http/https) stops the server
at startup.

```sh
docker run -p 8080:8080 \
  -e ACTUAL_SERVER_URL=https://actual.example.com \
  -e ACTUAL_SERVER_PASSWORD=... \
  -e ACTUAL_SYNC_ID=... \
  account-crawler
```

Note: plain environment variables are visible via `docker inspect` and `/proc`.
Prefer `--env-file` or your orchestrator's secret injection over inline values
in shell history or committed compose files.

Persisted data (sources, Actual settings, Actual cache) is stored in
`~/.account-crawler` by default. Override it with the `DATA_DIR` environment
variable. The listen port is set with `PORT` (default: a random free port) and
the bind address with `HOST` (default: `127.0.0.1`):

```sh
DATA_DIR=/path/to/data PORT=8080 pnpm --filter server start
```

### Logging

The server writes structured JSON logs to standard output only (no log files).
Set the level with `LOG_LEVEL` (`debug`, `info`, `warn` or `error`; default
`info`). An invalid value stops the server on startup. Secrets, request bodies
and statement/transaction data are never logged.

To debug a failing Actual connection, use `LOG_LEVEL=debug`: it logs each
connection phase (`load-api`, `init`, `download-budget`, `operation`) with
timings, and failures include the phase, error code, and cause chain. For
readable output, pipe through `pino-pretty`:

```sh
LOG_LEVEL=debug pnpm --filter server dev | npx pino-pretty
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
