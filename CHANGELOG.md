# Changelog

Written for people, not commits: what you can do now that you could not before, and what changed
underneath enough to matter.

## [Unreleased]

No changes yet.

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
