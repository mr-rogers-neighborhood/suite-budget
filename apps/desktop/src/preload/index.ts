import type { AppCommand, BudgetBridge, ExportFormat, OpenBudgetInfo } from "@suite/budget-core";
import { contextBridge, ipcRenderer } from "electron";

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const bridge: BudgetBridge = {
  listBudgets: () => ipcRenderer.invoke("library:list"),
  createBudget: (input) => ipcRenderer.invoke("library:create", input),
  openBudget: (id) => ipcRenderer.invoke("library:open", { id }),
  closeBudget: () => ipcRenderer.invoke("library:close"),
  removeBudget: (id) => ipcRenderer.invoke("library:remove", { id }),
  revealBudget: (id) => ipcRenderer.invoke("library:reveal", { id }),
  renameBudget: (id, name) => ipcRenderer.invoke("library:rename", { id, name }),
  importBudget: () => ipcRenderer.invoke("library:import"),
  openBudgetFile: () => ipcRenderer.invoke("library:import"),
  readImportSource: () => ipcRenderer.invoke("import:read"),
  loadSnapshot: () => ipcRenderer.invoke("budget:snapshot"),
  commit: (update) => ipcRenderer.invoke("budget:commit", update),
  info: () => ipcRenderer.invoke("budget:info"),
  exportBudget: () => ipcRenderer.invoke("budget:export"),
  exportRecords: (format: ExportFormat) => ipcRenderer.invoke("budget:export-records", format),
  onBudgetReplaced: (listener) =>
    subscribe<Uint8Array>("budget:replaced", (snapshot) => listener(snapshot)),
  onBudgetOpened: (listener) =>
    subscribe<OpenBudgetInfo>("budget:opened", (info) => listener(info)),
  onCommand: (listener) => subscribe<AppCommand>("ui:command", (command) => listener(command)),
  platform: () => ipcRenderer.invoke("app:platform"),
};

contextBridge.exposeInMainWorld("suiteBudget", bridge);
