## 1. Spike

- [ ] 1.1 Run `playwright codegen -o /tmp/rec.ts --target=javascript <url>`
      manually, close the window, and confirm the file is complete, the process
      exits, and a bare `F9` press (with and without a focused field) is
      recorded as a `press`; record the observed output shape as a test fixture

## 2. Transformation

- [x] 2.1 Implement `sanitize()` that replaces spans between marker-key presses
      (including an unmatched start) with a single `await page.pause();` and
      verify with unit tests on fixture recordings
- [x] 2.2 Add password-pattern redaction (English and French terms) with a
      warning list, and verify with unit tests that no credential value remains
      in the output
- [x] 2.3 Strip the wrapper/launch boilerplate so only page steps remain, and
      verify with a unit test

## 3. Generator Script

- [x] 3.1 Implement argument validation (name kebab-case, http(s) URL) and
      verify each failure mode exits non-zero with usage without launching a
      browser
- [x] 3.2 Spawn codegen with a temp output file, print the large pause-key
      banner (marker key as on/off toggle, how to finish, macOS `fn` note)
      before the browser opens, read and delete the file on exit, and verify
      with a manual run
- [x] 3.3 Implement the crawler template and write
      `packages/crawlers/src/<name>.ts`, and verify the generated file passes
      Biome and type checks
- [x] 3.4 Register the crawler in `packages/crawlers/src/index.ts` idempotently,
      and verify the crawler appears in the registry and that regenerating an
      existing name overwrites the file without duplicating the registration

## 4. Wiring and Docs

- [x] 4.1 Add the `crawler:generate` task to `mise.toml` and verify it appears
      in `mise tasks` and passes arguments through
- [x] 4.2 Document the workflow (marker key, finishing a recording) in README.md
      and fix the stale `mise run install`/`build` task names
- [x] 4.3 End-to-end: generate a crawler against a test page, run
      `mise run build`, and verify the build succeeds and no typed credential
      appears in the repo
