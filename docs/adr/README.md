# Decision records

Our own records, starting at ADR-0001. An id is stable and quotable. The prose beside a decision states
it, so code never depends on opening a record.

| ADR                                       | Decision                                         |
| ----------------------------------------- | ------------------------------------------------ |
| [0001](0001-loro-document.md)             | One Loro document per budget                     |
| [0002](0002-electron.md)                  | Electron, one Chromium on every OS               |
| [0003](0003-main-authority.md)            | Main is the authority; the renderer is a replica |
| [0004](0004-envelope-model.md)            | Plain credit cards and boundary overspending     |
| [0005](0005-minor-units.md)               | Integer minor units, one currency per budget     |
| [0006](0006-sparse-months.md)             | Sparse per-category month records                |
| [0007](0007-transfers-and-splits.md)      | Transfers are pairs; splits are child records    |
| [0008](0008-versioned-targets.md)         | Targets are versioned records                    |
| [0009](0009-staged-rules.md)              | Rules are staged, ranked, and learned            |
| [0010](0010-schedules-are-projections.md) | Schedules are projections; no unattended entry   |
| [0011](0011-imports-no-bank-sync.md)      | Imports are adapters; there is no bank sync      |
| [0012](0012-cash-basis-invariant.md)      | The cash-basis invariant and uncategorized rows  |
| [0013](0013-budget-library.md)            | The budget library and file lifecycle            |
| [0014](0014-never-lose-money.md)          | Validation, backups, recovery, migrations        |
| [0015](0015-local-gate.md)                | Local gate only; no CI                           |
| [0016](0016-svg-charts.md)                | Hand-rolled SVG charts, pure series in core      |
| [0017](0017-age-of-money.md)              | Age of money is FIFO over income                 |
