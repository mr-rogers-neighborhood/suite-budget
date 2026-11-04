# ADR-0001: One Loro document per budget

- Status: accepted
- Date: 2026-01-05

## Context

The budget must open and edit without a network, keep undo, and survive a crash. A future sync feature
should not force a rewrite of the document layer. A decade of transactions is thousands of records, not
millions.

## Decision

One Loro CRDT document per budget is the source of truth. Zod schemas validate every write.
`BudgetDocument` is the only writer, and every record is a mergeable map so writes land on leaf keys.

## Consequences

- Offline editing, undo, and concurrent merges come from the CRDT rather than hand-written code.
- A snapshot is the whole budget, which makes export, backup, and recovery straightforward.
- Reads rebuild projections; a very large budget may need an index later.
- Splitting into per-year documents is possible behind the `BudgetDocument` seam if a benchmark asks,
  at the cost of cross-document atomicity.
