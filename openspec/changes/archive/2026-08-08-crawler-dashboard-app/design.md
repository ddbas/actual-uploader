## Context

The monorepo currently has `apps/crawler` (an empty stub package) and no
`packages/`. There is no existing spec-driven architecture, web server, or UI.
Turborepo (`turbo.json`) and Mise already orchestrate `build`/`test` across
packages. This change introduces the first real application: a local binary that
serves a React dashboard for running Playwright-based account crawlers and
reviewing their output as Actual Budget-shaped transactions.

Constraints from the proposal:

- Vite (latest) + React for the web app.
- TypeScript 7.x everywhere.
- Vitest (latest) for all tests.
- Playwright (latest) for all browser automation.
- Crawlers return a stream of `Transaction`, not a `Promise`.
- Only one crawler (`mock`) is implemented in this pass.

## Goals / Non-Goals

**Goals:**

- Establish package boundaries: a shared `crawler-core` (types + interface),
  crawler implementations (`mock` to start), a server/binary, and the web
  dashboard.
- Define a `Crawler` interface whose `run()` returns an
  `AsyncGenerator<Transaction>`, enabling incremental streaming to the UI.
- Define a `Transaction` type matching the Actual Budget API reference exactly
  enough that no field mapping is needed before calling `importTransactions`.
- Wire a local server that runs crawlers and streams progress/results to the
  browser over a persistent connection (SSE), and a binary entry point that
  starts the server and opens the browser.
- Implement the `mock` crawler per the spec (Playwright to the example login
  URL, 5s wait, close, yield hard-coded transactions).

**Non-Goals:**

- Real bank crawler implementations (only `mock`).
- Persisting results to disk or uploading to Actual Budget (out of scope for
  this pass — dashboard only displays results).
- Authentication/session handling for the local dashboard (single-user,
  localhost only).
- Parallel crawler execution (only "Run All" in series is required).
- Handling of split transactions/subtransactions in the mock crawler.

## Decisions

### Package layout

Introduce, alongside the existing `apps/crawler`:

- `packages/crawler-core` — the `Crawler` interface, `Transaction` type, and a
  crawler registry helper. No UI or server dependencies.
- `packages/crawlers` — houses the `mock` crawler and future real crawlers, each
  implementing `Crawler` from `crawler-core`, using Playwright.
- `apps/server` — Node/TypeScript HTTP server exposing REST endpoints to list
  crawlers and trigger runs, plus an SSE endpoint that streams
  progress/transaction events; also the binary entry point (`bin`) that starts
  the server and opens the browser.
- `apps/dashboard` — Vite + React app, built as static assets served by
  `apps/server` in production, or proxied in dev.

Rationale: Keeping `crawler-core` dependency-free (no Playwright, no server/UI
code) keeps the interface reusable and easy to test. Splitting `server` and
`dashboard` follows Vite's standard client/server separation and keeps the
browser bundle free of Node-only Playwright code.

Alternative considered: a single `apps/crawler` app containing everything.
Rejected because it conflates a static React bundle build with a Node server +
Playwright runtime, complicating Vite config and Turborepo caching.

### Streaming transport: Server-Sent Events (SSE) over WebSockets

Use SSE for streaming crawler progress/transaction events from server to
browser. Rationale: communication is one-directional (server → browser); SSE is
simpler to implement/test with plain HTTP, works well with Vite dev proxying,
and avoids introducing a WebSocket dependency for a single-user localhost tool.
"Run"/"Run All" actions are triggered via simple POST requests; the SSE stream
(one per session, or one per run) carries `crawler-started`, `crawler-progress`,
`transaction`, `crawler-finished`, `crawler-failed`, and `run-all-finished`
events.

Alternative considered: WebSockets. Rejected as unnecessary complexity for a
one-directional, localhost-only stream.

### Crawler interface shape

```ts
interface Crawler {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  run(): AsyncGenerator<Transaction, void, void>;
}
```

`run()` is a generator function so each crawler implementation can `yield`
transactions as it collects them (e.g. mid-Playwright-session for real
crawlers). The mock crawler yields all of its transactions after Playwright
closes, but the interface does not require that ordering.

### Transaction type

Modeled directly on the Actual Budget API reference
(https://actualbudget.org/docs/api/reference#transaction):

```ts
interface Transaction {
  id?: string;
  account: string; // id, required
  date: string; // YYYY-MM-DD, required
  amount?: number; // integer, no decimal places
  payee?: string; // id
  payee_name?: string;
  imported_payee?: string;
  category?: string; // id
  notes?: string;
  imported_id?: string;
  transfer_id?: string;
  cleared?: boolean;
  subtransactions?: Transaction[];
}
```

Only `account` and `date` are required, matching the API reference. The mock
crawler will use a placeholder `account` id (since no real account mapping
exists yet) and set `payee_name`, `amount`, `date`, `imported_id`, and `notes`
on its hard-coded transactions.

### Progress indicator representation

Each crawler's run state is one of `idle | running | success | error`. The
server includes this state in SSE events and the dashboard keeps a client-side
map of `crawlerId -> state` (plus `error` message when applicable) to render
each crawler's progress indicator. No separate "percentage complete" is tracked
in this pass — the indicator is a simple spinner/badge reflecting the state
enum.

### Results tab data model

The dashboard accumulates a flat, in-memory (client-side) array of `Transaction`
records tagged with the `crawlerId` and `crawlerName` that produced them,
appended as `transaction` SSE events arrive. The Results tab renders this
accumulated list. Data is not persisted across page reloads in this pass.

### Mock crawler behavior

Implementation sketch:

```ts
async function* run() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto("https://example.com/login");
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
  yield {
    account: "mock-account",
    date: "2024-01-15",
    amount: -4599,
    payee_name: "Grocery Store",
    imported_id: "mock-1",
  };
  yield {
    account: "mock-account",
    date: "2024-01-16",
    amount: 250000,
    payee_name: "Employer Inc",
    imported_id: "mock-2",
  };
}
```

## Risks / Trade-offs

- [Risk] Navigating to a real external banking domain in an automated test suite
  is slow, flaky, and dependent on third-party uptime/DOM structure. →
  Mitigation: unit/integration tests for the mock crawler mock out Playwright
  (`chromium.launch`) rather than hitting the real network; a separate,
  optional/manual smoke test may exercise the real URL.
- [Risk] SSE connections can silently drop (e.g. proxies, browser tab
  suspension), leaving the dashboard's progress indicators stuck. → Mitigation:
  implement basic reconnect logic on the client and have the server tolerate a
  client reconnecting mid-run without restarting the crawler.
- [Risk] Running crawlers "in series" for "Run All" means one slow or hung
  crawler blocks all subsequent crawlers. → Mitigation: acceptable for this pass
  per the proposal ("in series for now"); document as a known limitation,
  revisit with a future concurrency change if needed.
- [Risk] TypeScript 7.x and the latest Vite/Vitest/Playwright/React versions may
  not all be mutually compatible or stable at implementation time. → Mitigation:
  pin to the latest versions that are verified compatible together at
  implementation time; document any necessary version adjustments in the
  change's tasks/PR rather than blocking on exact "7.*" if it is not yet
  generally available.

## Resolved Questions

- Crawler implementations live in their own `packages/crawlers` package (rather
  than directly inside `apps/crawler`/`apps/server`), keeping the implementation
  layer separate from `crawler-core`'s dependency-free types.
- The dashboard's dev server proxies API/SSE calls to the Node server via Vite's
  standard dev proxy, taking advantage of Vite's dev server (HMR, fast
  iteration); the binary builds and serves static assets in production.
