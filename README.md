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

Persisted data (sources, Actual settings, Actual cache) is stored in
`~/.account-crawler` by default. Override it with the `DATA_DIR` environment
variable. The listen port is set with `PORT` (default: a random free port) and
the bind address with `HOST` (default: `127.0.0.1`):

```sh
DATA_DIR=/path/to/data PORT=8080 pnpm --filter server start
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
