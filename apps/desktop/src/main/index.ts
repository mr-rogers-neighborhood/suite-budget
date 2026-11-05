import { app, BrowserWindow } from "electron";

import { registerIpc } from "./ipc";

import { adoptLegacyBudgets, ensureDirs, openFromPath, toOpenInfo } from "./library";
import { installMenu } from "./menu";
import { appPaths } from "./paths";
import { closeSession, openSession } from "./session";
import { applyContentSecurityPolicy, createMainWindow } from "./window";

app.setName("Suite Budget");

if (process.env.SUITE_BUDGET_USER_DATA) {
  app.setPath("userData", process.env.SUITE_BUDGET_USER_DATA);
}

let mainWindow: BrowserWindow | null = null;
let cleanedUp = false;
const pendingFiles: string[] = [];

/**
 * A budget path the process was started with, which is how the hub hands a file over.
 *
 * The operating system's `open-file` event is not sent for an argument, so reading `argv` here is what
 * makes a row in Start's Files pane open what it says it opens.
 */
function budgetFromArgv(argv: readonly string[]): string | null {
  for (const argument of argv.slice(1)) {
    if (argument.startsWith("-")) continue;
    if (/\.(budget|json)$/iu.test(argument)) return argument;
  }
  return null;
}

const coldStart = budgetFromArgv(process.argv);
if (coldStart) pendingFiles.push(coldStart);

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    focusWindow();
    const candidate = argv.find((arg) => /\.(budget|json)$/i.test(arg));
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
