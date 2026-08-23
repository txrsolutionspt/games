// Canvas grid + pseudo-isometric tile projection & drawing — PLAN.md §9.
// gridToScreen/screenToGrid are the same pure math used both to draw tiles
// and (by input.js) to interpret taps, so hit-testing can't drift from
// rendering. All drawing happens in CSS-pixel space; resize() applies the
// devicePixelRatio scale once via setTransform so nothing else needs to
// think about it.

// MIN_ZOOM is deliberately low: the field is 60x60, so even a generous
// zoom-out only shows a fraction of it (roughly cssW / (baseTileW * zoom)
// columns) — being able to pull back further gives a genuinely useful
// overview of a bigger chunk of the field, not just a slightly wider
// sliver of it.
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

// How many tile-columns fit across the canvas width at zoom 1. The field
// (CONFIG.gridCols × gridRows) is sized well beyond this on purpose — see
// PLAN.md §9 "Camera & world size" — so most of it is only reachable by
// panning/scrolling, the same as a map that's bigger than the screen.
const TARGET_VISIBLE_COLS = 5;

// Initial camera focus, in grid coordinates: the starting unlocked
// cluster (roughly the centroid of plot indices 0..initialUnlockedPlots),
// not the grid's overall center — a new player should land looking at
// their own plots, not empty locked land in the middle of a big field.
const FOCUS_COL = 2.5;
const FOCUS_ROW = 0.5;

