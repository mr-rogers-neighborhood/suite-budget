# ADR-0014: Validation, backups, recovery, migrations

- Status: accepted
- Date: 2026-01-05

## Context

A budget holds a household's financial history. Silently starting an empty document over a damaged file
is the worst failure the app can have. Suite Planner did that; Suite Budget must not.

## Decision

Every load decodes the envelope, builds a document, and validates every record. If the live file fails,
try the newest backup. If all fail, copy the damaged file to `recovered/<timestamp>/` and refuse to
overwrite; starting a new budget is an explicit choice. Every save is a temp file plus rename, keeps the
previous copy, and keeps seven daily backups. A schema migration writes a pre-migration backup first. A
newer schema opens read-only with an explanation.

## Consequences

- The failure mode is a visible folder with the original file, not a blank budget.
- Disk usage grows by at most eight copies per budget.
- A save error is surfaced and retried; the UI never claims success while the file is unwritable.
