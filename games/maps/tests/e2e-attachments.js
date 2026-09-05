/*
 * e2e-attachments.js — file attachments on objects: any file type is
 * accepted, images get a real thumbnail preview, other types show a
 * generic icon with no preview attempt, attachments persist across
 * reopening the editor, the popup shows a read-only thumbnail strip, and
 * a not-yet-saved object's attachments are rolled back (deleted from
 * IndexedDB) if its editor dialog is cancelled.
 *
 * Run: node tests/e2e-attachments.js
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");
const { startServer, trackErrors, makeReporter, launchOptions } = require("./helpers.js");

const PORT = 8206;
const URL = `http://localhost:${PORT}/games/maps/search.html`;
const { check, section, report } = makeReporter("e2e-attachments");

// A 1x1 red-pixel PNG and a plain text file, written to a temp dir so
// page.setInputFiles() has real files to attach.
const ASSET_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "maps-attachments-test-"));
const IMAGE_PATH = path.join(ASSET_DIR, "test-image.png");
const DOC_PATH = path.join(ASSET_DIR, "test-doc.txt");
fs.writeFileSync(
  IMAGE_PATH,
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64")
);
fs.writeFileSync(DOC_PATH, "hello world, this is a test document\n");

function indexedDbFileCount(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const req = indexedDB.open("map-editor-files-v1", 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("files", "readonly");
          const countReq = tx.objectStore("files").count();
          countReq.onsuccess = () => resolve(countReq.result);
        };
      })
  );
}

(async () => {
  const server = await startServer(PORT);
  const browser = await chromium.launch(launchOptions());
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = trackErrors(page);

  await page.goto(URL, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const mapBox = await page.locator("#map").boundingBox();

  section("attach an image and a non-image file to a new point");
  {
    await page.click("#add-button");
    await page.click('[data-add="point"]');
    await page.mouse.click(mapBox.x + 100, mapBox.y + 300);
    await page.waitForTimeout(150);

    await page.setInputFiles("#editor-file-input", [IMAGE_PATH, DOC_PATH]);
    await page.waitForTimeout(300);

    check("both files show up in the dialog's file list", (await page.locator("#editor-file-list .file-item").count()) === 2);
    check(
      "the image attachment shows a thumbnail preview",
      await page.evaluate(() => {
        const thumb = document.querySelector("#editor-file-list .file-thumb-image");
        return thumb ? getComputedStyle(thumb).backgroundImage !== "none" : false;
      })
    );
    check(
      "the non-image attachment shows the generic icon, no preview",
      await page.evaluate(() => {
        const items = [...document.querySelectorAll("#editor-file-list .file-item")];
        const textItem = items.find((item) => item.textContent.includes("test-doc.txt"));
        const thumb = textItem ? textItem.querySelector(".file-thumb") : null;
        return thumb ? !thumb.classList.contains("file-thumb-image") && thumb.textContent === "📄" : false;
      })
    );

    await page.fill("#editor-name", "Point With Files");
    await page.click("#editor-save");
    await page.waitForTimeout(250);
  }

  section("attachments persist across reopening, and can be removed");
  {
    await page.click('.feature-popup [data-action="edit-info"]');
    await page.waitForTimeout(200);
    check("both attachments are still there after reopening for edit", (await page.locator("#editor-file-list .file-item").count()) === 2);

    await page.evaluate(() => {
      const items = [...document.querySelectorAll("#editor-file-list .file-item")];
      items.find((item) => item.textContent.includes("test-doc.txt")).querySelector(".file-remove").click();
    });
    await page.waitForTimeout(200);
    check("removing one leaves exactly one", (await page.locator("#editor-file-list .file-item").count()) === 1);

    await page.click("#editor-save");
    await page.waitForTimeout(250);
    check("the popup shows a thumbnail for the remaining attachment", (await page.locator(".feature-popup .popup-attachment").count()) === 1);
  }

  section("cancelling a brand-new object rolls back its attachments");
  {
    const before = await indexedDbFileCount(page);

    await page.click("#add-button");
    await page.click('[data-add="point"]');
    await page.mouse.click(mapBox.x + 400, mapBox.y + 400);
    await page.waitForTimeout(150);
    await page.setInputFiles("#editor-file-input", [IMAGE_PATH]);
    await page.waitForTimeout(250);

    const duringDialog = await indexedDbFileCount(page);
    check("the file exists in IndexedDB while the dialog is open", duringDialog === before + 1, `before=${before} during=${duringDialog}`);

    await page.click("#editor-cancel");
    await page.waitForTimeout(250);

    const afterCancel = await indexedDbFileCount(page);
    check("cancelling rolls the orphaned file back out of IndexedDB", afterCancel === before, `before=${before} after=${afterCancel}`);
  }

  check("no unexpected console/page errors across the whole flow", errors.relevant().length === 0, errors.relevant().join(" | "));
  check("fatal error banner never appeared", !(await page.locator("#fatal-error-banner").isVisible()));

  await browser.close();
  server.close();
  fs.rmSync(ASSET_DIR, { recursive: true, force: true });
  process.exit(report());
})().catch((err) => {
  console.error("TEST FAILED", err);
  process.exit(1);
});
