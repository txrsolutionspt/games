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
  check('replay button hidden with no saved run', !(await page.isVisible('#btn-replay')));
  await page.screenshot({ path: path.join(SHOTS, '01-menu.png') });

  // ---------- driving settings ----------
  await page.click('#btn-driving');
  await page.waitForTimeout(200);
  check('driving settings screen opens', await page.isVisible('#screen-driving'));
  check('traction control defaults ON',
    (await page.textContent('#opt-traction')).includes('ON'));
  check('stability assist defaults ON',
    (await page.textContent('#opt-stability')).includes('ON'));
  check('counter-steer assist defaults ON',
    (await page.textContent('#opt-countersteer')).includes('ON'));
  check('pedal response defaults SMOOTH',
    (await page.textContent('#opt-pedal')).includes('SMOOTH'));
  check('player car has assists applied', await page.evaluate(() =>
    window.__rc.car.p.tractionControl && window.__rc.car.p.stabilityAssist &&
    window.__rc.car.p.counterSteer));
  await page.click('#opt-countersteer');
  check('counter-steer toggles OFF', (await page.textContent('#opt-countersteer')).includes('OFF'));
  await page.click('#opt-countersteer'); // back ON
  await page.click('#opt-pedal');
  check('pedal response toggles INSTANT',
    (await page.textContent('#opt-pedal')).includes('INSTANT'));
  await page.click('#opt-pedal'); // back to SMOOTH
  await page.click('#opt-handling'); // normal -> drift
  check('handling cycles to DRIFT',
    (await page.textContent('#opt-handling')).includes('DRIFT'));
  check('tuning applied to physics live', await page.evaluate(() =>
    window.__rc.car.p.tireRear.D < 1.1));
  await page.click('#opt-traction'); // ON -> OFF
  check('traction toggles OFF', (await page.textContent('#opt-traction')).includes('OFF'));
  await page.click('#btn-driving-back');
  await page.waitForTimeout(200);
  check('back returns to menu', await page.isVisible('#screen-menu'));
  // settings persist across a reload
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  check('driving settings persist after reload', await page.evaluate(() =>
    window.__rc.car.tuning.handling === 'drift' &&
    window.__rc.car.tuning.traction === false));
  // restore defaults for the rest of the run
  await page.click('#btn-driving');
  await page.click('#opt-handling'); // drift -> grip
  await page.click('#opt-handling'); // grip -> normal
  await page.click('#opt-traction'); // OFF -> ON
  await page.click('#btn-driving-back');
  await page.waitForTimeout(200);

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
  // smooth pedal mode: throttle ramps rather than snapping to 1
  const rampSample = await page.evaluate(() => new Promise((resolve) => {
    const samples = [];
    const iv = setInterval(() => {
      samples.push(window.__rc.input.control.throttle);
      // stop once full throttle is reached (or after ~2.4 s of sampling)
      if (samples[samples.length - 1] >= 0.99 || samples.length >= 40) {
        clearInterval(iv);
        resolve(samples);
      }
    }, 60);
  }));
  const sawPartial = rampSample.some((v) => v > 0.05 && v < 0.95);
  const reachedFull = rampSample.some((v) => v >= 0.99);
  check('keyboard throttle ramps progressively', sawPartial && reachedFull,
    JSON.stringify(rampSample.map((v) => +v.toFixed(2)).slice(0, 8)));
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

      // ---------- replay viewer of the saved best run ----------
      await page2.keyboard.press('KeyP'); // pause the race we restarted
      await page2.click('#btn-quit');
      await page2.waitForTimeout(400);
      check('replay button visible after a saved run', await page2.isVisible('#btn-replay'));
      await page2.click('#btn-replay');
      await page2.waitForFunction(() =>
        window.__rc.state === window.__rc.STATE.REPLAY, null, { timeout: 5000 });
      check('replay bar shown', await page2.isVisible('#replay-bar'));
      const rep0 = await page2.evaluate(() => ({
        t: window.__rc.replayT, x: window.__rc.car.x, z: window.__rc.car.z,
        dur: window.__rc.replayDuration,
      }));
      await page2.waitForTimeout(3500);
      const rep1 = await page2.evaluate(() => ({
        t: window.__rc.replayT, x: window.__rc.car.x, z: window.__rc.car.z,
      }));
      check('replay time advances', rep1.t > rep0.t + 1,
        `t0=${rep0.t.toFixed(1)} t1=${rep1.t.toFixed(1)}`);
      check('replay duration matches the run', rep0.dur > 30, `dur=${rep0.dur}`);
      check('replayed car moves on its own',
        Math.hypot(rep1.x - rep0.x, rep1.z - rep0.z) > 5);
      await page2.screenshot({ path: path.join(SHOTS, '14-replay.png') });
      await page2.click('#btn-replay-speed');
      check('speed toggles to 2x',
        (await page2.textContent('#btn-replay-speed')).includes('2'));
      await page2.click('#btn-replay-exit');
      await page2.waitForTimeout(400);
      check('exit replay returns to menu', await page2.isVisible('#screen-menu'));
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

  // ---------- dragway: open track, forced single run ----------
  const dragPage = await browser.newPage({ viewport: { width: 900, height: 480 } });
  const dragErrors = [];
  dragPage.on('console', (m) => { if (m.type() === 'error') dragErrors.push(m.text()); });
  dragPage.on('pageerror', (e) => dragErrors.push(String(e)));
  await dragPage.goto('http://localhost:8901/games/race-car/?track=dragway&laps=3',
    { waitUntil: 'load' });
  await dragPage.waitForTimeout(1800);
  check('dragway loads without errors', dragErrors.length === 0,
    dragErrors.slice(0, 3).join(' | '));
  check('dragway selected', await dragPage.evaluate(() => window.__rc.trackId === 'dragway'));
  check('open track data exposed', await dragPage.evaluate(() =>
    window.__rc.track.closed === false && window.__rc.track.forcedLaps === 1));
  await dragPage.click('#btn-start');
  await dragPage.waitForFunction(() =>
    window.__rc.state === window.__rc.STATE.RACING, null, { timeout: 20000 });
  check('forced single run despite ?laps=3',
    (await dragPage.textContent('#hud-lap')) === 'LAP 1/1');
  await dragPage.keyboard.down('KeyW');
  await dragPage.waitForFunction(() => window.__rc.car.speed > 20, null, { timeout: 30000 });
  const dragQ = await dragPage.evaluate(() => {
    const rc = window.__rc;
    const q = RCTrack.query(rc.track, rc.car.x, rc.car.z, null);
    return { s: q.s, d: q.d };
  });
  check('drag car launches straight down the strip',
    dragQ.s > 20 && Math.abs(dragQ.d) < 3, JSON.stringify(dragQ));
  await dragPage.keyboard.up('KeyW');
  check('no errors during drag run', dragErrors.length === 0,
    dragErrors.slice(0, 3).join(' | '));
  await dragPage.screenshot({ path: path.join(SHOTS, '16-dragway.png') });
  await dragPage.close();

  // ---------- speedbowl smoke: oval loads and races ----------
  const ovalPage = await browser.newPage({ viewport: { width: 900, height: 480 } });
  const ovalErrors = [];
  ovalPage.on('pageerror', (e) => ovalErrors.push(String(e)));
  await ovalPage.goto('http://localhost:8901/games/race-car/?track=speedbowl&auto=1&laps=1',
    { waitUntil: 'load' });
  await ovalPage.waitForTimeout(1800);
  await ovalPage.click('#btn-start');
  await ovalPage.waitForFunction(() =>
    window.__rc.state === window.__rc.STATE.RACING, null, { timeout: 20000 });
  await ovalPage.waitForFunction(() => window.__rc.car.speed > 15, null, { timeout: 30000 });
  check('speedbowl races (autopilot up to speed)', true);
  check('speedbowl full outer wall present', await ovalPage.evaluate(() =>
    window.__rc.track.walls.length === 1 &&
    window.__rc.track.walls[0].i1 - window.__rc.track.walls[0].i0 ===
      window.__rc.track.samples.length - 1));
  check('no errors on speedbowl', ovalErrors.length === 0, ovalErrors.slice(0, 3).join(' | '));
  await ovalPage.screenshot({ path: path.join(SHOTS, '17-speedbowl.png') });
  await ovalPage.close();

  // ---------- gamepad support (stubbed Gamepad API) ----------
  const padPage = await browser.newPage({ viewport: { width: 900, height: 480 } });
  await padPage.addInitScript(() => {
    window.__fakePad = {
      connected: true, index: 0, id: 'Fake Pad', mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    navigator.getGamepads = () => [window.__fakePad];
  });
  await padPage.goto('http://localhost:8901/games/race-car/?laps=1', { waitUntil: 'load' });
  await padPage.waitForTimeout(1800);
  await padPage.click('#btn-start');
  await padPage.waitForFunction(() =>
    window.__rc.state === window.__rc.STATE.RACING, null, { timeout: 20000 });
  await padPage.evaluate(() => {
    window.__fakePad.axes[0] = 0.8;       // steer right
    window.__fakePad.buttons[7].value = 0.6; // right trigger
  });
  await padPage.waitForTimeout(300);
  const padCtrl = await padPage.evaluate(() => ({
    steer: window.__rc.input.control.steer,
    throttle: window.__rc.input.control.throttle,
    connected: window.__rc.input.gamepadConnected,
  }));
  check('gamepad detected', padCtrl.connected);
  check('analog stick steers (curved, right)', padCtrl.steer > 0.4 && padCtrl.steer < 1,
    `steer=${padCtrl.steer.toFixed(2)}`);
  check('analog trigger throttles', Math.abs(padCtrl.throttle - 0.6) < 0.05,
    `thr=${padCtrl.throttle.toFixed(2)}`);
  await padPage.evaluate(() => { window.__fakePad.buttons[9].pressed = true; });
  await padPage.waitForTimeout(300);
  check('gamepad Start pauses', await padPage.evaluate(() =>
    window.__rc.state === window.__rc.STATE.PAUSED));
  await padPage.close();

  // ---------- Race mode: AI opponents ----------
  const racePage = await browser.newPage({ viewport: { width: 900, height: 480 } });
  const raceErrors = [];
  racePage.on('console', (m) => { if (m.type() === 'error') raceErrors.push(m.text()); });
  racePage.on('pageerror', (e) => raceErrors.push(String(e)));
  await racePage.goto(
    'http://localhost:8901/games/race-car/?mode=race&laps=1&rivals=5&difficulty=hard',
    { waitUntil: 'load' });
  await racePage.waitForTimeout(1800);
  const modeLabel = await racePage.textContent('#btn-mode');
  check('mode button reflects ?mode=race', modeLabel.includes('RACE'), modeLabel);
  check('difficulty button reflects ?difficulty=hard',
    (await racePage.textContent('#btn-difficulty')).includes('HARD'));
  check('rivals button reflects ?rivals=5',
    (await racePage.textContent('#btn-rivals')).includes('5'));
  check('race options visible in race mode',
    await racePage.isVisible('#btn-difficulty') && await racePage.isVisible('#btn-rivals'));
  await racePage.click('#btn-mode');
  await racePage.waitForTimeout(200);
  check('mode button toggles', (await racePage.textContent('#btn-mode')).includes('TIME TRIAL'));
  check('race options hidden in time trial',
    !(await racePage.isVisible('#btn-difficulty')) && !(await racePage.isVisible('#btn-rivals')));
  await racePage.click('#btn-mode'); // back to race
  await racePage.click('#btn-difficulty'); // hard -> easy (cycles)
  check('difficulty cycles', (await racePage.textContent('#btn-difficulty')).includes('EASY'));
  await racePage.click('#btn-rivals'); // 5 -> 3
  await racePage.click('#btn-rivals'); // 3 -> 5
  check('rivals cycles back to 5', (await racePage.textContent('#btn-rivals')).includes('5'));
  await racePage.click('#btn-start');
  await racePage.waitForFunction(() =>
    window.__rc.state === window.__rc.STATE.RACING, null, { timeout: 20000 });
  check('5 opponents spawned', await racePage.evaluate(() =>
    window.__rc.opponents && window.__rc.opponents.entries.length === 5));
  check('5 AI meshes enabled', await racePage.evaluate(() =>
    window.__rc.scene.getNodes().filter((n) =>
      n.name && n.name.startsWith('carRoot_ai') && n.isEnabled()).length === 5));
  check('position indicator visible', await racePage.isVisible('#hud-pos'));
  const aiPos0 = await racePage.evaluate(() =>
    window.__rc.opponents.entries.map((e) => [e.car.x, e.car.z]));
  await racePage.waitForTimeout(4000);
  const aiPos1 = await racePage.evaluate(() =>
    window.__rc.opponents.entries.map((e) => [e.car.x, e.car.z]));
  const aiMoved = aiPos0.every((p, i) =>
    Math.hypot(aiPos1[i][0] - p[0], aiPos1[i][1] - p[1]) > 5);
  check('all AI cars are driving', aiMoved);
  const posText = await racePage.textContent('#hud-pos');
  check('position shows Pn/6', /^P[1-6]\/6$/.test(posText), posText);
  check('no console errors in race mode', raceErrors.length === 0,
    raceErrors.slice(0, 3).join(' | '));
  await racePage.screenshot({ path: path.join(SHOTS, '13-race-mode.png') });
  await racePage.close();

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
