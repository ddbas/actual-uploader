import { useMemo, useState } from "react";
import {
  DATE_FORMATS,
  type DateFormat,
  detectDelimiter,
  mapRow,
  parseCsv,
  type UploadTypeDraft,
  validateUploadType,
} from "statement-core";

export interface UploadTypeWizardProps {
  onSave: (draft: UploadTypeDraft) => Promise<void>;
  onCancel: () => void;
}

type FieldKey =
  | "date"
  | "amount"
  | "debit"
  | "credit"
  | "payee"
  | "notes"
  | "importedId";

const FIELDS: Array<{ key: FieldKey; label: string; required: boolean }> = [
  { key: "date", label: "Date", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "debit", label: "Debit", required: true },
  { key: "credit", label: "Credit", required: true },
  { key: "payee", label: "Payee", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "importedId", label: "Source id", required: false },
];

const PREVIEW_ROWS = 5;
const DELIMITERS: Array<[string, string]> = [
  [",", "Comma"],
  [";", "Semicolon"],
  ["\t", "Tab"],
  ["|", "Pipe"],
];

export function UploadTypeWizard({ onSave, onCancel }: UploadTypeWizardProps) {
  const [name, setName] = useState("");
  const [fileText, setFileText] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [dateFormat, setDateFormat] = useState<DateFormat>("YYYY-MM-DD");
  const [amountKind, setAmountKind] = useState<"single" | "split">("single");
  const [decimalSeparator, setDecimalSeparator] = useState<"." | ",">(".");
  /** Which transaction field each column (by index) represents. */
  const [assignments, setAssignments] = useState<Record<number, FieldKey>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const rows = useMemo(
    () => (fileText === null ? [] : parseCsv(fileText, delimiter)),
    [fileText, delimiter],
  );
  const columnCount = Math.max(0, ...rows.map((r) => r.length));
  const header = hasHeader ? rows[0] : undefined;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const columnLabel = (i: number) =>
    header?.[i]?.trim() ? header[i] : `Column ${i + 1}`;

  const columnOf = (field: FieldKey): number | undefined => {
    const hit = Object.entries(assignments).find(([, f]) => f === field);
    return hit ? Number(hit[0]) : undefined;
  };

  const draft = {
    name,
    format: "csv",
    delimiter,
    hasHeader,
    dateColumn: columnOf("date"),
    dateFormat,
    amount:
      amountKind === "single"
        ? { kind: "single", column: columnOf("amount") }
        : {
            kind: "split",
            debitColumn: columnOf("debit"),
            creditColumn: columnOf("credit"),
          },
    decimalSeparator,
    payeeColumn: columnOf("payee"),
    notesColumn: columnOf("notes"),
    importedIdColumn: columnOf("importedId"),
  };
  const errors = fileText === null ? ["Upload an example file"] : [];
  errors.push(...validateUploadType(draft));
  const valid = errors.length === 0;

  const mapped = valid
    ? dataRows
        .slice(0, PREVIEW_ROWS)
        .map((row) =>
          mapRow({ ...(draft as UploadTypeDraft), id: "" }, row, "preview"),
        )
    : [];

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setFileText(text);
    setDelimiter(detectDelimiter(text));
    setAssignments({});
  }

  async function handleSave() {
    setSaveError(null);
    try {
      await onSave(draft as UploadTypeDraft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  const availableFields = FIELDS.filter((f) =>
    amountKind === "single"
      ? f.key !== "debit" && f.key !== "credit"
      : f.key !== "amount",
  );

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

  function changeAmountKind(kind: "single" | "split") {
    setAmountKind(kind);
    setAssignments((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([, f]) =>
          kind === "single" ? f !== "debit" && f !== "credit" : f !== "amount",
        ),
      ),
    );
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
          accept=".csv,text/csv"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>

      {fileText !== null ? (
        <>
          <label className="field">
            <span>Delimiter</span>
            <select
              value={delimiter}
              onChange={(e) => {
                setDelimiter(e.target.value);
                setAssignments({});
              }}
            >
              {DELIMITERS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
            />
            <span>First row is a header (ignore it)</span>
          </label>

          <label className="field">
            <span>Amount layout</span>
            <select
              value={amountKind}
              onChange={(e) =>
                changeAmountKind(e.target.value as "single" | "split")
              }
            >
              <option value="single">Single amount column</option>
              <option value="split">Separate debit and credit columns</option>
            </select>
          </label>
          <label className="field">
            <span>Date format</span>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as DateFormat)}
            >
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Decimal separator</span>
            <select
              value={decimalSeparator}
              onChange={(e) => setDecimalSeparator(e.target.value as "." | ",")}
            >
              <option value=".">Period (1,234.56)</option>
              <option value=",">Comma (1.234,56)</option>
            </select>
          </label>

          <h3>Choose what each column represents</h3>
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
          {mapped.length === 0 ? (
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
                {mapped.map((m, i) =>
                  typeof m === "string" ? (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                    <tr key={i} className="row-error">
                      <td colSpan={4}>{m}</td>
                    </tr>
                  ) : (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                    <tr key={i}>
                      <td>{m.date}</td>
                      <td>{((m.amount ?? 0) / 100).toFixed(2)}</td>
                      <td>{m.payee_name ?? ""}</td>
                      <td>{m.notes ?? ""}</td>
                    </tr>
                  ),
                )}
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
