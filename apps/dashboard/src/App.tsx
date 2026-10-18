import { useState } from "react";
import { SourcesTab } from "./SourcesTab.js";
import { UploadTab } from "./UploadTab.js";

type Tab = "upload" | "sources";

export function App() {
  const [tab, setTab] = useState<Tab>("upload");

  return (
    <div className="app">
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "upload"}
          onClick={() => setTab("upload")}
        >
          Upload
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sources"}
          onClick={() => setTab("sources")}
        >
          Sources
        </button>
      </div>
      {tab === "upload" ? <UploadTab /> : <SourcesTab />}
    </div>
  );
}
