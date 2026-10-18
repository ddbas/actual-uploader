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

const FIELDS: Array<{ key: FieldKey; label: string; required: boolean }> = [
  { key: "date", label: "Date", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "debit", label: "Debit", required: true },
  { key: "credit", label: "Credit", required: true },
  { key: "inOut", label: "In/Out", required: true },
  { key: "payee", label: "Payee", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "importedId", label: "Source id", required: false },
];

const AMOUNT_FIELDS: Record<AmountKind, FieldKey[]> = {
  single: ["amount"],
  split: ["debit", "credit"],
  inOut: ["amount", "inOut"],
};

function isAllowed(field: FieldKey, kind: AmountKind): boolean {
  const amountish: FieldKey[] = ["amount", "debit", "credit", "inOut"];
  return !amountish.includes(field) || AMOUNT_FIELDS[kind].includes(field);
}

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
  /** Which transaction field each column (by index) represents. */
  const [assignments, setAssignments] = useState<Record<number, FieldKey>>({});
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

  const columnLabel = (i: number) =>
    header?.[i]?.trim() ? header[i] : `Column ${i + 1}`;

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
    setAssignments(guess.assignments);
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

  const columnOf = (field: FieldKey): number | undefined => {
    const hit = Object.entries(assignments).find(([, f]) => f === field);
    return hit ? Number(hit[0]) : undefined;
  };

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

  const availableFields = FIELDS.filter((f) => isAllowed(f.key, amountKind));

  function assign(column: number, field: FieldKey | "") {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[column];
      if (field !== "") {
        // A field can only come from one column.
        for (const [k, v] of Object.entries(next)) {
          if (v === field) delete next[Number(k)];
        }
        next[column] = field;
      }
      return next;
    });
  }

  function changeAmountKind(kind: AmountKind) {
    setAmountKind(kind);
    setAssignments((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([, f]) => isAllowed(f, kind)),
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
  const dateIndex = columnOf("date");
  const dateSample =
    dateIndex === undefined ? "" : (dataRows[0]?.[dateIndex] ?? "");
  const dateSeparator = dateSample.match(/[/.,\-\\]/)?.[0] ?? " ";

  const money = (cents: number) => (cents / 100).toFixed(2);

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
              <label className="field">
                <span>Amount layout</span>
                <select
                  value={amountKind}
                  onChange={(e) =>
                    changeAmountKind(e.target.value as AmountKind)
                  }
                >
                  <option value="single">Single signed amount column</option>
                  <option value="split">
                    Separate debit and credit columns
                  </option>
                  <option value="inOut">
                    Amount column plus an in/out column
                  </option>
                </select>
              </label>
              {amountKind === "inOut" ? (
                <label className="field">
                  <span>Value that marks money going out</span>
                  <input
                    type="text"
                    value={outValue}
                    placeholder="e.g. Debit"
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
                <span>Flip amount (swap inflows and outflows)</span>
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

          <h3>Choose what each column represents</h3>
          <p className="hint">
            Columns were guessed from the file. Fields marked * are required.
          </p>
          <div className="preview-scroll">
            <table className="preview" aria-label="File preview">
              <thead>
                <tr>
                  {Array.from({ length: columnCount }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                    <th key={i}>
                      <select
                        aria-label={`Field for ${columnLabel(i)}`}
                        value={assignments[i] ?? ""}
                        onChange={(e) =>
                          assign(i, e.target.value as FieldKey | "")
                        }
                      >
                        <option value="">Ignore</option>
                        {availableFields
                          .filter(
                            (f) =>
                              assignments[i] === f.key ||
                              columnOf(f.key) === undefined,
                          )
                          .map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                              {f.required ? " *" : ""}
                            </option>
                          ))}
                      </select>
                    </th>
                  ))}
                </tr>
                <tr>
                  {Array.from({ length: columnCount }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                    <th key={i}>{columnLabel(i)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, PREVIEW_ROWS).map((row, r) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                  <tr key={r}>
                    {Array.from({ length: columnCount }, (_, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                      <td key={i}>{row[i] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Transaction preview</h3>
          {!valid ? (
            <p>Map the required fields to see a preview.</p>
          ) : (
            <table className="preview" aria-label="Transaction preview">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Payee</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {dataRows.slice(0, PREVIEW_ROWS).map((row, r) => {
                  const t = draft as unknown as UploadTypeDraft & {
                    id: string;
                  };
                  const { date, amount } = interpretRow(t, row);
                  const rawDate = (row[t.dateColumn] ?? "").trim();
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                    <tr key={r}>
                      <td>
                        <span className="raw">{rawDate || "Empty"} →</span>{" "}
                        <span className={date ? "parsed" : "invalid"}>
                          {date ?? "Invalid"}
                        </span>
                      </td>
                      <td className={amount === null ? "invalid" : ""}>
                        {amount === null ? "Invalid" : money(amount)}
                      </td>
                      <td>{(row[t.payeeColumn ?? -1] ?? "").trim()}</td>
                      <td>{(row[t.notesColumn ?? -1] ?? "").trim()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
