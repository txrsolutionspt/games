# Sudoku — Feature Status

**Location:** `games/sudoku/` · **Last updated:** 2026-07-11

A quick reference for what's actually implemented vs. what's left, so follow-up
work doesn't have to re-derive it by reading the diff.

## ✅ Implemented

### Core engine (`engine.js`, `worker.js`)
- Bitmask backtracking solver with MRV heuristic (fast: <1ms–~200ms per puzzle).
- Deterministic generator with guaranteed unique solution (verified via
  solution-counting, capped at 2).
- Four difficulty tiers: Easy (40–46 clues), Medium (32–39), Hard (27–31),
  Expert (22–26). Removal prefers 180°-rotational symmetry, falling back to
  single-cell removal when a symmetric pair can't both be removed.
- Generation runs in a Web Worker so the UI thread never blocks; falls back to
  synchronous main-thread generation if `Worker` is unavailable.

### Gameplay (`game.js`)
- Tap-to-select, tap-to-input via bottom number pad.
- Notes/pencil mode (toggle, per-cell bitmask of candidates 1–9).
- Undo/redo (full history stack, including note changes and peer-note
  auto-clearing).
- Erase selected cell.
- Hints: reveals the correct value for the selected (or a random empty) cell,
  tracks hint count, shown in win summary.
- Timer with pause/resume, auto-pause on tab/visibility change.
- Conflict highlighting (red) for any row/col/box rule violation.
- Selected-cell, peer (row/col/box), and same-number highlighting.
- Number pad dims a digit once all 9 non-conflicting instances are placed.
- Win detection → stats update (played/completed/best time per difficulty) →
  win dialog.

### Persistence & PWA
- Full game state (board, notes, undo history, elapsed time, hints used,
  selection) persists to `localStorage` and resumes on reload.
- Settings (high-contrast, highlight-same, auto-clear-notes, show-timer) and
  per-difficulty stats persist separately.
- `manifest.json` + service worker (`sw.js`) for offline load and
  "Add to Home Screen" installability. Verified: full reload with network
  disabled still renders and is playable.
- Generated PNG icons (192, 512, maskable 512, apple-touch-icon).

### UI / accessibility
- CSS Grid 9×9 board, bold 3×3 subgrid borders, `aspect-ratio: 1/1`, scales to
  viewport width.
- Thumb-zone number pad + toolbar pinned at the bottom of the screen.
- High-contrast mode and automatic dark mode (`prefers-color-scheme`).
- Roving-tabindex keyboard navigation (arrow keys move selection, digits
  place/note, Backspace erases, N toggles notes, H hints, Ctrl+Z/Shift+Ctrl+Z
  undo/redo, P pauses).
- `aria-label` per cell (row/column/value/given/conflict state) and a live
  region for hint/win announcements.

### Testing performed
- Playwright smoke tests (mobile viewport) covering: placement, conflicts,
  notes, undo/redo, hint counter, pause overlay, high-contrast + dark themes,
  a full win via real number-pad clicks, localStorage persistence across
  reload, and an offline reload with the network disabled. All passed with no
  console errors. (Tests were run ad hoc during development, not committed as
  a repo test suite — see "Missing" below.)

## ❌ Missing / follow-up candidates

- **Analytics** — spec listed this as optional; not implemented at all (no
  anonymous duration/completion tracking).
- **Real screen-reader verification** — markup is semantic (`role="grid"`,
  `aria-label`, live region) but has not been manually tested with
  VoiceOver/TalkBack/NVDA. Likely needs `role="row"` wrapper elements for a
  fully spec-correct ARIA grid, which the current flat CSS Grid DOM doesn't
  have.
- **True minimal (17-clue) Expert puzzles** — reaching the theoretical minimum
  needs much more expensive search than a greedy symmetric digger. Expert is
  currently capped at 22–26 clues as a speed/difficulty tradeoff. A smarter
  digger (e.g. look-ahead removal, more restarts, or a precomputed puzzle
  bank) could push this lower.
- **No committed automated test suite** — only manual Playwright runs during
  development; nothing in-repo to catch regressions.
- **No mistake limit / "3 strikes" fail state** — conflicts are highlighted
  but never end the game.
- **No custom install prompt** — relies entirely on the browser's native
  "Add to Home Screen" UI; no captured `beforeinstallprompt` + in-app button.
- **No "update available" flow** — the service worker caches and updates
  silently; there's no toast/banner telling a returning user new content is
  ready and prompting a refresh.
- **No sound effects.**
- **No onboarding / "How to play"** screen for first-time users.
- **Limited large-screen/tablet/landscape optimization** — layout is capped
  at `max-width: 560px` and tuned for portrait phones; not deliberately
  designed for tablets or desktop windows.
- **Single-device only** — no account/cloud sync; progress is local to one
  browser's `localStorage`.
- **No colorblind-specific palette testing** — high-contrast mode exists but
  hasn't been validated against colorblindness simulators.
