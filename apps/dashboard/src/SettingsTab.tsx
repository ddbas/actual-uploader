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
    <div className="flex items-start gap-6">
      <nav aria-label="Settings pages">
        <ul className="menu w-40 rounded-box bg-base-200">
          {pages.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={p.id === pageId ? "menu-active" : ""}
                aria-current={p.id === pageId ? "page" : undefined}
                onClick={() => setPageId(p.id)}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex-1">{Page ? <Page /> : null}</div>
    </div>
  );
}
