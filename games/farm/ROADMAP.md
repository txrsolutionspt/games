# Roadmap

Feature backlog for Little Farm School — what's proposed or planned next,
not what's already shipped (see `CHANGELOG.md`) or how the game is built
today (see `PLAN.md`). This is the product-owner-style doc: where a new
feature idea gets written down, prioritized, and tracked until it's
either built or explicitly rejected.

**Keep this current** (per `CLAUDE.md`'s documentation rule): add an entry
when a feature idea comes up, however small; update its status as it
moves; delete its entry once shipped (it belongs in `CHANGELOG.md` by
then, not here). A roadmap nobody updates is worse than none — it makes
stale ideas look active.

## How to read this doc

- **Status** — `Idea` (raised, not committed to) · `Planned` (agreed, not
  started) · `In progress` (actively being built).
- **Priority** — `High` / `Medium` / `Low`, a rough value-vs-effort call,
  not a hard ranking. Re-judge it if circumstances change; don't treat it
  as fixed once written.
- One entry = one player-facing feature, not a task list. Implementation
  detail belongs in `PLAN.md` once it's built, not here.

## Planned

*(nothing currently — see Under consideration below)*

## Under consideration

### In-game "How to Play" reference
- **Priority**: Medium
- **Status**: Idea
- **What**: A persistent ℹ️ info button (HUD rail or Settings) opening a
  short, kid-friendly reference screen that covers the core mechanics in
  one place — planting/watering/harvesting, feeding animals, processing
  buildings, seasons/weather, the market, and buying more land. Distinct
  from what already exists: the first-run tutorial (`tutorial.js`) only
  plays once and only covers plant→water→harvest; the per-tile "i" info
  tooltip (§10/§12) only explains one crop/animal/recipe at a time, not
  the game as a whole.
- **Why**: A returning player (or a parent helping a kid, or anyone who
  rushed/skipped the tutorial) currently has no self-serve way to answer
  "how do I do X again?" without hunting through menus or re-discovering
  it by trial and error. A standing reference screen closes that gap
  without re-teaching anything already learned, in the same
  minimal-friction spirit as the rest of the UI.

### Second farm / biome
- **Priority**: Low
- **Status**: Idea
- **What**: A second farm plot with a different climate/terrain mix
  (e.g. more lakes, different crop set).
- **Why**: Long-term replay value once the first farm feels complete.
  Large enough in scope (new terrain rules, likely new content) that it
  should stay an idea until the core loop feels fully rounded out.

### Harder seasonal challenges
- **Priority**: Low
- **Status**: Idea
- **What**: Occasional season-linked events beyond the current
  sunny/rainy/cloudy weather roll — e.g. an early frost, a heat wave.
- **Why**: More texture to seasons beyond "some crops grow better here."
  Needs care to stay forgiving, per the game's no-punishing-failure tone
  (see `PLAN.md` §8's crop-yield design).

### Additional languages
- **Priority**: Low
- **Status**: Idea
- **What**: A third locale beyond English/Portuguese (`PLAN.md` §6 — the
  i18n system is designed to make this a drop-in addition).
- **Why**: Reach. No specific language requested yet; revisit if one is.

### Sprite art upgrade
- **Priority**: Low
- **Status**: Idea
- **What**: Replace the emoji/shape placeholder art with a commissioned
  isometric sprite sheet behind the same `render.js` drawing calls.
- **Why**: Visual polish ceiling — emoji reads as a placeholder past a
  certain point. Needs actual art assets (out of scope for a code-only
  session), so blocked on that, not on engineering effort.

### Haptic feedback
- **Priority**: Low
- **Status**: Idea
- **What**: `navigator.vibrate()` on tile taps, mobile only.
- **Why**: Small, cheap complement to the sound/motion "juice" already
  shipped (v1.0.3, v1.0.5). Low effort, low impact — good filler task,
  not worth prioritizing over content or expansion work.

## Rejected / explicitly not planned

Decided against, with reasoning, so it doesn't get silently re-proposed:

- **A "wrong action" sound/buzzer.** Deliberately excluded when sound
  shipped (v1.0.5) — the game's tone is positive-reinforcement only; a
  blocked action already gets a toast, and a buzzer would cut against the
  forgiving, never-punishing design used throughout (see `PLAN.md` §12
  Sound, §8 crop yield).
