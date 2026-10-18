## Purpose

Defines the technical requirements for how the dashboard is served: a locally
hosted HTTP server that serves the built dashboard.

## Requirements

### Requirement: Binary Starts a Local HTTP Server

The binary SHALL start a local HTTP server that hosts the built web dashboard,
and SHALL determine that server's local URL before opening the browser.

#### Scenario: Binary starts the server before opening the browser

- **WHEN** the binary is run
- **THEN** a local HTTP server starts and begins serving the dashboard's static
  assets before the browser is opened to that server's URL
