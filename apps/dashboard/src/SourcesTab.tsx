import { useCallback, useEffect, useState } from "react";
import type { Source, SourceDraft } from "statement-core";
import { createSource, deleteSource, fetchSources } from "./api.js";
import { SourceWizard } from "./SourceWizard.js";

export function SourcesTab() {
  const [types, setTypes] = useState<Source[]>([]);
  const [creating, setCreating] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
              {confirmingId === t.id ? (
                <div role="alertdialog" aria-label={`Confirm delete ${t.name}`}>
                  <span>Delete "{t.name}"? This cannot be undone.</span>
                  <button
                    type="button"
                    onClick={() =>
                      deleteSource(t.id).then(() => {
                        setConfirmingId(null);
                        refresh();
                      })
                    }
                  >
                    Confirm delete
                  </button>
                  <button type="button" onClick={() => setConfirmingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={`Delete ${t.name}`}
                  onClick={() => setConfirmingId(t.id)}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
