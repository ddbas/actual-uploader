import { useCallback, useEffect, useState } from "react";
import type { UploadType, UploadTypeDraft } from "statement-core";
import { createUploadType, deleteUploadType, fetchUploadTypes } from "./api.js";
import { UploadTypeWizard } from "./UploadTypeWizard.js";

export function UploadTypesTab() {
  const [types, setTypes] = useState<UploadType[]>([]);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    fetchUploadTypes()
      .then(setTypes)
      .catch(() => setTypes([]));
  }, []);

  useEffect(refresh, [refresh]);

  if (creating) {
    return (
      <UploadTypeWizard
        onCancel={() => setCreating(false)}
        onSave={async (draft: UploadTypeDraft) => {
          await createUploadType(draft);
          setCreating(false);
          refresh();
        }}
      />
    );
  }

  return (
    <section aria-label="Upload Types">
      <button type="button" onClick={() => setCreating(true)}>
        New upload type
      </button>
      {types.length === 0 ? (
        <p>No upload types yet. Create one to start importing statements.</p>
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
                onClick={() => deleteUploadType(t.id).then(refresh)}
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
