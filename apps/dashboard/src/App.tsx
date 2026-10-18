import { useState } from "react";
import { ConnectionStatus } from "./ConnectionStatus.js";
import { SettingsTab } from "./SettingsTab.js";
import { UploadTab } from "./UploadTab.js";

type Tab = "upload" | "settings";

export function App() {
  const [tab, setTab] = useState<Tab>("upload");
  const [statusKey, setStatusKey] = useState(0);

  return (
    <div className="app">
      <header className="app-header">
        <ConnectionStatus refreshKey={statusKey} />
      </header>
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
