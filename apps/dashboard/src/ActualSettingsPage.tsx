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

export function ActualSettingsPage() {
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
      className="flex max-w-md flex-col gap-3"
      aria-label="Actual settings"
      onSubmit={onSubmit}
      noValidate
    >
      <label className="fieldset">
        <span className="label after:content-['*']">Server URL</span>
        <input
          type="text"
          className="input w-full"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
        />
        {errors.serverUrl ? (
          <p className="text-sm text-error">{errors.serverUrl}</p>
        ) : null}
      </label>
      <label className="fieldset">
        <span className="label after:content-['*']">Server password</span>
        <input
          type="password"
          className="input w-full"
          autoComplete="off"
          value={serverPassword}
          placeholder={saved?.hasServerPassword ? "•••••••• (saved)" : ""}
          onChange={(e) => setServerPassword(e.target.value)}
        />
        {errors.serverPassword ? (
          <p className="text-sm text-error">{errors.serverPassword}</p>
        ) : null}
      </label>
      <label className="fieldset">
        <span className="label after:content-['*']">Sync ID</span>
        <input
          type="text"
          className="input w-full"
          value={syncId}
          onChange={(e) => setSyncId(e.target.value)}
        />
        {errors.syncId ? (
          <p className="text-sm text-error">{errors.syncId}</p>
        ) : null}
      </label>
      <label className="fieldset">
        <span className="label">Encryption password (optional)</span>
        <input
          type="password"
          className="input w-full"
          autoComplete="off"
          value={encryptionPassword}
          placeholder={saved?.hasEncryptionPassword ? "•••••••• (saved)" : ""}
          onChange={(e) => setEncryptionPassword(e.target.value)}
        />
      </label>
      {errors.form ? <p className="text-sm text-error">{errors.form}</p> : null}
      <div>
        <button type="submit" className="btn btn-primary">
          Save
        </button>
      </div>
      {confirmation ? (
        <div role="status" className="alert alert-success">
          Settings saved.
        </div>
      ) : null}
    </form>
  );
}
