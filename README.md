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

---

Developer note:

**What is Suite?**

Suite is a collection of applications, a relay for sync and collaboration, and a toolbox for updating and managing your applications.

This architecture came from trying basically every application worth trying in its respective space and being left wanting. I can't claim to have replaced these applications, but I'm building my own that provide the feature sets I need. They're released open-source under the MIT license, local-first, and easy to install and manage from your own computer. Mobile applications are out of scope for now, but will come once there's a solid foundation. If these applications are useful to you, you're free to use them however you'd like, or fork and develop them into your own suite.

Applications I've tested in the past include knowledge management tools and outliners such as Obsidian, Notion, Capacities, Heptabase, Tana, Logseq, and AnyType. They also include planners and task management tools such as Sunsama, Akiflow, Todoist, and TickTick, as well as budgeting applications such as YNAB and Actual.

Each of these has something going for it that the others don't, and every one is missing a critical set of capabilities I'd want from that kind of application: a simple, local-first, integrated sync service, and flexible, deep collaboration features. Some are free and open-source, even local-first; others are tied entirely to the cloud and an internet connection. None contain the exact set of capabilities I want for a visual note-taking and research application.

That led to Suite Canvas, originally the only application in the collection. Suite Canvas combines the typed-object-graph model from apps like Capacities with the canvas-driven, research-oriented experience of Heptabase. It takes smaller influences from other applications on the list, and from some that aren't (such as a generalized version of Tana's Supertags). It's the most mature of the bunch, though still very much in alpha.

I've tried to build something like Canvas several times, and each attempt hit scope creep or a design wall that led me to abandon or restart it. Approaches that didn't work out:

- **Canvas as a CMS.** A tool for thinking always becomes constrained by the language and thought process of web design. People don't think in routes or views, and mashing the two languages together produced something confusing and not worth using. Adding mapping between the CMS and the canvas didn't help either (I carried over, and still maintain, many architectural ideas from WordPress plugins like Advanced Custom Fields, Metabox, and Pods). It was clunky and felt like using two separate applications that don't mix.
- **Infinite canvas.** It seems ideal, and I love the infinite-zoom drawings people make. I tried ICE, an experimental canvas engine, and PixiJS. Both looked striking and had genuinely impressive features (ICE let you arrange cards fractally, for example), but they were complexity tar pits that forced the entire application design to contort around them. That's before getting into accessibility, sync and collaboration, and also navigation: it predictably makes it very easy to get lost. Good for art, not clear that it is good for a structured thinking tool. I did end up integrating excalidraw, via the "Sketch" card type and embed, so you maintain the important bit of being able to draw and sketch on an infinite canvas, and then embed it in your non-infinite canvas. I also added the "Portal" card type, a way to link from one canvas board to another. These were more comprehensive and easily justified expansions.
- **No-code/low-code systems and computational notebook features.** These seem ideal too, but they cause both classes of problems above and worse ones. You lose the ability to arbitrarily rearrange your thoughts, because your links and cards now mean something beyond simple data. The result can be as striking as an infinite canavas (I even had links animate to show you the data-flow directly), but in my attempts it wasn't useful, just looked cool.

None of these experiments were pointless. Each revealed insights I didn't have before and taught me something about software design.

Suite Planner, Suite Budget, and the surrounding tooling (Suite Start and Suite Sync) came from realizing I can't fit all of these application types onto a canvas interface. I tried, and hit the the third design wall mentioned above. It was too complex, too deep, and too over-engineered to be functional and usable, let alone shippable.

So the applications are split into three that match their domains. A canvas is a thinking and research tool. A planner is a task, project management, and calendaring tool. A budget is a budgeting tool. I plan to experiment with integrations (embedding your calendar or budget into your canvas, or attaching your canvas to your calendar or budget, for example), but those features need to be considered deeply to actually be useful.

In the end, you should have a canvas, a planner, and a budget: all simple and easy to use, all with integrated and easy-to-run sync and update services, and none of them requiring you to connect to a centralized server or cloud service to use, at all. That's what will make Suite pretty sweet.

---

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

## Working on the whole suite

The hub, the sync server and the three apps are developed together from
[`suite-dev`](https://github.com/mr-rogers-neighborhood/suite-dev), which assumes the repositories are
cloned side by side. It stages the real binaries, runs the hub and the sync server together, seeds a
workspace, and owns the cross-app e2e suite. `pnpm preflight` there says what is missing.

## Your file

- Budgets live in `~/Documents/Suite/Budget`, the suite's file-location convention, with the daily
  backups beside them under `.backups/`. The library index (`library.json`) and `recovered/` stay in
  the application directory, because they describe this machine rather than the documents.
  `SUITE_BUDGET_LIBRARY` and `SUITE_BUDGET_DATA` move the two roots for a test or a portable install.
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
