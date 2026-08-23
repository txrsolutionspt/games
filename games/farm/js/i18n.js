// Translation lookup — PLAN.md §6. Every player-facing string in the UI
// goes through I18N.t(key, fallback) rather than being written directly
// into render/input/hud/modals code.
//
// UI-chrome strings (buttons, modal titles, toasts, ...) live only in
// LOCALE_EN / LOCALE_PT (js/locale-en.js, js/locale-pt.js).
//
// Content strings (crop/animal/recipe names, educational facts, mission
// text) are NOT duplicated into locale-en.js: the plain English already
// written in data-crops.js/data-animals.js/data-recipes.js/data-missions.js
// doubles as the English fallback. Callers pass that text as `fallback`,
// e.g. I18N.t('crop.wheat.name', cropDef.name). locale-pt.js only needs to
// supply the keys it wants to override.

const I18N = (function () {
  let locale = 'en';

  function detectLocale() {
    const nav = (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages && navigator.languages[0]))) || 'en';
    return nav.toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en';
  }

  function setLocale(code) {
    locale = (code === 'pt') ? 'pt' : 'en';
  }

  function getLocale() {
    return locale;
  }

  function dictFor(code) {
    if (code === 'pt' && typeof LOCALE_PT !== 'undefined') return LOCALE_PT;
    if (typeof LOCALE_EN !== 'undefined') return LOCALE_EN;
    return {};
  }

  function t(key, fallback) {
    const dict = dictFor(locale);
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    if (locale !== 'en') {
      const en = dictFor('en');
      if (en && Object.prototype.hasOwnProperty.call(en, key)) return en[key];
    }
    return fallback != null ? fallback : key;
  }

  return { setLocale: setLocale, getLocale: getLocale, detectLocale: detectLocale, t: t };
})();
