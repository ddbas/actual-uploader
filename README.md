# Account Crawler

## Usage

Install dependencies and build the workspace, then start the local binary:

```sh
mise run pnpm:install
mise run pnpm:build
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

#### Generating a crawler from a recording

Scaffold a crawler by recording a browsing session:

```sh
mise run crawler:generate <name> <url> [--marker-key <key>]
```

This opens Playwright codegen on `<url>`. Click through the site as you want the
crawler to. To keep credentials out of the code, press the **marker key**
(default `F9`; on macOS laptops hold `fn`) before logging in and press it again
afterwards: everything between the two presses is discarded and replaced by a
single `await page.pause()`, so you log in by hand each time the crawler runs.
Password-like fields that you forget to mark are redacted the same way, with a
warning. Close the browser window to finish; the crawler is written to
`packages/crawlers/src/<name>.ts` and registered in `index.ts`. Re-running with
an existing name overwrites it. Implement the `TODO: extract transactions`
placeholder yourself, and review the file before committing.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for more information.
