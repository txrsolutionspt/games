// "What's New" entries shown in-game (Settings > What's New) — PLAN.md
// §12. Player-facing and deliberately short (one icon + one line per
// item), unlike CHANGELOG.md, which is the complete developer-facing
// record these are curated from — not every changelog entry is exciting
// enough for a kid to read about (e.g. "added a version number" isn't),
// so this list is a subset, not a mirror.
//
// name/educational-style `fallback` strings double as the built-in
// English text for i18n (see js/i18n.js), same as every other data-*.js
// file, via each item's own `key`.
const WHATS_NEW = [
  {
    version: '1.0.12',
    items: [
      { icon: '🛠️', key: 'whatsnew.1.0.12.0', fallback: 'Fixed a bug where Reset Game Data (and switching farms) could quietly not take effect after reloading.' }
    ]
  },
  {
    version: '1.0.11',
    items: [
      { icon: '🗺️', key: 'whatsnew.1.0.11.0', fallback: 'Farm expansion is back! Half the field starts unlocked, and you can now buy your way into the rest with coins — cheap at first, pricier the farther out you go.' }
    ]
  },
  {
    version: '1.0.10',
    items: [
      { icon: '🍎', key: 'whatsnew.1.0.10.0', fallback: 'New: an Apple Tree that keeps producing fruit every season without needing to be replanted, plus two new animals — Goats and Pigs (which sniff out truffles!).' }
    ]
  },
  {
    version: '1.0.9',
    items: [
      { icon: '🧶', key: 'whatsnew.1.0.9.0', fallback: 'Sheep wool now has a use! Spin it into yarn at a new Loom, then sew that yarn into clothing at a new Tailor.' }
    ]
  },
  {
    version: '1.0.8',
    items: [
      { icon: '🎨', key: 'whatsnew.1.0.8.0', fallback: 'The farm looks a little more three-dimensional now: shaded tiles and soft shadows on crops, animals and buildings.' },
      { icon: '⚡', key: 'whatsnew.1.0.8.1', fallback: 'Tapping Plant, Animals, or Build now pops your choices open right next to the button — faster, and you can switch between them without closing anything first.' }
    ]
  },
  {
    version: '1.0.7',
    items: [
      { icon: '🆕', key: 'whatsnew.1.0.7.0', fallback: 'This "What\'s New" screen! Check back here after an update to see what changed.' }
    ]
  },
  {
    version: '1.0.6',
    items: [
      { icon: '👋', key: 'whatsnew.1.0.6.0', fallback: 'A "Welcome back!" message now shows you what grew or finished while you were away.' }
    ]
  },
  {
    version: '1.0.5',
    items: [
      { icon: '🔊', key: 'whatsnew.1.0.5.0', fallback: 'Added sound! Little chimes for planting, watering, harvesting and more — turn it off anytime in Settings.' }
    ]
  },
  {
    version: '1.0.3',
    items: [
      { icon: '✨', key: 'whatsnew.1.0.3.0', fallback: 'A clearer, more colorful look: labeled buttons, bigger touch targets, and bouncier animations.' }
    ]
  },
  {
    version: '1.0.2',
    items: [
      { icon: '🌊', key: 'whatsnew.1.0.2.0', fallback: 'Lakes now water nearby crops automatically, every day, for free.' },
      { icon: '⛏️', key: 'whatsnew.1.0.2.1', fallback: 'Mountains can be mined for stone — buildings now need some stone alongside coins.' }
    ]
  }
];

if (typeof module === 'object' && module.exports) {
  module.exports = { WHATS_NEW: WHATS_NEW };
}
