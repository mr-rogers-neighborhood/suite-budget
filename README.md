# Suite Budget

**A local-first envelope budget.** Give every dollar a job, import transactions from your bank's CSV,
and keep the ledger in one file you own — in an Electron app that opens without a network and has no
account, no server, and no telemetry.

Suite Budget is the money app in the Suite family, alongside
[Suite Canvas](https://github.com/mr-rogers-neighborhood/suite-canvas) and
[Suite Planner](https://github.com/mr-rogers-neighborhood/suite-planner).

> Suite Budget is pre-alpha. The core loop works: a launcher, accounts, transactions, the month grid,
> rollover, reconcile, undo, and a `.budget` file with rolling backups. Targets, rules, schedules,
> CSV/QIF import, and reports are being built.

## What it does

- **Envelopes, not forecasts.** Only money that exists in on-budget accounts can be assigned. Positive
  Available carries forward; a negative envelope is shown, closed at the month boundary, and deducted
  from the next month's Ready to Assign.
- **Credit cards are accounts.** A card is an on-budget account with a negative balance. There is no
  hidden payment category and no automatic money movement.
- **A real register.** Splits, transfers, payees, memos, flags, cleared and reconciled rows. A transfer
  is a pair of linked records; a split is a parent with child records.
- **Nothing is trapped.** Export a `.budget` file, plain JSON records, transactions as CSV, or QIF.
  Import CSV, QIF, native JSON, or another `.budget`.
- **Offline by design.** No network client, no updater, no analytics. Bank sync is deliberately absent.

## Run it

Node 22 or newer, pnpm 12, and a display (Electron). pnpm is the only package manager.

```sh
pnpm install
pnpm dev        # Electron window, Vite renderer with hot reload
```

Other commands:

```sh
pnpm check      # the edit loop: biome, tsc, changed tests, shape
pnpm verify     # lint, types, all tests, shape, knip, build, Storybook build
pnpm test       # every Vitest project
pnpm storybook  # component workshop on :6006
pnpm build      # required before the Playwright journey, which launches the built app
pnpm e2e:smoke  # Playwright Electron journey; on request, not part of the gate
pnpm package    # electron-builder targets for this platform
```

If there is no display (CI or a container), run the smoke test under Xvfb:

```sh
pnpm build
xvfb-run -a pnpm e2e:smoke
```

## Your file

- The app keeps a budget library at the Electron `userData` directory: `library.json`, `budgets/`,
  `backups/`, and `recovered/`.
- A `.budget` file is JSON containing a base64 Loro snapshot and its format/schema versions. It is
  readable by anyone who has the file. **Use OS disk encryption**; the app does not add a passphrase.
- Every save is atomic (temp file → rename), keeps the previous copy, and keeps seven daily backups.
- A damaged file is never overwritten: the app tries the newest backup, then opens recovery mode with a
  copy in `recovered/`.

## How it is built

React 19 on Electron, one Loro CRDT document per budget, Zod-validated records, Tailwind v4 with Radix
primitives. The main process owns the authoritative document, the file store, backups, and recovery;
the renderer keeps a replica and streams CRDT deltas over a narrow, validated IPC bridge. Pure
projections compute the month, targets, rules, reports, and imports.

| Path             | What lives there                                                                    |
| ---------------- | ----------------------------------------------------------------------------------- |
| `apps/desktop`   | Electron main, preload bridge, React renderer, Storybook, Playwright                |
| `packages/core`  | Schema, `BudgetDocument`, month math, rules, importers, exports, reports, templates |
| `docs/reference` | Architecture, conventions, data model, interface                                    |
| `docs/adr`       | The decisions behind the shape, one page each                                       |

Read [AGENTS.md](AGENTS.md) before contributing (human or agent), and
[docs/reference/architecture.md](docs/reference/architecture.md) for the longer version.

## Security

Report a vulnerability per [SECURITY.md](SECURITY.md). The app makes no network calls and does not
encrypt the budget file; use OS disk encryption.

## Licence

MIT, © Suite contributors.
