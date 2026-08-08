import type { ResultTransaction } from "./serverTypes.js";

export interface ResultsTabProps {
  results: ResultTransaction[];
}

export function ResultsTab({ results }: ResultsTabProps) {
  if (results.length === 0) {
    return (
      <section aria-label="Results">
        <p>No transactions yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="Results">
      <table>
        <thead>
          <tr>
            <th>Crawler</th>
            <th>Date</th>
            <th>Payee</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, index) => (
            <tr key={`${result.crawlerId}-${result.imported_id ?? index}`}>
              <td>{result.crawlerName}</td>
              <td>{result.date}</td>
              <td>{result.payee_name ?? "—"}</td>
              <td>{result.amount ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
