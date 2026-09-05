/*
 * e2e-pwa.js — the manifest/meta tags, service worker registration, and
 * (the important part) that the app shell still renders when the network
 * goes down after the service worker has taken control.
 *
 * Run: node tests/e2e-pwa.js
 */
"use strict";
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions } = require("./helpers.js");

const PORT = 8207;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, section, report } = makeReporter("e2e-pwa");

(async () => {
  const server = await startServer(PORT);
  const browser = await chromium.launch(launchOptions());
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = trackErrors(page);

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(1000);

  section("manifest + meta tags");
  {
    check("manifest link points at manifest.json", (await page.locator('link[rel="manifest"]').getAttribute("href")) === "manifest.json");
    check("theme-color meta is set", (await page.locator('meta[name="theme-color"]').getAttribute("content"))?.length > 0);
    check("apple-touch-icon is set", (await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"))?.length > 0);

    const manifest = await page.evaluate(async () => (await fetch("manifest.json")).json());
    check("manifest has a name", manifest.name?.length > 0);
    check("manifest has at least one icon", manifest.icons?.length > 0);
    check("manifest requests standalone display", manifest.display === "standalone");

    const iconStatuses = await page.evaluate(async (icons) => {
      const results = [];
      for (const icon of icons) results.push((await fetch(icon.src)).status);
      return results;
    }, manifest.icons);
    check("every icon the manifest references actually loads (200)", iconStatuses.every((s) => s === 200), JSON.stringify(iconStatuses));
  }

  section("service worker registration");
  {
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 5000 }).catch(() => {});
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(1000);

    check("the service worker is controlling the page after a reload", await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));
    check("the app UI still renders normally under SW control", await page.locator("#sidebar-title").isVisible());
  }

  section("offline: the shell still renders from cache");
  {
    await context.setOffline(true);
    await page.reload({ waitUntil: "load" }).catch(() => {});
    await page.waitForTimeout(1000);

    check("the toolbar is visible while offline (served from the SW cache)", await page.locator("#toolbar").isVisible().catch(() => false));
    const title = await page.locator("#sidebar-title").textContent().catch(() => null);
    check("the sidebar title renders while offline", Boolean(title), title);
    check("no fatal-error banner shown for the expected offline tile failures", !(await page.locator("#fatal-error-banner").isVisible()));

    await context.setOffline(false);
  }

  await browser.close();
  server.close();
  process.exit(report());
})().catch((err) => {
  console.error("TEST FAILED", err);
  process.exit(1);
});
