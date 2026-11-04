import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  type BudgetDocument,
  type BudgetInfo,
  type BudgetSnapshot,
  type ExportFormat,
  encodeBudgetFile,
  type LibraryEntry,
} from "@suite/budget-core";

import { backupCurrent, exportRecordsText, writeBudgetDocument } from "./library";
import type { AppPaths } from "./paths";

/**
 * Owns the authoritative document while a budget is open. Renderer edits arrive as CRDT
 * updates and are written to disk on a debounce; the write is atomic and keeps backups.
 */
export class BudgetStore {
  readonly #doc: BudgetDocument;
  readonly #paths: AppPaths;
  #entry: LibraryEntry;
  #saveTimer: NodeJS.Timeout | null = null;
  #flushing: Promise<void> = Promise.resolve();
  #saveError: string | null = null;

  private constructor(paths: AppPaths, entry: LibraryEntry, doc: BudgetDocument) {
    this.#paths = paths;
    this.#entry = entry;
    this.#doc = doc;
  }

  static fromDocument(paths: AppPaths, entry: LibraryEntry, doc: BudgetDocument): BudgetStore {
    return new BudgetStore(paths, entry, doc);
  }

  get document(): BudgetDocument {
    return this.#doc;
  }

  get entry(): LibraryEntry {
    return this.#entry;
  }

  get path(): string {
    return this.#entry.path;
  }

  get saveError(): string | null {
    return this.#saveError;
  }

  snapshot(): Uint8Array {
    return this.#doc.snapshot();
  }

  getSnapshot(): BudgetSnapshot {
    return this.#doc.getSnapshot();
  }

  info(): BudgetInfo {
    const settings = this.#doc.getSettings();
    return {
      id: this.#entry.id,
      name: this.#doc.getMeta().name,
      path: this.#entry.path,
      schemaVersion: this.#doc.getMeta().schemaVersion,
      currency: settings.currency,
      currencyScale: settings.currencyScale,
    };
  }

  commit(update: Uint8Array): void {
    this.#doc.applyUpdate(update);
    this.scheduleSave();
  }

  mutate<T>(mutation: (doc: BudgetDocument) => T): T {
    const result = mutation(this.#doc);
    this.scheduleSave();
    return result;
  }

  scheduleSave(): void {
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      void this.flush();
    }, 400);
  }

  flush(): Promise<void> {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    this.#flushing = this.#flushing.then(
      () => this.#writeCurrent(),
      () => this.#writeCurrent(),
    );
    return this.#flushing;
  }

  async close(): Promise<void> {
    await this.flush();
  }

  async exportTo(target: string): Promise<void> {
    await writeFile(target, encodeBudgetFile(this.#doc), "utf8");
  }

  async exportRecords(format: ExportFormat, target: string): Promise<void> {
    const contents = await exportRecordsText(this.#doc.getSnapshot(), format);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }

  async rename(name: string): Promise<LibraryEntry> {
    this.#doc.rename(name);
    this.#entry = { ...this.#entry, name };
    this.scheduleSave();
    return this.#entry;
  }

  async #writeCurrent(): Promise<void> {
    try {
      await backupCurrent(this.#paths, this.#entry.id, this.#entry.path);
      await writeBudgetDocument(this.#entry.path, this.#doc);
      this.#saveError = null;
    } catch (error) {
      this.#saveError = error instanceof Error ? error.message : String(error);
      // Keep the chain alive: a transient failure must not stop every later save.
      console.error("Suite Budget: could not write the budget", this.#saveError);
    }
  }
}
