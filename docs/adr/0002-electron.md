# ADR-0002: Electron, one Chromium on every OS

- Status: accepted
- Date: 2026-01-05

## Context

Suite Budget is a desktop app from the start. It needs files, a menu, a native save dialog, and a
consistent keyboard and rendering model on Linux, macOS, and Windows. Tauri is smaller but uses each
OS's webview, where rendering and accessibility drift.

## Decision

Use Electron with electron-vite. Ship one Chromium runtime, keep the renderer a normal React app, and
put file, library, backup, and recovery work in the main process.

## Consequences

- One rendering target, one keyboard model, one accessibility baseline.
- The installer is large and memory use is higher than a native shell.
- Node in main makes atomic writes and recovery straightforward.
- The renderer stays sandboxed; Node is not available to it.
