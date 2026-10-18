import { useCallback, useEffect, useState } from "react";
import type { Source, SourceDraft } from "statement-core";
import { createSource, deleteSource, fetchSources } from "./api.js";
import { SourceWizard } from "./SourceWizard.js";

export function SourcesTab() {
  const [types, setTypes] = useState<Source[]>([]);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    fetchSources()
      .then(setTypes)
      .catch(() => setTypes([]));
  }, []);

  useEffect(refresh, [refresh]);

  if (creating) {
    return (
      <SourceWizard
        onCancel={() => setCreating(false)}
        onSave={async (draft: SourceDraft) => {
          await createSource(draft);
          setCreating(false);
          refresh();
        }}
      />
    );
  }

  return (
    <section aria-label="Sources">
      <button type="button" onClick={() => setCreating(true)}>
        New source
      </button>
      {types.length === 0 ? (
        <p>No sources yet. Create one to start importing statements.</p>
      ) : (
        <ul className="crawler-list">
          {types.map((t) => (
            <li key={t.id} className="crawler-row">
              <div className="crawler-info">
                <div className="crawler-name">{t.name}</div>
                <div className="crawler-description">
                  {t.format.toUpperCase()}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Delete ${t.name}`}
                onClick={() => deleteSource(t.id).then(refresh)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
