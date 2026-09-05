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
