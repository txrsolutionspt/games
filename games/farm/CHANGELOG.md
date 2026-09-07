# Changelog

Player-facing summary of what changed in each released version (`js/version.js`'s
`APP_VERSION`, shown in Settings). Internal-only churn (refactors, test
scripts, an in-progress change that got reverted before ever shipping) is
left out — this is a record of what changed for someone actually playing,
not a full commit log (see git history / `PLAN.md` for that).

## 1.0.12
- Fixed a bug where Reset Game Data (and switching/creating/deleting a
  farm) could silently fail to take effect — your old progress could
  come right back after the page reloaded.

## 1.0.11
- Farm expansion is back: half the field starts unlocked and ready to
  play, and the rest can now be bought plot by plot with coins, starting
  cheap and growing pricier the farther out you go.

## 1.0.10
- New content: an Apple Tree crop that keeps producing fruit season after
  season instead of needing to be replanted after each harvest, plus two
  new animals — Goats (goat's milk) and Pigs (truffles, sniffed out from
  underground).

## 1.0.9
- Wool now has somewhere to go: a new Loom building spins it into yarn,
  and a new Tailor sews that yarn into clothing to sell — a longer
  version of the same "raw material becomes something useful" chain as
  wheat → flour → bread.

## 1.0.8
- The farm looks a little more three-dimensional now: tiles have a soft
  shaded look instead of flat color, and crops/animals/buildings cast a
  gentle shadow.
- Tapping Plant, Animals, or Build now pops open your choices right next
  to the button instead of a full-screen menu — faster, and you can
  switch straight from one to another without closing anything first.

## 1.0.7
- Added a "What's New" screen in Settings, with a small dot on the
  Settings button when there's something you haven't seen yet.

## 1.0.6
- Added a "Welcome back!" popup on reopening the game: if crops finished
  growing, animal products became ready, or a recipe completed while you
  were away, it tells you right away instead of leaving you to notice.

## 1.0.5
- Added sound: a short chime for planting, watering, harvesting, feeding,
  collecting, coins going up or down, and completing a mission. Off by
  default until your first tap (browsers require that), toggleable
  anytime via a new Sound On/Off button in Settings.

## 1.0.3
- Clearer, more kid-friendly interface: every icon button (Shop, Save,
  Full screen, Settings) now has a readable label under it, touch targets
  are bigger, and buttons/modals/the coin counter now pop and bounce
  instead of just appearing.

## 1.0.2
- Lakes now water nearby crops automatically, once a day, for free.
- Mountains can be mined for stone (tap to start, tap again once ready to
  collect); buildings now cost some stone alongside coins.

## 1.0.1
- Added a version number to Settings, so you can always tell which
  release you're playing.

## 1.0.0 and earlier
The original game: a 60×60 farm, 6 crops, 3 animals, 4 processing
buildings with matching recipes, an educational mission line with
English/Portuguese explanations, a first-run tutorial, seasons and
weather, and local save slots — no accounts, nothing leaves your device
(see `PRIVACY.md`). See `PLAN.md` for the full architecture.
