## 1. Implementation

- [x] 1.1 Add `apps/server/src/cli.ts` with `resolveDataDir` (uses
  `util.parseArgs`; precedence flag > env > default; errors on missing value or
  unknown argument) and verify with unit tests in `cli.test.ts` covering every
  scenario in the spec (`mise run` test task for the server passes)
- [x] 1.2 Use `resolveDataDir` in `apps/server/src/bin.ts`, printing
  errors/usage and exiting non-zero on failure, and verify by running the built
  binary with `--data-dir /tmp/ac-test` and seeing files created there

## 2. Documentation and validation

- [x] 2.1 Document `--data-dir` wherever `ACCOUNT_CRAWLER_DATA_DIR` is
  documented (README/CONTRIBUTING if present) and verify with
  `rg ACCOUNT_CRAWLER_DATA_DIR`
- [x] 2.2 Run the repo's lint, type-check and test tasks via mise and verify
  they all pass
