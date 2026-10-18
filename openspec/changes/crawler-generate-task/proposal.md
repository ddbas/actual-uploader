## Why

Writing a crawler by hand means reverse-engineering a bank's login and
navigation flow in code. Playwright's codegen can record that flow, but it
cannot be customized and today there is no workflow in the repo that turns a
recording into a crawler, and a raw recording would capture credentials the user
types. A single command that records a session and scaffolds a crawler removes
the boilerplate and keeps credential entry manual.

## What Changes

- Add a Mise task `crawler:generate <name> <url>` that launches a recording
  browser on the given URL and, once the user finishes recording, scaffolds a
  new crawler in `packages/crawlers/src/` from the recording.
- While recording, the user clicks a floating "manual mode" button injected into
  the page to start, and again to end, a manual section (e.g. login). Everything
  recorded between the two clicks is discarded and replaced by a single
  `await page.pause()`, so credentials are always entered by a human at crawl
  time.
- Likely credential entries that were not marked are redacted and also become
  `await page.pause()`, so credentials never land in a file.
- Recording and generated crawlers use a real Chrome (when installed) with
  automation signals reduced, because banks commonly deny automated-looking
  browsers.
- The scaffolded crawler is registered in `packages/crawlers/src/index.ts` and
  implements the existing `Crawler` interface; the transaction extraction
  portion is left as a clearly marked TODO for the developer.

## Capabilities

### New Capabilities

- `crawler-generator`: Developer-facing behavior of the `crawler:generate` task
  — inputs, recording flow, manual-step marking, credential safety, and the
  scaffolded output.
- `crawler-generator-technical`: Technical requirements — how recorded code is
  captured, transformed, and written, and how the task is wired into Mise.

### Modified Capabilities

## Impact

- New script in the repo (location decided in design) and a new task in
  `mise.toml`.
- New files in `packages/crawlers/src/` and an edit to
  `packages/crawlers/src/index.ts` per generated crawler.
- Uses `playwright` (already a dependency of `packages/crawlers`); no new
  runtime dependency expected.
