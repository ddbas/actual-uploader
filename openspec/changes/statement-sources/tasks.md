## 1. statement-core

- [x] 1.1 CSV parser, delimiter detection
- [x] 1.2 Source model, validation, row mapping (date, amount parsing)
- [x] 1.3 Flexible date parsing and multi-row date format detection
- [x] 1.4 Amount layouts (single, split, in/out), flip, skipped lines
- [x] 1.5 Mapping guess (including value-based payee and amount detection) and
      column analysis
- [x] 1.6 Unit tests

## 2. Server

- [x] 2.1 Source JSON store
- [x] 2.2 REST endpoints and tests

## 3. Dashboard

- [x] 3.1 "Sources" tab and list
- [x] 3.2 Creation wizard: options, field-to-column mapping, parsed preview
- [x] 3.3 Auto-mapping, column filtering, option naming, date format hints
- [x] 3.4 Confirmation prompt before deleting a source
- [x] 3.5 Allow selecting any column in every select; block saving when a column
      is assigned to more than one field (shared validation)
- [x] 3.6 Tests

## 4. Follow-ups (not in this change)

- [ ] 4.1 File encoding detection/selection
- [ ] 4.2 UI for processing a statement with a saved source
- [ ] 4.3 PDF sources
