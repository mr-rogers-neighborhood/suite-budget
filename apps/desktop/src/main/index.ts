import { existsSync } from "node:fs";
import { join } from "node:path";

import { app, BrowserWindow } from "electron";
import { budgetFromArgv } from "./budgetLocation";
import { registerIpc } from "./ipc";
import { adoptLegacyBudgets, ensureDirs, openFromPath, toOpenInfo } from "./library";
import { installMenu } from "./menu";
import { appPaths } from "./paths";
import { registerAppScheme, serveRenderer } from "./protocol";
import { closeSession, openSession } from "./session";
import { applyContentSecurityPolicy, createMainWindow, pageCsp } from "./window";

app.setName("Suite Budget");

// Before `ready`: a scheme cannot be registered as privileged afterwards.
registerAppScheme();

if (process.env.SUITE_BUDGET_USER_DATA) {
  app.setPath("userData", process.env.SUITE_BUDGET_USER_DATA);
}

let mainWindow: BrowserWindow | null = null;
let cleanedUp = false;
const pendingFiles: string[] = [];

/** The budget the command line names, whether a path or a link the hub routed here. */
function budgetFromCommandLine(argv: readonly string[]): string | null {
  return budgetFromArgv(argv, appPaths().budgetsDir, existsSync);
}

const coldStart = budgetFromCommandLine(process.argv);
if (coldStart) pendingFiles.push(coldStart);

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    focusWindow();
    const candidate = budgetFromCommandLine(argv);
    if (candidate) void openExternal(candidate);
  });

  app.on("open-file", (event, path) => {
    event.preventDefault();
    if (app.isReady()) void openExternal(path);
    else pendingFiles.push(path);
  });

  app
    .whenReady()
    .then(bootstrap)
    .catch((error: unknown) => {
      console.error("Suite Budget failed to start", error);
      app.quit();
    });

  app.on("before-quit", (event) => {
    if (cleanedUp) return;
    event.preventDefault();
    void shutdown();
  });

  app.on("window-all-closed", () => {
    // There is no tray and no background work; closing the last window quits.
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
}

async function bootstrap(): Promise<void> {
  serveRenderer(
    join(__dirname, "../renderer"),
    pageCsp(Boolean(process.env.ELECTRON_RENDERER_URL)),
  );
  const paths = appPaths();
  // Before the folders are created: this is what moves budgets written before the convention.
  await adoptLegacyBudgets(paths);
  await ensureDirs(paths);
  applyContentSecurityPolicy();
  registerIpc();
  installMenu();
  openWindow();

  for (const path of pendingFiles.splice(0)) await openExternal(path);
}

function openWindow(): BrowserWindow {
  const window = createMainWindow();
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  mainWindow = window;
  return window;
}

function focusWindow(): void {
  if (!app.isReady()) return;
  if (!mainWindow) {
    openWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function openExternal(path: string): Promise<void> {
  const paths = appPaths();
  try {
    const result = await openFromPath(paths, path);
    await openSession(paths, result.entry, result.doc);
    const info = toOpenInfo(result.entry, result.doc);
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("budget:opened", info);
    }
    focusWindow();
  } catch (error) {
    console.error("Suite Budget: could not open the file", error);
  }
}

async function shutdown(): Promise<void> {
  await closeSession();
  cleanedUp = true;
  app.quit();
}
