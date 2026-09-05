/*
 * e2e-core-objects.js — drives the real app: drawing a point, line, and
 * area through the real UI (click/drag on the canvas, not synthetic
 * events), the icon-grid category picker, the feature popup's
 * coordinate/length/area readout, editing a saved object's properties,
 * and deleting it.
 *
 * Run: node tests/e2e-core-objects.js
 */
"use strict";
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions } = require("./helpers.js");

const PORT = 8202;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, section, report } = makeReporter("e2e-core-objects");

(async () => {
  const server = await startServer(PORT);
  const browser = await chromium.launch(launchOptions());
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = trackErrors(page);

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const mapBox = await page.locator("#map").boundingBox();

  section("draw a point, with the category icon-grid");
  {
    await page.click("#add-button");
    await page.click('[data-add="point"]');
    await page.mouse.click(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2);
    await page.waitForTimeout(200);

    const gridButtons = await page.locator("#editor-category-grid .category-option").count();
    check("the category picker renders as an icon grid", gridButtons > 1, `buttons=${gridButtons}`);

    await page.click('#editor-category-grid [data-category="water"]');
    await page.fill("#editor-name", "Well");
    await page.click("#editor-save");
    await page.waitForTimeout(300);

    const saved = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      const stored = JSON.parse(localStorage.getItem(`map-editor-data-v1:${mapId}`));
      return stored.objects.find((f) => f.properties.name === "Well");
    });
    check("the point saved with the picked category", saved?.properties.category === "water");
    check("the popup shows the category's icon + label", (await page.locator(".feature-popup .category").innerText()).includes("Water"));
    check("the popup shows coordinates for a point", /📍/.test(await page.locator(".feature-popup .meta").innerText()));
  }

  section("draw a line, check length readout");
  {
    await page.click("#add-button");
    await page.click('[data-add="line"]');
    const p1 = { x: mapBox.x + 100, y: mapBox.y + 100 };
    const p2 = { x: mapBox.x + 300, y: mapBox.y + 100 };
    // One plain click per vertex (including the last), then a *separate*
    // dblclick at that same last point purely to finish — combining
    // "add the final point" and "finish" into one dblclick at a NEW
    // location is unreliable (the browser's own double-click timing can
    // swallow the second point).
    await page.mouse.click(p1.x, p1.y);
    await page.waitForTimeout(150);
    await page.mouse.click(p2.x, p2.y);
    await page.waitForTimeout(150);
    await page.mouse.dblclick(p2.x, p2.y);
    await page.waitForTimeout(150);
    await page.fill("#editor-name", "Test Trail");
    await page.click('#editor-category-grid [data-category="trail"]');
    await page.click("#editor-save");
    await page.waitForTimeout(300);

    const metaLines = await page.locator(".feature-popup .meta").allInnerTexts();
    check("the popup shows a distance readout for a line", metaLines.some((t) => /📏/.test(t)), JSON.stringify(metaLines));
  }

  section("draw an area, check area readout");
  {
    await page.click("#add-button");
    await page.click('[data-add="polygon"]');
    // Kept well below y=200: the drawing-hint banner sits centered at the
    // top of the map and widens once it shows a point count + Finish/
    // Cancel buttons, so a vertex placed near its band (as an earlier
    // version of this test did, near the horizontal center) can land on
    // the banner instead of the map canvas.
    const p3 = { x: mapBox.x + 600, y: mapBox.y + 350 };
    await page.mouse.click(mapBox.x + 500, mapBox.y + 250);
    await page.waitForTimeout(150);
    await page.mouse.click(mapBox.x + 700, mapBox.y + 250);
    await page.waitForTimeout(150);
    await page.mouse.click(p3.x, p3.y);
    await page.waitForTimeout(150);
    await page.mouse.dblclick(p3.x, p3.y);
    await page.waitForTimeout(150);
    await page.fill("#editor-name", "Test Field");
    await page.click('#editor-category-grid [data-category="field"]');
    await page.click("#editor-save");
    await page.waitForTimeout(300);

    const metaLines = await page.locator(".feature-popup .meta").allInnerTexts();
    check("the popup shows an area readout for a polygon", metaLines.some((t) => /▦/.test(t)), JSON.stringify(metaLines));
  }

  section("edit properties + sidebar list");
  {
    await page.click("#sidebar-toggle-button").catch(() => {});
    await page.waitForTimeout(300);
    // A fresh browser profile also seeds 2 onboarding demo objects, so
    // check for the specific drawn names rather than an exact total count.
    for (const name of ["Well", "Test Trail", "Test Field"]) {
      check(`"${name}" appears in the sidebar list`, (await page.locator("#object-list .object-list-item", { hasText: name }).count()) > 0);
    }

    await page.locator("#object-list .object-list-item", { hasText: "Well" }).click();
    await page.waitForTimeout(200);
    await page.click('.feature-popup [data-action="edit-info"]');
    await page.waitForTimeout(150);
    await page.fill("#editor-name", "Renamed Well");
    await page.click("#editor-save");
    await page.waitForTimeout(200);

    const renamed = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      const stored = JSON.parse(localStorage.getItem(`map-editor-data-v1:${mapId}`));
      return stored.objects.find((f) => f.properties.name === "Renamed Well");
    });
    check("editing properties persists the new name", renamed !== undefined);
  }

  section("delete");
  {
    await page.click('.feature-popup [data-action="delete"]');
    await page.waitForTimeout(150);
    await page.click("#confirm-delete");
    await page.waitForTimeout(200);

    const stillThere = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      const stored = JSON.parse(localStorage.getItem(`map-editor-data-v1:${mapId}`));
      return stored.objects.some((f) => f.properties.name === "Renamed Well");
    });
    check("confirming delete removes the object", !stillThere);
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
