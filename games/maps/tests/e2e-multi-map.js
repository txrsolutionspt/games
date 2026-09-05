/*
 * e2e-multi-map.js — "My Maps": a fresh install gets exactly one seeded
 * map, creating a new map switches to it, and objects never leak between
 * maps when switching back and forth.
 *
 * Run: node tests/e2e-multi-map.js
 */
"use strict";
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions, freshContext } = require("./helpers.js");

const PORT = 8205;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, report } = makeReporter("e2e-multi-map");

(async () => {
  const server = await startServer(PORT);
  const browser = await chromium.launch(launchOptions());
  const context = await freshContext(browser, { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = trackErrors(page);

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelectorAll("#object-list .object-list-item").length > 0, null, { timeout: 5000 });

  const index = JSON.parse(await page.evaluate(() => localStorage.getItem("maps-v1")));
  check("a fresh install has exactly one map", index.maps.length === 1);
  check("that map is named 'My Map'", index.maps[0].name === "My Map");

  const seeded = JSON.parse(await page.evaluate((id) => localStorage.getItem(`map-editor-data-v1:${id}`), index.activeMapId));
  check("it comes with the 2 onboarding demo objects", seeded.objects.length === 2, `n=${seeded.objects.length}`);

  const mapBox = await page.locator("#map").boundingBox();

  // Add a real point on the initial map.
  await page.click("#add-button");
  await page.click('[data-add="point"]');
  await page.mouse.click(mapBox.x + 200, mapBox.y + 200);
  await page.waitForTimeout(150);
  await page.fill("#editor-name", "Original Map Point");
  await page.click("#editor-save");
  await page.waitForTimeout(250);

  // Create a second map via the My Maps dialog.
  await page.click('[data-action="my-maps"]');
  await page.waitForTimeout(200);
  await page.click("#maps-new");
  await page.waitForTimeout(500);
  check("creating a map switches the sidebar title to it", (await page.locator("#sidebar-title").textContent()) === "New Map");

  // Add a point on the NEW map.
  await page.click("#add-button");
  await page.click('[data-add="point"]');
  await page.mouse.click(mapBox.x + 300, mapBox.y + 300);
  await page.waitForTimeout(150);
  await page.fill("#editor-name", "New Map Point");
  await page.click("#editor-save");
  await page.waitForTimeout(250);

  // Switch back to the original map via the dialog.
  await page.click('[data-action="my-maps"]');
  await page.waitForTimeout(200);
  await page.click('.maps-list-item:not(:has-text("New Map")) .maps-list-info');
  await page.waitForTimeout(500);

  const titleAfterSwitchBack = await page.locator("#sidebar-title").textContent();
  check("switching back restores the original map's title", titleAfterSwitchBack !== "New Map", titleAfterSwitchBack);

  const objectsOnOriginal = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("maps-v1"));
    const raw = localStorage.getItem(`map-editor-data-v1:${stored.activeMapId}`);
    return JSON.parse(raw).objects.map((f) => f.properties.name);
  });
  check("the original map still has its own point", objectsOnOriginal.includes("Original Map Point"));
  check("the new map's point did NOT leak into the original map", !objectsOnOriginal.includes("New Map Point"), JSON.stringify(objectsOnOriginal));

  // Renaming, and the "can't delete the last map" guard.
  await page.click('[data-action="my-maps"]');
  await page.waitForTimeout(200);

  const newMapRow = page.locator('.maps-list-item:has-text("New Map")');
  await newMapRow.locator('[aria-label="Rename map"]').click();
  await page.waitForTimeout(100);
  await page.locator(".maps-list-rename-input").fill("Renamed Trip");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  check("renaming a map updates its name in the list", (await page.locator('.maps-list-item:has-text("Renamed Trip")').count()) > 0);

  const deleteButtons = page.locator('[aria-label="Delete map"]');
  const deleteButtonCount = await deleteButtons.count();
  let anyEnabled = false;
  for (let i = 0; i < deleteButtonCount; i++) {
    if (!(await deleteButtons.nth(i).isDisabled())) anyEnabled = true;
  }
  check("delete is enabled while more than one map exists", anyEnabled);

  await page.click('.maps-list-item:has-text("Renamed Trip") [aria-label="Delete map"]');
  await page.waitForTimeout(150);
  await page.click("#confirm-delete");
  await page.waitForTimeout(200);
  const onlyOneLeft = (await page.locator(".maps-list-item").count()) === 1;
  check("deleting the second map leaves exactly one", onlyOneLeft);
  if (onlyOneLeft) {
    check("delete is disabled on the last remaining map", await page.locator('[aria-label="Delete map"]').isDisabled());
  }

  await page.click("#maps-close");
  await page.waitForTimeout(200);

  check("no unexpected console/page errors", errors.relevant().length === 0, errors.relevant().join(" | "));
  check("fatal error banner never appeared", !(await page.locator("#fatal-error-banner").isVisible()));

  await browser.close();
  server.close();
  process.exit(report());
})().catch((err) => {
  console.error("TEST FAILED", err);
  process.exit(1);
});
