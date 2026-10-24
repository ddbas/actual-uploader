import {
  type ComponentType,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  APPROACH_IDS,
  APPROACHES,
  type Approach,
  DEFAULT_APPROACH,
  type SourceDraft,
  validateSource,
} from "statement-core";
import type { PdfDocument } from "statement-pdf";
import { EDITORS, type EditorProps } from "./editors.js";
import { describePdfError, loadPdf } from "./pdfLoader.js";

export interface PdfSourceSetupProps {
  name: string;
  onSave: (draft: SourceDraft) => Promise<void>;
  onCancel: () => void;
  /** Overridable for tests; defaults to every registered approach. */
  approaches?: Record<string, Approach>;
  editors?: Record<string, ComponentType<EditorProps>>;
}

const money = (cents: number | undefined) =>
  cents === undefined ? "" : (cents / 100).toFixed(2);

/**
 * The PDF source setup shell: the example PDF, the approach select and each
 * approach's remembered settings, the transaction preview and saving. The
 * approach-specific part is the editor from the registry.
 */
export function PdfSourceSetup({
  name,
  onSave,
  onCancel,
  approaches = APPROACHES,
  editors = EDITORS,
}: PdfSourceSetupProps) {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [approachId, setApproachId] = useState<string>(DEFAULT_APPROACH);
  /** Settings per approach, so switching away and back restores them. */
  const [configs, setConfigs] = useState<Record<string, unknown>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const current = useRef<PdfDocument | null>(null);

  useEffect(
    () => () => {
      void current.current?.destroy();
    },
    [],
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setFileError(null);
    try {
      const next = await loadPdf(await file.arrayBuffer());
      void current.current?.destroy();
      current.current = next;
      setDoc(next);
      setConfigs({});
      setApproachId(DEFAULT_APPROACH);
    } catch (error) {
      setDoc(null);
      setFileError(describePdfError(error));
    } finally {
      setLoading(false);
    }
  }

  const approach = approaches[approachId];
  const Editor = editors[approachId];
  const initial = useMemo(
    () => (doc && approach ? approach.initialConfig(doc.pages) : undefined),
    [doc, approach],
  );
  const config = configs[approachId] ?? initial;

  const draft = {
    name,
    format: "pdf" as const,
    approach: approachId,
    config,
  };
  const errors: string[] = doc === null ? ["Upload an example PDF"] : [];
  if (doc !== null) errors.push(...validateSource(draft));
  const valid = errors.length === 0;

  const result = useMemo(
    () =>
      doc && approach && approach.validateConfig(config).length === 0
        ? approach.run(doc.pages, config, "preview")
        : null,
    [doc, approach, config],
  );

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
        <span className="label">Example PDF file</span>
        <input
          type="file"
          className="file-input w-full max-w-sm"
          accept=".pdf,application/pdf"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>
      {loading ? <p role="status">Reading PDF…</p> : null}
      {fileError ? (
        <div role="alert" className="alert alert-error">
          {fileError}
        </div>
      ) : null}

      {doc ? (
        <>
          <label className="fieldset">
            <span className="label">Extraction approach</span>
            <select
              className="select w-full max-w-sm"
              value={approachId}
              onChange={(e) => {
                // Keep what has been set so far for the approach being left.
                setConfigs((prev) => ({ ...prev, [approachId]: config }));
                setApproachId(e.target.value);
              }}
            >
              {(approaches === APPROACHES
                ? APPROACH_IDS
                : Object.keys(approaches)
              ).map((id) => (
                <option key={id} value={id}>
                  {approaches[id]?.label ?? id}
                </option>
              ))}
            </select>
          </label>

          {Editor ? (
            <Editor
              // a fresh editor per approach and example file
              key={`${approachId}`}
              doc={doc}
              config={config}
              onChange={(next) =>
                setConfigs((prev) => ({ ...prev, [approachId]: next }))
              }
            />
          ) : null}

          <h3 className="text-lg font-semibold">Transaction preview</h3>
          {result ? (
            <>
              {result.warnings.map((w) => (
                <div key={w} role="status" className="alert alert-warning">
                  {w}
                </div>
              ))}
              <div className="overflow-x-auto">
                <table
                  className="table table-xs table-zebra"
                  aria-label="Transaction preview"
                >
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Payee</th>
                      <th>Notes</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transactions.map((t, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                      <tr key={i}>
                        <td>{t.date}</td>
                        <td>{t.payee_name ?? ""}</td>
                        <td>{t.notes ?? ""}</td>
                        <td>{money(t.amount)}</td>
                      </tr>
                    ))}
                    {result.errors.map((e) => (
                      <tr key={`${e.page}-${e.row}`}>
                        <td colSpan={4} className="text-error">
                          <strong>Invalid</strong> {e.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm opacity-70">
              Complete the settings above to preview the transactions.
            </p>
          )}
        </>
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
