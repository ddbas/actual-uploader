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

### Requirement: Responsive Layout Uses Tailwind Breakpoints

The dashboard SHALL implement responsive behavior with Tailwind CSS responsive
utilities and daisyUI components, using the `md` breakpoint (768px) as the
single threshold between the narrow and wide layouts. Page padding SHALL be
reduced below `md`. Tables SHALL be wrapped in a horizontally scrollable
container.

#### Scenario: Single breakpoint

- **WHEN** layout differs between narrow and wide viewports
- **THEN** the switch happens at the `md` breakpoint

### Requirement: Settings Navigation Has A Single Source

The narrow (select) and wide (menu) settings navigation SHALL both be rendered
from the same list of settings pages, so adding a page appears in both. Only one
presentation SHALL be exposed to assistive technology at a time.

#### Scenario: Adding a settings page

- **WHEN** a page entry is added to the settings page list
- **THEN** it appears in both the select and the side menu without further
  changes
