# ADR-0013: The budget library and file lifecycle

- Status: accepted
- Date: 2026-01-05

## Context

A finance app needs more than one budget (household, business, a historical year) and a file the user can
copy to another machine. A single autosaved workspace, as in Suite Planner, is not enough.

## Decision

An app-managed library at `userData` holds `library.json`, `budgets/<id>.budget`, `backups/<id>/`, and
`recovered/`. The launcher lists entries; Open, Import, Rename, Show in folder, and Remove from library
operate on the entry. Removing leaves the file. A `.budget` opened from the OS is copied into the library
and opened.

## Consequences

- The user can have several budgets without a settings maze.
- Save As and Export still produce a file anywhere the user chooses.
- The library index is a small JSON file; if it is corrupt it is reported, not rewritten.
- The app has one open budget at a time; no multi-window coordination in v1.
