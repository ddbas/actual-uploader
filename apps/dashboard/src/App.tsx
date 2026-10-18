import { useState } from "react";
import { SettingsTab } from "./SettingsTab.js";
import { UploadTab } from "./UploadTab.js";

type Tab = "upload" | "settings";

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
