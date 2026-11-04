# ADR-0017: Age of money is FIFO over income

- Status: accepted
- Date: 2026-01-05

## Context

"Age of money" is a useful lens and an easy number to compute dishonestly. It needs a definition that
matches the ledger and can be tested.

## Decision

Income to Ready to Assign creates dated lots. Each outflow consumes the oldest lots first. The age of a
dollar spent is the weighted average age of the lots it consumed. The headline number is the weighted
average of the last ten outflows. Transfers between on-budget accounts are skipped.

## Consequences

- The number is deterministic and explainable.
- A budget with little history shows a short age, not an error.
- The report says it is a lens, not a score.
