# ADR-0006: Sparse per-category month records

- Status: accepted
- Date: 2026-01-05

## Context

A month could be one record holding a map of category allocations. That makes a whole-document write for
one assignment and makes concurrent edits to two categories collide. Most categories have no assignment
in most months.

## Decision

Store one record per `(month, category)` only when the assigned amount is non-zero. Key it
`yyyy-MM:categoryId`. A missing record is zero.

## Consequences

- Assigning one category is one leaf write.
- Two replicas editing different categories in the same month merge.
- Month projections iterate categories, not budget records; a month with no data costs nothing.
- A future bulk import writes one record per category, still in one commit.
