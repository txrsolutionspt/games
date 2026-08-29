// Quarry (mountain resource) — PLAN.md §10/§17. Unlike crops/animals/
// buildings, a mountain tile needs no purchase or placement: every
// mountain is already a quarry, tap it to mine. One shared definition
// (not a list like CROPS/ANIMALS/BUILDINGS) since there's only one kind
// of quarry.
//
// name/educational double as the built-in English fallback for i18n (see
// js/i18n.js) via keys 'quarry.stone.name' / 'quarry.stone.fact'.

const QUARRY = {
  icon: '⛏️',
  cycleSec: 60,
  produces: { item: 'stone', qty: 1, sellPrice: 4 },
  name: 'Stone',
  educational: 'Quarries dig stone out of mountainsides — real builders use quarried stone for walls and foundations.'
};

if (typeof module === 'object' && module.exports) {
  module.exports = { QUARRY: QUARRY };
}
