/*
 * e2e-sidebar-sort-filter.js — drives the real app to check the sidebar's
 * sort (Default/Name/Category/Nearest to me) and filter (by category)
 * controls: drawing objects across categories, reordering them via each
 * sort mode, narrowing the list via the category filter, and confirming
 * the filter's option list only ever offers categories actually in use
 * (mocking geolocation for the "Nearest to me" sort).
 *
 * Run: node tests/e2e-sidebar-sort-filter.js
 */
"use strict";
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions, freshContext } = require("./helpers.js");

const PORT = 8210;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, section, report } = makeReporter("e2e-sidebar-sort-filter");

async function drawPoint(page, mapBox, x, y, name, category) {
  await page.click("#add-button");
  await page.click('[data-add="point"]');
  await page.mouse.click(mapBox.x + x, mapBox.y + y);
  await page.waitForTimeout(200);
  await page.fill("#editor-name", name);
  await page.click(`#editor-category-grid [data-category="${category}"]`);
  await page.click("#editor-save");
  await page.waitForTimeout(250);
}

(async () => {
  const server = await startServer(PORT);
  const browser = await chromium.launch(launchOptions());
  const context = await freshContext(browser, {
    viewport: { width: 1280, height: 800 },
    geolocation: { latitude: 40.0, longitude: -75.0 },
    permissions: ["geolocation"],
  });
  const page = await context.newPage();
  const errors = trackErrors(page);

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const mapBox = await page.locator("#map").boundingBox();

  section("draw objects across categories");
  {
    await drawPoint(page, mapBox, mapBox.width / 2, mapBox.height / 2, "Charlie Water", "water");
    await drawPoint(page, mapBox, mapBox.width / 2 + 150, mapBox.height / 2, "Alpha House", "house");
    await drawPoint(page, mapBox, mapBox.width / 2 + 300, mapBox.height / 2, "Bravo Water", "water");

    await page.click("#sidebar-toggle-button").catch(() => {});
    await page.waitForTimeout(200);

    check("the sort control renders", (await page.locator("#sidebar-sort").count()) === 1);
    check("the filter control renders", (await page.locator("#sidebar-filter").count()) === 1);

    const names = await page.locator("#object-list .object-list-item .name").allInnerTexts();
    check(
      "all 3 drawn objects appear",
      names.includes("Charlie Water") && names.includes("Alpha House") && names.includes("Bravo Water"),
      JSON.stringify(names)
    );
  }

  section("sort: Name (A-Z)");
  {
    await page.selectOption("#sidebar-sort", "name");
    await page.waitForTimeout(150);
    const names = await page.locator("#object-list .object-list-item .name").allInnerTexts();
    const ours = names.filter((n) => ["Charlie Water", "Alpha House", "Bravo Water"].includes(n));
    check(
      "our objects appear in alphabetical order",
      JSON.stringify(ours) === JSON.stringify(["Alpha House", "Bravo Water", "Charlie Water"]),
      JSON.stringify(ours)
    );
  }

  section("filter: by category");
  {
    const optionValues = await page
      .locator("#sidebar-filter option, #sidebar-filter optgroup option")
      .evaluateAll((els) => els.map((el) => el.value));
    check("the filter offers the Point:water category", optionValues.includes("Point:water"), JSON.stringify(optionValues));
    check("the filter offers the Point:house category", optionValues.includes("Point:house"), JSON.stringify(optionValues));

    await page.selectOption("#sidebar-filter", "Point:water");
    await page.waitForTimeout(150);
    const names = await page.locator("#object-list .object-list-item .name").allInnerTexts();
    check(
      "only the water objects show",
      names.includes("Charlie Water") && names.includes("Bravo Water") && !names.includes("Alpha House"),
      JSON.stringify(names)
    );

    await page.selectOption("#sidebar-filter", "all");
    await page.waitForTimeout(150);
  }

  section("sort: Category");
  {
    await page.selectOption("#sidebar-sort", "category");
    await page.waitForTimeout(150);
    const names = await page.locator("#object-list .object-list-item .name").allInnerTexts();
    const ours = names.filter((n) => ["Charlie Water", "Alpha House", "Bravo Water"].includes(n));
    const houseIndex = ours.indexOf("Alpha House");
    const waterIndices = [ours.indexOf("Bravo Water"), ours.indexOf("Charlie Water")];
    check("House sorts before Water (alphabetical category label)", houseIndex < Math.min(...waterIndices), JSON.stringify(ours));
  }

  section("sort: Nearest to me (geolocation mocked)");
  {
    const bravo = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      const stored = JSON.parse(localStorage.getItem(`map-editor-data-v1:${mapId}`));
      return stored.objects.find((f) => f.properties.name === "Bravo Water").geometry.coordinates;
    });
    // Pin the mocked position a hair from Bravo Water's own coordinates so
    // the expected nearest-first order is deterministic regardless of
    // where the map itself happened to be centered when these were drawn.
    await context.setGeolocation({ latitude: bravo[1] + 0.0001, longitude: bravo[0] + 0.0001 });

    await page.selectOption("#sidebar-sort", "nearest");
    await page.waitForTimeout(500);
    const names = await page.locator("#object-list .object-list-item .name").allInnerTexts();
    const ours = names.filter((n) => ["Charlie Water", "Alpha House", "Bravo Water"].includes(n));
    check("the object closest to the mocked position sorts first", ours[0] === "Bravo Water", JSON.stringify(ours));
  }

  section("filter option list tracks what's actually on the map");
  {
    await page.selectOption("#sidebar-sort", "default");
    await page.selectOption("#sidebar-filter", "all");
    await page.waitForTimeout(150);

    await page.locator("#object-list .object-list-item", { hasText: "Alpha House" }).click();
    await page.waitForTimeout(200);
    await page.click('.feature-popup [data-action="delete"]');
    await page.waitForTimeout(150);
    await page.click("#confirm-delete");
    await page.waitForTimeout(250);

    const optionValues = await page
      .locator("#sidebar-filter option, #sidebar-filter optgroup option")
      .evaluateAll((els) => els.map((el) => el.value));
    check("Point:house drops out once nothing uses it anymore", !optionValues.includes("Point:house"), JSON.stringify(optionValues));
  }

  check("no unexpected console/page errors across the whole flow", errors.relevant().length === 0, errors.relevant().join(" | "));
  check("fatal error banner never appeared", !(await page.locator("#fatal-error-banner").isVisible()));

  await browser.close();
  server.close();
  process.exit(report());
})().catch((err) => {
  console.error("TEST FAILED", err);
  process.exit(1);
});
