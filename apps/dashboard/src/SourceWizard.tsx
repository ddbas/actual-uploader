import { useMemo, useState } from "react";
import {
  detectDelimiter,
  guessMapping,
  parseCsv,
  type SourceDraft,
  validateSource,
  windowRows,
} from "statement-core";
import { MappingStep } from "./MappingStep.js";
import {
  emptyMappingState,
  type MappingState,
  toFieldMapping,
} from "./mappingState.js";
import { PdfSourceSetup } from "./PdfSourceSetup.js";

export interface SourceWizardProps {
  onSave: (draft: SourceDraft) => Promise<void>;
  onCancel: () => void;
}

type Format = "csv" | "pdf";

const DELIMITERS: Array<[string, string]> = [
  [",", "Comma ( , )"],
  [";", "Semicolon ( ; )"],
  ["\t", "Tab"],
  ["|", "Pipe ( | )"],
  ["~", "Tilde ( ~ )"],
];

export function SourceWizard({ onSave, onCancel }: SourceWizardProps) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("csv");

  return (
    <section aria-label="New source" className="flex max-w-4xl flex-col gap-4">
      <h2 className="text-xl font-semibold">New source</h2>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">File format</legend>
        <div className="join">
          {(["csv", "pdf"] as const).map((f) => (
            <input
              key={f}
              type="radio"
              name="source-format"
              className="btn join-item"
              aria-label={f.toUpperCase()}
              checked={format === f}
              onChange={() => setFormat(f)}
            />
          ))}
        </div>
      </fieldset>
      <label className="fieldset">
        <span className="label">Name</span>
        <input
          type="text"
          className="input w-full max-w-sm"
          value={name}
          placeholder="e.g. Checking & savings"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {format === "csv" ? (
        <CsvSourceSetup name={name} onSave={onSave} onCancel={onCancel} />
      ) : (
        <PdfSourceSetup name={name} onSave={onSave} onCancel={onCancel} />
      )}
    </section>
  );
}

interface SetupProps {
  name: string;
  onSave: (draft: SourceDraft) => Promise<void>;
  onCancel: () => void;
}

function CsvSourceSetup({ name, onSave, onCancel }: SetupProps) {
  const [fileText, setFileText] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState(",");
  const [hasHeader, setHasHeader] = useState(true);
  const [skipStartLines, setSkipStartLines] = useState(0);
  const [skipEndLines, setSkipEndLines] = useState(0);
  const [mappingState, setMappingState] =
    useState<MappingState>(emptyMappingState);
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
    setMappingState((prev) => ({
      ...prev,
      mapping: Object.fromEntries(
        Object.entries(guess.assignments).map(([col, f]) => [f, Number(col)]),
      ),
      amountKind: guess.amountKind,
      dateFormat: guess.dateFormat,
      decimalSeparator: guess.decimalSeparator,
    }));
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

  const draft = {
    name,
    format: "csv",
    delimiter,
    skipStartLines,
    skipEndLines,
    hasHeader,
    ...toFieldMapping(mappingState),
  };
  const errors = fileText === null ? ["Upload an example file"] : [];
  errors.push(...validateSource(draft));
  const valid = errors.length === 0;

  async function handleSave() {
    setSaveError(null);
    try {
      await onSave(draft as SourceDraft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <>
      <label className="fieldset">
        <span className="label">Example CSV file</span>
        <input
          type="file"
          className="file-input w-full max-w-sm"
          accept=".csv,.tsv,text/csv"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>

      {fileText !== null ? (
        <MappingStep
          state={mappingState}
          onChange={setMappingState}
          header={header}
          rows={dataRows}
          columnCount={columnCount}
          leading={
            <fieldset className="fieldset rounded-box border border-base-300 bg-base-200 p-4">
              <legend className="fieldset-legend">CSV options</legend>
              <label className="fieldset">
                <span className="label">Delimiter</span>
                <select
                  className="select"
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
              <label className="label cursor-pointer justify-start gap-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={hasHeader}
                  onChange={(e) => reparse({ hasHeader: e.target.checked })}
                />
                <span>First row is a header (ignore it)</span>
              </label>
              <label className="label gap-2">
                <span>Skip lines at start</span>
                <input
                  type="number"
                  className="input input-sm w-20"
                  min={0}
                  value={skipStartLines}
                  onChange={(e) =>
                    reparse({
                      skipStartLines: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </label>
              <label className="label gap-2">
                <span>Skip lines at end</span>
                <input
                  type="number"
                  className="input input-sm w-20"
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
          }
        />
      ) : null}

      {!valid ? (
        <ul
          className="list-inside list-disc text-sm text-error"
          aria-label="Missing information"
        >
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {saveError ? (
        <div role="alert" className="alert alert-error">
          {saveError}
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid}
          onClick={() => void handleSave()}
        >
          Save source
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  );
}
