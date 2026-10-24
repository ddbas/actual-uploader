import { type FormEvent, useEffect, useState } from "react";
import type { Source } from "statement-core";
import {
  type Account,
  fetchAccounts,
  fetchSources,
  importTransactions,
  type ProcessedFile,
  processPdfStatement,
  processStatement,
} from "./api.js";
import type { Transaction } from "./types.js";

interface FileResult extends ProcessedFile {
  fileName: string;
  /** Why the file could not be read at all (PDFs). */
  readError?: string;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const formatAmount = (cents: number | undefined): string =>
  cents === undefined ? "—" : (cents / 100).toFixed(2);

export function UploadTab() {
  const [sources, setSources] = useState<Source[] | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [account, setAccount] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<FileResult[] | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    fetchSources()
      .then(setSources)
      .catch(() => setSources([]));
    fetchAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const transactions: Transaction[] =
    results?.flatMap((r) => r.transactions) ?? [];
  const source = sources?.find((s) => s.id === sourceId);
  const isPdf = source?.format === "pdf";
  const canProcess =
    sourceId !== "" && account !== "" && files.length > 0 && !processing;

  async function onProcess(e: FormEvent) {
    e.preventDefault();
    setProcessing(true);
    setError("");
    setUploaded(null);
    try {
      const out: FileResult[] = [];
      for (const file of files) {
        if (isPdf) {
          // An unreadable PDF is reported against its file, not the batch.
          try {
            const processed = await processPdfStatement(
              sourceId,
              account,
              toBase64(await file.arrayBuffer()),
            );
            out.push({ fileName: file.name, ...processed });
          } catch (err) {
            out.push({
              fileName: file.name,
              transactions: [],
              errors: [],
              readError:
                err instanceof Error ? err.message : "Failed to process file",
            });
          }
          continue;
        }
        const processed = await processStatement(
          sourceId,
          account,
          await file.text(),
        );
        out.push({ fileName: file.name, ...processed });
      }
      setResults(out);
    } catch (err) {
      setResults(null);
      setError(err instanceof Error ? err.message : "Failed to process files");
    } finally {
      setProcessing(false);
    }
  }

  async function onUpload() {
    setUploading(true);
    setUploadError("");
    try {
      const result = await importTransactions(transactions);
      setUploaded(result.added + result.updated);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Failed to upload transactions",
      );
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setResults(null);
    setFiles([]);
    setUploaded(null);
    setError("");
    setUploadError("");
  }

  if (uploaded !== null) {
    return (
      <section aria-label="Upload">
        <div role="status" className="alert alert-success mb-4">
          Uploaded {uploaded} transaction{uploaded === 1 ? "" : "s"} to Actual
          Budget.
        </div>
        <button type="button" className="btn" onClick={reset}>
          Upload more
        </button>
      </section>
    );
  }

  if (results) {
    const errorCount = results.reduce((n, r) => n + r.errors.length, 0);
    return (
      <section aria-label="Upload">
        <h2 className="mb-4 text-xl font-semibold">Review transactions</h2>
        {results.map((r) =>
          r.readError ? (
            <div
              key={`${r.fileName}-read`}
              className="alert alert-error mb-4"
              role="alert"
            >
              {r.fileName}: {r.readError}
            </div>
          ) : null,
        )}
        {results.flatMap((r) =>
          (r.warnings ?? []).map((w) => (
            <div
              key={`${r.fileName}-${w}`}
              className="alert alert-warning mb-4"
              role="status"
            >
              {r.fileName}: {w}
            </div>
          )),
        )}
        {results.map((r) =>
          r.errors.length > 0 ? (
            <div
              key={r.fileName}
              className="alert alert-error mb-4"
              role="alert"
            >
              {r.fileName}: {r.errors.length} row
              {r.errors.length === 1 ? "" : "s"} skipped (
              {r.errors
                .map((x) => (x.page ? x.message : `row ${x.row}: ${x.message}`))
                .join("; ")}
              )
            </div>
          ) : null,
        )}
        {transactions.length === 0 ? (
          <p className="opacity-70">No transactions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="table table-zebra"
              aria-label="Parsed transactions"
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
                {transactions.map((t, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static list
                  <tr key={i}>
                    <td>{t.date}</td>
                    <td>{t.payee_name ?? "—"}</td>
                    <td>{t.notes ?? "—"}</td>
                    <td>{formatAmount(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="my-4">
          {transactions.length} transaction
          {transactions.length === 1 ? "" : "s"}
          {errorCount > 0 ? `, ${errorCount} skipped` : ""}.
        </p>
        {uploadError ? (
          <div className="alert alert-error mb-4" role="alert">
            {uploadError}
          </div>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="btn"
            onClick={reset}
            disabled={uploading}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={transactions.length === 0 || uploading}
            onClick={onUpload}
          >
            {uploading ? "Uploading…" : "Upload to Actual"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Upload">
      {sources?.length === 0 ? (
        <div role="status" className="alert alert-info">
          No sources yet. Create one in the Sources tab first.
        </div>
      ) : (
        <form onSubmit={onProcess} className="flex max-w-md flex-col gap-3">
          <label className="fieldset">
            <span className="label">Source</span>
            <select
              className="select w-full"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              <option value="">Choose a source…</option>
              {sources?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="fieldset">
            <span className="label">Account</span>
            <select
              className="select w-full"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">Choose an account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="fieldset">
            <span className="label">Statement files</span>
            <input
              type="file"
              className="file-input w-full"
              multiple
              accept={isPdf ? ".pdf,application/pdf" : ".csv,text/csv"}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          {error ? (
            <div role="alert" className="alert alert-error">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canProcess}
          >
            {processing ? "Processing…" : "Process files"}
          </button>
        </form>
      )}
    </section>
  );
}
