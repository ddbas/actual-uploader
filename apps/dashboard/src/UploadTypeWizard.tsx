import { useMemo, useState } from "react";
import {
  DATE_FORMATS,
  type DateFormat,
  detectDelimiter,
  type FieldKey,
  guessMapping,
  interpretRow,
  parseCsv,
  type UploadTypeDraft,
  validateUploadType,
  windowRows,
} from "statement-core";

export interface UploadTypeWizardProps {
  onSave: (draft: UploadTypeDraft) => Promise<void>;
  onCancel: () => void;
}

type AmountKind = "single" | "split" | "inOut";

const PREVIEW_ROWS = 5;
const DELIMITERS: Array<[string, string]> = [
  [",", "Comma ( , )"],
  [";", "Semicolon ( ; )"],
  ["\t", "Tab"],
  ["|", "Pipe ( | )"],
  ["~", "Tilde ( ~ )"],
];

/** Which amount-related fields apply for each layout. */
const AMOUNT_FIELDS: Record<AmountKind, FieldKey[]> = {
  single: ["amount"],
  split: ["debit", "credit"],
  inOut: ["inOut", "amount"],
};

const AMOUNTISH: FieldKey[] = ["amount", "debit", "credit", "inOut"];

function isAllowed(field: FieldKey, kind: AmountKind): boolean {
  return !AMOUNTISH.includes(field) || AMOUNT_FIELDS[kind].includes(field);
}

const FIELD_LABELS: Record<FieldKey, string> = {
  date: "Date",
  payee: "Payee",
  notes: "Notes",
  importedId: "Source id",
  amount: "Amount",
  debit: "Outflow",
  credit: "Inflow",
  inOut: "In/Out",
};

const REQUIRED_FIELDS: FieldKey[] = [
  "date",
  "amount",
  "debit",
  "credit",
  "inOut",
];

