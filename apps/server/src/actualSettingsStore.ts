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

/** Stores Actual connection settings, optionally persisted to a 0600 JSON file. */
export class ActualSettingsStore {
  private settings: ActualSettings = { ...EMPTY };

  constructor(private readonly filePath?: string) {
    if (filePath && existsSync(filePath)) {
      this.settings = {
        ...EMPTY,
        ...JSON.parse(readFileSync(filePath, "utf8")),
      };
    }
  }

  /** Full settings including secrets, for server-internal use only. */
  getSecret(): ActualSettings {
    return { ...this.settings };
  }

  get(): ActualSettingsView {
    return {
      serverUrl: this.settings.serverUrl,
      syncId: this.settings.syncId,
      hasServerPassword: this.settings.serverPassword !== "",
      hasEncryptionPassword: this.settings.encryptionPassword !== "",
    };
  }

  /** Returns field errors, or an empty object after saving. */
  update(input: unknown): Record<string, string> {
    const errors = validateActualSettings(input, this.settings);
    if (Object.keys(errors).length > 0) return errors;
    const u = input as ActualSettingsUpdate;
    this.settings = {
      serverUrl: u.serverUrl.trim(),
      syncId: u.syncId.trim(),
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
