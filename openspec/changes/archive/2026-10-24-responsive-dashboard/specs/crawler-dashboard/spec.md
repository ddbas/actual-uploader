## ADDED Requirements

### Requirement: Dashboard Fits Narrow Viewports

The dashboard SHALL be usable on phone-width viewports for the Upload and
Settings tabs: page content SHALL NOT cause the page itself to scroll
horizontally, and tables wider than the screen SHALL scroll horizontally within
their own area. Configuring a PDF source's column layout is not required to be
touch-friendly.

#### Scenario: Wide table on a phone

- **WHEN** a table is wider than the viewport on a narrow screen
- **THEN** the table scrolls horizontally within its container and the rest of
  the page stays within the screen width

#### Scenario: Reading the page on a phone

- **WHEN** the user opens any dashboard tab on a narrow viewport
- **THEN** the page does not scroll horizontally
