import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export interface ActualSettings {
  serverUrl: string;
  serverPassword: string;
  syncId: string;
  encryptionPassword: string;
}

/** Public (secret-free) view of the settings. */
export interface ActualSettingsView {
  serverUrl: string;
  syncId: string;
  hasServerPassword: boolean;
  hasEncryptionPassword: boolean;
  /** True per field when its value comes from the environment. */
  locked: Record<keyof ActualSettings, boolean>;
}

/** Update payload; omitted passwords keep their stored value. */
export interface ActualSettingsUpdate {
  serverUrl: string;
  syncId: string;
  serverPassword?: string;
  encryptionPassword?: string;
}

const EMPTY: ActualSettings = {
  serverUrl: "",
  serverPassword: "",
  syncId: "",
  encryptionPassword: "",
};

/**
 * Validates an update against the currently stored settings. Returns a map of
 * field name to error message (empty when valid).
 */
export function validateActualSettings(
  input: unknown,
  current: ActualSettings = EMPTY,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const body = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const url = str(body.serverUrl);
  if (!url) {
    errors.serverUrl = "Server URL is required";
  } else {
    try {
      const protocol = new URL(url).protocol;
      if (protocol !== "http:" && protocol !== "https:") {
        errors.serverUrl = "Server URL must be an http or https URL";
      }
    } catch {
      errors.serverUrl = "Server URL must be an http or https URL";
    }
  }

  if (!str(body.syncId)) errors.syncId = "Sync ID is required";

  if (
    body.serverPassword !== undefined &&
    typeof body.serverPassword !== "string"
  ) {
    errors.serverPassword = "Server password must be a string";
  } else if (
    !(typeof body.serverPassword === "string"
      ? body.serverPassword
      : current.serverPassword)
  ) {
    errors.serverPassword = "Server password is required";
  }

  if (
    body.encryptionPassword !== undefined &&
    typeof body.encryptionPassword !== "string"
  ) {
    errors.encryptionPassword = "Encryption password must be a string";
  }
  return errors;
}

const FIELDS = [
  "serverUrl",
  "serverPassword",
  "syncId",
  "encryptionPassword",
] as const;

/**
 * Stores Actual connection settings, optionally persisted to a 0600 JSON file.
 * `envOverrides` take precedence per field and are never persisted.
 */
export class ActualSettingsStore {
  private settings: ActualSettings = { ...EMPTY };

  constructor(
    private readonly filePath?: string,
    private readonly envOverrides: Partial<ActualSettings> = {},
  ) {
    if (filePath && existsSync(filePath)) {
      this.settings = {
        ...EMPTY,
        ...JSON.parse(readFileSync(filePath, "utf8")),
      };
    }
  }

  private isLocked(field: keyof ActualSettings): boolean {
    return !!this.envOverrides[field];
  }

  /** Full settings including secrets, for server-internal use only. */
  getSecret(): ActualSettings {
    const merged = { ...this.settings };
    for (const f of FIELDS) {
      const v = this.envOverrides[f];
      if (v) merged[f] = v;
    }
    return merged;
  }

  get(): ActualSettingsView {
    const s = this.getSecret();
    return {
      serverUrl: s.serverUrl,
      syncId: s.syncId,
      hasServerPassword: s.serverPassword !== "",
      hasEncryptionPassword: s.encryptionPassword !== "",
      locked: {
        serverUrl: this.isLocked("serverUrl"),
        serverPassword: this.isLocked("serverPassword"),
        syncId: this.isLocked("syncId"),
        encryptionPassword: this.isLocked("encryptionPassword"),
      },
    };
  }

  /** Returns field errors, or an empty object after saving. */
  update(input: unknown): Record<string, string> {
    const body = {
      ...(input && typeof input === "object" ? input : {}),
    } as Record<string, unknown>;
    // Locked fields are ignored; locked required fields count as satisfied.
    for (const f of FIELDS) if (this.isLocked(f)) delete body[f];
    if (this.isLocked("serverUrl"))
      body.serverUrl = this.envOverrides.serverUrl;
    if (this.isLocked("syncId")) body.syncId = this.envOverrides.syncId;

    const errors = validateActualSettings(body, this.getSecret());
    if (Object.keys(errors).length > 0) return errors;
    const u = body as unknown as ActualSettingsUpdate;
    this.settings = {
      serverUrl: this.isLocked("serverUrl")
        ? this.settings.serverUrl
        : u.serverUrl.trim(),
      syncId: this.isLocked("syncId") ? this.settings.syncId : u.syncId.trim(),
      serverPassword: u.serverPassword ?? this.settings.serverPassword,
      encryptionPassword:
        u.encryptionPassword ?? this.settings.encryptionPassword,
    };
    this.save();
    return {};
  }

  private save(): void {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), {
      mode: 0o600,
    });
    chmodSync(this.filePath, 0o600);
  }
}
