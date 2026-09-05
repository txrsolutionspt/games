/*
 * e2e-selection-and-search.js — selecting an object (sidebar highlight +
 * popup), the ephemeral measure tool (never saved), and the unified search
 * bar (your own objects + mocked geocoding results in one list).
 *
 * Run: node tests/e2e-selection-and-search.js
 */
"use strict";
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions } = require("./helpers.js");

const PORT = 8204;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, section, report } = makeReporter("e2e-selection-and-search");

(async () => {
  const server = await startServer(PORT);
  const browser = await chromium.launch(launchOptions());

  section("selecting an object highlights it in the sidebar and opens its popup");
  {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const mapBox = await page.locator("#map").boundingBox();

    await page.click("#add-button");
    await page.click('[data-add="point"]');
    await page.mouse.click(mapBox.x + 200, mapBox.y + 300);
    await page.waitForTimeout(150);
    await page.fill("#editor-name", "Selected Point");
    await page.click("#editor-save");
    await page.waitForTimeout(200);

    // Creating it already selects it — deselect by clicking empty space,
    // then re-select it via the sidebar to check that path too.
    await page.mouse.click(mapBox.x + 900, mapBox.y + 700);
    await page.waitForTimeout(150);
    check("clicking empty map space closes the popup", (await page.locator(".feature-popup").count()) === 0);

    await page.click("#sidebar-toggle-button").catch(() => {});
    await page.waitForTimeout(200);
    await page.locator("#object-list .object-list-item", { hasText: "Selected Point" }).click();
    await page.waitForTimeout(200);

    check(
      "selecting from the sidebar marks that row selected",
      await page.locator("#object-list .object-list-item", { hasText: "Selected Point" }).evaluate((el) => el.classList.contains("selected"))
    );
    check("selecting from the sidebar opens its popup", (await page.locator(".feature-popup", { hasText: "Selected Point" }).count()) > 0);
    await page.close();
  }

  section("measure tool is ephemeral (never saved)");
  {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const mapBox = await page.locator("#map").boundingBox();

    const countObjects = () =>
      page.evaluate(() => {
        const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
        const stored = JSON.parse(localStorage.getItem(`map-editor-data-v1:${mapId}`) || '{"objects":[]}');
        return stored.objects.length;
      });

    const before = await countObjects();

    await page.click("#add-button");
    await page.click('[data-add="measure"]');
    await page.mouse.click(mapBox.x + 300, mapBox.y + 400);
    await page.waitForTimeout(120);
    await page.mouse.click(mapBox.x + 600, mapBox.y + 400);
    await page.waitForTimeout(120);
    const hintText = await page.locator("#drawing-hint-text").innerText();
    check("the measure hint shows a live distance", /📏/.test(hintText), hintText);

    await page.click("#drawing-cancel"); // "Done"
    await page.waitForTimeout(150);
    check("the hint disappears after Done", !(await page.locator("#drawing-hint").isVisible()));

    const after = await countObjects();
    check("measuring never creates a saved object", after === before, `before=${before} after=${after}`);
    await page.close();
  }

  section("unified search: your objects + mocked geocoding");
  {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await page.route("https://nominatim.openstreetmap.org/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ display_name: "Farmville, Somewhere", lon: "10", lat: "20" }]),
      })
    );
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const mapBox = await page.locator("#map").boundingBox();

    await page.click("#add-button");
    await page.click('[data-add="point"]');
    await page.mouse.click(mapBox.x + 300, mapBox.y + 300);
    await page.waitForTimeout(150);
    await page.click('#editor-category-grid [data-category="water"]');
    await page.fill("#editor-name", "Well Number One");
    await page.click("#editor-save");
    await page.waitForTimeout(200);

    await page.fill("#search-input", "well");
    await page.waitForTimeout(150);
    check(
      "typing finds a matching saved object",
      (await page.locator("#search-results button", { hasText: "Well Number One" }).count()) > 0
    );

    await page.waitForTimeout(500); // let the mocked geocoding request resolve too
    check(
      "the same results list also includes a geocoding (place) result",
      (await page.locator("#search-results", { hasText: "Farmville" }).count()) > 0
    );

    await page.click("#search-results button", { hasText: "Well Number One" });
    await page.waitForTimeout(250);
    check(
      "clicking a search result for your own object opens its popup",
      (await page.locator(".feature-popup", { hasText: "Well Number One" }).count()) > 0
    );
    await page.close();
  }

  await browser.close();
  server.close();
  process.exit(report());
})().catch((err) => {
  console.error("TEST FAILED", err);
  process.exit(1);
});
