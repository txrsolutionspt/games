// Season/weather tables — data-driven per PLAN.md §5.
// Weather for a given in-game day is picked deterministically (see
// simulation.js weatherForDay) from these per-season weights, so it never
// needs to be stored in the save file. A rainy day auto-waters every
// planted crop once, teaching "rain is water too" without punishing the
// player on sunny/cloudy days — they just do not get free water that day.

const SEASONS = ['spring', 'summer', 'fall', 'winter'];

const WEATHER_TABLE = {
  spring: { sunny: 0.4, rainy: 0.4, cloudy: 0.2 },
  summer: { sunny: 0.6, rainy: 0.2, cloudy: 0.2 },
  fall: { sunny: 0.3, rainy: 0.3, cloudy: 0.4 },
  winter: { sunny: 0.3, rainy: 0.1, cloudy: 0.6 }
};

const WEATHER_ICON = { sunny: '☀️', rainy: '🌧️', cloudy: '☁️' };
const SEASON_ICON = { spring: '🌱', summer: '☀️', fall: '🍂', winter: '❄️' };

if (typeof module === 'object' && module.exports) {
  module.exports = { SEASONS: SEASONS, WEATHER_TABLE: WEATHER_TABLE, WEATHER_ICON: WEATHER_ICON, SEASON_ICON: SEASON_ICON };
}
