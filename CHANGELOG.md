# Changelog

Written for people, not commits: what you can do now that you could not before, and what changed
underneath enough to matter.

## [Unreleased]

No changes yet.

## [0.2.2] - 2026-11-08

### Changed

- The start screen is the shared one, the same centred card as Canvas and Planner. Import is a plain
  button because Budget has one import path: a bank export.
- The theme picker and the privacy line moved into the card's footer, where they sit under the
  actions instead of competing with them.
- Space and type come from `@suite/theme` tokens.

## [0.2.1] - 2026-11-07

### Changed

- The interface wears the Budget glyph now, on the suite's accent tile, instead of a gradient
  square.
- **The theme control is on the first screen.** It was in the sidebar, which does not exist
  until a budget is open, so the one screen everybody sees had no way to change the theme.

### Fixed

- The privacy claim uses the suite's shared sentence: "Local file. No account, no server, no
  telemetry."

## [0.2.0] - 2026-11-07

### Added

- **Three colour themes, each in light and dark.** Suite, Solarized in its two official variants,
  and Warm. The sidebar offers a Theme list and a Brightness toggle, and the choice is remembered.
- **A light mode that works.** The app could follow the desktop before, but had no way to be told
  to.

### Changed

- The interface draws from the suite's shared palette. The chart series and the money colours are
  theme roles now, so a preset decides them together with the rest of the interface.

### Fixed

- A primary button's label was hardcoded near-black, tuned to this app's own green — unreadable
  on several presets.
- A `Toast` component that was never rendered has been removed.

## [0.1.2] - 2026-11-07

### Fixed

- The app's mark is where the package looks for it. 0.1.0 shipped Electron's default icon because
  the artwork was in `build/` and this app's build resources are `resources/`.
- The window's desktop name carries the `.desktop` suffix, so a panel groups the running window with
  its menu entry instead of drawing a second, generic icon.

## [0.1.1] - 2026-11-07

### Added

- The app has its own icon, on the window and in the menu entry the system draws.

### Changed

- An update now arrives from Suite Start. An app the hub launched leaves its own update check
  alone; a copy run from a folder keeps its own updater.
- The update report is written even on a first launch, so the hub can say "not checked" rather than
  showing a stale answer.

### Fixed

- One artifact-name shape across the suite, with no spaces in it.

## [0.1.0] - 2026-11-06

### Added

- First packaged release: an envelope budget in a file you own.
