# ADR-0005: Integer minor units, one currency per budget

- Status: accepted
- Date: 2026-01-05

## Context

Floating point money drifts, and a budget that disagrees with the bank by a cent is a broken budget.
Multi-currency adds exchange rates, historical rates, and a second layer of rounding to every report.

## Decision

Every amount is a signed integer in minor units. `money.ts` owns parsing, formatting, and the currency
scale. One budget has one currency and one scale. Floats never touch a record, a sum, or a target.

## Consequences

- Arithmetic is exact and the invariant is testable with integers.
- A second currency is a separate budget for now; adding it later needs an ADR.
- `parseFloat` and `toFixed` are banned outside `money.ts` and tests; the shape check enforces it.
