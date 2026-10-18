import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { UploadType, UploadTypeDraft } from "statement-core";

/** Stores upload types, optionally persisted to a JSON file. */
export class UploadTypeStore {
  private types: UploadType[] = [];

  constructor(private readonly filePath?: string) {
    if (filePath && existsSync(filePath)) {
      this.types = JSON.parse(readFileSync(filePath, "utf8"));
    }
  }

  list(): UploadType[] {
    return [...this.types];
  }

  get(id: string): UploadType | undefined {
    return this.types.find((t) => t.id === id);
  }

  add(draft: UploadTypeDraft): UploadType {
    const type: UploadType = { ...draft, id: randomUUID() };
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
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.types, null, 2));
  }
}
