import type { AppCommand, ExportFormat } from "@suite/budget-core";
import { app, BrowserWindow, dialog, Menu, type MenuItemConstructorOptions } from "electron";

const isMac = process.platform === "darwin";

function send(command: AppCommand): void {
  BrowserWindow.getFocusedWindow()?.webContents.send("ui:command", command);
}

function sendExport(format: ExportFormat): void {
  const command: AppCommand =
    format === "json" ? "export-json" : format === "csv" ? "export-csv" : "export-qif";
  send(command);
}

export function installMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "Budget",
      submenu: [
        { label: "New Budget…", accelerator: "CmdOrCtrl+N", click: () => send("new-budget") },
        { label: "Open File…", accelerator: "CmdOrCtrl+O", click: () => send("open-file") },
        {
          label: "Show Budgets",
          accelerator: "CmdOrCtrl+Shift+B",
          click: () => send("show-budgets"),
        },
        { type: "separator" },
        {
          label: "Export Budget…",
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => send("export-budget"),
        },
        {
          label: "Export Records",
          submenu: [
            { label: "JSON…", click: () => sendExport("json") },
            { label: "CSV…", click: () => sendExport("csv") },
            { label: "QIF…", click: () => sendExport("qif") },
          ],
        },
        { type: "separator" },
        { label: "Close Budget", click: () => send("close-budget") },
        ...(isMac ? [] : [{ type: "separator" as const }, { role: "quit" as const }]),
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => send("undo"),
        },
        {
          label: "Redo",
          accelerator: "Shift+CmdOrCtrl+Z",
          click: () => send("redo"),
        },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Plan", accelerator: "CmdOrCtrl+1", click: () => send("view-plan") },
        { label: "Accounts", accelerator: "CmdOrCtrl+2", click: () => send("view-accounts") },
        { label: "Reports", accelerator: "CmdOrCtrl+3", click: () => send("view-reports") },
        { type: "separator" },
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Command Palette",
          accelerator: "CmdOrCtrl+K",
          click: () => send("command-palette"),
        },
        { type: "separator" },
        {
          label: "About Suite Budget",
          click: () => {
            void dialog.showMessageBox({
              type: "info",
              title: "Suite Budget",
              message: "Suite Budget",
              detail: `Version ${app.getVersion()}\n\nA local-first envelope budget.\nMIT licensed. No account, no server, no telemetry.`,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