const Render = (function () {
  function computeGeometry(canvas) {
    const cssW = canvas.clientWidth || 300;
    const cssH = canvas.clientHeight || 300;
    const cols = CONFIG.gridCols, rows = CONFIG.gridRows;
    // Natural, readable tile size — independent of how big the field is,
    // unlike a "shrink everything to fit" layout. Bounded so it doesn't
    // shrink below readable on a narrow phone or balloon huge on a wide
    // desktop frame.
    const tileW = Math.max(28, Math.min(140, (cssW * 0.82) / TARGET_VISIBLE_COLS));
    const tileH = tileW / 2;
    const originX = cssW / 2 - (FOCUS_COL - FOCUS_ROW) * (tileW / 2);
    const originY = cssH / 2 - (FOCUS_COL + FOCUS_ROW) * (tileH / 2);
    return { cssW: cssW, cssH: cssH, tileW: tileW, tileH: tileH, originX: originX, originY: originY, cols: cols, rows: rows };
  }

  // The farm grid supports pinch/scroll zoom + drag pan (see input.js).
  // `view` ({zoom, panX, panY}) is ephemeral UI state owned by game.js, not
  // saved game state. computeGeometry() above is the "natural size,
  // camera focused on the starting cluster" baseline; applyView() zooms
  // that baseline around the canvas center and then shifts it by the pan
  // offset, producing the same {tileW, tileH, originX, originY, ...}
  // shape gridToScreen/screenToGrid already expect — so neither of those
  // needs to know zoom/pan exist.
  function applyView(baseGeom, view) {
    const cx = baseGeom.cssW / 2;
    const cy = baseGeom.cssH / 2;
    const zoom = view.zoom;
    return {
      cssW: baseGeom.cssW,
      cssH: baseGeom.cssH,
      cols: baseGeom.cols,
      rows: baseGeom.rows,
      tileW: baseGeom.tileW * zoom,
      tileH: baseGeom.tileH * zoom,
      originX: cx + (baseGeom.originX - cx) * zoom + view.panX,
      originY: cy + (baseGeom.originY - cy) * zoom + view.panY
    };
  }

  // Keeps panning within the field's own extent: past a certain point
  // there is simply no more world in that direction to scroll to. The
  // allowance grows with zoom (a more zoomed-in view needs to travel
  // further, in screen pixels, to cross the same amount of field) and
  // with the field's total size, so a bigger CONFIG.gridCols/gridRows
  // automatically means more room to pan around in.
  function clampView(baseGeom, view) {
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom));
    const cols = baseGeom.cols, rows = baseGeom.rows;
    const tileW = baseGeom.tileW * zoom;
    const tileH = tileW / 2;
    const worldW = (cols + rows) * tileW / 2 + tileW;
    const worldH = (cols + rows) * tileH / 2 + tileH;
    const maxPanX = worldW / 2;
    const maxPanY = worldH / 2;
    return {
      zoom: zoom,
      panX: Math.max(-maxPanX, Math.min(maxPanX, view.panX)),
      panY: Math.max(-maxPanY, Math.min(maxPanY, view.panY))
    };
  }

  function resize(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 300;
    const cssH = canvas.clientHeight || 300;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas._baseGeom = computeGeometry(canvas);
    canvas._geom = canvas._baseGeom;
    return canvas._baseGeom;
  }

  function gridToScreen(geom, col, row) {
    return {
      x: geom.originX + (col - row) * (geom.tileW / 2),
      y: geom.originY + (col + row) * (geom.tileH / 2)
    };
  }

  // Inverse of gridToScreen — rounds to the nearest cell, used by input.js
  // for exact tile-ground hit-testing (see PLAN.md §10 on the two layered
  // hit-testing methods).
  function screenToGrid(geom, x, y) {
    const dx = x - geom.originX;
    const dy = y - geom.originY;
    const col = (dx / (geom.tileW / 2) + dy / (geom.tileH / 2)) / 2;
    const row = (dy / (geom.tileH / 2) - dx / (geom.tileW / 2)) / 2;
    return { col: Math.round(col), row: Math.round(row) };
  }

  function drawDiamond(ctx, cx, cy, w, h, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = Math.max(1, w * 0.018);
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function bounceOffset(t, active) {
    return active ? Math.sin(t / 220) * 3 : 0;
  }

  // Growth reads as a clear seed → sprout → recognizable-crop → mature
  // progression, not just the same icon slowly scaling up: a seed stage
  // shows a small soil mound (nothing plant-like yet), middle stage(s)
  // show a generic sprout (growing, but not yet recognizable as *this*
  // crop), and the crop's own icon only appears once it's in its final
  // growing stage — smaller than its full mature size, so "ready" (full
  // size + sparkle) still reads as a distinct, unmistakable step up.
  function drawCrop(ctx, plot, geom, cx, cy, t, tick) {
    const occ = plot.occupant;
    const def = CROPS_BY_ID[occ.id];
    const progress = FarmRules.cropProgress(occ, def, tick);
    const ready = occ.state === 'ready';
    const bounce = bounceOffset(t, ready);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (ready) {
      const size = geom.tileH * 1.05;
      ctx.font = size + 'px sans-serif';
      ctx.fillText(def.icon, cx, cy - size * 0.35 + bounce);
      ctx.font = (geom.tileH * 0.3) + 'px sans-serif';
      ctx.fillText('✨', cx + size * 0.35, cy - size * 0.55 + bounce);
    } else {
      const stageCount = def.growthStages;
      const stage = progress.stage;
      // How far through *this* stage growth is, so size still climbs
      // smoothly within a stage rather than jumping only at boundaries.
      const stageFrac = Math.min(1, Math.max(0, progress.frac * stageCount - stage));

      if (stage === 0) {
        const r = geom.tileH * (0.05 + 0.05 * stageFrac);
        ctx.beginPath();
        ctx.ellipse(cx, cy + geom.tileH * 0.15, r * 1.6, r, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#6b4a2a';
        ctx.fill();
      } else if (stage === stageCount - 1) {
        const size = geom.tileH * (0.6 + 0.3 * stageFrac);
        ctx.font = size + 'px sans-serif';
        ctx.globalAlpha = 0.85;
        ctx.fillText(def.icon, cx, cy - size * 0.3);
        ctx.globalAlpha = 1;
      } else {
        const size = geom.tileH * (0.28 + 0.3 * stageFrac);
        ctx.font = size + 'px sans-serif';
        ctx.fillText('🌱', cx, cy - size * 0.25);
      }

      const dropSize = geom.tileH * 0.22;
      ctx.font = dropSize + 'px sans-serif';
      const total = def.waterRequired;
      const given = Math.min(occ.waterGiven, total);
      const startX = cx - (total - 1) * dropSize * 0.35;
      for (let i = 0; i < total; i++) {
        ctx.globalAlpha = i < given ? 1 : 0.25;
        ctx.fillText('💧', startX + i * dropSize * 0.7, cy + geom.tileH * 0.45);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawAnimal(ctx, plot, geom, cx, cy, t, tick) {
    const occ = plot.occupant;
    const def = ANIMALS_BY_ID[occ.id];
    const progress = FarmRules.animalProgress(occ, def, tick);
    const ready = occ.state === 'ready';
    const bounce = bounceOffset(t, ready);
    const size = geom.tileH * 1.1;

    ctx.font = size + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, cy - size * 0.3 + bounce);

    if (ready) {
      ctx.font = (geom.tileH * 0.3) + 'px sans-serif';
      ctx.fillText('✨', cx + size * 0.32, cy - size * 0.5 + bounce);
    } else if (progress.happiness < 0.9) {
      ctx.font = (geom.tileH * 0.26) + 'px sans-serif';
      ctx.fillText('🍽️', cx + size * 0.3, cy - size * 0.5);
    }
  }

  const BUILDING_COLOR = { mill: '#c9a86a', bakery: '#e0a45c', churn: '#e8d99a', kitchen: '#e2846a' };

  function drawBuilding(ctx, plot, geom, cx, cy, t, tick) {
    const occ = plot.occupant;
    const def = BUILDINGS_BY_ID[occ.id];
    const w = geom.tileW * 0.62, h = geom.tileH * 1.6;
    const top = cy - h * 0.62;

    ctx.fillStyle = BUILDING_COLOR[occ.id] || '#c9a86a';
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    const r = 6;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + r, top);
    ctx.arcTo(cx + w / 2, top, cx + w / 2, top + h, r);
    ctx.arcTo(cx + w / 2, top + h, cx - w / 2, top + h, r);
    ctx.arcTo(cx - w / 2, top + h, cx - w / 2, top, r);
    ctx.arcTo(cx - w / 2, top, cx + w / 2, top, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = (geom.tileH * 0.6) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, top + h * 0.42);

    if (occ.job) {
      const recipe = RECIPES_BY_ID[occ.job.recipeId];
      const progress = FarmRules.recipeProgress(occ.job, recipe, tick);
      if (progress.ready) {
        const bounce = bounceOffset(t, true);
        ctx.font = (geom.tileH * 0.3) + 'px sans-serif';
        ctx.fillText('✨', cx + w * 0.42, top + bounce);
      } else {
        const barW = w * 0.8;
        const barX = cx - barW / 2;
        const barY = top + h + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(barX, barY, barW, 5);
        ctx.fillStyle = '#5b8c3e';
        ctx.fillRect(barX, barY, barW * progress.frac, 5);
      }
    }
  }

  function draw(canvas, state, ui) {
    const ctx = canvas.getContext('2d');
    const baseGeom = canvas._baseGeom || resize(canvas);
    const geom = applyView(baseGeom, ui.view);
    canvas._geom = geom;
    ctx.clearRect(0, 0, geom.cssW, geom.cssH);

    const order = state.plots.slice().sort(function (a, b) {
      const ra = Math.floor(a.index / geom.cols) + (a.index % geom.cols);
      const rb = Math.floor(b.index / geom.cols) + (b.index % geom.cols);
      return ra - rb;
    });

    const t = performance.now();

    order.forEach(function (plot) {
      const row = Math.floor(plot.index / geom.cols);
      const col = plot.index % geom.cols;
      const pos = gridToScreen(geom, col, row);
      const cx = pos.x, cy = pos.y;
      const hovered = ui.hoverIndex === plot.index;

      if (!plot.unlocked) {
        drawDiamond(ctx, cx, cy, geom.tileW, geom.tileH, hovered ? '#8a92a0' : '#9aa1a8', 'rgba(0,0,0,0.15)');
        ctx.font = (geom.tileH * 0.5) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', cx, cy);
        return;
      }

      const highlightable = ui.tool && !plot.occupant && (ui.tool.type === 'plant-crop' || ui.tool.type === 'place-animal' || ui.tool.type === 'place-building');
      let fill = '#d8b478';
      if (highlightable) fill = '#f3e2a9';
      if (hovered) fill = highlightable ? '#ffe9a8' : '#e2c48f';
      drawDiamond(ctx, cx, cy, geom.tileW, geom.tileH, fill, 'rgba(0,0,0,0.12)');

      if (plot.occupant) {
        if (plot.occupant.kind === 'crop') drawCrop(ctx, plot, geom, cx, cy, t, state.clock.tick);
        else if (plot.occupant.kind === 'animal') drawAnimal(ctx, plot, geom, cx, cy, t, state.clock.tick);
        else if (plot.occupant.kind === 'building') drawBuilding(ctx, plot, geom, cx, cy, t, state.clock.tick);
      }
    });
  }

  return {
    resize: resize,
    gridToScreen: gridToScreen,
    screenToGrid: screenToGrid,
    draw: draw,
    clampView: clampView,
    MIN_ZOOM: MIN_ZOOM,
    MAX_ZOOM: MAX_ZOOM
  };
})();
