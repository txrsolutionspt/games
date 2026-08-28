const ICON_SIZE = 32;

export function iconIdFor(categoryValue) {
  return `cat-icon-${categoryValue}`;
}

export const DEFAULT_ICON_ID = iconIdFor("__default__");

// MapLibre renders symbol text through its own glyph (PBF) font server, which
// typically only covers the fonts' declared Latin/etc. ranges — not emoji
// codepoints — so a "text-field" of "🏠" would likely render blank. Drawing
// the emoji onto a canvas and registering it as an image (the documented
// MapLibre pattern for custom marker icons) sidesteps the glyph server
// entirely: "icon-image" just draws a bitmap.
function renderEmojiIcon(emoji) {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.font = `${Math.round(ICON_SIZE * 0.75)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, ICON_SIZE / 2, ICON_SIZE / 2 + 1);
  return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

// map.addImage() doesn't survive map.setStyle() (same as sources/layers), so
// this needs to run again on every style.load, same as the overlay layers.
export function registerCategoryIcons(map, categories) {
  for (const { value, icon } of categories) {
    const id = iconIdFor(value);
    if (!map.hasImage(id)) {
      map.addImage(id, renderEmojiIcon(icon));
    }
  }

  if (!map.hasImage(DEFAULT_ICON_ID)) {
    map.addImage(DEFAULT_ICON_ID, renderEmojiIcon("📍"));
  }
}

// A "match" expression pairing every known category value with its icon
// image id, falling back to a default pin for anything else (legacy data,
// an empty category, a category from a set that's since changed).
export function categoryIconExpression(categories) {
  const pairs = [];
  for (const { value } of categories) {
    pairs.push(value, iconIdFor(value));
  }
  return ["match", ["get", "category"], ...pairs, DEFAULT_ICON_ID];
}
