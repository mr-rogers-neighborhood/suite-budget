# ADR-0009: Rules are staged, ranked, and learned

- Status: accepted
- Date: 2026-01-05

## Context

Imports arrive with ugly payees and inconsistent categories. A flat, user-ordered list is hard to
maintain; an unordered set is nondeterministic.

## Decision

Rules have three stages (`pre`, `default`, `post`). Within a stage they are ranked by specificity (exact
before set membership before substring before regex), then creation time, then id. Broad rules run first;
the last matching action wins. Rules run on import and on request. Manual categorizing creates or updates
a learned rule, which is an ordinary editable record.

## Consequences

- Results are deterministic and explainable.
- A specific rule can override a broad one without deleting it.
- Learned rules can be disabled or deleted like any other rule.
- Conditions are matched against a plain draft, so the evaluator is pure and testable.
