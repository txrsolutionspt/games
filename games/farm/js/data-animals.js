// Animal definitions — data-driven per PLAN.md §5.
//
// needs.feedItemId points at a real harvested crop item (wheat_grain, the
// player's own wheat) rather than an abstract "feed" resource, so feeding
// animals is tied to crops the player actually grows.
//
// Neglecting an animal's feed/water only slows how often it produces
// (see farm-rules.js animalHappiness/animalProgress) — it never removes
// the animal or stops production outright.

const ANIMALS = [
  {
    id: 'chicken',
    name: 'Chicken',
    icon: '🐔',
    cost: 30,
    needs: { feedItemId: 'wheat_grain', feedPerCycleSec: 45, waterPerCycleSec: 45, shelter: 'coop' },
    produces: { item: 'egg', qty: 1, cycleSec: 40, sellPrice: 3 },
    educational: 'Chickens turn the wheat you grow into eggs — real farms feed animals what they grow.'
  },
  {
    id: 'cow',
    name: 'Cow',
    icon: '🐄',
    cost: 100,
    needs: { feedItemId: 'wheat_grain', feedPerCycleSec: 70, waterPerCycleSec: 70, shelter: 'barn' },
    produces: { item: 'milk', qty: 1, cycleSec: 80, sellPrice: 5 },
    educational: 'Cows eat grain and grass and turn it into milk, which can become butter or cheese.'
  },
  {
    id: 'sheep',
    name: 'Sheep',
    icon: '🐑',
    cost: 80,
    needs: { feedItemId: 'wheat_grain', feedPerCycleSec: 90, waterPerCycleSec: 90, shelter: 'barn' },
    produces: { item: 'wool', qty: 1, cycleSec: 100, sellPrice: 6 },
    educational: 'Sheep grow a woolly coat that can be sheared and spun into yarn for clothing.'
  },
  {
    id: 'goat',
    name: 'Goat',
    icon: '🐐',
    cost: 60,
    needs: { feedItemId: 'wheat_grain', feedPerCycleSec: 70, waterPerCycleSec: 70, shelter: 'barn' },
    produces: { item: 'goat_milk', qty: 1, cycleSec: 75, sellPrice: 6 },
    educational: 'Goats are hardy and will happily eat many different plants, which is why they are easy to raise on small farms.'
  },
  {
    id: 'pig',
    name: 'Pig',
    icon: '🐖',
    cost: 90,
    needs: { feedItemId: 'wheat_grain', feedPerCycleSec: 100, waterPerCycleSec: 100, shelter: 'barn' },
    produces: { item: 'truffle', qty: 1, cycleSec: 120, sellPrice: 9 },
    educational: 'Pigs have an excellent sense of smell and are sometimes trained to sniff out truffles hidden underground.'
  }
];

const ANIMALS_BY_ID = {};
ANIMALS.forEach(function (a) { ANIMALS_BY_ID[a.id] = a; });

if (typeof module === 'object' && module.exports) {
  module.exports = { ANIMALS: ANIMALS, ANIMALS_BY_ID: ANIMALS_BY_ID };
}
