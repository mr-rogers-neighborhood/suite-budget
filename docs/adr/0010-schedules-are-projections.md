# ADR-0010: Schedules are projections; no unattended entry

- Status: accepted
- Date: 2026-01-05

## Context

A schedule can be a recurring transaction that enters itself, or a template that shows what is coming.
Automatic entry while the app is closed needs a background process and makes the ledger change without
the user seeing it.

## Decision

A schedule stores an anchor date, a frequency, an interval, and the next date. Upcoming entries are
derived for a window. Entering one creates a transaction and advances the next date. There is no
background auto-entry in v1. The anchor keeps the 31st on the 31st after short months.

## Consequences

- The app does nothing behind the user's back.
- Closing the app stops no scheduled work because none is running.
- A later auto-enter feature can be added as an explicit setting without changing the record's meaning.
