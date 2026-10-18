## 1. Spike

- [x] 1.1 Spike: establish that codegen cannot be customized and that function
      keys are not reliably recorded, leading to an own public-API recorder

## 2. Transformation

- [x] 2.1 Implement the page recorder script and `record()` so manual sections
      become a single `await page.pause();` and typed values never leave the
      page, verified in a real browser
- [x] 2.2 Add password-pattern redaction (English and French terms) with a
      warning list, and verify with unit tests that no credential value remains
      in the output
- [x] 2.3 Generate only page steps (no launch boilerplate), verified by tests

## 3. Generator Script

- [x] 3.1 Implement argument validation (name kebab-case, http(s) URL) and
      verify each failure mode exits non-zero with usage without launching a
      browser
- [x] 3.2 Launch the browser with the recorder enabled and the injected toggle
      button, print the large banner (toggle button, how to finish) before the
      browser opens, read and delete the file on exit, and verify with a manual
      run
- [x] 3.3 Implement the crawler template and write
      `packages/crawlers/src/<name>.ts`, and verify the generated file passes
      Biome and type checks
- [x] 3.4 Register the crawler in `packages/crawlers/src/index.ts` idempotently,
      and verify the crawler appears in the registry and that regenerating an
      existing name overwrites the file without duplicating the registration

## 4. Wiring and Docs

- [x] 4.1 Add the `crawler:generate` task to `mise.toml` and verify it appears
      in `mise tasks` and passes arguments through
- [x] 4.2 Document the workflow (toggle button, finishing a recording) in
      README.md and fix the stale `mise run install`/`build` task names
- [x] 4.3 End-to-end: generate a crawler against a test page, run
      `mise run pnpm:build`, and verify the build succeeds and no typed
      credential appears in the repo

## 5. Rework: toggle button and low-detectability browser

- [x] 5.1 Replace the `F9` marker with an injected floating toggle button
      detected in the recording, and verify with a real recorder run that toggle
      clicks are recorded and state survives
- [x] 5.2 Add shared `launchBrowser()` (real Chrome, no automation flag) used by
      both the recorder and generated crawlers
- [x] 5.3 Replace the private-API recorder with a public-API recorder
      (`addInitScript` + `exposeFunction`) and verify against a real browser
- [ ] 5.4 Developer verifies against their bank that login is no longer denied
