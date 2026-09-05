/*
 * Shared helpers for the games/maps Playwright e2e tests: a tiny static
 * file server (serves the repo root so `vendor/`, `js/`, etc. resolve the
 * same way they do on GitHub Pages) and a check()/report() pass-fail
 * counter, matching the pattern in games/race-car/test-e2e.js.
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", ".."); // .../games/maps/tests -> repo root

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
};

function startServer(port) {
  const server = http.createServer((req, res) => {
    let filePath = path.join(REPO_ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (filePath.endsWith("/")) filePath += "index.html";
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found: " + filePath);
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// Ignorable noise seen across every test: benign favicon 404s, and
// cross-origin satellite/geocoding requests that either aren't mocked in a
// given test or are expected to fail in CI's sandboxed network.
const IGNORABLE_ERROR_PATTERNS = [
  /favicon/i,
  /404/,
  /Failed to fetch/,
  /ERR_/,
  /tiles\.maps\.eox\.at/,
  /AJAXError/,
  /nominatim\.openstreetmap\.org/,
];

function trackErrors(page) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push("pageerror: " + err.message));
  return {
    all: errors,
    relevant: () => errors.filter((e) => !IGNORABLE_ERROR_PATTERNS.some((pattern) => pattern.test(e))),
  };
}

function makeReporter(fileName) {
  let passed = 0;
  let failed = 0;

  function check(name, cond, detail) {
    if (cond) {
      passed++;
      console.log(`  ok  ${name}`);
    } else {
      failed++;
      console.error(`FAIL  ${name}${detail !== undefined ? " — " + detail : ""}`);
    }
  }

  function section(name) {
    console.log(`\n== ${name} ==`);
  }

  function report() {
    console.log(`\n[${fileName}] ${passed} passed, ${failed} failed`);
    return failed === 0 ? 0 : 1;
  }

  return { check, section, report };
}

// Software rendering flags so WebGL (MapLibre) works headless without a
// real GPU, in CI and in any other GPU-less environment.
const CHROMIUM_ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blacklist"];

// Only set an explicit executablePath when one is known to exist (this
// sandbox's pre-installed browser); otherwise let Playwright fall back to
// whatever `npx playwright install chromium` put in its own cache — which
// is what CI and a normal local `npm install` both rely on.
function launchOptions() {
  const sandboxChromium = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
  const options = { args: CHROMIUM_ARGS };
  if (fs.existsSync(sandboxChromium)) {
    options.executablePath = sandboxChromium;
  }
  return options;
}

// A context that starts with an actually-clean localStorage, for testing
// fresh-install behavior (seeding, default settings, etc). Clearing
// localStorage via page.evaluate() AFTER a goto() is a trap: the first
// load already kicked off its own async seed-data fetch, and clearing +
// reloading races that fetch against a second one — sometimes the object
// list ends up empty because the check ran between the two. An init
// script clears storage before any page script ever runs, so there's only
// ever one seed fetch per fresh context.
//
// context.addInitScript() re-runs on every navigation in the context,
// including a later page.reload() — so a plain unconditional clear would
// also wipe out anything a test saves before reloading to check that it
// persisted. sessionStorage survives reloads (but not a new context), so
// it's used here as a one-shot guard: cleared once, left alone after.
async function freshContext(browser, contextOptions) {
  const context = await browser.newContext(contextOptions);
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("__test_cleared_once")) {
      localStorage.clear();
      sessionStorage.setItem("__test_cleared_once", "1");
    }
  });
  return context;
}

module.exports = { startServer, trackErrors, makeReporter, launchOptions, freshContext, REPO_ROOT };
