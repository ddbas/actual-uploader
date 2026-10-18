## Decisions

- **Shared pure package `statement-core`.** The wizard previews parsed rows in
  the browser and the server processes statements; both use the same CSV parser
  and mapping code so previews match real results.
- **Columns are referenced by zero-based index**, which works whether or not a
  header exists. Header names are only used for display.
- **Upload type model** is a discriminated union on `format` (`"csv"` now) so
  PDF types can be added later without migration.
- **Amount** is `{ kind: "single", column }`,
  `{ kind: "split", debitColumn, creditColumn }` (shown as outflow/inflow), or
  `{ kind: "inOut", column, inOutColumn, outValue }`; an optional `flipAmount`
  negates the result. Output is integer cents per the Actual Budget
  `Transaction`.
- **Dates** use field order and year width (`YYYY MM DD`, `MM DD YYYY`, ...),
  independent of separator, and are normalized to `YYYY-MM-DD`. Format detection
  scans all sample rows and reports ambiguity.
- **Mapping UI** follows Actual: one select per field choosing a column (each
  column feeds one field), separate from a preview table whose columns are the
  fields. Mappings are guessed from headers and value shapes, and selects list
  only columns that can plausibly supply the field.
- **Skipped lines** (`skipStartLines`/`skipEndLines`) apply before the header
  row; row numbers in errors refer to the original file.
- **Known limitation:** files are read as UTF-8; other encodings (as Actual
  supports) are not yet handled.
- **Account** is not part of an upload type; it is supplied when processing.
- **Persistence** is a JSON file in a data directory
  (`ACCOUNT_CRAWLER_DATA_DIR`, default `~/.account-crawler`). Simple, local,
  inspectable; swappable for a database later.
