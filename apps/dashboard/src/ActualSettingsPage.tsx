import { type FormEvent, useEffect, useState } from "react";
import {
  type ActualSettingsView,
  fetchActualSettings,
  SettingsValidationError,
  saveActualSettings,
} from "./api.js";

type Errors = Record<string, string>;

function isHttpUrl(value: string): boolean {
  try {
    const p = new URL(value).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
}

export function ActualSettingsPage({
  onActualSaved,
}: {
  onActualSaved?: () => void;
}) {
  const [serverUrl, setServerUrl] = useState("");
  const [syncId, setSyncId] = useState("");
  const [serverPassword, setServerPassword] = useState("");
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [saved, setSaved] = useState<ActualSettingsView | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmation, setConfirmation] = useState(false);

  useEffect(() => {
    fetchActualSettings()
      .then((s) => {
        setSaved(s);
        setServerUrl(s.serverUrl);
        setSyncId(s.syncId);
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setConfirmation(false);
    const found: Errors = {};
    if (!serverUrl.trim()) found.serverUrl = "Server URL is required";
    else if (!isHttpUrl(serverUrl.trim()))
      found.serverUrl = "Server URL must be an http or https URL";
    if (!serverPassword && !saved?.hasServerPassword)
      found.serverPassword = "Server password is required";
    if (!syncId.trim()) found.syncId = "Sync ID is required";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      const view = await saveActualSettings({
        serverUrl: serverUrl.trim(),
        syncId: syncId.trim(),
        ...(serverPassword ? { serverPassword } : {}),
        ...(encryptionPassword ? { encryptionPassword } : {}),
      });
      setSaved(view);
      setServerPassword("");
      setEncryptionPassword("");
      setConfirmation(true);
      onActualSaved?.();
    } catch (err) {
      setErrors(
        err instanceof SettingsValidationError
          ? err.errors
          : { form: "Failed to save settings" },
      );
    }
  }

  return (
    <form
      className="wizard"
      aria-label="Actual settings"
      onSubmit={onSubmit}
      noValidate
    >
      <label className="field">
        <span className="required">Server URL</span>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
        />
        {errors.serverUrl ? (
          <p className="missing">{errors.serverUrl}</p>
        ) : null}
      </label>
      <label className="field">
        <span className="required">Server password</span>
        <input
          type="password"
          autoComplete="off"
          value={serverPassword}
          placeholder={saved?.hasServerPassword ? "•••••••• (saved)" : ""}
          onChange={(e) => setServerPassword(e.target.value)}
        />
        {errors.serverPassword ? (
          <p className="missing">{errors.serverPassword}</p>
        ) : null}
      </label>
      <label className="field">
        <span className="required">Sync ID</span>
        <input
          type="text"
          value={syncId}
          onChange={(e) => setSyncId(e.target.value)}
        />
        {errors.syncId ? <p className="missing">{errors.syncId}</p> : null}
      </label>
      <label className="field">
        <span>Encryption password (optional)</span>
        <input
          type="password"
          autoComplete="off"
          value={encryptionPassword}
          placeholder={saved?.hasEncryptionPassword ? "•••••••• (saved)" : ""}
          onChange={(e) => setEncryptionPassword(e.target.value)}
        />
      </label>
      {errors.form ? <p className="missing">{errors.form}</p> : null}
      <div className="actions">
        <button type="submit">Save</button>
      </div>
      {confirmation ? <p role="status">Settings saved.</p> : null}
    </form>
  );
}
