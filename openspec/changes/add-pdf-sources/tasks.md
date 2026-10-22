## 1. Credit marker (shared mapping)

- [x] 1.1 Extract a shared `FieldMapping` type from `CsvSource` in
      `packages/statement-core/src/source.ts` and make `CsvSource` use it;
      verify `mise run test` still passes with no behaviour change.
- [x] 1.2 Add the optional `creditMarker` to `FieldMapping`, apply it in
      `interpretRow` before flip-amount, and validate it (non-empty, not digits
      or separators) in `validateSource`; verify new unit tests cover the "CR",
      thousands-space, flip and invalid-marker scenarios.
- [x] 1.3 Add the credit marker control to the CSV wizard amount options
      (`apps/dashboard/src/SourceWizard.tsx`) and verify a component test shows
      "59,00" and "113,83CR" previewed as outflow and inflow.

## 2. Year-less dates

- [x] 2.1 Add `DD MM` and `MM DD` parsing to `statement-core`, including
      separators and month names, kept out of the CSV date format options;
      verify unit tests for valid and invalid day/month values.
- [x] 2.2 Implement year resolution (anchor year = year of the last row, step
      back when the month jumps up by more than six, ignore unparseable rows);
      verify tests for the Dec/Jan boundary, the small backward step and invalid
      rows.

## 3. Approach contract and registry

- [x] 3.1 Add text item and page types and the approach contract (id, label,
      `run`, config validation, versioned config) under
      `packages/statement-core/src/pdf/`; verify it type-checks and exports from
      `index.ts`.
- [x] 3.2 Add the approach registry and extend `Source` with `PdfSource` and
      `validateSource` delegation to the approach; verify tests for a valid
      source, an unknown approach, an invalid config and an untouched CSV
      source.
- [x] 3.3 Add `warnings` to the process result type (empty for CSV); verify the
      existing CSV processing tests are updated and pass.

## 4. Aligned columns approach

- [x] 4.1 Build the synthetic text-items fixture with realistic positions and
      fragmentation but invented data; verify no real names, addresses or
      account numbers appear in it.
- [x] 4.2 Implement line grouping and run joining; verify tests for baseline
      tolerance, word joining ("LES GRILLADES DU") and split digits ("1" +
      "979,73CR") against the fixture.
- [x] 4.3 Implement divider-based cell assignment by run midpoint and the
      date-anchored row filter across pages; verify tests for right-aligned
      amounts, ignored headings and totals lines, and multi-page rows.
- [x] 4.4 Map rows through the existing mapping and the year resolution,
      returning transactions, page/line errors and the "no transactions" and
      "year could not be determined" warnings; verify end-to-end `run` tests on
      the fixture, including the credit marker and year-less dates.
- [x] 4.5 Implement suggested dividers and the initial mapping guess over the
      grid; verify tests that the fixture's columns are suggested and date and
      amount are pre-assigned.
- [x] 4.6 Register the approach with config validation and version; verify
      config validation tests.

## 5. statement-pdf package

- [x] 5.1 Create `packages/statement-pdf` (workspace, tsconfig, tsup, vitest,
      turbo wiring) depending on `pdfjs-dist`; verify `mise run build` builds
      it.
- [x] 5.2 Implement bytes → pages of positioned text items for Node and the
      browser, with typed errors for encrypted and no-text PDFs; verify tests
      using a small generated PDF and error cases.
- [ ] 5.3 Configure pdfjs font data for Node and the Docker image, and verify
      reading under Node produces no `standardFontDataUrl` warnings and
      `mise run docker:build` succeeds.

## 6. Server

- [x] 6.1 Accept PDF sources in `POST /api/sources` using the shared validation;
      verify tests for stored, invalid-config and unknown-approach cases.
- [x] 6.2 Add the PDF branch to `POST /api/sources/:id/process` (base64 body →
      items → approach `run`), return `warnings`, and map read failures to 4xx
      with a reason; verify endpoint tests for success, not-a-PDF, encrypted and
      no-text.
- [x] 6.3 Verify a data file written before this change loads and its CSV
      sources process unchanged.

## 7. Dashboard: PDF source setup

- [x] 7.1 Split the CSV mapping step (field selects, layout options, mapped
      preview) out of `SourceWizard.tsx` into a reusable component without
      changing CSV behaviour; verify the existing wizard tests pass unmodified.
- [x] 7.2 Add the format choice (CSV or PDF) and the PDF setup shell: example
      PDF upload, reading via `statement-pdf`, page display with navigation and
      the unreadable/encrypted messages; verify component tests for each
      scenario.
- [x] 7.3 Add the approach select, the editor registry typed as a complete
      record over registered approaches, and the per-approach config store;
      verify a test that switching away and back restores settings and that a
      missing editor fails type-checking.
- [x] 7.4 Build the Aligned columns editor: page overlay with draggable, addable
      and removable dividers in PDF points, suggested defaults and zoom
      independence; verify component tests and a manual check that a divider
      stays over the same text when zooming.
- [x] 7.5 Compose the mapping step into the editor, including the year-less date
      formats and the year click (highlight, reject text without a year, block
      save until chosen); verify component tests for each scenario.
- [x] 7.6 Show the shell's transaction preview from the approach's `run` on the
      current config, and the save action with validation; verify a test that
      the preview equals the transactions the server returns for the same PDF.

## 8. Upload tab

- [x] 8.1 Accept PDFs for PDF sources, send them as base64, and show `warnings`
      and read errors with each file's results; verify component tests for each
      scenario in the `crawler-dashboard` delta.

## 9. Wrap-up

- [x] 9.1 Update `README.md` for PDF sources and approaches, and note extending
      with a new approach in `CONTRIBUTING.md`; verify the docs describe the
      registry and editor steps.
- [ ] 9.2 Run the full `mise run test` and `mise run build`, then try the
      fixture flow manually in the dashboard with a real statement; verify
      transactions match the statement and git hooks and CI pass.
