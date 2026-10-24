## ADDED Requirements

### Requirement: Settings Navigation Adapts To Narrow Viewports

On narrow viewports (phones) the settings navigation SHALL NOT sit beside the
page content; it SHALL be presented as a single select control above the content
that lists every settings page and shows the current one. On wider viewports it
SHALL remain a side navigation. Both presentations SHALL list the same pages and
select the same one.

#### Scenario: Switching pages on a phone

- **WHEN** the viewport is narrow and the user chooses "Sources" in the settings
  select
- **THEN** the Sources settings page is shown at the full available width

#### Scenario: Content gets the full width on a phone

- **WHEN** the user opens the "Settings" tab on a narrow viewport
- **THEN** the selected settings page uses the full width of the screen and is
  not shown beside a navigation

#### Scenario: Wide viewport unchanged

- **WHEN** the user opens the "Settings" tab on a wide viewport
- **THEN** the navigation is shown to the left of the selected page
