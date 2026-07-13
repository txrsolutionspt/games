/*
 * test-e2e.js — drives the real game in headless Chromium via Playwright:
 * boots the page, checks console errors, starts a race, drives with the
 * keyboard, verifies HUD/timing/reset/pause, exercises the mobile touch
 * layout, and (--full) lets the autopilot finish a rendered 1-lap race
 * through to the finish screen.
 *
 * Requires the `playwright` package with its chromium browser installed
 * (in CI: `npm install playwright && npx playwright install chromium`).
 *
 * Run: node test-e2e.js [--full]
 * Screenshots are written to test-artifacts/ (gitignored).
 */
'use strict';
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'); // repo root
const SHOTS = path.join(__dirname, 'test-artifacts');
fs.mkdirSync(SHOTS, { recursive: true });
const FULL = process.argv.includes('--full');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nf'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.error(`FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

(async () => {
  await new Promise((r) => server.listen(8901, r));
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 480 } });

  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  // ---------- boot & menu ----------
  await page.goto('http://localhost:8901/games/race-car/?laps=1', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  check('no console/page errors on boot', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('menu visible', await page.isVisible('#screen-menu'));
  const webgl = await page.evaluate(() => !!window.__rc && !!window.__rc.engine);
  check('engine booted (debug hook present)', webgl);
  const versionText = await page.textContent('#menu-version');
  const expectedVersion = require('./version.js').version;
  check('version displayed on menu', versionText === 'v' + expectedVersion,
    `shown="${versionText}" expected="v${expectedVersion}"`);
  check('medal targets shown on menu', await page.evaluate(() =>
    document.querySelectorAll('#menu-medals .medal-target').length === 3));
  await page.screenshot({ path: path.join(SHOTS, '01-menu.png') });

  // ---------- track selection ----------
  const track0 = await page.evaluate(() => window.__rc.trackId);
  const label0 = await page.textContent('#btn-track');
  await page.click('#btn-track');
  await page.waitForTimeout(600);
  const track1 = await page.evaluate(() => window.__rc.trackId);
  const label1 = await page.textContent('#btn-track');
  check('track button switches track', track1 !== track0 && label1 !== label0,
    `${track0}->${track1}`);
  check('scene rebuilt without errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  // cycle back so the rest of the test runs on the default track
  const ids = await page.evaluate(() => RCTrack.trackIds().length);
  for (let i = 0; i < ids - 1; i++) {
    await page.click('#btn-track');
    await page.waitForTimeout(400);
  }
  check('cycled back to first track',
    await page.evaluate((t) => window.__rc.trackId === t, track0));

  // ---------- start race ----------
  await page.click('#btn-start');
  await page.waitForTimeout(300);
  check('countdown state', await page.evaluate(() => window.__rc.state === window.__rc.STATE.COUNTDOWN));
  await page.screenshot({ path: path.join(SHOTS, '02-countdown.png') });
  await page.waitForFunction(() => window.__rc.state === window.__rc.STATE.RACING, null, { timeout: 15000 });
  check('racing state after countdown', true);

  // ---------- drive forward with keyboard ----------
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__rc.car.speed > 10, null, { timeout: 20000 });
  const drive1 = await page.evaluate(() => ({
    speed: window.__rc.car.speed, clock: window.__rc.clock,
  }));
  check('car accelerates with W held', drive1.speed > 10, `v=${drive1.speed.toFixed(1)}`);
  check('race clock runs', drive1.clock > 1, `clock=${drive1.clock.toFixed(1)}`);
  await page.screenshot({ path: path.join(SHOTS, '03-driving.png') });

  // HUD shows time and speed
  const lapText = await page.textContent('#hud-laptime');
  const spdText = await page.textContent('#hud-speed-val');
  check('HUD lap time ticking', /\d:\d\d\.\d\d/.test(lapText) && lapText !== '0:00.00', lapText);
  check('HUD speed > 0', parseInt(spdText, 10) > 20, spdText);
  check('minimap visible during race', await page.isVisible('#minimap'));
  check('minimap has drawn pixels', await page.evaluate(() => {
    const mmCanvas = document.getElementById('minimap');
    const data = mmCanvas.getContext('2d').getImageData(0, 0,
      mmCanvas.width, mmCanvas.height).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
    return false;
  }));

  // keep driving straight until past first gate (gate 0 at ~1/12 of lap)
  let gateInfo = null;
  try {
    await page.waitForFunction(() => window.__rc.race.splits.length >= 1, null, { timeout: 25000 });
    gateInfo = await page.evaluate(() => ({
      nextGate: window.__rc.race.nextGate, splits: window.__rc.race.splits.length,
    }));
  } catch (e) { /* handled below */ }
  await page.keyboard.up('KeyW');
  check('first checkpoint registered', gateInfo && gateInfo.nextGate >= 1 && gateInfo.splits >= 1,
    JSON.stringify(gateInfo));

  // ---------- reset to checkpoint ----------
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(400);
  const afterReset = await page.evaluate(() => ({
    speed: window.__rc.car.speed, clock: window.__rc.clock,
  }));
  check('reset stops the car', afterReset.speed < 1, `v=${afterReset.speed.toFixed(1)}`);
  check('reset keeps the clock running', afterReset.clock > drive1.clock);
  await page.screenshot({ path: path.join(SHOTS, '04-after-reset.png') });

  // ---------- pause ----------
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  check('pause screen shows', await page.isVisible('#screen-pause'));
  const clockPaused = await page.evaluate(() => window.__rc.clock);
  await page.waitForTimeout(800);
  check('clock frozen while paused',
    await page.evaluate((c) => Math.abs(window.__rc.clock - c) < 0.01, clockPaused));
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  check('resume works', await page.evaluate(() => window.__rc.state === window.__rc.STATE.RACING));

  check('no console errors during play', errors.length === 0, errors.slice(0, 3).join(' | '));

  // ---------- full lap with autopilot (finish screen) ----------
  if (FULL) {
    // free the CPU for the rendered lap (software GL is slow enough already)
    await page.close();
    const page2 = await browser.newPage({ viewport: { width: 900, height: 480 } });
    const errors2 = [];
    page2.on('console', (m) => { if (m.type() === 'error') errors2.push(m.text()); });
    page2.on('pageerror', (e) => errors2.push(String(e)));
    await page2.goto('http://localhost:8901/games/race-car/?laps=1&auto=1', { waitUntil: 'load' });
    await page2.waitForTimeout(1500);
    await page2.click('#btn-start');
    console.log('  ... autopilot lapping (up to 4 min real time)');
    try {
      // a sector completes about a third of the way around
      await page2.waitForFunction(() =>
        window.__rc.race && window.__rc.race.sectorTimes.length >= 1,
        null, { timeout: 120000 });
      check('sector time recorded mid-lap', true);
      await page2.waitForSelector('#screen-finish:not(.hidden)', { timeout: 240000 });
      check('autopilot finishes a rendered lap (finish screen)', true);
      check('finish medal banner shown', await page2.evaluate(() => {
        const m = document.getElementById('finish-medal');
        return !m.classList.contains('hidden') && m.textContent.length > 0;
      }));
      check('finish stats populated', await page2.evaluate(() =>
        document.querySelectorAll('#finish-stats .stat').length >= 4));
      const sectorBests = await page2.evaluate(() =>
        window.__rc.store.get('best.apex.sectors', null));
      check('sector bests persisted', Array.isArray(sectorBests) &&
        sectorBests.length === 3 && sectorBests.every((v) => v > 0),
        JSON.stringify(sectorBests));
      const total = await page2.textContent('#finish-total');
      check('finish total shown', /\d:\d\d\.\d\d/.test(total), total);
      const best = await page2.evaluate(() =>
        window.__rc.store.get('best.apex.1laps.total', null));
      check('best time persisted (per-track key)', best != null && best > 30, String(best));
      const ghostData = await page2.evaluate(() =>
        window.__rc.store.get('best.apex.1laps.ghost', null));
      check('ghost recording persisted with best', ghostData != null &&
        Array.isArray(ghostData.p) && ghostData.p.length > 100,
        ghostData ? `samples=${ghostData.p.length / 3}` : 'null');
      await page2.screenshot({ path: path.join(SHOTS, '05-finish.png') });

      // restart: the saved best should now play back as a ghost
      await page2.click('#btn-restart');
      await page2.waitForFunction(() =>
        window.__rc.state === window.__rc.STATE.RACING, null, { timeout: 20000 });
      await page2.waitForFunction(() => window.__rc.ghostActive, null, { timeout: 15000 })
        .catch(() => {});
      check('ghost replays on the next run',
        await page2.evaluate(() => window.__rc.ghostActive));
      await page2.waitForTimeout(4000);
      await page2.screenshot({ path: path.join(SHOTS, '10-ghost.png') });
    } catch (e) {
      const st = await page2.evaluate(() => ({
        state: window.__rc.state, lap: window.__rc.race && window.__rc.race.nextGate,
        v: window.__rc.car.speed, clock: window.__rc.clock,
      })).catch(() => null);
      check('autopilot finishes a rendered lap (finish screen)', false, JSON.stringify(st));
      await page2.screenshot({ path: path.join(SHOTS, '05-finish-timeout.png') });
    }
    check('no console errors in autopilot run', errors2.length === 0, errors2.slice(0, 3).join(' | '));
    await page2.close();
  }

  // ---------- mobile viewport: touch controls + portrait overlay ----------
  const mob = await browser.newPage({
    viewport: { width: 780, height: 360 }, hasTouch: true, isMobile: true,
  });
  await mob.goto('http://localhost:8901/games/race-car/', { waitUntil: 'load' });
  await mob.waitForTimeout(1800);
  check('touch class applied', await mob.evaluate(() => document.body.classList.contains('touch')));
  await mob.tap('#btn-start');
  await mob.waitForFunction(() => window.__rc.state === window.__rc.STATE.RACING, null, { timeout: 15000 });
  check('touch controls visible during race', await mob.isVisible('#touch-controls'));
  await mob.screenshot({ path: path.join(SHOTS, '06-mobile.png') });

  // hold the gas pedal (synthetic pointerdown with no matching up = held)
  await mob.evaluate(() => {
    document.getElementById('pedal-gas')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
  });
  await mob.waitForFunction(() => window.__rc.car.speed > 5, null, { timeout: 15000 })
    .catch(() => {});
  const mobSpeed = await mob.evaluate(() => window.__rc.car.speed);
  check('gas pedal accelerates', mobSpeed > 5, `v=${mobSpeed.toFixed(1)}`);

  // portrait -> rotate overlay
  await mob.setViewportSize({ width: 360, height: 780 });
  await mob.waitForTimeout(400);
  check('rotate overlay in portrait', await mob.isVisible('#rotate-overlay'));
  await mob.screenshot({ path: path.join(SHOTS, '07-portrait.png') });
  await mob.close();

  await browser.close();
  server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
