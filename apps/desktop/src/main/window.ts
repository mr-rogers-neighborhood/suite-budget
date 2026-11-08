import { existsSync } from "node:fs";
import { join } from "node:path";
import { desktopCsp, isTrustedSender } from "@suite/desktop";
import { app, BrowserWindow, session, shell } from "electron";

import { APP_ENTRY, pageOrigins } from "./protocol";

/** The dev server needs its own origin and the evaluation the bundler uses. */
export function pageCsp(dev: boolean): string {
  return dev
    ? desktopCsp({
        scriptSrc: ["'unsafe-eval'"],
        connectSrc: ["ws:", "http://localhost:*"],
      })
    : desktopCsp();
}

/**
 * The policy for a page served over http (the dev server). A packaged window
 * gets the same policy in the `app://` response headers.
 */
export function applyContentSecurityPolicy(): void {
  const policy = pageCsp(Boolean(process.env.ELECTRON_RENDERER_URL));
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [policy],
      },
    });
  });
}

/**
 * The window's own icon.
 *
 * A desktop entry draws its icon from the hicolor theme; a running window's taskbar icon is
 * `_NET_WM_ICON`, which Chromium fills only when `BrowserWindow` is given one. Without it the
 * panel shows Electron's logo beside this app's own entry.
 */
function windowIcon(): string | null {
  const packaged = join(process.resourcesPath, "icon.png");
  if (app.isPackaged && existsSync(packaged)) return packaged;
  const source = join(app.getAppPath(), "resources", "icon.png");
  return existsSync(source) ? source : null;
}

export function createMainWindow(): BrowserWindow {
  const icon = windowIcon();
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    ...(icon === null ? {} : { icon }),
    title: "Suite Budget",
    backgroundColor: "#0b0d12",
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    // Origins, not prefixes: `http://localhost:5173.evil.example` is a different
    // host that merely starts with the dev server's address.
    if (url !== APP_ENTRY && !isTrustedSender(url, pageOrigins())) event.preventDefault();
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadURL(APP_ENTRY);

  return window;
}
