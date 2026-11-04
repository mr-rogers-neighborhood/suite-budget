# ADR-0012: The cash-basis invariant and uncategorized rows

- Status: accepted
- Date: 2026-01-05

## Context

Envelope math is easy to get subtly wrong. A negative category, an uncategorized import, a transfer, or
a split can each break the relationship between the ledger and the envelopes.

## Decision

For every month:

```
sum(available for every category) + readyToAssign = onBudgetBalance
```

`readyToAssign` is computed as the on-budget balance minus the sum of Available. Uncategorized
transactions reduce the balance and therefore Ready to Assign; the Plan shows a review banner. A negative
Available is closed at the month boundary, which is why the next month's Ready to Assign drops by the
deficit. The rule is asserted by a property test and a hand-computed fixture.

## Consequences

- There is one formula to reason about, and one place to fix.
- An uncategorized row is never silent: money leaves Ready to Assign and the UI says so.
- A split, transfer, or credit card cannot invent money without failing a test.
