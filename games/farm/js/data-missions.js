// Educational missions — data-driven per PLAN.md §5/§12. Each mission
// listens for an event emitted by simulation/economy (see missions.js),
// counts matching occurrences, and on completion awards coins and shows a
// short "learned" explainer. name/title/description/learned strings are
// plain English that also serve as the i18n fallback (see js/i18n.js) via
// keys 'mission.<id>.title' / 'mission.<id>.description' / 'mission.<id>.learned'.

const MISSIONS = [
  {
    id: 'first-plant',
    title: 'Prepare Your First Plot',
    description: 'Plant any crop on an empty plot.',
    trigger: 'plant',
    match: {},
    count: 1,
    reward: { coins: 5 },
    learned: 'Every crop starts as a tiny seed planted in prepared soil.'
  },
  {
    id: 'first-wheat',
    title: 'Grow Your First Wheat',
    description: 'Harvest 1 wheat.',
    trigger: 'harvest',
    match: { crop: 'wheat' },
    count: 1,
    reward: { coins: 10 },
    learned: 'Wheat takes time to grow — that time is part of why food takes work to produce.'
  },
  {
    id: 'carrot-patch',
    title: 'Carrot Patch',
    description: 'Harvest 10 carrots.',
    trigger: 'harvest',
    match: { crop: 'carrot' },
    count: 10,
    reward: { coins: 20 },
    learned: 'Carrots grow quickly, but it still takes many plantings to gather a big harvest.'
  },
  {
    id: 'chicken-chores',
    title: 'Chicken Chores',
    description: 'Feed a chicken.',
    trigger: 'feedAnimal',
    match: { animal: 'chicken' },
    count: 1,
    reward: { coins: 10 },
    learned: 'Chickens need food, water and a safe coop to stay healthy and lay eggs.'
  },
  {
    id: 'egg-collector',
    title: 'Egg Collector',
    description: 'Collect 3 eggs.',
    trigger: 'collectAnimal',
    match: { item: 'egg' },
    count: 3,
    reward: { coins: 15 },
    learned: 'Collecting eggs regularly gives hens room to lay more.'
  },
  {
    id: 'grain-to-flour',
    title: 'From Grain to Flour',
    description: 'Turn wheat into flour at the Mill.',
    trigger: 'process',
    match: { recipe: 'flour' },
    count: 1,
    reward: { coins: 15 },
    learned: 'Milling crushes dry wheat grain into fine, powdery flour.'
  },
  {
    id: 'bake-bread',
    title: 'Bake Some Bread',
    description: 'Bake bread at the Bakery.',
    trigger: 'process',
    match: { recipe: 'bread' },
    count: 1,
    reward: { coins: 20 },
    learned: 'Flour, water and heat combine to bake fresh bread.'
  },
  {
    id: 'right-season',
    title: 'Right Crop, Right Season',
    description: 'Plant a crop that grows well in the current season.',
    trigger: 'plant',
    match: { inSeason: true },
    count: 1,
    reward: { coins: 10 },
    learned: 'Planting a crop in its right season gives it the weather it grows best in.'
  },
  {
    id: 'quarry-work',
    title: 'Quarry Work',
    description: 'Mine 1 stone from a mountain.',
    trigger: 'mine',
    match: {},
    count: 1,
    reward: { coins: 10 },
    learned: 'Quarries dig stone and minerals out of mountainsides — real builders use it for walls and foundations.'
  }
];

if (typeof module === 'object' && module.exports) {
  module.exports = MISSIONS;
}
