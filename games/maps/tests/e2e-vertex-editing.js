/*
 * e2e-vertex-editing.js — edit-shape mode: inserting a vertex by dragging a
 * midpoint handle, tap-to-delete via real mouse, and — the most important
 * check in this file — a real TOUCH tap-to-delete on a polygon, which is a
 * regression test for a bug where a single touch tap deleted two vertices
 * instead of one (real touch devices replay a completed tap as a synthetic
 * mouse click shortly after, and both used to run the delete handler).
 *
 * Run: node tests/e2e-vertex-editing.js
 */
"use strict";
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions } = require("./helpers.js");

const PORT = 8203;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, section, report } = makeReporter("e2e-vertex-editing");

async function currentMapId(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("maps-v1")).activeMapId);
}

async function getFeatureByName(page, name) {
  const mapId = await currentMapId(page);
  return page.evaluate(
    ({ mapId, name }) => {
      const stored = JSON.parse(localStorage.getItem(`map-editor-data-v1:${mapId}`));
      return stored.objects.find((f) => f.properties.name === name);
    },
    { mapId, name }
  );
}

(async () => {
  const server = await startServer(PORT);
  const browser = await chromium.launch(launchOptions());

  section("mouse: insert via midpoint drag, then tap-delete");
  {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true })).newPage();
    const errors = trackErrors(page);
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const mapBox = await page.locator("#map").boundingBox();

    await page.click("#add-button");
    await page.click('[data-add="line"]');
    const p1 = { x: mapBox.x - 150 + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };
    const p2 = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };
    const p3 = { x: mapBox.x + 150 + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };
    await page.mouse.click(p1.x, p1.y);
    await page.waitForTimeout(120);
    await page.mouse.click(p2.x, p2.y);
    await page.waitForTimeout(120);
    await page.mouse.click(p3.x, p3.y);
    await page.waitForTimeout(120);
    await page.mouse.dblclick(p3.x, p3.y);
    await page.waitForTimeout(150);
    await page.fill("#editor-name", "VertexTestLine");
    await page.click("#editor-save");
    await page.waitForTimeout(200);

    let feature = await getFeatureByName(page, "VertexTestLine");
    check("the line has 3 points before editing", feature.geometry.coordinates.length === 3);

    await page.click('.feature-popup [data-action="edit-shape"]');
    await page.waitForTimeout(200);

    // Drag from the midpoint between p1 and p2 to a new spot — should
    // insert a real vertex there.
    const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    await page.mouse.move(midPoint.x, midPoint.y);
    await page.mouse.down();
    await page.mouse.move(midPoint.x + 30, midPoint.y - 60, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    feature = await getFeatureByName(page, "VertexTestLine");
    check("dragging a midpoint handle inserts a vertex", feature.geometry.coordinates.length === 4, `n=${feature.geometry.coordinates.length}`);

    // Tap (no movement) on the original first vertex to delete it.
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(200);

    feature = await getFeatureByName(page, "VertexTestLine");
    check("a mouse tap on a vertex deletes exactly that one vertex", feature.geometry.coordinates.length === 3, `n=${feature.geometry.coordinates.length}`);

    check("no unexpected console/page errors", errors.relevant().length === 0, errors.relevant().join(" | "));
    await page.close();
  }

  section("REGRESSION: real touch tap deletes exactly one polygon vertex");
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const mapBox = await page.locator("#map").boundingBox();
    const center = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };

    // A 5-point pentagon, vertices spaced well apart on screen.
    const pts = [
      { x: center.x - 200, y: center.y - 100 },
      { x: center.x, y: center.y - 180 },
      { x: center.x + 200, y: center.y - 100 },
      { x: center.x + 120, y: center.y + 120 },
      { x: center.x - 120, y: center.y + 120 },
    ];

    await page.click("#add-button");
    await page.click('[data-add="polygon"]');
    for (const p of pts) {
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(120);
    }
    await page.mouse.dblclick(pts[4].x, pts[4].y);
    await page.waitForTimeout(150);
    await page.fill("#editor-name", "TouchDeletePoly");
    await page.click("#editor-save");
    await page.waitForTimeout(200);

    let feature = await getFeatureByName(page, "TouchDeletePoly");
    const ringBefore = feature.geometry.coordinates[0].length;
    check("the pentagon ring has 6 entries before editing (5 vertices + closing dup)", ringBefore === 6, `n=${ringBefore}`);

    await page.click('.feature-popup [data-action="edit-shape"]');
    await page.waitForTimeout(200);

    // A real touch tap (not a mouse click) on a middle vertex.
    await page.touchscreen.tap(pts[2].x, pts[2].y);
    await page.waitForTimeout(400);

    feature = await getFeatureByName(page, "TouchDeletePoly");
    const ringAfter = feature.geometry.coordinates[0].length;
    check(
      "a single real touch tap removes exactly ONE vertex, not two",
      ringAfter === ringBefore - 1,
      `before=${ringBefore} after=${ringAfter}`
    );

    await context.close();
  }

  section("real touch drag moves a vertex without deleting it");
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const mapBox = await page.locator("#map").boundingBox();
    const center = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };

    const pts = [
      { x: center.x - 200, y: center.y - 100 },
      { x: center.x, y: center.y - 180 },
      { x: center.x + 200, y: center.y - 100 },
      { x: center.x + 120, y: center.y + 120 },
      { x: center.x - 120, y: center.y + 120 },
    ];
    await page.click("#add-button");
    await page.click('[data-add="polygon"]');
    for (const p of pts) {
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(120);
    }
    await page.mouse.dblclick(pts[4].x, pts[4].y);
    await page.waitForTimeout(150);
    await page.fill("#editor-name", "TouchDragPoly");
    await page.click("#editor-save");
    await page.waitForTimeout(200);

    const before = await getFeatureByName(page, "TouchDragPoly");
    const ringBefore = before.geometry.coordinates[0].length;

    await page.click('.feature-popup [data-action="edit-shape"]');
    await page.waitForTimeout(200);

    const from = pts[0];
    const to = { x: from.x + 60, y: from.y + 40 };
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
    await page.waitForTimeout(30);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }] });
    await page.waitForTimeout(30);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: to.x, y: to.y }] });
    await page.waitForTimeout(30);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);

    const after = await getFeatureByName(page, "TouchDragPoly");
    check(
      "a real touch drag moves the vertex, not deletes it",
      after.geometry.coordinates[0].length === ringBefore,
      `before=${ringBefore} after=${after.geometry.coordinates[0].length}`
    );

    await context.close();
  }

  await browser.close();
  server.close();
  process.exit(report());
})().catch((err) => {
  console.error("TEST FAILED", err);
  process.exit(1);
});
