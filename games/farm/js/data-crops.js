// Crop definitions — data-driven per PLAN.md §5. Adding a crop means adding
// an entry here; no rendering/input/simulation code needs to change.
//
// waterRequired is a *count*, not a timer: the player can water the crop
// that many times whenever they like during growth. Watering enough times
// before it matures yields a full harvest; watering less still yields a
// (smaller) harvest — neglect never destroys the crop.
//
// name/educational are shown as-is in English, and double as the built-in
// English fallback for i18n (see js/i18n.js) via keys 'crop.<id>.name' /
// 'crop.<id>.fact'.

const CROPS = [
  {
    id: 'wheat',
    name: 'Wheat',
    icon: '🌾',
    seedCost: 5,
    growthStages: 4,
    growTimeSec: 45,
    waterRequired: 2,
    season: ['spring', 'summer', 'fall'],
    harvestYield: { item: 'wheat_grain', qty: 3 },
    sellPrice: 3,
    educational: 'Wheat is a grass. Its grain is ground into flour to make bread.'
  },
  {
    id: 'carrot',
    name: 'Carrot',
    icon: '🥕',
    seedCost: 4,
    growthStages: 3,
    growTimeSec: 30,
    waterRequired: 1,
    season: ['spring', 'fall', 'winter'],
    harvestYield: { item: 'carrot', qty: 4 },
    sellPrice: 2,
    educational: 'Carrots are roots — the part that grows underground, soaking up water and nutrients from the soil.'
  },
  {
    id: 'tomato',
    name: 'Tomato',
    icon: '🍅',
    seedCost: 8,
    growthStages: 4,
    growTimeSec: 60,
    waterRequired: 3,
    season: ['summer'],
    harvestYield: { item: 'tomato', qty: 3 },
    sellPrice: 5,
    educational: 'Tomatoes need plenty of sunlight and water before they are ready to become sauce.'
  },
  {
    id: 'corn',
    name: 'Corn',
    icon: '🌽',
    seedCost: 7,
    growthStages: 4,
    growTimeSec: 70,
    waterRequired: 2,
    season: ['summer', 'fall'],
    harvestYield: { item: 'corn', qty: 3 },
    sellPrice: 4,
    educational: 'Corn is a tall grass that grows quickly in warm summer weather.'
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    icon: '🍓',
    seedCost: 6,
    growthStages: 3,
    growTimeSec: 40,
    waterRequired: 2,
    season: ['spring', 'summer'],
    harvestYield: { item: 'strawberry', qty: 4 },
    sellPrice: 4,
    educational: 'Strawberries grow close to the ground and ripen quickly once the weather warms up.'
  },
  {
    id: 'potato',
    name: 'Potato',
    icon: '🥔',
    seedCost: 5,
    growthStages: 3,
    growTimeSec: 50,
    waterRequired: 1,
    season: ['spring', 'fall', 'winter'],
    harvestYield: { item: 'potato', qty: 4 },
    sellPrice: 3,
    educational: 'Potatoes grow underground and store extra energy for the plant — that is why they are so filling.'
  }
];

const CROPS_BY_ID = {};
CROPS.forEach(function (c) { CROPS_BY_ID[c.id] = c; });

if (typeof module === 'object' && module.exports) {
  module.exports = { CROPS: CROPS, CROPS_BY_ID: CROPS_BY_ID };
}
