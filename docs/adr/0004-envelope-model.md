# ADR-0004: Plain credit cards and boundary overspending

- Status: accepted
- Date: 2026-01-05

## Context

YNAB creates a payment category per credit card and moves money when a card is used. Actual treats a
card as an on-budget account with a negative balance and leaves the envelope math explicit. The second
is easier to explain, easier to audit, and has fewer hidden writes.

## Decision

A credit card is a plain on-budget account. There is no payment category and no automatic transfer.
Spending on the card reduces the category and the on-budget balance at the same time.

A negative Available is shown in its month. At the month boundary it starts at zero in the next month,
and Ready to Assign drops by the deficit. Assigning money to the negative category in the same month
covers it explicitly, and then nothing is deducted.

## Consequences

- The user can always see where money went; no category appears from nowhere.
- Age-of-money, reports, and reconciles use ordinary transactions.
- A household used to YNAB's payment category has to learn one sentence: credit cards are accounts.
- A payment category can still be added by hand as an ordinary category.
