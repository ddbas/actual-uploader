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

function EnvBadge() {
  return (
    <span className="badge badge-neutral badge-sm">Set by environment</span>
  );
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
  const locked = saved?.locked;
  const allLocked = !!locked && Object.values(locked).every(Boolean);
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
    if (!locked?.serverUrl) {
      if (!serverUrl.trim()) found.serverUrl = "Server URL is required";
      else if (!isHttpUrl(serverUrl.trim()))
        found.serverUrl = "Server URL must be an http or https URL";
    }
    if (!locked?.serverPassword && !serverPassword && !saved?.hasServerPassword)
      found.serverPassword = "Server password is required";
    if (!locked?.syncId && !syncId.trim()) found.syncId = "Sync ID is required";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      const view = await saveActualSettings({
        ...(locked?.serverUrl ? {} : { serverUrl: serverUrl.trim() }),
        ...(locked?.syncId ? {} : { syncId: syncId.trim() }),
        ...(serverPassword && !locked?.serverPassword
          ? { serverPassword }
          : {}),
        ...(encryptionPassword && !locked?.encryptionPassword
          ? { encryptionPassword }
          : {}),
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
      className="flex max-w-md flex-col gap-3"
      aria-label="Actual settings"
      onSubmit={onSubmit}
      noValidate
    >
      <label className="fieldset">
        <span className="label after:content-['*']">Server URL</span>
        {locked?.serverUrl ? <EnvBadge /> : null}
        <input
          type="text"
          className="input w-full"
          value={serverUrl}
          disabled={locked?.serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
        />
        {errors.serverUrl ? (
          <p className="text-sm text-error">{errors.serverUrl}</p>
        ) : null}
      </label>
      <label className="fieldset">
        <span className="label after:content-['*']">Server password</span>
        {locked?.serverPassword ? <EnvBadge /> : null}
        <input
          type="password"
          className="input w-full"
          autoComplete="off"
          value={serverPassword}
          disabled={locked?.serverPassword}
          placeholder={
            saved?.hasServerPassword
              ? locked?.serverPassword
                ? "•••••••• (set)"
                : "•••••••• (saved)"
              : ""
          }
          onChange={(e) => setServerPassword(e.target.value)}
        />
        {errors.serverPassword ? (
          <p className="text-sm text-error">{errors.serverPassword}</p>
        ) : null}
      </label>
      <label className="fieldset">
        <span className="label after:content-['*']">Sync ID</span>
        {locked?.syncId ? <EnvBadge /> : null}
        <input
          type="text"
          className="input w-full"
          value={syncId}
          disabled={locked?.syncId}
          onChange={(e) => setSyncId(e.target.value)}
        />
        {errors.syncId ? (
          <p className="text-sm text-error">{errors.syncId}</p>
        ) : null}
      </label>
      <label className="fieldset">
        <span className="label">Encryption password (optional)</span>
        {locked?.encryptionPassword ? <EnvBadge /> : null}
        <input
          type="password"
          className="input w-full"
          autoComplete="off"
          value={encryptionPassword}
          disabled={locked?.encryptionPassword}
          placeholder={
            saved?.hasEncryptionPassword
              ? locked?.encryptionPassword
                ? "•••••••• (set)"
                : "•••••••• (saved)"
              : ""
          }
          onChange={(e) => setEncryptionPassword(e.target.value)}
        />
      </label>
      {errors.form ? <p className="text-sm text-error">{errors.form}</p> : null}
      <div>
        <button type="submit" className="btn btn-primary" disabled={allLocked}>
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
