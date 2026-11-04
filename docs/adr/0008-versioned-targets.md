# ADR-0008: Targets are versioned records

- Status: accepted
- Date: 2026-01-05

## Context

A target changes over time. Storing only the current target on the category would rewrite history:
opening an old month would show today's target instead of the one that applied then.

## Decision

A target is a record with `startsOn` and `endsOn`. Editing closes the current record at the previous
month and opens a new one at the current month. Suggestions and funded state are derived from the active
record, the category's Available, and the months remaining.

## Consequences

- Past months keep the target that applied.
- A target edit is a small, append-like change rather than a whole-category write.
- Debt payoff uses a linked account balance and ignores interest in v1.
