/*
 * e2e-bulk-actions.js — drives the real app to check the sidebar's
 * multi-select mode: entering/exiting Select, checking items via
 * checkboxes, "Select all" (scoped to the currently visible/filtered
 * list), bulk recategorize (including the mixed-geometry-type guard) via
 * the dedicated bulk category picker, and bulk delete via the shared
 * confirm dialog.
 *
 * Run: node tests/e2e-bulk-actions.js
 */
"use strict";
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions, freshContext } = require("./helpers.js");

const PORT = 8211;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, section, report } = makeReporter("e2e-bulk-actions");

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
  const context = await freshContext(browser, { viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = trackErrors(page);

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const mapBox = await page.locator("#map").boundingBox();

  section("draw 3 points");
  {
    await drawPoint(page, mapBox, mapBox.width / 2, mapBox.height / 2, "One", "water");
    await drawPoint(page, mapBox, mapBox.width / 2 + 100, mapBox.height / 2, "Two", "water");
    await drawPoint(page, mapBox, mapBox.width / 2 + 200, mapBox.height / 2, "Three", "house");

    await page.click("#sidebar-toggle-button").catch(() => {});
    await page.waitForTimeout(200);
    check("the select toggle button renders", (await page.locator("#sidebar-select-toggle").count()) === 1);
    check(
      "the bulk bar is hidden before entering select mode",
      await page.locator("#sidebar-bulk-bar").evaluate((el) => el.classList.contains("hidden"))
    );
  }

  section("enter select mode");
  {
    await page.click("#sidebar-select-toggle");
    await page.waitForTimeout(150);
    check(
      "the bulk bar shows once select mode is on",
      !(await page.locator("#sidebar-bulk-bar").evaluate((el) => el.classList.contains("hidden")))
    );
    check("each item shows a checkbox", (await page.locator(".object-list-checkbox").count()) >= 3);
    check("bulk actions start disabled with nothing checked", await page.locator("#sidebar-bulk-recategorize").isDisabled());
  }

  section("check two items, bulk recategorize them");
  {
    await page.locator("#object-list .object-list-item", { hasText: "One" }).click();
    await page.locator("#object-list .object-list-item", { hasText: "Two" }).click();
    await page.waitForTimeout(150);
    check("the count reads '2 selected'", (await page.locator("#sidebar-bulk-count").innerText()) === "2 selected");
    check("recategorize is enabled with 2 checked", !(await page.locator("#sidebar-bulk-recategorize").isDisabled()));

    await page.click("#sidebar-bulk-recategorize");
    await page.waitForTimeout(150);
    check(
      "the bulk category picker opens",
      !(await page.locator("#bulk-category-overlay").evaluate((el) => el.classList.contains("hidden")))
    );

    await page.click('#bulk-category-grid [data-category="house"]');
    await page.waitForTimeout(250);

    const categories = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      const stored = JSON.parse(localStorage.getItem(`map-editor-data-v1:${mapId}`));
      return Object.fromEntries(stored.objects.map((f) => [f.properties.name, f.properties.category]));
    });
    check("both checked objects are recategorized", categories.One === "house" && categories.Two === "house", JSON.stringify(categories));
    check("the unchecked object is untouched", categories.Three === "house");
    check(
      "select mode exits automatically once the bulk action completes",
      await page.locator("#sidebar-bulk-bar").evaluate((el) => el.classList.contains("hidden"))
    );
  }

  section("mixed geometry types can't be bulk-recategorized together");
  {
    // Draw a line so a mixed-type selection is possible. Close the sidebar
    // first (via the scrim — the toggle button sits under the open drawer)
    // since its scrim otherwise intercepts clicks on the map/toolbar.
    await page.click("#sidebar-scrim").catch(() => {});
    await page.waitForTimeout(200);
    await page.click("#add-button");
    await page.click('[data-add="line"]');
    await page.mouse.click(mapBox.x + 100, mapBox.y + 100);
    await page.waitForTimeout(150);
    await page.mouse.click(mapBox.x + 300, mapBox.y + 100);
    await page.waitForTimeout(150);
    await page.mouse.dblclick(mapBox.x + 300, mapBox.y + 100);
    await page.waitForTimeout(150);
    await page.fill("#editor-name", "A Trail");
    await page.click('#editor-category-grid [data-category="trail"]');
    await page.click("#editor-save");
    await page.waitForTimeout(300);

    await page.click("#sidebar-toggle-button").catch(() => {});
    await page.waitForTimeout(200);
    await page.click("#sidebar-select-toggle");
    await page.waitForTimeout(150);
    await page.locator("#object-list .object-list-item", { hasText: "One" }).click();
    await page.locator("#object-list .object-list-item", { hasText: "A Trail" }).click();
    await page.waitForTimeout(150);

    let alertMessage = null;
    page.once("dialog", async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });
    await page.click("#sidebar-bulk-recategorize");
    await page.waitForTimeout(200);
    check("a Point + a Line selection is rejected with an explanatory message", !!alertMessage, String(alertMessage));
    check(
      "the bulk category picker never opened",
      await page.locator("#bulk-category-overlay").evaluate((el) => el.classList.contains("hidden"))
    );

    await page.click("#sidebar-select-toggle"); // cancel select mode
    await page.waitForTimeout(150);
  }

  section("select all + bulk delete");
  {
    await page.click("#sidebar-select-toggle");
    await page.waitForTimeout(150);
    await page.click("#sidebar-select-all");
    await page.waitForTimeout(150);

    await page.click("#sidebar-bulk-delete");
    await page.waitForTimeout(150);
    check(
      "the shared confirm dialog opens for bulk delete",
      !(await page.locator("#confirm-overlay").evaluate((el) => el.classList.contains("hidden")))
    );
    await page.click("#confirm-delete");
    await page.waitForTimeout(300);

    const names = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      const stored = JSON.parse(localStorage.getItem(`map-editor-data-v1:${mapId}`));
      return stored.objects.map((f) => f.properties.name);
    });
    check(
      "select-all + bulk delete removed every drawn object",
      !names.includes("One") && !names.includes("Two") && !names.includes("Three") && !names.includes("A Trail"),
      JSON.stringify(names)
    );
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
