import { useEffect, useState } from "react";
import { fetchCrawlers, runAllCrawlers, runCrawler } from "./api.js";
import { HomeTab } from "./HomeTab.js";
import { ResultsTab } from "./ResultsTab.js";
import type { CrawlerSummary } from "./serverTypes.js";
import { UploadTypesTab } from "./UploadTypesTab.js";
import { useCrawlerEvents } from "./useCrawlerEvents.js";

type Tab = "home" | "results" | "upload-types";

export function App() {
  const [crawlers, setCrawlers] = useState<CrawlerSummary[]>([]);
  const [tab, setTab] = useState<Tab>("home");
  const { states, errors, results, hasAnyCompleted } = useCrawlerEvents();

  useEffect(() => {
    fetchCrawlers()
      .then(setCrawlers)
      .catch(() => setCrawlers([]));
  }, []);

  return (
    <div className="app">
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "home"}
          onClick={() => setTab("home")}
        >
          Home
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "upload-types"}
          onClick={() => setTab("upload-types")}
        >
          Upload Types
        </button>
        {hasAnyCompleted ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "results"}
            onClick={() => setTab("results")}
          >
            Results
          </button>
        ) : null}
      </div>
      {tab === "upload-types" ? (
        <UploadTypesTab />
      ) : tab === "home" || !hasAnyCompleted ? (
        <HomeTab
          crawlers={crawlers}
          states={states}
          errors={errors}
          onRun={runCrawler}
          onRunAll={runAllCrawlers}
        />
      ) : (
        <ResultsTab results={results} />
      )}
    </div>
  );
}
