import { type FormEvent, useEffect, useState } from "react";
import type { Source } from "statement-core";
import {
  type Account,
  fetchAccounts,
  fetchSources,
  type ProcessedFile,
  processStatement,
} from "./api.js";
import type { Transaction } from "./types.js";

interface FileResult extends ProcessedFile {
  fileName: string;
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

  function reset() {
    setResults(null);
    setFiles([]);
    setUploaded(null);
    setError("");
  }

  if (uploaded !== null) {
    return (
      <section aria-label="Upload">
        <p role="status">
          Uploaded {uploaded} transaction{uploaded === 1 ? "" : "s"} to Actual
          Budget.
        </p>
        <button type="button" onClick={reset}>
          Upload more
        </button>
      </section>
    );
  }

  if (results) {
    const errorCount = results.reduce((n, r) => n + r.errors.length, 0);
    return (
      <section aria-label="Upload">
        <h2>Review transactions</h2>
        {results.map((r) =>
          r.errors.length > 0 ? (
            <div key={r.fileName} className="crawler-error" role="alert">
              {r.fileName}: {r.errors.length} row
              {r.errors.length === 1 ? "" : "s"} skipped (
              {r.errors.map((x) => `row ${x.row}: ${x.message}`).join("; ")})
            </div>
          ) : null,
        )}
        {transactions.length === 0 ? (
          <p>No transactions found.</p>
        ) : (
          <table aria-label="Parsed transactions">
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
        )}
        <p>
          {transactions.length} transaction
          {transactions.length === 1 ? "" : "s"}
          {errorCount > 0 ? `, ${errorCount} skipped` : ""}.
        </p>
        <button type="button" onClick={reset}>
          Back
        </button>{" "}
        <button
          type="button"
          disabled={transactions.length === 0}
          // Actual Budget upload is not implemented yet; confirm only.
          onClick={() => setUploaded(transactions.length)}
        >
          Upload to Actual
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Upload">
      {sources?.length === 0 ? (
        <p>No sources yet. Create one in the Sources tab first.</p>
      ) : (
        <form onSubmit={onProcess}>
          <p>
            <label>
              Source{" "}
              <select
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
          </p>
          <p>
            <label>
              Account{" "}
              <select
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
          </p>
          <p>
            <label>
              Statement files{" "}
              <input
                type="file"
                multiple
                accept=".csv,text/csv"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
          </p>
          {error ? <div className="crawler-error">{error}</div> : null}
          <button type="submit" disabled={!canProcess}>
            {processing ? "Processing…" : "Process files"}
          </button>
        </form>
      )}
    </section>
  );
}
