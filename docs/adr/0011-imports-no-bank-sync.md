# ADR-0011: Imports are adapters; there is no bank sync

- Status: accepted
- Date: 2026-01-05

## Context

Bank sync needs a server, credentials, a provider contract, and a privacy story that this app does not
have. File import covers the same need without a network path.

## Decision

CSV, QIF, native JSON, and `.budget` are the only ways data enters. Each parser is a pure adapter that
returns an `ImportBatch`. OFX/QFX/CAMT may be added as adapters later. Bank sync is not deferred; it is
decided against.

## Consequences

- The bundle has no network client.
- Imports can be previewed, reviewed, and tested with fixtures.
- The user downloads a file from their bank; the app never holds credentials.
- A future sync relay would have to be a separate decision and a separate layer.
