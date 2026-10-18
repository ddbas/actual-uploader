import { type ComponentType, useState } from "react";
import { ActualSettingsPage } from "./ActualSettingsPage.js";
import { SourcesTab } from "./SourcesTab.js";

interface SettingsPage {
  id: string;
  label: string;
  component: ComponentType;
}

/** Add a settings page by adding an entry here. The first is the default. */
const pages: SettingsPage[] = [
  { id: "actual", label: "Actual", component: ActualSettingsPage },
  { id: "sources", label: "Sources", component: SourcesTab },
];

export function SettingsTab() {
  const [pageId, setPageId] = useState(pages[0]?.id);
  const Page = pages.find((p) => p.id === pageId)?.component;

  return (
    <div className="settings">
      <nav className="settings-nav" aria-label="Settings pages">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-current={p.id === pageId ? "page" : undefined}
            onClick={() => setPageId(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <div className="settings-page">{Page ? <Page /> : null}</div>
    </div>
  );
}
