# Architecture

Suite Budget is a local-first envelope budget. One Loro document per budget is the source of truth,
`@suite/budget-core` validates every write, and the React app renders projections of that document. A
transaction exists whether or not a category is assigned; a month is a window over the same records.

This page is the map. The rules are in [conventions.md](conventions.md), the records in
[data-model.md](data-model.md), the interface in [ui.md](ui.md), and the reasoning in
[../adr/README.md](../adr/README.md).

## Three rules

1. **Offline works.** Opening, editing, and exporting need no network. There is no network client in
   the bundle; bank sync is deliberately absent.
2. **Loro owns the document.** The UI reads through `@suite/budget-core` and writes through
   `BudgetDocument`, never raw Loro.
3. **Every write is validated.** Zod schemas in `packages/core/src/schema.ts` parse at the boundary
   before a value reaches the CRDT.

## Process model

```
┌──────────────────────────── Electron main (authority) ────────────────────────────┐
│  Library (library.json)  ──►  budget files (.budget, atomic write, backups)        │
│         │                                                                          │
│         └──► open budget ──► BudgetDocument (Loro) ──► IPC snapshot/commit/export  │
│                                                                                    │
│  dialogs, file reads, recovery, single-instance handling, menu, window              │
└────────────────────────────────────────────────────────────────────────────────────┘
                                     │ contextBridge, allowlisted channels
┌────────────────────────────────────▼─────────────────────────────────────────────┐
│  Renderer (launcher + replica)                                                    │
│  React 19 + Vite + Tailwind + Radix                                               │
│    ├── Launcher: library list, new-budget wizard, import                           │
│    ├── DocumentReplica: one observe call site → snapshot store                     │
│    ├── Zustand: UI state only (view, month, selection, dialogs, notice)            │
│    └── pure projections: monthState, targets, autoAssign, reports, importers       │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Boot.** The app starts with no budget open. The renderer asks the bridge for the library and renders
the launcher. Opening a budget returns a snapshot; the renderer builds a replica and subscribes.

**Edits.** The replica mutates; `subscribeLocalUpdates` emits a CRDT delta; the snapshot store
forwards it over `budget:commit` and rebuilds its derived snapshot. Main imports the delta and debounces
an atomic write (400 ms). The same delta channel is what a relay would carry later, so the document
layer does not change when sync arrives.

**Switch.** "All budgets" flushes main, closes the document, and re-renders the launcher. The renderer
disposes the replica and its undo history.

**Undo.** A Loro `UndoManager` lives on the replica. Undo emits a normal delta, so main records it like
any other edit. History is session-scoped and cleared when the budget closes. `BudgetDocument.batch()`
groups several mutations into one commit and therefore one undo step.

## Library lifecycle

| Step   | What happens                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------- |
| Create | `BudgetDocument.create`, optional starter template and first account, write the file, add a library entry |
| Open   | Read the library index, load the file, validate every record, update `lastOpenedAt`                       |
| Edit   | The renderer streams deltas; main applies them and saves on a debounce                                    |
| Save   | Temp file → previous backup → daily backup → rename; prune to seven dailies                               |
| Export | Write the `.budget` envelope or a records/CSV/QIF file; never mutate the budget                           |
| Import | Decode `.budget` or records; write a copy into the library; open it                                       |
| Close  | Flush and close the document; the launcher remains                                                        |
| Damage | Try the newest backup; then copy the damaged file to `recovered/` and refuse to overwrite                 |

## Layers

- **Pure.** `schema`, `money`, `dates`, `ids`, `plan/*`, `rules/*`, `import/*`, `reports/*`, file
  decoding, template data. No DOM, no Loro, no `fs`, no `fetch`, no timers. A test needs none of them.
- **Document.** `loro/*`. Owns the `LoroDoc`, validates writes, commits transactions. The only layer
  allowed to import `loro-crdt`.
- **Shell.** Electron main, preload, library, budget store, recovery, IPC, React hosts. Owns state and
  I/O.
- **UI state.** Zustand, UI only. Never a second copy of document truth.

Dependencies point inward: a pure module never imports the document layer; the document layer never
imports React or Electron.

## Security model

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- No remote content. `setWindowOpenHandler` denies and opens fixed help URLs in the system browser.
- A Content-Security-Policy is set on responses and repeated in `index.html`; production needs
  `wasm-unsafe-eval` for Loro's wasm, nothing else.
- Every IPC payload is a Zod schema in main; only `Uint8Array` deltas cross the commit channel.
- File paths are app-owned except the ones chosen in a native dialog.
- No telemetry, analytics, updater, or network client in the bundle. `check-shape` bans `fetch`,
  `XMLHttpRequest`, and `WebSocket` in `apps/`.
- Logs name error codes, never amounts, payees, memos, or file paths.

## Failure modes

| Failure                              | Behavior                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Invalid live file                    | Try the newest backup; then enter recovery mode: copy the damaged file to `recovered/<timestamp>/`, never overwrite, show its folder |
| Write fails (disk full, permissions) | Keep the in-memory document, surface the error, retry on the next debounce and on quit; the save is never reported as successful     |
| Schema is newer than the app         | The format guard refuses the file; no downgrade migration                                                                            |
| Crash mid-write                      | Temp file + rename means the previous file survives                                                                                  |
| Renderer crash                       | Main still holds the document and the last committed state                                                                           |
| Bad import row                       | Row number and reason in the preview; the good rows still import                                                                     |
| Duplicate import                     | Review list; ids win, fuzzy matches are proposals                                                                                    |

## Decisions

| Question                        | Decision                                                           | Record             |
| ------------------------------- | ------------------------------------------------------------------ | ------------------ |
| Where truth lives               | One Loro document per budget, owned by main                        | ADR-0001, ADR-0003 |
| What runs the UI                | Electron, one Chromium on every OS                                 | ADR-0002           |
| Credit cards and overspending   | Plain on-budget accounts; negative envelopes close at the boundary | ADR-0004           |
| How money is stored             | Integer minor units, one currency per budget                       | ADR-0005           |
| How months are stored           | Sparse per-category assignment records                             | ADR-0006           |
| What a transfer and a split are | Paired records and child records                                   | ADR-0007           |
| How targets work                | Versioned records, suggestions derived                             | ADR-0008           |
| How rules work                  | Staged, ranked, learned from user actions                          | ADR-0009           |
| How schedules work              | Projections; one-click entry, no unattended auto-entry             | ADR-0010           |
| What import is                  | Adapters; no bank sync                                             | ADR-0011           |
| What the invariant is           | Cash basis with uncategorized rows                                 | ADR-0012           |
| Where files live                | App-managed library with backups and recovery                      | ADR-0013           |
| What protects the file          | Validation, backups, recovery, no silent new document              | ADR-0014           |
| What gates a change             | Local commands only                                                | ADR-0015           |
| How charts are drawn            | Hand-rolled SVG; pure series in core                               | ADR-0016           |
| How age of money works          | FIFO over income to Ready to Assign                                | ADR-0017           |

## Not settled

- OFX/QFX/CAMT import. The `ImportAdapter` seam exists; no parser ships.
- Receipt attachments.
- Multi-currency and exchange rates.
- Optional passphrase encryption.
- Shared or household budgets.
- Investment/tracking accounts and manual valuations.
- Auto-entering schedules while the app is closed.
- Loan amortization and interest splitting.
- Privacy/scramble mode.
- A web build at `budget.suite.run`, mobile, and the suite switcher.
- Multiple windows.
- Saved filters and bulk transaction editing.
- Bank sync — decided against, not deferred.
