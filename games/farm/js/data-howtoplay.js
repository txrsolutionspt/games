// "How to Play" reference — ROADMAP.md's in-game reference entry, PLAN.md
// §12. A persistent, always-available reference to the core mechanics,
// opened via the ℹ️ button in the HUD rail — distinct from
// data-whatsnew.js (release notes, shown once per update) and the
// first-run tutorial (tutorial.js, plays once and only covers
// plant→water→harvest). A returning player (or a parent) can reopen this
// anytime to answer "how do I do X again?" without hunting through menus.
//
// name/educational-style `fallback` strings double as the built-in
// English text for i18n (see js/i18n.js), same as every other data-*.js
// file, via each item's own `key`.
const HOW_TO_PLAY = [
  { icon: '🌱', key: 'howtoplay.planting', fallback: 'Tap Plant, choose a crop, then tap an empty soil plot. Water it a few times while it grows, then tap Harvest once it sparkles.' },
  { icon: '🐔', key: 'howtoplay.animals', fallback: 'Tap Animals to place a chicken, cow, sheep, goat or pig on pasture. Feed and water them, then collect what they produce once they are ready.' },
  { icon: '🏗️', key: 'howtoplay.buildings', fallback: 'Tap Build to place a processing building on soil, like a Mill or Bakery. Tap it to turn raw ingredients into something more valuable, like wheat into flour into bread.' },
  { icon: '🌦️', key: 'howtoplay.seasons', fallback: 'The season changes every few days and affects which crops grow best. Rainy days water your growing crops for free.' },
  { icon: '🛒', key: 'howtoplay.market', fallback: 'Tap the shop icon anytime to sell whatever is in your inventory for coins.' },
  { icon: '🔒', key: 'howtoplay.expand', fallback: 'Half your farm starts unlocked. Tap a locked, grayed-out plot to buy it with coins — the closer to home, the cheaper it is.' }
];

if (typeof module === 'object' && module.exports) {
  module.exports = { HOW_TO_PLAY: HOW_TO_PLAY };
}
