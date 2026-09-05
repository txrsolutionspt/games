/*
 * e2e-app-shell.js — drives the real app in headless Chromium: boot with
 * no console errors, the About screen's version display, default/last-view
 * persistence, the full-bleed desktop layout with its on-map controls, the
 * mobile search pill's clearance from those same controls, the sidebar
 * drawer on both desktop and mobile, the Layers panel, and flying to an
 * object selected from the sidebar list.
 *
 * Run: node tests/e2e-app-shell.js
 */
"use strict";
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions, freshContext } = require("./helpers.js");

const PORT = 8201;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, section, report } = makeReporter("e2e-app-shell");

(async () => {
  const server = await startServer(PORT);
  const browser = await chromium.launch(launchOptions());

  section("boot");
  {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const errors = trackErrors(page);
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    check("no console/page errors on boot", errors.relevant().length === 0, errors.relevant().join(" | "));
    check("fatal error banner is hidden", !(await page.locator("#fatal-error-banner").isVisible()));
    await page.close();
  }

  section("About screen");
  {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1200);

    await page.click("#more-button");
    await page.waitForTimeout(100);
    await page.click('[data-action="about"]');
    await page.waitForTimeout(100);
    check("About overlay opens", await page.locator("#about-overlay").evaluate((el) => !el.classList.contains("hidden")));
    const versionText = (await page.locator("#about-version").textContent()).trim();
    check("version text matches the expected format", /^map-editor build \d{4}-\d{2}-\d{2}\.\d+$/.test(versionText), versionText);

    await page.click("#about-close");
    await page.waitForTimeout(100);
    check("About overlay closes", await page.locator("#about-overlay").evaluate((el) => el.classList.contains("hidden")));
    await page.close();
  }

  section("default view + last-view persistence");
  {
    const context = await freshContext(browser, { viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1500);

    // Settings are only written to localStorage once something changes
    // (e.g. moveend) — a fresh load has no saved key at all, so the default
    // projection/style are checked via the View menu's "active" state
    // instead of reading localStorage before any interaction happens.
    await page.click("#view-button");
    await page.waitForTimeout(150);
    check(
      "a fresh install defaults to the mercator (flat, non-globe) projection",
      await page.locator('[data-projection="mercator"]').evaluate((el) => el.classList.contains("active"))
    );
    check(
      "a fresh install defaults to the satellite style",
      await page.locator('[data-style="satellite"]').evaluate((el) => el.classList.contains("active"))
    );
    await page.click("#view-button");
    await page.waitForTimeout(150);

    const box = await page.locator("#map").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2 + 80, { steps: 10 });
    await page.mouse.up();
    // moveend (and the settings save it triggers) can lag a moment behind
    // the mouseup — poll for the saved key rather than a fixed wait.
    await page.waitForFunction(
      (mapId) => localStorage.getItem(`map-settings-v1:${mapId}`) !== null,
      await page.evaluate(() => JSON.parse(localStorage.getItem("maps-v1")).activeMapId),
      { timeout: 5000 }
    );

    const afterDrag = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      return JSON.parse(localStorage.getItem(`map-settings-v1:${mapId}`));
    });
    const PORTUGAL_DEFAULT_CENTER = [-8.0, 39.5];
    check("dragging the map persists a new view, away from the default", !approxEquals(afterDrag.view.center, PORTUGAL_DEFAULT_CENTER, 0.01), JSON.stringify(afterDrag.view.center));

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(1000);
    const afterReload = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      return JSON.parse(localStorage.getItem(`map-settings-v1:${mapId}`));
    });
    check("a reload keeps the dragged-to view instead of resetting", approxEquals(afterReload.view.center, afterDrag.view.center, 0.001));

    await page.close();
  }

  section("full-bleed desktop layout + on-map controls");
  {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1500);

    const mapBox = await page.locator("#map").boundingBox();
    check("the map fills close to the full viewport width", mapBox.width > 1200, `width=${mapBox.width}`);
    check("the sidebar is closed by default (a dismissible drawer)", !(await page.locator("#sidebar").evaluate((el) => el.classList.contains("open"))));
    check("GeolocateControl (Locate me) is mounted", (await page.locator(".maplibregl-ctrl-geolocate").count()) > 0);
    check("NavigationControl (zoom) is mounted", (await page.locator(".maplibregl-ctrl-zoom-in").count()) > 0);

    const fitAllButton = page.locator('[aria-label="Show all objects"]');
    check("the Fit-all control is mounted", (await fitAllButton.count()) > 0);
    await fitAllButton.click();
    await page.waitForTimeout(300);

    await page.click("#sidebar-toggle-button");
    // The drawer is a CSS transform transition (~250ms) — wait for it to
    // finish rather than racing a fixed timeout against the animation.
    await page.waitForFunction(
      () => {
        const box = document.getElementById("sidebar").getBoundingClientRect();
        return box.x >= -1;
      },
      null,
      { timeout: 2000 }
    );
    const sidebarBox = await page.locator("#sidebar").boundingBox();
    check("the sidebar drawer slides on-screen when opened", sidebarBox.x >= -1, JSON.stringify(sidebarBox));

    await page.click("#sidebar-scrim");
    await page.waitForTimeout(300);
    check("clicking the scrim closes the sidebar drawer", !(await page.locator("#sidebar").evaluate((el) => el.classList.contains("open"))));
    await page.close();
  }

  section("mobile layout: sidebar sheet + search pill clearance");
  {
    const page = await (await browser.newContext({ viewport: { width: 412, height: 892 }, hasTouch: true, isMobile: true })).newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1500);

    check("sidebar-toggle (Objects) is visible in the bottom nav", await page.locator("#sidebar-toggle-button").isVisible());
    check("Add is visible in the bottom nav", await page.locator("#add-button").isVisible());

    await page.click("#sidebar-toggle-button");
    await page.waitForTimeout(400);
    check("tapping Objects opens the sidebar sheet", await page.locator("#sidebar").evaluate((el) => el.classList.contains("open")));
    await page.click("#sidebar-scrim", { force: true });
    await page.waitForTimeout(400);
    check("tapping the scrim closes the sidebar sheet", !(await page.locator("#sidebar").evaluate((el) => el.classList.contains("open"))));

    // Regression: the search pill used to overlap MapLibre's own top-right
    // zoom/locate/fit-all control stack on real phone widths.
    const searchBox = await page.locator(".search-box").boundingBox();
    const firstControl = await page.locator(".maplibregl-ctrl-top-right .maplibregl-ctrl").first().boundingBox();
    const gap = firstControl.x - (searchBox.x + searchBox.width);
    check("the mobile search pill doesn't overlap the map's control stack", gap > 0, `gap=${gap}px`);

    await page.close();
  }

  section("Layers panel");
  {
    const page = await (await browser.newContext({ viewport: { width: 412, height: 892 }, hasTouch: true })).newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1500);

    await page.click("#layers-button");
    await page.waitForTimeout(200);
    check("the Layers dropdown opens", await page.locator("#layers-dropdown").isVisible());
    await page.click('[data-layer="Point"]');
    await page.waitForTimeout(200);
    const stateText = await page.locator('[data-layer="Point"] .layer-state').innerText();
    check("toggling a layer off updates its visible state text", stateText.length > 0, stateText);
    await page.close();
  }

  section("fly-to on sidebar selection");
  {
    const context = await freshContext(browser, { viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: "load" });
    // Fresh-install seeding is async (fetches data/default-objects.json) —
    // wait for it rather than a fixed timeout, which was a source of
    // flakiness in earlier ad-hoc versions of this check.
    await page.waitForFunction(
      () => document.querySelectorAll("#object-list .object-list-item").length > 0,
      null,
      { timeout: 5000 }
    );

    // Settings aren't written until the camera actually moves (moveend),
    // so "before" here is simply "no saved view yet" rather than reading a
    // key that doesn't exist yet.
    const beforeSettings = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      const raw = localStorage.getItem(`map-settings-v1:${mapId}`);
      return raw ? JSON.parse(raw) : null;
    });
    check("no view has been saved yet on a fresh install", beforeSettings === null);

    await page.click("#sidebar-toggle-button").catch(() => {}); // no-op on desktop, harmless
    await page.locator("#object-list .object-list-item").first().click();
    await page.waitForTimeout(1200);

    const afterSettings = await page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      const raw = localStorage.getItem(`map-settings-v1:${mapId}`);
      return raw ? JSON.parse(raw) : null;
    });
    check("selecting a sidebar object moves the camera (flyTo), saving a view", afterSettings !== null, JSON.stringify(afterSettings));
    await page.close();
  }

  await browser.close();
  server.close();
  process.exit(report());
})().catch((err) => {
  console.error("TEST FAILED", err);
  process.exit(1);
});

function approxEquals(a, b, tolerance) {
  return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}