export function UploadTypeWizard({ onSave, onCancel }: UploadTypeWizardProps) {
  const [name, setName] = useState("");
  const [fileText, setFileText] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [skipStartLines, setSkipStartLines] = useState(0);
  const [skipEndLines, setSkipEndLines] = useState(0);
  const [dateFormat, setDateFormat] = useState<DateFormat>("YYYY MM DD");
  const [amountKind, setAmountKind] = useState<AmountKind>("single");
  const [decimalSeparator, setDecimalSeparator] = useState<"." | ",">(".");
  const [flipAmount, setFlipAmount] = useState(false);
  const [outValue, setOutValue] = useState("");
  /** Which column (by index) supplies each transaction field. */
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const rows = useMemo(
    () => (fileText === null ? [] : parseCsv(fileText, delimiter)),
    [fileText, delimiter],
  );
  const { header, data: dataRows } = windowRows(
    { hasHeader, skipStartLines, skipEndLines },
    rows,
  );
  const columnCount = Math.max(
    0,
    ...rows.slice(skipStartLines).map((r) => r.length),
  );

  /** Auto-detect mappings (like Actual Budget) whenever the file is re-read. */
  function autoMap(
    text: string,
    delim: string,
    header: boolean,
    start: number,
    end: number,
  ) {
    const guess = guessMapping(
      windowRows(
        { hasHeader: header, skipStartLines: start, skipEndLines: end },
        parseCsv(text, delim),
      ),
    );
    setMapping(
      Object.fromEntries(
        Object.entries(guess.assignments).map(([col, f]) => [f, Number(col)]),
      ),
    );
    setAmountKind(guess.amountKind);
    setDateFormat(guess.dateFormat);
    setDecimalSeparator(guess.decimalSeparator);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const delim = detectDelimiter(text);
    setFileText(text);
    setDelimiter(delim);
    autoMap(text, delim, hasHeader, skipStartLines, skipEndLines);
  }

  function reparse(next: {
    delimiter?: string;
    hasHeader?: boolean;
    skipStartLines?: number;
    skipEndLines?: number;
  }) {
    const d = next.delimiter ?? delimiter;
    const h = next.hasHeader ?? hasHeader;
    const s = next.skipStartLines ?? skipStartLines;
    const e = next.skipEndLines ?? skipEndLines;
    setDelimiter(d);
    setHasHeader(h);
    setSkipStartLines(s);
    setSkipEndLines(e);
    if (fileText !== null) autoMap(fileText, d, h, s, e);
  }

  const columnOf = (field: FieldKey): number | undefined => mapping[field];

  const draft = {
    name,
    format: "csv",
    delimiter,
    skipStartLines,
    skipEndLines,
    hasHeader,
    dateColumn: columnOf("date"),
    dateFormat,
    amount:
      amountKind === "single"
        ? { kind: "single", column: columnOf("amount") }
        : amountKind === "split"
          ? {
              kind: "split",
              debitColumn: columnOf("debit"),
              creditColumn: columnOf("credit"),
            }
          : {
              kind: "inOut",
              column: columnOf("amount"),
              inOutColumn: columnOf("inOut"),
              outValue,
            },
    decimalSeparator,
    flipAmount,
    payeeColumn: columnOf("payee"),
    notesColumn: columnOf("notes"),
    importedIdColumn: columnOf("importedId"),
  };
  const errors = fileText === null ? ["Upload an example file"] : [];
  errors.push(...validateUploadType(draft));
  const valid = errors.length === 0;

  function assign(field: FieldKey, column: number | undefined) {
    setMapping((prev) => ({ ...prev, [field]: column }));
  }

  function changeAmountKind(kind: AmountKind) {
    setAmountKind(kind);
    setMapping((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([f]) => isAllowed(f as FieldKey, kind)),
      ),
    );
  }

  async function handleSave() {
    setSaveError(null);
    try {
      await onSave(draft as UploadTypeDraft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  // Show the date separator seen in the file in the format labels, as Actual does.
  const dateIndex = mapping.date;
  const dateSample =
    dateIndex === undefined ? "" : (dataRows[0]?.[dateIndex] ?? "");
  const dateSeparator = dateSample.match(/[/.,\-\\]/)?.[0] ?? " ";

  const money = (cents: number) => (cents / 100).toFixed(2);

  const visibleFields: FieldKey[] = [
    "date",
    "payee",
    "notes",
    "importedId",
    ...AMOUNT_FIELDS[amountKind],
  ];

  const sampleRow = dataRows[0] ?? [];
  const optionLabel = (i: number) =>
    header?.[i]?.trim()
      ? (header[i] as string)
      : `Column ${i + 1} (${(sampleRow[i] ?? "").trim()})`;

  /** Outflow/inflow preview cell, derived from the final (flipped) amount. */
  function splitCell(
    amount: number | null,
    anyRaw: boolean,
    side: "out" | "in",
  ) {
    if (amount === null) {
      return anyRaw ? <span className="invalid">Invalid</span> : null;
    }
    if (side === "out") return amount < 0 ? money(amount) : null;
    return amount > 0 ? money(amount) : null;
  }

  return (
    <section aria-label="New upload type" className="wizard">
      <h2>New upload type</h2>
      <label className="field">
        <span>Name</span>
        <input
          type="text"
          value={name}
          placeholder="e.g. Desjardins checking & savings"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Example CSV file</span>
        <input
          type="file"
          accept=".csv,.tsv,text/csv"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>

      {fileText !== null ? (
        <>
          <div className="options">
            <fieldset>
              <legend>CSV options</legend>
              <label className="field">
                <span>Delimiter</span>
                <select
                  value={delimiter}
                  onChange={(e) => reparse({ delimiter: e.target.value })}
                >
                  {DELIMITERS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field inline">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => reparse({ hasHeader: e.target.checked })}
                />
                <span>First row is a header (ignore it)</span>
              </label>
              <label className="field inline">
                <span>Skip lines at start</span>
                <input
                  type="number"
                  min={0}
                  value={skipStartLines}
                  onChange={(e) =>
                    reparse({
                      skipStartLines: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
              <label className="field inline">
                <span>Skip lines at end</span>
                <input
                  type="number"
                  min={0}
                  value={skipEndLines}
                  onChange={(e) =>
                    reparse({
                      skipEndLines: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Amount options</legend>
              <label className="field inline">
                <input
                  type="checkbox"
                  checked={amountKind === "split"}
                  onChange={(e) =>
                    changeAmountKind(e.target.checked ? "split" : "single")
                  }
                />
                <span>Split amount into separate inflow/outflow columns</span>
              </label>
              <label className="field inline">
                <input
                  type="checkbox"
                  checked={amountKind === "inOut"}
                  onChange={(e) =>
                    changeAmountKind(e.target.checked ? "inOut" : "single")
                  }
                />
                <span>
                  Select a column to specify if the amount goes in/out
                </span>
              </label>
              {amountKind === "inOut" ? (
                <label className="field">
                  <span>In/Out outflow value</span>
                  <input
                    type="text"
                    value={outValue}
                    placeholder="Value for out rows, e.g. Debit"
                    onChange={(e) => setOutValue(e.target.value)}
                  />
                </label>
              ) : null}
              <label className="field inline">
                <input
                  type="checkbox"
                  checked={flipAmount}
                  onChange={(e) => setFlipAmount(e.target.checked)}
                />
                <span>Flip amount</span>
              </label>
              <label className="field">
                <span>Decimal separator</span>
                <select
                  value={decimalSeparator}
                  onChange={(e) =>
                    setDecimalSeparator(e.target.value as "." | ",")
                  }
                >
                  <option value=".">Period (1,234.56)</option>
                  <option value=",">Comma (1.234,56)</option>
                </select>
              </label>
            </fieldset>

            <fieldset>
              <legend>Date options</legend>
              <label className="field">
                <span>Date format</span>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                >
                  {DATE_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f.replace(/ /g, dateSeparator)}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          </div>

          <h3>Map fields to columns</h3>
          <p className="hint">
            Columns were guessed from the file. Fields marked * are required; a
            column can only feed one field.
          </p>
          <div className="mappings">
            {visibleFields.map((field) => (
              <label key={field} className="field">
                <span
                  className={
                    REQUIRED_FIELDS.includes(field) ? "required" : undefined
                  }
                >
                  {FIELD_LABELS[field]}
                </span>
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    assign(
                      field,
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                    )
                  }
                >
                  <option value="">Choose field…</option>
                  {Array.from({ length: columnCount }, (_, i) => i)
                    .filter(
                      (i) =>
                        mapping[field] === i ||
                        !visibleFields.some((f) => mapping[f] === i),
                    )
                    .map((i) => (
                      <option key={i} value={i}>
                        {optionLabel(i)}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>

          <h3>Transaction preview</h3>
          <div className="preview-scroll">
            <table className="preview" aria-label="Transaction preview">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Payee</th>
                  <th>Notes</th>
                  <th>Source id</th>
                  {amountKind === "split" ? (
                    <>
                      <th>Outflow</th>
                      <th>Inflow</th>
                    </>
                  ) : (
                    <>
                      {amountKind === "inOut" ? <th>In/Out</th> : null}
                      <th>Amount</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, PREVIEW_ROWS).map((row, r) => {
                  const t = draft as unknown as UploadTypeDraft & {
                    id: string;
                  };
                  const { date, amount } = interpretRow(t, row);
                  const at = (f: FieldKey) => {
                    const c = mapping[f];
                    return c === undefined ? "" : (row[c] ?? "").trim();
                  };
                  const rawDate = at("date");
                  const anyRaw = at("debit") !== "" || at("credit") !== "";
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                    <tr key={r}>
                      <td>
                        {mapping.date === undefined ? null : (
                          <>
                            <span className="raw">{rawDate || "Empty"} →</span>{" "}
                            <span className={date ? "parsed" : "invalid"}>
                              {date ?? "Invalid"}
                            </span>
                          </>
                        )}
                      </td>
                      <td>{at("payee")}</td>
                      <td>{at("notes")}</td>
                      <td>{at("importedId")}</td>
                      {amountKind === "split" ? (
                        <>
                          <td>{splitCell(amount, anyRaw, "out")}</td>
                          <td>{splitCell(amount, anyRaw, "in")}</td>
                        </>
                      ) : (
                        <>
                          {amountKind === "inOut" ? (
                            <td>{at("inOut")}</td>
                          ) : null}
                          <td
                            className={
                              mapping.amount !== undefined && amount === null
                                ? "invalid"
                                : ""
                            }
                          >
                            {mapping.amount === undefined
                              ? ""
                              : amount === null
                                ? "Invalid"
                                : money(amount)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!valid ? (
        <ul className="missing" aria-label="Missing information">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {saveError ? <div className="crawler-error">{saveError}</div> : null}
      <div className="actions">
        <button
          type="button"
          disabled={!valid}
          onClick={() => void handleSave()}
        >
          Save upload type
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
