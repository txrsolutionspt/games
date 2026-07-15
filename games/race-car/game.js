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
    mode: 'time-trial', // 'time-trial' | 'race'
    difficulty: 'medium',
    rivals: 3,
    // driving feel: assists default ON so the car doesn't power-slide out
    // of every slow corner under binary keyboard throttle
    driving: {
      handling: 'normal',
      steering: 'standard',
      traction: true,
      stability: true,
      countersteer: true,
      pedal: 'smooth',
    },
  }, store.get('settings', null) || {});
  settings.driving = Object.assign({
    handling: 'normal', steering: 'standard', traction: true, stability: true,
    countersteer: true, pedal: 'smooth',
  }, settings.driving || {});
  if (!RCTrack.TRACKS[settings.track]) settings.track = RCTrack.DEFAULT_TRACK;
  if (settings.mode !== 'race') settings.mode = 'time-trial';
  if (!RCOpponents.DIFFICULTIES[settings.difficulty]) settings.difficulty = 'medium';
  if (settings.rivals !== 3 && settings.rivals !== 5) settings.rivals = 3;
  // URL overrides (session only; persisted only if the user cycles them)
  const urlTrack = params.get('track');
  if (urlTrack && RCTrack.TRACKS[urlTrack]) settings.track = urlTrack;
  if (params.get('mode') === 'race') settings.mode = 'race';
  const urlDiff = params.get('difficulty');
  if (urlDiff && RCOpponents.DIFFICULTIES[urlDiff]) settings.difficulty = urlDiff;
  const urlRivals = parseInt(params.get('rivals'), 10);
  if (urlRivals === 3 || urlRivals === 5) settings.rivals = urlRivals;

  const isRaceMode = () => settings.mode === 'race';

  audio.setMuted(!!settings.muted);
  hud.setQualityLabel(settings.quality);
  hud.setMuteLabel(!!settings.muted);
  hud.setGhostLabel(!!settings.ghost);
  hud.setModeLabel(settings.mode);
  hud.setDifficultyLabel(settings.difficulty);
  hud.setRivalsLabel(settings.rivals);
  car.setTuning(settings.driving);
  input.setPedalMode(settings.driving.pedal);
  hud.setDrivingLabels(settings.driving);
  input.on('padconnected', () =>
    hud.toast('\u{1F3AE} Controller connected', 2500));

  // ------------- per-track best-time storage (+ v1.0.0 migration) -------------
  // Some tracks force a lap count (a drag strip is a single run)
  function raceLaps() {
    return (world && world.track.forcedLaps) || TOTAL_LAPS;
  }
  function bestKey(name) {
    return 'best.' + world.track.id + '.' + raceLaps() + 'laps.' + name;
  }
  // sector bests are per-lap segments, so they're lap-count independent
  function sectorKey() { return 'best.' + world.track.id + '.sectors'; }
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
  const STATE = { MENU: 0, COUNTDOWN: 1, RACING: 2, PAUSED: 3, FINISHED: 4, REPLAY: 5 };
  let state = STATE.MENU;
  let race = null;
  let clock = 0;            // race clock, s (runs only while RACING)
  let countdownT = 0;
  let countdownStep = -1;
  let queryHint = null;
  let menuAngle = 0;
  let pulseT = 0; // free-running timer for the active-gate pulse
  let ghostRecorder = null;
  let ghostPlayer = null;
  let ghostPose = null;
  let bestSectors = null;    // all-time best per sector (persisted)
  let sessionSectors = null; // best per sector within the current race
  let stats = null;          // per-race driving stats
  let opponents = null;      // AI pack (Race mode only)
  let playerPos = 1;         // live standing in Race mode
  let lastQ = null;          // most recent track query for the player
  // replay viewer
  let replayPlayer = null;
  let replayDirector = null;
  let replayT = 0;
  let replaySpeed = 1;
  let replayPaused = false;
  let replayHint = null;
  let replayPrev = null;     // previous pose, for speed/steer derivation

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
      laps: raceLaps(),
      closed: world.track.closed,
      validWidth: world.track.halfWidth + 3.5,
      // checkpoint deltas track your TT best — meaningless with traffic
      bestSplits: isRaceMode() ? null : store.get(bestKey('splits'), null),
    });
    clock = 0;
    ghostRecorder = RCGhost.createRecorder();
    // no ghost in Race mode — three live opponents are enough traffic
    ghostPlayer = settings.ghost && !isRaceMode()
      ? RCGhost.createPlayer(store.get(bestKey('ghost'), null))
      : null;
    ghostPose = null;
    world.built.ghost.root.setEnabled(false);
    bestSectors = store.get(sectorKey(), null) || [null, null, null];
    sessionSectors = [Infinity, Infinity, Infinity];
    stats = { topSpeed: 0, offTrack: 0, driftTime: 0, resets: 0 };
    lastQ = null;
    if (isRaceMode()) {
      opponents = RCOpponents.createOpponents(world.track, raceLaps(), {
        count: settings.rivals,
        difficulty: settings.difficulty,
      });
      playerPos = opponents.entries.length + 1; // everyone starts ahead
      syncOpponentNodes();
      world.built.opponents.forEach((n, i) =>
        n.root.setEnabled(i < opponents.entries.length));
      hud.setPositionVisible(true);
      hud.setPosition(playerPos, opponents.entries.length + 1);
    } else {
      opponents = null;
      world.built.opponents.forEach((n) => n.root.setEnabled(false));
      hud.setPositionVisible(false);
    }
    hud.setLap(1, raceLaps());
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
    world.built.opponents.forEach((n) => n.root.setEnabled(false));
    opponents = null;
    hud.screen('menu');
    hud.setHudVisible(false);
    hud.setTouchVisible(false);
    hud.countdown('');
    refreshMenuBest();
  }

  function refreshMenuBest() {
    const pb = store.get(bestKey('total'), null);
    hud.setMenuBest(pb, store.get(bestKey('lap'), null));
    hud.setMenuMedals(world.track.medals, raceLaps(),
      RCRace.medalFor(pb, world.track.medals, raceLaps()));
    hud.setReplayAvailable(store.get(bestKey('ghost'), null) != null);
  }

  // ---------------- replay viewer ----------------
  function startReplay() {
    if (state !== STATE.MENU) return;
    const player = RCGhost.createPlayer(store.get(bestKey('ghost'), null));
    if (!player) return;
    replayPlayer = player;
    replayDirector = RCReplayCam.createDirector(world.track);
    replayT = 0;
    replaySpeed = 1;
    replayPaused = false;
    replayHint = null;
    replayPrev = null;
    state = STATE.REPLAY;
    hud.screen(null);
    hud.setHudVisible(false);
    hud.setTouchVisible(false);
    hud.setReplayBarVisible(true);
    hud.setReplaySpeedLabel(replaySpeed);
    hud.setReplayPausedLabel(false);
    audio.unlock();
  }

  function exitReplay() {
    replayPlayer = null;
    replayDirector = null;
    hud.setReplayBarVisible(false);
    goToMenu();
  }

  function toggleReplayPause() {
    replayPaused = !replayPaused;
    hud.setReplayPausedLabel(replayPaused);
  }

  function cycleReplaySpeed() {
    replaySpeed = replaySpeed === 1 ? 2 : 1;
    hud.setReplaySpeedLabel(replaySpeed);
  }

  function finishRace(ev) {
    state = STATE.FINISHED;
    if (isRaceMode()) {
      // Race mode result = finishing position; time-trial PBs/ghosts/medals
      // are reserved for clean laps without traffic
      const order = opponents.standings({ rm: race, q: lastQ, finishTime: ev.total });
      const pos = order.findIndex((r) => r.you) + 1;
      hud.fillFinishRace(order, pos, ev.total, stats);
      hud.screen('finish');
      hud.setTouchVisible(false);
      if (pos === 1) audio.bestJingle();
      else audio.finishJingle();
      return;
    }
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
    const medal = RCRace.medalFor(ev.total, world.track.medals, raceLaps());
    hud.fillFinish(ev.lapTimes, ev.total,
      isNewBest ? ev.total : prevTotal, isNewBest, {
        medal,
        medals: world.track.medals,
        laps: raceLaps(),
        stats,
      });
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
    if (stats) stats.resets++;
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

  function toggleMode() {
    if (state !== STATE.MENU) return;
    settings.mode = isRaceMode() ? 'time-trial' : 'race';
    store.set('settings', settings);
    hud.setModeLabel(settings.mode);
  }

  function cycleDifficulty() {
    if (state !== STATE.MENU) return;
    const ids = Object.keys(RCOpponents.DIFFICULTIES);
    const i = ids.indexOf(settings.difficulty);
    settings.difficulty = ids[(i + 1) % ids.length];
    store.set('settings', settings);
    hud.setDifficultyLabel(settings.difficulty);
  }

  function cycleRivals() {
    if (state !== STATE.MENU) return;
    settings.rivals = settings.rivals === 3 ? 5 : 3;
    store.set('settings', settings);
    hud.setRivalsLabel(settings.rivals);
  }

  // ---------------- driving settings ----------------
  function applyDriving() {
    car.setTuning(settings.driving);
    input.setPedalMode(settings.driving.pedal);
    store.set('settings', settings);
    hud.setDrivingLabels(settings.driving);
  }

  function cycleDrivingOption(key) {
    const d = settings.driving;
    if (key === 'handling') {
      const order = ['grip', 'normal', 'drift'];
      d.handling = order[(order.indexOf(d.handling) + 1) % order.length];
    } else if (key === 'steering') {
      const order = ['relaxed', 'standard', 'sharp'];
      d.steering = order[(order.indexOf(d.steering) + 1) % order.length];
    } else if (key === 'traction') {
      d.traction = !d.traction;
    } else if (key === 'stability') {
      d.stability = !d.stability;
    } else if (key === 'countersteer') {
      d.countersteer = !d.countersteer;
    } else if (key === 'pedal') {
      d.pedal = d.pedal === 'smooth' ? 'instant' : 'smooth';
    }
    applyDriving();
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
  document.getElementById('btn-mode').addEventListener('click', toggleMode);
  document.getElementById('btn-difficulty').addEventListener('click', cycleDifficulty);
  document.getElementById('btn-rivals').addEventListener('click', cycleRivals);
  document.getElementById('btn-driving').addEventListener('click', () => {
    if (state === STATE.MENU) hud.screen('driving');
  });
  document.getElementById('btn-driving-back').addEventListener('click', () => {
    hud.screen('menu');
  });
  document.getElementById('opt-handling').addEventListener('click', () => cycleDrivingOption('handling'));
  document.getElementById('opt-steering').addEventListener('click', () => cycleDrivingOption('steering'));
  document.getElementById('opt-traction').addEventListener('click', () => cycleDrivingOption('traction'));
  document.getElementById('opt-stability').addEventListener('click', () => cycleDrivingOption('stability'));
  document.getElementById('opt-countersteer').addEventListener('click', () => cycleDrivingOption('countersteer'));
  document.getElementById('opt-pedal').addEventListener('click', () => cycleDrivingOption('pedal'));
  document.getElementById('btn-replay').addEventListener('click', startReplay);
  document.getElementById('btn-replay-exit').addEventListener('click', exitReplay);
  document.getElementById('btn-replay-pause').addEventListener('click', toggleReplayPause);
  document.getElementById('btn-replay-speed').addEventListener('click', cycleReplaySpeed);

  input.on('confirm', () => {
    if (state === STATE.MENU || state === STATE.FINISHED) startCountdown();
    else if (state === STATE.PAUSED) togglePause();
    else if (state === STATE.REPLAY) toggleReplayPause();
  });
  input.on('reset', resetToCheckpoint);
  input.on('pause', () => {
    if (state === STATE.RACING || state === STATE.PAUSED) togglePause();
    else if (state === STATE.REPLAY) exitReplay();
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
      } else if (ev.type === 'sector') {
        // purple = all-time best, green = best of this race, plain otherwise
        let tier = 'plain';
        if (bestSectors[ev.sector] == null || ev.time < bestSectors[ev.sector]) {
          tier = 'purple';
          bestSectors[ev.sector] = ev.time;
          store.set(sectorKey(), bestSectors);
        } else if (ev.time < sessionSectors[ev.sector]) {
          tier = 'green';
        }
        sessionSectors[ev.sector] = Math.min(sessionSectors[ev.sector], ev.time);
        hud.showSector(ev.sector, ev.time, tier);
      } else if (ev.type === 'lap') {
        if (!race.finished) {
          hud.toast('LAP ' + ev.lap + '  —  ' + hud.fmt(ev.time), 2600);
          hud.setLap(race.lap, raceLaps());
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

  function syncOpponentNodes() {
    if (!opponents) return;
    opponents.entries.forEach((e, i) => {
      const nodes = world.built.opponents[i];
      if (!nodes) return;
      nodes.root.position.x = e.car.x;
      nodes.root.position.z = e.car.z;
      nodes.root.rotation.y = Math.PI / 2 - e.car.theta;
      nodes.bodyNode.rotation.z = -e.car.roll;
      nodes.bodyNode.rotation.x = -e.car.pitch;
      for (const w of nodes.wheels) {
        w.hub.rotation.x = e.car.wheelSpin % (Math.PI * 2);
        if (w.front) w.pivot.rotation.y = -e.car.steerAngle;
      }
    });
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
    input.update(dt); // pedal ramping + gamepad polling

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

      if (opponents) {
        opponents.update(dt, clock);
        opponents.resolveCollisions(
          [car].concat(opponents.entries.map((e) => e.car)));
      }

      q = RCTrack.query(world.track, car.x, car.z, queryHint);
      queryHint = q.idx;
      lastQ = q;
      const wall = RCTrack.wallAt(world.track, q.idx);
      if (wall) car.hitWall(q, wall);

      handleRaceEvents(race.update({
        s: q.s, d: q.d, speed: car.speed, dt, clock,
      }));

      if (opponents && !race.finished) {
        const order = opponents.standings({ rm: race, q, finishTime: null });
        const pos = order.findIndex((r) => r.you) + 1;
        if (pos !== playerPos) {
          playerPos = pos;
          hud.setPosition(pos, order.length);
        }
      }

      if (ghostRecorder) ghostRecorder.add(clock, car.x, car.z, car.theta);
      ghostPose = ghostPlayer ? ghostPlayer.sampleAt(clock) : null;

      stats.topSpeed = Math.max(stats.topSpeed, car.speed);
      if (!onTrack) stats.offTrack += dt;
      if (car.slipping) stats.driftTime += dt;

      hud.setTimes(clock - race.lapStartClock, clock);
      hud.setSpeed(car.speed * 3.6);
      audio.update(
        Math.min(1, Math.abs(car.vLong) / 52),
        ctrl.throttle,
        car.slipping ? car.slipMag : 0,
        true);
    } else if (state === STATE.REPLAY && replayPlayer) {
      if (!replayPaused) replayT += dt * replaySpeed;
      if (replayT > replayPlayer.duration) replayT = 0; // loop the show
      const pose = replayPlayer.sampleAt(replayT) ||
        replayPlayer.sampleAt(replayPlayer.duration);

      // derive speed/steer for wheel + body animation
      let v = 0, yawRate = 0;
      if (replayPrev && !replayPaused) {
        v = Math.hypot(pose.x - replayPrev.x, pose.z - replayPrev.z) /
          Math.max(dt * replaySpeed, 1e-4);
        let dth = pose.theta - replayPrev.theta;
        while (dth > Math.PI) dth -= 2 * Math.PI;
        while (dth < -Math.PI) dth += 2 * Math.PI;
        yawRate = dth / Math.max(dt * replaySpeed, 1e-4);
      }
      replayPrev = pose;
      car.x = pose.x; car.z = pose.z; car.theta = pose.theta;
      if (!replayPaused) {
        car.wheelSpin += (v / 0.33) * dt * replaySpeed;
        car.steerAngle = Math.max(-0.5, Math.min(0.5,
          yawRate * 2.6 / Math.max(v, 3)));
        const latG = Math.max(-1.3, Math.min(1.3, v * yawRate / 9.81));
        car.roll += (-latG * 0.062 - car.roll) * Math.min(1, dt * 7);
      }

      const q = RCTrack.query(world.track, pose.x, pose.z, replayHint);
      replayHint = q.idx;
      const shot = replayDirector.update(replayT, pose, q.s);
      const camera = world.built.camera;
      if (shot.cut) {
        camera.position.set(shot.pos.x, shot.pos.y, shot.pos.z);
      } else if (shot.smooth > 0) {
        const k = 1 - Math.exp(-dt * shot.smooth);
        camera.position.x += (shot.pos.x - camera.position.x) * k;
        camera.position.y += (shot.pos.y - camera.position.y) * k;
        camera.position.z += (shot.pos.z - camera.position.z) * k;
      }
      camera.setTarget(new BABYLON.Vector3(
        shot.target.x, shot.target.y, shot.target.z));
      camera.fov = 0.9;

      hud.setReplayTime(replayT, replayPlayer.duration);
      audio.update(Math.min(1, v / 52), replayPaused ? 0 : 0.45, 0, !replayPaused);
    } else {
      audio.update(0, 0, 0, false);
    }

    // checkpoint gate highlight: show the player's next required gate
    pulseT += dt;
    const inPlay = state === STATE.COUNTDOWN || state === STATE.RACING ||
      state === STATE.PAUSED;
    world.built.gates.setActive(inPlay && race && !race.finished ? race.nextGate : -1);
    world.built.gates.pulse(pulseT);

    syncGhost();
    syncOpponentNodes();
    syncCarNodes(false);
    if (state !== STATE.REPLAY) updateCamera(dt, false); // director owns the replay cam
    if (state === STATE.COUNTDOWN || state === STATE.RACING || state === STATE.REPLAY) {
      const nextGate = (state !== STATE.REPLAY && race && !race.finished)
        ? world.track.gates[race.nextGate] : null;
      hud.drawMinimap(car, ghostPose,
        opponents ? opponents.entries.map((e) => ({
          x: e.car.x, z: e.car.z, color: e.color,
        })) : null,
        nextGate);
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
    STATE, car, engine, store, input,
    get track() { return world.track; },
    get trackId() { return world.track.id; },
    get scene() { return world.built.scene; },
    get gates() { return world.built.gates; },
    get race() { return race; },
    get clock() { return clock; },
    get ghostActive() { return !!ghostPose; },
    get opponents() { return opponents; },
    get mode() { return settings.mode; },
    get playerPos() { return playerPos; },
    get replayT() { return replayT; },
    get replayDuration() { return replayPlayer ? replayPlayer.duration : 0; },
    startCountdown, resetToCheckpoint, cycleTrack, toggleMode,
    startReplay, exitReplay,
  };
})();
