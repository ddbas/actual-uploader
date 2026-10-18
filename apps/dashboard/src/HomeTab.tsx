import type { CrawlerState, CrawlerSummary } from "./serverTypes.js";

export interface HomeTabProps {
  crawlers: CrawlerSummary[];
  states: Record<string, CrawlerState>;
  errors: Record<string, string>;
  onRun: (id: string) => void;
  onRunAll: () => void;
}

const STATE_LABELS: Record<CrawlerState, string> = {
  idle: "Idle",
  running: "Running…",
  success: "Success",
  error: "Error",
};

export function HomeTab({
  crawlers,
  states,
  errors,
  onRun,
  onRunAll,
}: HomeTabProps) {
  return (
    <section aria-label="Crawlers">
      <button type="button" onClick={onRunAll}>
        Run All
      </button>
      <ul className="crawler-list">
        {crawlers.map((crawler) => {
          const state = states[crawler.id] ?? "idle";
          return (
            <li key={crawler.id} className="crawler-row">
              <div className="crawler-info">
                <div className="crawler-name">{crawler.name}</div>
                <div className="crawler-description">{crawler.description}</div>
                {state === "error" && errors[crawler.id] ? (
                  <div className="crawler-error">{errors[crawler.id]}</div>
                ) : null}
              </div>
              <span className={`status-badge ${state}`}>
                {STATE_LABELS[state]}
              </span>
              <button
                type="button"
                onClick={() => onRun(crawler.id)}
                disabled={state === "running"}
              >
                Run
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
