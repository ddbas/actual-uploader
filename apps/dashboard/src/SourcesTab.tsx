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
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setCreating(true)}
      >
        New source
      </button>
      {types.length === 0 ? (
        <p className="mt-4 opacity-70">
          No sources yet. Create one to start importing statements.
        </p>
      ) : (
        <ul className="list mt-4 rounded-box bg-base-100 shadow-md">
          {types.map((t) => (
            <li key={t.id} className="list-row items-center">
              <div className="list-col-grow">
                <div className="font-semibold">{t.name}</div>
                <div className="badge badge-ghost badge-sm">
                  {t.format.toUpperCase()}
                </div>
              </div>
              {confirmingId === t.id ? (
                <div
                  role="alertdialog"
                  aria-label={`Confirm delete ${t.name}`}
                  className="flex items-center gap-2"
                >
                  <span className="text-error">
                    Delete "{t.name}"? This cannot be undone.
                  </span>
                  <button
                    type="button"
                    className="btn btn-error btn-sm"
                    onClick={() =>
                      deleteSource(t.id).then(() => {
                        setConfirmingId(null);
                        refresh();
                      })
                    }
                  >
                    Confirm delete
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setConfirmingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-error"
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
