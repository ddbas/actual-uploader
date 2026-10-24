import { type ComponentType, useState } from "react";
import { ActualSettingsPage } from "./ActualSettingsPage.js";
import { SourcesTab } from "./SourcesTab.js";

export interface SettingsPageProps {
  onActualSaved?: () => void;
}

interface SettingsPage {
  id: string;
  label: string;
  component: ComponentType<SettingsPageProps>;
}

/** Add a settings page by adding an entry here. The first is the default. */
const pages: SettingsPage[] = [
  { id: "actual", label: "Actual", component: ActualSettingsPage },
  { id: "sources", label: "Sources", component: SourcesTab },
];

export function SettingsTab({ onActualSaved }: SettingsPageProps) {
  const [pageId, setPageId] = useState(pages[0]?.id);
  const Page = pages.find((p) => p.id === pageId)?.component;

  return (
    <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-start md:gap-6">
      <select
        className="select w-full md:hidden"
        aria-label="Settings page"
        value={pageId}
        onChange={(e) => setPageId(e.target.value)}
      >
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <nav aria-label="Settings pages" className="hidden md:block">
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
      <div className="min-w-0 flex-1">
        {Page ? <Page onActualSaved={onActualSaved} /> : null}
      </div>
    </div>
  );
}
