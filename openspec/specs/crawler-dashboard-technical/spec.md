## Purpose

Defines the technical/architectural requirements for how the crawler dashboard
is served and how it communicates with crawler runs: a locally hosted server,
streaming progress/results over Server-Sent Events, run isolation between
crawlers, and client-side reconnection behavior.

## Requirements

### Requirement: Binary Starts a Local HTTP Server

The binary SHALL start a local HTTP server that hosts the built web dashboard,
and SHALL determine that server's local URL before opening the browser.

#### Scenario: Binary starts the server before opening the browser

- **WHEN** the binary is run
- **THEN** a local HTTP server starts and begins serving the dashboard's static
  assets before the browser is opened to that server's URL

### Requirement: Progress and Results Are Streamed Over Server-Sent Events

The server SHALL expose a Server-Sent Events (SSE) endpoint that streams crawler
lifecycle and transaction events (at minimum: crawler started, crawler progress,
transaction produced, crawler finished, crawler failed, and run-all finished) to
connected dashboard clients.

#### Scenario: Dashboard receives streamed events

- **WHEN** a crawler run is in progress
- **THEN** the connected dashboard client receives SSE events reflecting that
  crawler's lifecycle and any transactions it produces, without polling

### Requirement: Crawler Run Failures Are Isolated

The server SHALL isolate a failing crawler's run from other crawlers: an error
in one crawler's `run` generator SHALL emit a crawler-failed event for that
crawler only and SHALL NOT prevent other crawlers from running, whether
triggered individually or as part of "Run All".

#### Scenario: One crawler failing does not stop Run All

- **WHEN** "Run All" is in progress and one crawler's run throws an error
- **THEN** the server emits a crawler-failed event for that crawler and proceeds
  to run the next crawler in the series

### Requirement: Dashboard Client Reconnects After a Dropped Connection

The dashboard client SHALL attempt to reconnect to the server's SSE endpoint if
the connection drops while a run is in progress, so that progress indicators do
not remain permanently stuck in a running state due to a transient network
interruption.

#### Scenario: Client reconnects after a dropped SSE connection

- **WHEN** the dashboard's SSE connection drops while a crawler run is in
  progress
- **THEN** the dashboard client automatically attempts to reconnect and resumes
  receiving progress/result events for in-progress runs
