import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type { ExportFormat, OpenBudgetInfo } from "@suite/budget-core";
import { isTrustedSender } from "@suite/desktop";

import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions, shell } from "electron";
import { z } from "zod";

import {
  createBudget,
  importFromPath,
  listEntries,
  openBudget,
  removeBudget,
  renameBudget,
  toOpenInfo,
} from "./library";
import { appPaths } from "./paths";
import { pageOrigins } from "./protocol";
import { closeSession, openSession, requireStore } from "./session";

const startingAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["checking", "savings", "cash", "credit", "loan"]),
  onBudget: z.boolean().optional(),
  startingBalanceMinor: z.number().int(),
});

const createBudgetSchema = z.object({
  name: z.string().min(1),
  currency: z.string().length(3),
  currencyScale: z.number().int().min(0).max(3).optional(),
  firstDayOfWeek: z.number().int().min(0).max(6).optional(),
  template: z.enum(["essentials", "four_rules", "blank"]),
  startingAccount: startingAccountSchema.optional(),
});

const idSchema = z.object({ id: z.string().min(1) });
const renameSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });
const updateSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array, {
  message: "Expected a binary CRDT update",
});
const formatSchema = z.enum(["json", "csv", "qif"]);

function onIpc(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event.senderFrame?.url, pageOrigins())) return undefined;
    return handler(event, ...args);
  });
}

export function registerIpc(): void {
  const paths = appPaths();

  onIpc("library:list", () => listEntries(paths));

  onIpc("library:create", async (_event, payload: unknown) => {
    const input = createBudgetSchema.parse(payload);
    const result = await createBudget(paths, input);
    await openSession(paths, result.entry, result.doc);
    return toOpenInfo(result.entry, result.doc);
  });

  onIpc("library:open", async (_event, payload: unknown) => {
    const { id } = idSchema.parse(payload);
    const result = await openBudget(paths, id);
    await openSession(paths, result.entry, result.doc);
    const info = toOpenInfo(result.entry, result.doc);
    return result.usedBackup
      ? { ...info, warning: "The live file could not be read; this is the newest backup." }
      : info;
  });

  onIpc(
    "library:import",
    async (event): Promise<{ canceled: boolean; opened?: OpenBudgetInfo }> => {
      const filePath = await pickBudgetFile(event);
      if (!filePath) return { canceled: true };
      const result = await importFromPath(paths, filePath);
      await openSession(paths, result.entry, result.doc);
      return { canceled: false, opened: toOpenInfo(result.entry, result.doc) };
    },
  );

  onIpc("library:close", async () => {
    await closeSession();
  });

  onIpc("library:remove", async (_event, payload: unknown) => {
    const { id } = idSchema.parse(payload);
    const store = requireStoreIfOpen();
    if (store?.entry.id === id) throw new Error("Close the budget before removing it");
    await removeBudget(paths, id);
  });

  onIpc("library:reveal", async (_event, payload: unknown) => {
    const { id } = idSchema.parse(payload);
    const entry = (await listEntries(paths)).find((candidate) => candidate.id === id);
    if (entry) shell.showItemInFolder(entry.path);
  });

  onIpc("library:rename", async (_event, payload: unknown) => {
    const { id, name } = renameSchema.parse(payload);
    const store = requireStoreIfOpen();
    if (store?.entry.id === id) throw new Error("Close the budget before renaming it");
    return renameBudget(paths, id, name);
  });

  onIpc("budget:snapshot", () => requireStore().snapshot());
  onIpc("budget:commit", (_event, payload: unknown) => {
    requireStore().commit(updateSchema.parse(payload));
  });
  onIpc("budget:info", () => {
    const store = requireStore();
    return { ...store.info(), saveError: store.saveError };
  });

  onIpc("budget:export", async (event) => {
    const store = requireStore();
    const filePath = await pickSaveTarget(event, {
      title: "Export budget",
      defaultPath: join(
        app.getPath("documents"),
        `${safeName(store.entry.name)}-${new Date().toISOString().slice(0, 10)}.budget`,
      ),
      filters: [{ name: "Suite Budget", extensions: ["budget"] }],
    });
    if (!filePath) return { canceled: true };
    await store.exportTo(filePath);
    return { canceled: false, path: filePath };
  });

  onIpc("budget:export-records", async (event, payload: unknown) => {
    const format = formatSchema.parse(payload) as ExportFormat;
    const store = requireStore();
    const extension = format === "json" ? "json" : format;
    const filePath = await pickSaveTarget(event, {
      title: "Export records",
      defaultPath: join(
        app.getPath("documents"),
        `${safeName(store.entry.name)}-transactions.${extension}`,
      ),
      filters: [{ name: `${format.toUpperCase()} file`, extensions: [extension] }],
    });
    if (!filePath) return { canceled: true };
    await store.exportRecords(format, filePath);
    return { canceled: false, path: filePath };
  });

  onIpc("import:read", async (event) => {
    const filePath = await pickImportSource(event);
    if (!filePath) return { canceled: true };
    const info = await stat(filePath);
    if (info.size > 100 * 1024 * 1024) {
      throw new Error("That file is larger than 100 MB");
    }
    const text = await readFile(filePath, "utf8");
    return { canceled: false, name: filePath.split(/[\\/]/).pop() ?? filePath, text };
  });

  onIpc("app:platform", () => process.platform);
}

function requireStoreIfOpen() {
  try {
    return requireStore();
  } catch {
    return null;
  }
}

async function pickBudgetFile(event: Electron.IpcMainInvokeEvent): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: "Open a budget",
    properties: ["openFile"],
    filters: [
      { name: "Suite Budget", extensions: ["budget"] },
      { name: "Suite Budget records", extensions: ["json"] },
    ],
  };
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

async function pickImportSource(event: Electron.IpcMainInvokeEvent): Promise<string | null> {
  const options: OpenDialogOptions = {
    title: "Choose a file to import",
    properties: ["openFile"],
    filters: [
      { name: "Transactions", extensions: ["csv", "qif"] },
      { name: "Suite Budget records", extensions: ["json"] },
    ],
  };
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? null : (result.filePaths[0] ?? null);
}

async function pickSaveTarget(
  event: Electron.IpcMainInvokeEvent,
  options: Electron.SaveDialogOptions,
): Promise<string | null> {
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = window
    ? await dialog.showSaveDialog(window, options)
    : await dialog.showSaveDialog(options);
  return result.canceled ? null : (result.filePath ?? null);
}

function safeName(name: string): string {
  return name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "budget";
}
