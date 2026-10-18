import { useState } from "react";
import { SettingsTab } from "./SettingsTab.js";
import { UploadTab } from "./UploadTab.js";

type Tab = "upload" | "settings";

export function App() {
  const [tab, setTab] = useState<Tab>("upload");

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="tabs tabs-border mb-6" role="tablist">
        <button
          type="button"
          role="tab"
          className={`tab ${tab === "upload" ? "tab-active" : ""}`}
          aria-selected={tab === "upload"}
          onClick={() => setTab("upload")}
        >
          Upload
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${tab === "settings" ? "tab-active" : ""}`}
          aria-selected={tab === "settings"}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </div>
      {tab === "upload" ? <UploadTab /> : <SettingsTab />}
    </div>
  );
}
