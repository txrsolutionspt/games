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
    };
    let toastTimer = null, deltaTimer = null;

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
    };
  }

  const api = { createHud, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCHud = api;
})(typeof window !== 'undefined' ? window : globalThis);
