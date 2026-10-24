import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Source, SourceDraft } from "statement-core";
import { type Logger, silentLogger } from "./logger.js";

/** Stores sources, optionally persisted to a JSON file. */
export class SourceStore {
  private types: Source[] = [];

  constructor(
    private readonly filePath?: string,
    private readonly log: Logger = silentLogger,
  ) {
    if (filePath && existsSync(filePath)) {
      try {
        this.types = JSON.parse(readFileSync(filePath, "utf8"));
      } catch (error) {
        this.log.error({ err: error, filePath }, "Failed to load sources");
        throw error;
      }
      this.log.debug({ count: this.types.length }, "Loaded sources");
    }
  }

  list(): Source[] {
    return [...this.types];
  }

  get(id: string): Source | undefined {
    return this.types.find((t) => t.id === id);
  }

  add(draft: SourceDraft): Source {
    const type: Source = { ...draft, id: randomUUID() };
    this.types.push(type);
    this.save();
    return type;
  }

  remove(id: string): boolean {
    const before = this.types.length;
    this.types = this.types.filter((t) => t.id !== id);
    if (this.types.length === before) return false;
    this.save();
    return true;
  }

  private save(): void {
    if (!this.filePath) return;
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.types, null, 2));
    } catch (error) {
      this.log.error(
        { err: error, filePath: this.filePath },
        "Failed to save sources",
      );
      throw error;
    }
  }
}
