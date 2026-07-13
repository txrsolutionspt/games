/*
 * game.js — orchestrator: state machine (MENU / COUNTDOWN / RACING / PAUSED /
 * FINISHED), render loop, physics <-> track <-> race wiring, track selection,
 * ghost replay, persistence, camera and HUD updates.
 *
 * Debug URL params: ?laps=N (shorter race), ?auto=1 (autopilot demo drive),
 * ?track=<id> (start on a specific track).
 */
(function () {
  'use strict';

  const STORE_PREFIX = 'racecar.';
  const params = new URLSearchParams(location.search);
  const TOTAL_LAPS = Math.max(1, Math.min(9, parseInt(params.get('laps'), 10) || 3));
  const AUTOPILOT = params.get('auto') === '1';

  // ---------------- storage (localStorage may be unavailable) ----------------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(STORE_PREFIX + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); }
      catch (e) { /* private mode etc. */ }
    },
    remove(key) {
      try { localStorage.removeItem(STORE_PREFIX + key); }
      catch (e) { /* ok */ }
    },
  };

  // ---------------- boot ----------------
  const canvas = document.getElementById('renderCanvas');
  let engine;
  try {
    engine = new BABYLON.Engine(canvas, true, { stencil: false, adaptToDeviceRatio: false });
  } catch (e) {
    showError('Your browser does not support WebGL, which this game requires.');
    return;
  }

  function showError(msg) {
    document.getElementById('error-msg').textContent = msg;
    document.getElementById('error-overlay').classList.remove('hidden');
    document.getElementById('screen-menu').classList.add('hidden');
  }

  const car = new RCCar.Car();
  const input = RCInput.createInput();
  input.bindTouchUI();
  const audio = RCAudio.createAudio();
  const hud = RCHud.createHud();

  // ---------------- settings ----------------
  const QUALITIES = ['low', 'med', 'high'];
  const settings = Object.assign({
    quality: input.hasTouch ? 'med' : 'high',
    muted: false,
    ghost: true,
    track: RCTrack.DEFAULT_TRACK,
  }, store.get('settings', null) || {});
  if (!RCTrack.TRACKS[settings.track]) settings.track = RCTrack.DEFAULT_TRACK;
  // URL override (session only; persisted only if the user cycles tracks)
  const urlTrack = params.get('track');
  if (urlTrack && RCTrack.TRACKS[urlTrack]) settings.track = urlTrack;

  audio.setMuted(!!settings.muted);
  hud.setQualityLabel(settings.quality);
  hud.setMuteLabel(!!settings.muted);
  hud.setGhostLabel(!!settings.ghost);

  // ------------- per-track best-time storage (+ v1.0.0 migration) -------------
  function bestKey(name) {
    return 'best.' + world.track.id + '.' + TOTAL_LAPS + 'laps.' + name;
  }
  function migrateV1Keys() {
    // v1.0.0 stored bests without a track id; those runs were on 'apex'
    for (const name of ['total', 'lap', 'splits']) {
      const oldKey = 'best.' + TOTAL_LAPS + 'laps.' + name;
      const newKey = 'best.apex.' + TOTAL_LAPS + 'laps.' + name;
      const oldVal = store.get(oldKey, null);
      if (oldVal != null && store.get(newKey, null) == null) {
        store.set(newKey, oldVal);
      }
      if (oldVal != null) store.remove(oldKey);
    }
  }

  // ---------------- world (track + scene; rebuilt on track switch) ----------------
  let world = null;
  let autopilot = null;

  function initWorld(trackId) {
    if (world) world.built.scene.dispose();
    const track = RCTrack.build(trackId);
    const built = RCScene.createScene(engine, track);
    built.applyQuality(settings.quality);
    world = { track, built };
    autopilot = AUTOPILOT ? RCAutopilot.createAutopilot(track) : null;
    queryHint = null;
    car.reset(track.startPose.x, track.startPose.z, track.startPose.theta);
    hud.setTrackLabel(track.name);
    hud.setMinimapTrack(track);
    syncCarNodes(true);
  }

  // ---------------- race state ----------------
  const STATE = { MENU: 0, COUNTDOWN: 1, RACING: 2, PAUSED: 3, FINISHED: 4 };
  let state = STATE.MENU;
  let race = null;
  let clock = 0;            // race clock, s (runs only while RACING)
  let countdownT = 0;
  let countdownStep = -1;
  let queryHint = null;
  let menuAngle = 0;
  let ghostRecorder = null;
  let ghostPlayer = null;
  let ghostPose = null;

  function placeCarAtStart() {
    const p = world.track.startPose;
    car.reset(p.x, p.z, p.theta);
    queryHint = null;
    syncCarNodes(true);
  }

  function newRace() {
    race = new RCRace.RaceManager({
      length: world.track.length,
      gateS: world.track.gates.map((g) => g.s),
      laps: TOTAL_LAPS,
      validWidth: world.track.halfWidth + 3.5,
      bestSplits: store.get(bestKey('splits'), null),
    });
    clock = 0;
    ghostRecorder = RCGhost.createRecorder();
    ghostPlayer = settings.ghost
      ? RCGhost.createPlayer(store.get(bestKey('ghost'), null))
      : null;
    ghostPose = null;
    world.built.ghost.root.setEnabled(false);
    hud.setLap(1, TOTAL_LAPS);
    hud.setTimes(0, 0);
    hud.hideDelta();
    hud.setWrongWay(false);
  }

  function startCountdown() {
    placeCarAtStart();
    newRace();
    state = STATE.COUNTDOWN;
    countdownT = 3.0;
    countdownStep = -1;
    hud.screen(null);
    hud.setHudVisible(true);
    hud.setTouchVisible(input.hasTouch);
    audio.unlock();
  }

  function goToMenu() {
    state = STATE.MENU;
    placeCarAtStart();
    world.built.ghost.root.setEnabled(false);
    hud.screen('menu');
    hud.setHudVisible(false);
    hud.setTouchVisible(false);
    hud.countdown('');
    refreshMenuBest();
  }

  function refreshMenuBest() {
    hud.setMenuBest(store.get(bestKey('total'), null), store.get(bestKey('lap'), null));
  }

  function finishRace(ev) {
    state = STATE.FINISHED;
    const prevTotal = store.get(bestKey('total'), null);
    const prevLap = store.get(bestKey('lap'), null);
    const bestLapOfRun = Math.min.apply(null, ev.lapTimes);
    const isNewBest = prevTotal == null || ev.total < prevTotal;
    if (isNewBest) {
      store.set(bestKey('total'), ev.total);
      store.set(bestKey('splits'), race.splits);
      if (ghostRecorder && ghostRecorder.sampleCount > 2) {
        store.set(bestKey('ghost'), ghostRecorder.serialize());
      }
    }
    if (prevLap == null || bestLapOfRun < prevLap) {
      store.set(bestKey('lap'), bestLapOfRun);
    }
    hud.fillFinish(ev.lapTimes, ev.total,
      isNewBest ? ev.total : prevTotal, isNewBest);
    hud.screen('finish');
    hud.setTouchVisible(false);
    if (isNewBest) audio.bestJingle();
    else audio.finishJingle();
  }

  function resetToCheckpoint() {
    if (state !== STATE.RACING || !race) return;
    const s = race.lastGateHitS();
    let pose;
    if (s == null) {
      pose = world.track.startPose;
    } else {
      const idx = RCTrack.wrapIndex(Math.round(s / world.track.step),
        world.track.samples.length);
      const sm = world.track.samples[idx];
      pose = { x: sm.x, z: sm.z, theta: Math.atan2(sm.tz, sm.tx) };
    }
    car.reset(pose.x, pose.z, pose.theta);
    queryHint = null;
    race.notifyTeleport();
    hud.setWrongWay(false);
    hud.toast('RESET — clock still running', 1500);
    syncCarNodes(true);
  }

  function togglePause() {
    if (state === STATE.RACING) {
      state = STATE.PAUSED;
      hud.screen('pause');
      hud.setTouchVisible(false);
    } else if (state === STATE.PAUSED) {
      state = STATE.RACING;
      hud.screen(null);
      hud.setTouchVisible(input.hasTouch);
    }
  }

  function toggleMute() {
    settings.muted = !settings.muted;
    audio.setMuted(settings.muted);
    hud.setMuteLabel(settings.muted);
    store.set('settings', settings);
  }

  function toggleGhost() {
    settings.ghost = !settings.ghost;
    hud.setGhostLabel(settings.ghost);
    store.set('settings', settings);
  }

  function cycleQuality() {
    const i = QUALITIES.indexOf(settings.quality);
    settings.quality = QUALITIES[(i + 1) % QUALITIES.length];
    world.built.applyQuality(settings.quality);
    hud.setQualityLabel(settings.quality);
    store.set('settings', settings);
  }

  function cycleTrack() {
    if (state !== STATE.MENU) return;
    const ids = RCTrack.trackIds();
    const i = ids.indexOf(world.track.id);
    settings.track = ids[(i + 1) % ids.length];
    store.set('settings', settings);
    initWorld(settings.track);
    refreshMenuBest();
  }

  // ---------------- wire UI ----------------
  document.getElementById('btn-start').addEventListener('click', startCountdown);
  document.getElementById('btn-restart').addEventListener('click', startCountdown);
  document.getElementById('btn-resume').addEventListener('click', togglePause);
  document.getElementById('btn-menu').addEventListener('click', goToMenu);
  document.getElementById('btn-quit').addEventListener('click', goToMenu);
  document.getElementById('btn-pause').addEventListener('click', () => {
    if (state === STATE.RACING || state === STATE.PAUSED) togglePause();
  });
  document.getElementById('btn-quality').addEventListener('click', cycleQuality);
  document.getElementById('btn-mute').addEventListener('click', toggleMute);
  document.getElementById('btn-ghost').addEventListener('click', toggleGhost);
  document.getElementById('btn-track').addEventListener('click', cycleTrack);

  input.on('confirm', () => {
    if (state === STATE.MENU || state === STATE.FINISHED) startCountdown();
    else if (state === STATE.PAUSED) togglePause();
  });
  input.on('reset', resetToCheckpoint);
  input.on('pause', () => {
    if (state === STATE.RACING || state === STATE.PAUSED) togglePause();
  });
  input.on('mute', toggleMute);
  input.on('interact', () => audio.unlock());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === STATE.RACING) togglePause();
  });

  window.addEventListener('resize', () => engine.resize());

  // ---------------- race events ----------------
  function handleRaceEvents(events) {
    for (const ev of events) {
      if (ev.type === 'gate') {
        if (ev.delta != null) hud.showDelta(ev.delta);
      } else if (ev.type === 'lap') {
        if (!race.finished) {
          hud.toast('LAP ' + ev.lap + '  —  ' + hud.fmt(ev.time), 2600);
          hud.setLap(race.lap, TOTAL_LAPS);
          audio.lapChime();
        }
      } else if (ev.type === 'finish') {
        finishRace(ev);
      } else if (ev.type === 'wrongway') {
        hud.setWrongWay(ev.active);
        if (ev.active) audio.warnBuzz();
      } else if (ev.type === 'missedGate') {
        hud.toast('CHECKPOINT MISSED — go back to complete the lap', 3200);
        audio.warnBuzz();
      }
    }
  }

  // ---------------- per-frame ----------------
  function syncCarNodes(snap) {
    const nodes = world.built.car;
    nodes.root.position.x = car.x;
    nodes.root.position.z = car.z;
    nodes.root.rotation.y = Math.PI / 2 - car.theta;
    // visual suspension: roll around the mesh's forward (z) axis, pitch
    // around the lateral (x) axis (signs tuned to lean out of corners /
    // squat under acceleration)
    nodes.bodyNode.rotation.z = -car.roll;
    nodes.bodyNode.rotation.x = -car.pitch;
    for (const w of nodes.wheels) {
      w.hub.rotation.x = car.wheelSpin % (Math.PI * 2);
      if (w.front) w.pivot.rotation.y = -car.steerAngle;
    }
    if (snap) {
      updateCamera(1, true);
    }
  }

  function syncGhost() {
    const gRoot = world.built.ghost.root;
    if (!ghostPose) {
      if (gRoot.isEnabled()) gRoot.setEnabled(false);
      return;
    }
    if (!gRoot.isEnabled()) gRoot.setEnabled(true);
    gRoot.position.x = ghostPose.x;
    gRoot.position.z = ghostPose.z;
    gRoot.rotation.y = Math.PI / 2 - ghostPose.theta;
  }

  function updateCamera(dt, snap) {
    const camera = world.built.camera;
    const fwdX = Math.cos(car.theta), fwdZ = Math.sin(car.theta);
    const v = car.speed;
    if (state === STATE.MENU) {
      menuAngle += dt * 0.12;
      const cx = car.x + Math.cos(menuAngle) * 26;
      const cz = car.z + Math.sin(menuAngle) * 26;
      camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 2);
      camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 2);
      camera.position.y += (9 - camera.position.y) * Math.min(1, dt * 2);
      camera.setTarget(new BABYLON.Vector3(car.x, 1.2, car.z));
      return;
    }
    const back = 8.2 + v * 0.075;
    const height = 3.1 + v * 0.02;
    const desired = new BABYLON.Vector3(
      car.x - fwdX * back, height, car.z - fwdZ * back);
    if (snap) {
      camera.position.copyFrom(desired);
    } else {
      const k = 1 - Math.exp(-dt * 5.5);
      camera.position.x += (desired.x - camera.position.x) * k;
      camera.position.y += (desired.y - camera.position.y) * k;
      camera.position.z += (desired.z - camera.position.z) * k;
    }
    camera.setTarget(new BABYLON.Vector3(
      car.x + fwdX * 7, 1.1, car.z + fwdZ * 7));
    camera.fov = 0.95 + Math.min(0.14, v * 0.0022);
  }

  function frame() {
    // cap at 100 ms: car.step substeps internally, and clock uses the same
    // capped dt so the race timer and physics can never diverge
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1) || 0.016;

    if (state === STATE.COUNTDOWN) {
      countdownT -= dt;
      const step = Math.ceil(Math.max(countdownT, 0));
      if (step !== countdownStep) {
        countdownStep = step;
        if (step > 0) {
          hud.countdown(String(step));
          audio.countdownBeep();
        }
      }
      if (countdownT <= 0) {
        state = STATE.RACING;
        hud.countdown('GO!', true);
        audio.goBeep();
        setTimeout(() => hud.countdown(''), 900);
      }
    } else if (state === STATE.RACING) {
      clock += dt;

      let q = RCTrack.query(world.track, car.x, car.z, queryHint);
      queryHint = q.idx;
      const onTrack = Math.abs(q.d) <= world.track.halfWidth + 0.3;

      const ctrl = autopilot ? autopilot.drive(car, q) : input.control;
      car.step(dt, ctrl,
        onTrack ? { grip: 1 } : { grip: 0.55, extraDrag: 900 });

      q = RCTrack.query(world.track, car.x, car.z, queryHint);
      queryHint = q.idx;
      const wall = RCTrack.wallAt(world.track, q.idx);
      if (wall) car.hitWall(q, wall);

      handleRaceEvents(race.update({
        s: q.s, d: q.d, speed: car.speed, dt, clock,
      }));

      if (ghostRecorder) ghostRecorder.add(clock, car.x, car.z, car.theta);
      ghostPose = ghostPlayer ? ghostPlayer.sampleAt(clock) : null;

      hud.setTimes(clock - race.lapStartClock, clock);
      hud.setSpeed(car.speed * 3.6);
      audio.update(
        Math.min(1, Math.abs(car.vLong) / 52),
        ctrl.throttle,
        car.slipping ? car.slipMag : 0,
        true);
    } else {
      audio.update(0, 0, 0, false);
    }

    syncGhost();
    syncCarNodes(false);
    updateCamera(dt, false);
    if (state === STATE.COUNTDOWN || state === STATE.RACING) {
      hud.drawMinimap(car, ghostPose);
    }
    world.built.scene.render();
  }

  // ---------------- version display ----------------
  if (typeof VERSION_INFO !== 'undefined') {
    const vEl = document.getElementById('menu-version');
    if (vEl) {
      vEl.textContent = VERSION_INFO.getVersionString();
      vEl.title = VERSION_INFO.getDetailedInfo();
    }
  }

  // ---------------- start ----------------
  initWorld(settings.track);
  migrateV1Keys();
  goToMenu();
  engine.runRenderLoop(frame);

  // debug/testing hook
  window.__rc = {
    get state() { return state; },
    STATE, car, engine, store,
    get track() { return world.track; },
    get trackId() { return world.track.id; },
    get scene() { return world.built.scene; },
    get race() { return race; },
    get clock() { return clock; },
    get ghostActive() { return !!ghostPose; },
    startCountdown, resetToCheckpoint, cycleTrack,
  };
})();
