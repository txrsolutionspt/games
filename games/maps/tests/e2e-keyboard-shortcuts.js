/*
 * e2e-keyboard-shortcuts.js — desktop keyboard shortcuts: Delete/Backspace
 * removes the selected object (with the same confirm dialog as the popup's
 * Delete button), Ctrl/Cmd+D duplicates it, and — the important guard —
 * neither fires while the user is typing in a text field (the editor
 * dialog's name/description, an input, etc).
 *
 * Run: node tests/e2e-keyboard-shortcuts.js
 */
"use strict";
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions } = require("./helpers.js");

const PORT = 8208;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, section, report } = makeReporter("e2e-keyboard-shortcuts");

(async () => {
  const server = await startServer(PORT);
  const browser = await chromium.launch(launchOptions());
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = trackErrors(page);

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const mapBox = await page.locator("#map").boundingBox();

  async function objects() {
    return page.evaluate(() => {
      const mapId = JSON.parse(localStorage.getItem("maps-v1")).activeMapId;
      return JSON.parse(localStorage.getItem(`map-editor-data-v1:${mapId}`)).objects;
    });
  }

  await page.click("#add-button");
  await page.click('[data-add="point"]');
  await page.mouse.click(mapBox.x + 300, mapBox.y + 300);
  await page.waitForTimeout(150);
  await page.fill("#editor-name", "KeyboardTest Point");
  await page.click("#editor-save");
  await page.waitForTimeout(250);
  const baseline = (await objects()).length;

  section("shortcuts are ignored while typing in a field");
  {
    await page.click('.feature-popup [data-action="edit-info"]');
    await page.waitForTimeout(150);
    await page.click("#editor-description");
    await page.keyboard.type("test");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(150);
    check("Backspace while typing doesn't delete the object", (await objects()).length === baseline);

    await page.keyboard.down("Control");
    await page.keyboard.press("d");
    await page.keyboard.up("Control");
    await page.waitForTimeout(150);
    check("Ctrl+D while typing doesn't duplicate the object", (await objects()).length === baseline);

    await page.click("#editor-cancel");
    await page.waitForTimeout(150);
  }

  section("Ctrl/Cmd+D duplicates the selected object");
  {
    await page.keyboard.down("Control");
    await page.keyboard.press("d");
    await page.keyboard.up("Control");
    await page.waitForTimeout(300);

    const after = await objects();
    check("the object count increases by one", after.length === baseline + 1, `baseline=${baseline} after=${after.length}`);
    check("the duplicate is named '... (copy)'", after.some((o) => o.properties.name === "KeyboardTest Point (copy)"));
  }

  section("Delete/Backspace removes the selected object, with confirmation");
  {
    // The duplicate section above left the popup open on the copy.
    await page.keyboard.press("Delete");
    await page.waitForTimeout(150);
    check("a confirm dialog appears rather than deleting immediately", await page.locator("#confirm-overlay").evaluate((el) => !el.classList.contains("hidden")));

    await page.click("#confirm-delete");
    await page.waitForTimeout(250);
    const afterDelete = await objects();
    check("confirming removes the copy", afterDelete.length === baseline, `baseline=${baseline} after=${afterDelete.length}`);
    check("the original object is untouched", afterDelete.some((o) => o.properties.name === "KeyboardTest Point"));
  }

  section("shortcuts are a no-op with nothing selected");
  {
    await page.mouse.click(mapBox.x + 900, mapBox.y + 700); // deselect
    await page.waitForTimeout(150);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(150);
    check("no confirm dialog when nothing is selected", await page.locator("#confirm-overlay").evaluate((el) => el.classList.contains("hidden")));
    check("object count is unchanged", (await objects()).length === baseline);
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
