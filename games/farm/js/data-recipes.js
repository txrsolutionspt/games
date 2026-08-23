// Production recipes — data-driven per PLAN.md §5: inputs -> time -> output.
// Each recipe belongs to a building type; a building can only run one job
// at a time (a queue depth of 1), started by spending the inputs up front.

const BUILDINGS = [
  { id: 'mill', name: 'Mill', icon: '⚙️', cost: 40 },
  { id: 'bakery', name: 'Bakery', icon: '🍞', cost: 70 },
  { id: 'churn', name: 'Butter Churn', icon: '🧈', cost: 60 },
  { id: 'kitchen', name: 'Kitchen', icon: '🍲', cost: 65 }
];

const BUILDINGS_BY_ID = {};
BUILDINGS.forEach(function (b) { BUILDINGS_BY_ID[b.id] = b; });

const RECIPES = [
  {
    id: 'flour',
    building: 'mill',
    name: 'Grind Flour',
    inputs: [{ item: 'wheat_grain', qty: 3 }],
    timeSec: 20,
    output: { item: 'flour', qty: 1, sellPrice: 6 },
    educational: 'Millstones crush dry wheat grain into fine, powdery flour.'
  },
  {
    id: 'bread',
    building: 'bakery',
    name: 'Bake Bread',
    inputs: [{ item: 'flour', qty: 2 }],
    timeSec: 30,
    output: { item: 'bread', qty: 1, sellPrice: 14 },
    educational: 'Baking combines flour, water and heat to turn raw grain into fresh bread.'
  },
  {
    id: 'butter',
    building: 'churn',
    name: 'Churn Butter',
    inputs: [{ item: 'milk', qty: 2 }],
    timeSec: 25,
    output: { item: 'butter', qty: 1, sellPrice: 10 },
    educational: 'Churning shakes cream in milk until it clumps together into butter.'
  },
  {
    id: 'sauce',
    building: 'kitchen',
    name: 'Cook Tomato Sauce',
    inputs: [{ item: 'tomato', qty: 3 }],
    timeSec: 20,
    output: { item: 'tomato_sauce', qty: 1, sellPrice: 12 },
    educational: 'Cooking ripe tomatoes down with a little heat turns them into a rich sauce.'
  }
];

const RECIPES_BY_ID = {};
RECIPES.forEach(function (r) { RECIPES_BY_ID[r.id] = r; });

function recipesForBuilding(buildingId) {
  return RECIPES.filter(function (r) { return r.building === buildingId; });
}

if (typeof module === 'object' && module.exports) {
  module.exports = {
    BUILDINGS: BUILDINGS,
    BUILDINGS_BY_ID: BUILDINGS_BY_ID,
    RECIPES: RECIPES,
    RECIPES_BY_ID: RECIPES_BY_ID,
    recipesForBuilding: recipesForBuilding
  };
}
