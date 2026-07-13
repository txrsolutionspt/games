/*
 * hud.js — DOM overlay: timers, lap counter, speed, deltas, toasts,
 * countdown and the menu/pause/finish screens.
 */
(function (global) {
  'use strict';

  function fmt(t) {
    if (t == null || !isFinite(t)) return '—';
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  function fmtDelta(d) {
    return (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(2);
  }

  function createHud() {
    const $ = (id) => document.getElementById(id);
    const el = {
      hud: $('hud'), lap: $('hud-lap'), laptime: $('hud-laptime'),
      total: $('hud-total'), delta: $('hud-delta'), speed: $('hud-speed-val'),
      wrongway: $('hud-wrongway'), toast: $('hud-toast'), countdown: $('countdown'),
      touch: $('touch-controls'),
      menu: $('screen-menu'), pause: $('screen-pause'), finish: $('screen-finish'),
      menuBest: $('menu-best'), menuBestTotal: $('menu-best-total'),
      menuBestLap: $('menu-best-lap'),
      finishLaps: $('finish-laps'), finishTotal: $('finish-total'),
      finishPb: $('finish-pb'), finishNewBest: $('finish-newbest'),
      qualityBtn: $('btn-quality'), muteBtn: $('btn-mute'),
      ghostBtn: $('btn-ghost'), trackBtn: $('btn-track'),
      minimap: $('minimap'),
    };
    let toastTimer = null, deltaTimer = null;

    // ---- minimap: track outline cached as a Path2D + fit transform ----
    const mm = { path: null, sx: 1, sz: 1, ox: 0, oz: 0, start: null };
    function mmPoint(x, z) { return [mm.ox + x * mm.sx, mm.oz + z * mm.sz]; }
    function setMinimapTrack(track) {
      if (!el.minimap) return;
      const ctx = el.minimap.getContext('2d');
      const W = el.minimap.width, H = el.minimap.height, PAD = 10;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const sm of track.samples) {
        minX = Math.min(minX, sm.x); maxX = Math.max(maxX, sm.x);
        minZ = Math.min(minZ, sm.z); maxZ = Math.max(maxZ, sm.z);
      }
      const scale = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD) / (maxZ - minZ));
      mm.sx = scale;
      mm.sz = -scale; // world +z up on the map
      mm.ox = (W - (maxX + minX) * scale) / 2;
      mm.oz = (H + (maxZ + minZ) * scale) / 2;
      const path = new Path2D();
      track.samples.forEach((sm, i) => {
        const [px, pz] = mmPoint(sm.x, sm.z);
        if (i === 0) path.moveTo(px, pz);
        else path.lineTo(px, pz);
      });
      path.closePath();
      mm.path = path;
      mm.start = mmPoint(track.samples[0].x, track.samples[0].z);
      ctx.clearRect(0, 0, W, H); // stale frame from the previous track
    }
    function drawMinimap(car, ghostPose) {
      if (!el.minimap || !mm.path) return;
      const ctx = el.minimap.getContext('2d');
      const W = el.minimap.width, H = el.minimap.height;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineJoin = 'round';
      ctx.stroke(mm.path);
      // start/finish marker
      ctx.fillStyle = 'rgba(255,209,102,0.9)';
      ctx.beginPath();
      ctx.arc(mm.start[0], mm.start[1], 3, 0, Math.PI * 2);
      ctx.fill();
      // ghost dot (under the car dot)
      if (ghostPose) {
        const [gx, gz] = mmPoint(ghostPose.x, ghostPose.z);
        ctx.fillStyle = 'rgba(140,190,240,0.9)';
        ctx.beginPath();
        ctx.arc(gx, gz, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      // car dot
      const [cx, cz] = mmPoint(car.x, car.z);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cz, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    function show(node, yes) { node.classList.toggle('hidden', !yes); }

    return {
      fmt,
      setLap(lap, total) { el.lap.textContent = 'LAP ' + lap + '/' + total; },
      setTimes(lapT, totalT) {
        el.laptime.textContent = fmt(lapT);
        el.total.textContent = fmt(totalT);
      },
      setSpeed(kmh) { el.speed.textContent = Math.round(kmh); },
      showDelta(delta) {
        el.delta.textContent = fmtDelta(delta);
        el.delta.classList.toggle('ahead', delta < 0);
        el.delta.classList.toggle('behind', delta >= 0);
        show(el.delta, true);
        clearTimeout(deltaTimer);
        deltaTimer = setTimeout(() => show(el.delta, false), 3200);
      },
      hideDelta() { show(el.delta, false); },
      setWrongWay(on) { show(el.wrongway, on); },
      toast(msg, ms) {
        el.toast.textContent = msg;
        show(el.toast, true);
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => show(el.toast, false), ms || 2600);
      },
      countdown(text, isGo) {
        el.countdown.textContent = text;
        el.countdown.classList.toggle('go', !!isGo);
        show(el.countdown, text !== '');
      },
      setHudVisible(v) { show(el.hud, v); },
      setTouchVisible(v) { show(el.touch, v); },
      screen(name) {
        show(el.menu, name === 'menu');
        show(el.pause, name === 'pause');
        show(el.finish, name === 'finish');
      },
      setMenuBest(total, lap) {
        show(el.menuBest, total != null);
        el.menuBestTotal.textContent = fmt(total);
        el.menuBestLap.textContent = fmt(lap);
      },
      fillFinish(lapTimes, total, pb, isNewBest) {
        el.finishLaps.innerHTML = '';
        const best = Math.min.apply(null, lapTimes);
        lapTimes.forEach((t, i) => {
          const tr = document.createElement('tr');
          if (t === best) tr.className = 'best-lap';
          const td1 = document.createElement('td');
          td1.textContent = 'LAP ' + (i + 1) + (t === best ? ' ★' : '');
          const td2 = document.createElement('td');
          td2.textContent = fmt(t);
          tr.appendChild(td1);
          tr.appendChild(td2);
          el.finishLaps.appendChild(tr);
        });
        el.finishTotal.textContent = fmt(total);
        el.finishPb.textContent = fmt(pb);
        show(el.finishNewBest, !!isNewBest);
      },
      setQualityLabel(q) { el.qualityBtn.textContent = 'QUALITY: ' + q.toUpperCase(); },
      setMuteLabel(muted) { el.muteBtn.textContent = 'SOUND: ' + (muted ? 'OFF' : 'ON'); },
      setGhostLabel(on) { el.ghostBtn.textContent = 'GHOST: ' + (on ? 'ON' : 'OFF'); },
      setTrackLabel(name) { el.trackBtn.textContent = 'TRACK: ' + name; },
      setMinimapTrack,
      drawMinimap,
    };
  }

  const api = { createHud, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCHud = api;
})(typeof window !== 'undefined' ? window : globalThis);
