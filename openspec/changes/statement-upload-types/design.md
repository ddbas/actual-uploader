## Decisions

- **Shared pure package `statement-core`.** The wizard previews parsed rows in
  the browser and the server processes statements; both use the same CSV parser
  and mapping code so previews match real results.
- **Columns are referenced by zero-based index**, which works whether or not a
  header exists. Header names are only used for display.
- **Upload type model** is a discriminated union on `format` (`"csv"` now) so
  PDF types can be added later without migration.
- **Amount** is either `{ kind: "single", column }` or
  `{ kind: "split", debitColumn, creditColumn }`; output is integer cents per
  the Actual Budget `Transaction`. Dates are normalized to `YYYY-MM-DD` using a
  user-chosen format.
- **Account** is not part of an upload type; it is supplied when processing.
- **Persistence** is a JSON file in a data directory
  (`ACCOUNT_CRAWLER_DATA_DIR`, default `~/.account-crawler`). Simple, local,
  inspectable; swappable for a database later.
