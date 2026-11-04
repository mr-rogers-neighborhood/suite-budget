# ADR-0003: Main is the authority; the renderer is a replica

- Status: accepted
- Date: 2026-01-05

## Context

Autosave, backups, recovery, and native dialogs need the process that can touch disk. The budget also
has to survive a renderer crash. The renderer's lifetime is a window.

## Decision

The main process owns the authoritative `BudgetDocument`, the library, and the file store. The renderer
keeps a replica, streams CRDT deltas over `budget:commit`, and reads a rebuilt snapshot. Every IPC
payload is validated in main.

## Consequences

- A renderer crash does not lose committed edits.
- The renderer cannot write files or read arbitrary paths.
- The delta channel is exactly what a future relay would carry.
- The renderer must rebuild its snapshot after each commit; that is the price of one truth.
