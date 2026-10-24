## Why

On phones the Settings page is unusable: a fixed 160px left-hand navigation plus
gaps leaves roughly 140px for the page content. Other dashboard views have
similar narrow-viewport problems (wide tables, oversized page padding).

## What Changes

- Settings navigation collapses to a select control on narrow viewports and
  remains a left sidebar on wider ones.
- Dashboard page padding is reduced on narrow viewports.
- Data tables scroll horizontally inside their container instead of widening the
  page.
- Out of scope: making the PDF column editor / source setup wizard
  touch-friendly (treated as a desktop task). Automated layout tests
  (verification is manual).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `dashboard-settings`: settings navigation adapts to narrow viewports.
- `crawler-dashboard`: dashboard content fits narrow viewports without
  page-level horizontal scrolling.
- `crawler-dashboard-technical`: breakpoint and layout mechanism requirements.

## Impact

- `apps/dashboard/src/SettingsTab.tsx`, `App.tsx`, and table markup in
  `UploadTab.tsx`, `MappingStep.tsx`, `PdfSourceSetup.tsx`.
- Existing component tests for `SettingsTab` need to cover the select rendering.
- No server, API, or dependency changes.
