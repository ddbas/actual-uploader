## 1. Workspace & Tooling Setup

- [x] 1.1 Add `packages/crawler-core`, `packages/crawlers`, `apps/server`, and
      `apps/dashboard` to the pnpm workspace, updating `pnpm-workspace.yaml` as
      needed.
- [x] 1.2 Add TypeScript 7.x as a shared devDependency and a base
      `tsconfig.json` referenced by each new package/app.
- [x] 1.3 Configure Vitest (latest) at the workspace/root level with per-package
      test configs.
- [x] 1.4 Wire `build`, `test`, `check-types`, and `dev` scripts for the new
      packages/apps into `turbo.json`'s task pipeline.
- [x] 1.5 Reconcile the existing empty `apps/crawler` package with the new
      structure (repurpose into `packages/crawlers`, or remove it in favor of
      the new package).

## 2. Crawler Core (Types & Interface)

- [x] 2.1 Implement the `Transaction` type in `packages/crawler-core` matching
      the Actual Budget API reference (`account`, `date`, `amount`, `payee`,
      `payee_name`, `imported_payee`, `category`, `notes`, `imported_id`,
      `transfer_id`, `cleared`, `subtransactions`, optional `id`).
- [x] 2.2 Implement the `Crawler` interface (`id`, `name`, `description`,
      `run(): AsyncGenerator<Transaction, void, void>`) in
      `packages/crawler-core`.
- [x] 2.3 Implement a crawler registry helper (e.g.
      `registerCrawler`/`getCrawlers`) usable by the server to enumerate
      available crawlers without running them.
- [x] 2.4 Write Vitest unit tests for the registry helper and for type-level
      conformance of a sample crawler.

## 3. Mock Crawler

- [x] 3.1 Add Playwright (latest) as a dependency of the crawler implementations
      package.
- [x] 3.2 Implement the `mock` crawler: launch Playwright, navigate to
      `https://accweb.mouv.desjardins.com/identifiantunique/securite-garantie/authentification/auth/manuel`,
      wait 5 seconds, close the browser.
- [x] 3.3 After closing Playwright, yield a small set of hard-coded
      `Transaction` objects from the mock crawler's `run()` generator.
- [x] 3.4 Write Vitest tests for the mock crawler with Playwright's
      `chromium.launch` mocked/stubbed (no real network calls in the default
      test run), asserting navigation URL, wait duration, browser close, and
      yielded transactions.
- [x] 3.5 (Optional) Add a separate manual/opt-in smoke test script that runs
      the mock crawler against the real URL, excluded from the default CI test
      run.

## 4. Server & Binary

- [x] 4.1 Scaffold `apps/server` as a Node/TypeScript HTTP server with an
      endpoint to list registered crawlers (`id`, `name`, `description`).
- [x] 4.2 Implement an endpoint/mechanism to trigger a single crawler's run by
      `id`.
- [x] 4.3 Implement an endpoint/mechanism to trigger "Run All" that runs every
      registered crawler in series.
- [x] 4.4 Implement an SSE endpoint that streams `crawler-started`,
      `crawler-progress`, `transaction`, `crawler-finished`, `crawler-failed`,
      and `run-all-finished` events to connected clients.
- [x] 4.5 Ensure a failing crawler run (`run-all` or individual) is isolated:
      emits `crawler-failed` for that crawler only and does not stop other
      crawlers'/subsequent runs.
- [x] 4.6 Implement the binary entry point that starts the server, determines
      the local URL, and opens it in the user's default browser.
- [x] 4.7 Configure the binary/server to serve the built dashboard's static
      assets in production.
- [x] 4.8 Write Vitest tests for the server's run orchestration (single run,
      run-all in series, error isolation) using a fake in-memory crawler.

## 5. Dashboard (Vite + React)

- [x] 5.1 Scaffold `apps/dashboard` with the latest Vite + React + TypeScript
      7.x template, configured to proxy API/SSE requests to `apps/server` in
      development.
- [x] 5.2 Implement the top-level tab layout with "Home" selected by default and
      a hidden-until-first-completion "Results" tab.
- [x] 5.3 Implement the Home tab: "Run All" button above the crawler list; list
      of crawlers each showing name, description, "Run" button, and a
      per-crawler progress indicator (`idle | running | success | error`).
- [x] 5.4 Wire the "Run" and "Run All" buttons to call the server endpoints and
      connect to the SSE stream to update per-crawler state live.
- [x] 5.5 Implement client-side accumulation of streamed `transaction` events
      into a session-scoped list tagged with the originating crawler.
- [x] 5.6 Reveal and populate the "Results" tab as soon as the first
      `transaction`/`crawler-finished` event is received; keep it updated as
      further events stream in, including across multiple crawlers/"Run All".
- [x] 5.7 Implement basic SSE reconnect handling on the client so a dropped
      connection doesn't permanently strand progress indicators.
- [x] 5.8 Write Vitest + React Testing Library tests for: default Home tab,
      Results tab hidden until first completion, per-crawler Run isolation, Run
      All series behavior (mocked server/SSE), and incremental Results
      population.

## 6. Integration & Polish

- [x] 6.1 Run the full workspace build/test/check-types via `turbo run build` /
      `turbo run test` and fix any cross-package issues.
- [x] 6.2 Manually verify end-to-end: start the binary, confirm the browser
      opens, run the mock crawler individually and via "Run All", confirm
      progress indicators and Results tab behave as specified.
- [x] 6.3 Update `README.md`/`CONTRIBUTING.md` (if needed) with instructions for
      running the binary locally and adding new crawlers.
- [ ] 6.4 Ensure all git hooks (lefthook) pass without being skipped.
