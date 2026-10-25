## Why

Users currently have no way to run their bank/financial account crawlers or
review the transactions those crawlers collect. To make the tool usable, we need
a local runner: a binary that starts a web server, opens a dashboard in the
browser, lets the user trigger one or all crawlers, watch progress, and review
the resulting transactions in a shape compatible with Actual Budget's
`Transaction` model. This change establishes that foundation, along with a
common crawler interface and a first mock crawler implementation so future real
crawlers can be added consistently.

## What Changes

- Add a local binary (Node/TypeScript) that starts an HTTP server hosting a web
  application and automatically opens it in the user's default browser.
- Add a React + Vite web dashboard with two tabs:
  - **Home**: lists all registered crawlers (name, description, per-crawler
    "Run" button, per-crawler progress indicator) plus a "Run All" button at the
    top that runs every crawler in series.
  - **Results**: appears only after at least one crawler run has completed,
    populated with the collected transaction data.
- Define a common `Crawler` interface/contract that all crawlers implement, so
  new crawlers can be added by conforming to this contract. Crawlers expose an
  async stream (e.g. `AsyncIterable`/`AsyncGenerator`) of `Transaction` objects
  rather than a single resolved promise, so results can be surfaced
  incrementally as they're collected.
- Define a `Transaction` type modeled on the Actual Budget API `Transaction`
  reference (https://actualbudget.org/docs/api/reference) so crawler output is
  directly compatible with Actual Budget import.
- Implement a `mock` crawler: launches Playwright, navigates to
  `https://example.com/login`, waits 5 seconds, closes Playwright, then yields a
  small set of hard-coded mock `Transaction` records.
- Add server-side endpoints/streaming mechanism (e.g. Server-Sent Events or
  WebSocket) so the dashboard can display live per-crawler progress and stream
  transactions to the Results tab as they arrive.
- Establish the technical baseline for the project: Vite (latest) + React,
  TypeScript 7.x, Vitest (latest) for all tests, Playwright (latest) for all
  browser automation.

## Capabilities

Functional requirements (user/observable behavior) and technical/ architectural
requirements (internal contracts, data shapes, and implementation mechanisms)
are captured in **separate spec files per capability**, never mixed in the same
document. Each functional capability below has a corresponding `-technical`
capability holding the architectural/technical requirements that support it,
except `crawler-interface-technical`, which is a purely technical/architectural
contract with no independent user-facing behavior of its own.

### New Capabilities

Functional:

- `crawler-dashboard`: User-observable behavior of the local dashboard — the
  Home tab listing crawlers, running crawlers individually or all in series,
  per-crawler progress indicators, and the Results tab appearing and streaming
  in collected transactions.
- `mock-crawler`: User-observable behavior of the reference `mock` crawler — it
  is listed and runnable, simulates a bank login session on a real bank
  authentication page without logging in, and then produces sample transaction
  data.

Technical/Architectural:

- `crawler-interface-technical`: The common `Crawler` TypeScript interface and
  streaming semantics (crawlers return an async stream of transactions rather
  than a `Promise`), and the `Transaction` type shape aligned with the Actual
  Budget API (https://actualbudget.org/docs/api/reference).
- `mock-crawler-technical`: The mock crawler's implementation details —
  conformance to the `Crawler` interface, use of Playwright/Chromium to drive
  the simulated login session, and yielding hard-coded `Transaction` objects.
- `crawler-dashboard-technical`: The binary's local HTTP server, the Server-Sent
  Events (SSE) transport used to stream crawler progress and transactions to the
  browser, failure isolation between crawler runs, and client-side SSE reconnect
  behavior.

### Modified Capabilities

- None (this is a greenfield set of capabilities; no existing specs are
  changed).

## Impact

- New app(s)/package(s) in the monorepo: a server/binary package, a web
  dashboard package, and a shared crawler-interface (types) package, alongside
  the existing `apps/crawler` package (which currently contains no
  implementation and will need to be reconciled/populated as part of this
  change).
- New dependencies: Vite, React, TypeScript 7.x, Vitest, Playwright, plus a
  minimal HTTP/streaming server and an "open in browser" utility.
- New build/test targets wired into the existing Turborepo pipeline
  (`turbo.json`) and Mise tasks.
- No impact on existing specs, since none exist yet in `openspec/specs/`.
