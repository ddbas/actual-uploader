import { useState } from "react";
import { ConnectionStatus } from "./ConnectionStatus.js";
import { SettingsTab } from "./SettingsTab.js";
import { UploadTab } from "./UploadTab.js";

type Tab = "upload" | "settings";

export function App() {
  const [tab, setTab] = useState<Tab>("upload");
  const [statusKey, setStatusKey] = useState(0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-2 flex justify-end">
        <ConnectionStatus refreshKey={statusKey} />
      </header>
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
      {tab === "upload" ? (
        <UploadTab />
      ) : (
        <SettingsTab onActualSaved={() => setStatusKey((k) => k + 1)} />
      )}
    </div>
  );
}
