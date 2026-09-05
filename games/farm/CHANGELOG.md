# Changelog

Player-facing summary of what changed in each released version (`js/version.js`'s
`APP_VERSION`, shown in Settings). Internal-only churn (refactors, test
scripts, an in-progress change that got reverted before ever shipping) is
left out — this is a record of what changed for someone actually playing,
not a full commit log (see git history / `PLAN.md` for that).

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
