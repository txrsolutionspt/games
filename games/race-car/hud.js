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
      gate: $('hud-gate'),
      sector: $('hud-sector'), menuMedals: $('menu-medals'),
      finishMedal: $('finish-medal'), finishStats: $('finish-stats'),
      modeBtn: $('btn-mode'), pos: $('hud-pos'),
      difficultyBtn: $('btn-difficulty'), rivalsBtn: $('btn-rivals'),
      driving: $('screen-driving'),
      optHandling: $('opt-handling'), optSteering: $('opt-steering'),
      optTraction: $('opt-traction'), optStability: $('opt-stability'),
      optCountersteer: $('opt-countersteer'), optPedal: $('opt-pedal'),
      replayBtn: $('btn-replay'), replayBar: $('replay-bar'),
      replayTime: $('replay-time'), replayPauseBtn: $('btn-replay-pause'),
      replaySpeedBtn: $('btn-replay-speed'),
      finishPosition: $('finish-position'), finishTable: $('finish-table'),
      raceResults: $('race-results'),
    };
    let toastTimer = null, deltaTimer = null, sectorTimer = null, gateTimer = null;
    const MEDAL_ICONS = { gold: '\u{1F947}', silver: '\u{1F948}', bronze: '\u{1F949}' };

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
      if (track.closed !== false) path.closePath();
      mm.path = path;
      mm.start = mmPoint(track.samples[0].x, track.samples[0].z);
      ctx.clearRect(0, 0, W, H); // stale frame from the previous track
    }
    function drawMinimap(car, ghostPose, aiPoses, nextGate) {
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
      // next checkpoint: amber ring
      if (nextGate) {
        const [gx, gz] = mmPoint(nextGate.x, nextGate.z);
        ctx.strokeStyle = 'rgba(255,196,60,0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gx, gz, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      // AI opponent dots (under the car dot)
      if (aiPoses) {
        for (const p of aiPoses) {
          const [ax, az] = mmPoint(p.x, p.z);
          ctx.fillStyle = 'rgb(' + Math.round(p.color[0] * 255) + ',' +
            Math.round(p.color[1] * 255) + ',' + Math.round(p.color[2] * 255) + ')';
          ctx.beginPath();
          ctx.arc(ax, az, 3.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
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
      // checkpoint confirmation: "CP 5/12 ✓ 8.42" (time since previous gate)
      showGateSplit(num, total, sinceLast) {
        el.gate.textContent = 'CP ' + num + '/' + total + ' ✓ ' +
          (sinceLast != null ? sinceLast.toFixed(2) : '');
        show(el.gate, true);
        clearTimeout(gateTimer);
        gateTimer = setTimeout(() => show(el.gate, false), 2200);
      },
      showSector(sector, time, tier) {
        el.sector.textContent = 'S' + (sector + 1) + '  ' + fmt(time);
        el.sector.className = 'hud-box sector-' + tier;
        show(el.sector, true);
        clearTimeout(sectorTimer);
        sectorTimer = setTimeout(() => show(el.sector, false), 3000);
      },
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
        show(el.driving, name === 'driving');
      },
      setDrivingLabels(d) {
        el.optHandling.textContent = 'HANDLING: ' + d.handling.toUpperCase();
        el.optSteering.textContent = 'STEERING: ' + d.steering.toUpperCase();
        el.optTraction.textContent = 'TRACTION CONTROL: ' + (d.traction ? 'ON' : 'OFF');
        el.optStability.textContent = 'STABILITY ASSIST: ' + (d.stability ? 'ON' : 'OFF');
        el.optCountersteer.textContent = 'COUNTER-STEER ASSIST: ' + (d.countersteer ? 'ON' : 'OFF');
        el.optPedal.textContent = 'PEDAL RESPONSE: ' + d.pedal.toUpperCase();
      },
      setMenuBest(total, lap) {
        show(el.menuBest, total != null);
        el.menuBestTotal.textContent = fmt(total);
        el.menuBestLap.textContent = fmt(lap);
      },
      // medals: per-lap targets from the track registry; earned: medal id or null
      setMenuMedals(medals, laps, earned) {
        if (!el.menuMedals) return;
        el.menuMedals.innerHTML = '';
        for (const tier of ['gold', 'silver', 'bronze']) {
          const span = document.createElement('span');
          span.className = 'medal-target' + (earned === tier ? ' earned' : '');
          span.textContent = MEDAL_ICONS[tier] + ' ' + fmt(medals[tier] * laps);
          el.menuMedals.appendChild(span);
        }
      },
      fillFinish(lapTimes, total, pb, isNewBest, extra) {
        // restore time-trial layout (a Race-mode finish may have hidden it)
        show(el.finishTable, true);
        if (el.raceResults) show(el.raceResults, false);
        if (el.finishPosition) show(el.finishPosition, false);
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

        // medal banner (earned) or the next target to chase
        if (el.finishMedal && extra && extra.medals) {
          if (extra.medal) {
            el.finishMedal.textContent =
              MEDAL_ICONS[extra.medal] + ' ' + extra.medal.toUpperCase() + ' MEDAL';
            el.finishMedal.className = 'finish-medal medal-' + extra.medal;
          } else {
            el.finishMedal.textContent =
              'Target: ' + MEDAL_ICONS.bronze + ' ' + fmt(extra.medals.bronze * extra.laps);
            el.finishMedal.className = 'finish-medal medal-none';
          }
          // hint the next tier up when one was earned but not gold
          if (extra.medal === 'bronze' || extra.medal === 'silver') {
            const next = extra.medal === 'bronze' ? 'silver' : 'gold';
            el.finishMedal.textContent += '  ·  next: ' +
              MEDAL_ICONS[next] + ' ' + fmt(extra.medals[next] * extra.laps);
          }
          show(el.finishMedal, true);
        } else if (el.finishMedal) {
          show(el.finishMedal, false);
        }

        // driving stats
        if (el.finishStats && extra && extra.stats) {
          const s = extra.stats;
          const spread = lapTimes.length > 1
            ? Math.max.apply(null, lapTimes) - Math.min.apply(null, lapTimes)
            : null;
          const rows = [
            ['Top speed', Math.round(s.topSpeed * 3.6) + ' km/h'],
            ['Time off track', s.offTrack.toFixed(1) + ' s'],
            ['Drift time', s.driftTime.toFixed(1) + ' s'],
            ['Resets', String(s.resets)],
          ];
          if (spread != null) rows.push(['Lap consistency', '±' + fmt(spread)]);
          el.finishStats.innerHTML = '';
          for (const [label, value] of rows) {
            const div = document.createElement('div');
            div.className = 'stat';
            const l = document.createElement('span');
            l.className = 'stat-label';
            l.textContent = label;
            const v = document.createElement('span');
            v.className = 'stat-value';
            v.textContent = value;
            div.appendChild(l);
            div.appendChild(v);
            el.finishStats.appendChild(div);
          }
        }
      },
      setQualityLabel(q) { el.qualityBtn.textContent = 'QUALITY: ' + q.toUpperCase(); },
      setMuteLabel(muted) { el.muteBtn.textContent = 'SOUND: ' + (muted ? 'OFF' : 'ON'); },
      setGhostLabel(on) { el.ghostBtn.textContent = 'GHOST: ' + (on ? 'ON' : 'OFF'); },
      setTrackLabel(name) { el.trackBtn.textContent = 'TRACK: ' + name; },
      setModeLabel(mode) {
        el.modeBtn.textContent = 'MODE: ' + (mode === 'race' ? 'RACE' : 'TIME TRIAL');
        // difficulty/field size only matter when racing the AI
        if (el.difficultyBtn) show(el.difficultyBtn, mode === 'race');
        if (el.rivalsBtn) show(el.rivalsBtn, mode === 'race');
      },
      setDifficultyLabel(d) {
        el.difficultyBtn.textContent = 'AI: ' + d.toUpperCase();
      },
      setReplayAvailable(v) { show(el.replayBtn, v); },
      setReplayBarVisible(v) { show(el.replayBar, v); },
      setReplayTime(t, duration) {
        el.replayTime.textContent = fmt(t) + ' / ' + fmt(duration);
      },
      setReplayPausedLabel(paused) {
        el.replayPauseBtn.textContent = paused ? '▶' : '‖';
      },
      setReplaySpeedLabel(speed) {
        el.replaySpeedBtn.textContent = speed + '×';
      },
      setRivalsLabel(n) {
        el.rivalsBtn.textContent = 'RIVALS: ' + n;
      },
      setPositionVisible(v) { show(el.pos, v); },
      setPosition(pos, total) {
        el.pos.textContent = 'P' + pos + '/' + total;
        el.pos.classList.toggle('leading', pos === 1);
      },
      // Race-mode results: finishing order instead of lap table/medals/PB
      fillFinishRace(order, playerPos, total, stats) {
        show(el.finishTable, false);
        show(el.finishMedal, false);
        show(el.raceResults, true);
        el.finishPosition.textContent = playerPos === 1
          ? '\u{1F3C6} YOU WIN — P1/' + order.length
          : 'FINISHED P' + playerPos + '/' + order.length;
        el.finishPosition.className = 'finish-position' + (playerPos === 1 ? ' win' : '');
        show(el.finishPosition, true);
        el.raceResults.innerHTML = '';
        order.forEach((row, i) => {
          const tr = document.createElement('tr');
          if (row.you) tr.className = 'you-row';
          const tdP = document.createElement('td');
          tdP.textContent = 'P' + (i + 1);
          const tdN = document.createElement('td');
          tdN.textContent = row.you ? 'YOU' : row.name;
          const tdT = document.createElement('td');
          tdT.textContent = row.finished ? fmt(row.time) : 'running';
          tr.appendChild(tdP);
          tr.appendChild(tdN);
          tr.appendChild(tdT);
          el.raceResults.appendChild(tr);
        });
        // reuse the stats grid below the results
        this.fillFinishStatsOnly(stats);
      },
      fillFinishStatsOnly(stats) {
        if (!el.finishStats || !stats) return;
        const rows = [
          ['Top speed', Math.round(stats.topSpeed * 3.6) + ' km/h'],
          ['Time off track', stats.offTrack.toFixed(1) + ' s'],
          ['Drift time', stats.driftTime.toFixed(1) + ' s'],
          ['Resets', String(stats.resets)],
        ];
        el.finishStats.innerHTML = '';
        for (const [label, value] of rows) {
          const div = document.createElement('div');
          div.className = 'stat';
          const l = document.createElement('span');
          l.className = 'stat-label';
          l.textContent = label;
          const v = document.createElement('span');
          v.className = 'stat-value';
          v.textContent = value;
          div.appendChild(l);
          div.appendChild(v);
          el.finishStats.appendChild(div);
        }
      },
      setMinimapTrack,
      drawMinimap,
    };
  }

  const api = { createHud, fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCHud = api;
})(typeof window !== 'undefined' ? window : globalThis);
