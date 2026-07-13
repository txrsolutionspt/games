/*
 * scene.js — Babylon.js scene construction: track ribbon, kerbs, barriers,
 * scenery, the car meshes, lighting, camera and quality tiers. Everything is
 * procedural low-poly (no external 3D/texture assets).
 *
 * Mapping from the physics plane: physics (x, z) -> world (x, z), y up.
 * Physics heading theta (fwd = (cos t, sin t)) -> node.rotation.y = PI/2 - t
 * for meshes modeled facing +z.
 */
(function (global) {
  'use strict';

  const V3 = (x, y, z) => new BABYLON.Vector3(x, y, z);
  const C3 = (r, g, b) => new BABYLON.Color3(r, g, b);

  // deterministic RNG for scenery placement
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function flatMat(scene, name, color, emissiveScale) {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = color;
    m.specularColor = C3(0.04, 0.04, 0.04);
    if (emissiveScale) m.emissiveColor = color.scale(emissiveScale);
    return m;
  }

  function createScene(engine, track) {
    // per-track scenery palette (see TRACKS in track.js)
    const pal = track.palette || {
      grass: [0.36, 0.55, 0.28], crown: [0.18, 0.42, 0.2],
      skyTop: '#4a90cf', skyMid: '#8fc3e8', skyHorizon: '#cfe6f5',
      fog: [0.66, 0.78, 0.9], clear: [0.62, 0.78, 0.92],
    };
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(pal.clear[0], pal.clear[1], pal.clear[2], 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0013;
    scene.fogColor = C3(pal.fog[0], pal.fog[1], pal.fog[2]);

    // ---------------- lights ----------------
    const hemi = new BABYLON.HemisphericLight('hemi', V3(0.2, 1, 0.1), scene);
    hemi.intensity = 0.65;
    hemi.groundColor = C3(0.25, 0.3, 0.25);
    const sun = new BABYLON.DirectionalLight('sun', V3(-0.45, -1, -0.35), scene);
    sun.position = V3(120, 220, 100);
    sun.intensity = 0.9;

    // ---------------- sky ----------------
    const sky = BABYLON.MeshBuilder.CreateSphere('sky',
      { diameter: 1700, sideOrientation: BABYLON.Mesh.BACKSIDE, segments: 8 }, scene);
    const skyMat = new BABYLON.StandardMaterial('skyMat', scene);
    const skyTex = new BABYLON.DynamicTexture('skyTex', { width: 16, height: 256 }, scene, false);
    {
      const c = skyTex.getContext();
      const grad = c.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, pal.skyHorizon); // horizon haze (texture v flipped on sphere)
      grad.addColorStop(0.42, pal.skyMid);
      grad.addColorStop(1, pal.skyTop);     // zenith
      c.fillStyle = grad;
      c.fillRect(0, 0, 16, 256);
      skyTex.update();
    }
    skyMat.emissiveTexture = skyTex;
    skyMat.disableLighting = true;
    skyMat.backFaceCulling = false;
    sky.material = skyMat;
    sky.applyFog = false;
    sky.isPickable = false;
    sky.infiniteDistance = true;

    // ---------------- ground ----------------
    const ground = BABYLON.MeshBuilder.CreateGround('ground',
      { width: 1500, height: 1500, subdivisions: 2 }, scene);
    ground.position.y = -0.02;
    ground.material = flatMat(scene, 'grass', C3(pal.grass[0], pal.grass[1], pal.grass[2]));
    ground.receiveShadows = true;
    ground.freezeWorldMatrix();

    // ---------------- road ribbon ----------------
    const S = track.samples;
    const n = S.length;
    const hw = track.halfWidth;
    const left = [], right = [], lineL = [], lineR = [];
    for (let i = 0; i <= n; i++) {
      const sm = S[i % n];
      left.push(V3(sm.x + sm.nx * hw, 0, sm.z + sm.nz * hw));
      right.push(V3(sm.x - sm.nx * hw, 0, sm.z - sm.nz * hw));
      lineL.push([
        V3(sm.x + sm.nx * (hw - 0.12), 0.015, sm.z + sm.nz * (hw - 0.12)),
        V3(sm.x + sm.nx * (hw - 0.5), 0.015, sm.z + sm.nz * (hw - 0.5)),
      ]);
      lineR.push([
        V3(sm.x - sm.nx * (hw - 0.5), 0.015, sm.z - sm.nz * (hw - 0.5)),
        V3(sm.x - sm.nx * (hw - 0.12), 0.015, sm.z - sm.nz * (hw - 0.12)),
      ]);
    }
    const road = BABYLON.MeshBuilder.CreateRibbon('road',
      { pathArray: [left, right] }, scene);
    road.material = flatMat(scene, 'asphalt', C3(0.23, 0.24, 0.27));
    road.receiveShadows = true;
    road.freezeWorldMatrix();

    const edgeMat = flatMat(scene, 'edgeline', C3(0.92, 0.92, 0.95), 0.35);
    for (const [name, pts] of [['lineL', lineL], ['lineR', lineR]]) {
      const ribbon = BABYLON.MeshBuilder.CreateRibbon(name, {
        pathArray: [pts.map((p) => p[0]), pts.map((p) => p[1])],
      }, scene);
      ribbon.material = edgeMat;
      ribbon.freezeWorldMatrix();
    }

    // ---------------- start/finish line + gantry ----------------
    {
      const sm = S[0];
      const checker = new BABYLON.DynamicTexture('checker', { width: 128, height: 32 }, scene, false);
      const cc = checker.getContext();
      const cell = 16;
      for (let ix = 0; ix < 8; ix++) {
        for (let iz = 0; iz < 2; iz++) {
          cc.fillStyle = (ix + iz) % 2 ? '#eeeeee' : '#111111';
          cc.fillRect(ix * cell, iz * cell, cell, cell);
        }
      }
      checker.update();
      const lineMat = new BABYLON.StandardMaterial('startline', scene);
      lineMat.diffuseTexture = checker;
      lineMat.emissiveColor = C3(0.35, 0.35, 0.35);
      lineMat.specularColor = C3(0, 0, 0);
      const startLine = BABYLON.MeshBuilder.CreateGround('startLine',
        { width: hw * 2, height: 2.4 }, scene);
      startLine.position = V3(sm.x, 0.02, sm.z);
      startLine.rotation.y = Math.PI / 2 - Math.atan2(sm.tz, sm.tx);
      startLine.material = lineMat;
      startLine.freezeWorldMatrix();

      const postMat = flatMat(scene, 'post', C3(0.75, 0.76, 0.8));
      const bannerMat = new BABYLON.StandardMaterial('banner', scene);
      const bannerTex = new BABYLON.DynamicTexture('bannerTex', { width: 512, height: 96 }, scene, true);
      bannerTex.drawText('FINISH', null, 68, 'bold 64px sans-serif', '#ffffff', '#c0392b', true);
      bannerMat.diffuseTexture = bannerTex;
      bannerMat.emissiveColor = C3(0.4, 0.4, 0.4);
      bannerMat.backFaceCulling = false;
      for (const side of [1, -1]) {
        const post = BABYLON.MeshBuilder.CreateCylinder('post' + side,
          { height: 7, diameter: 0.5, tessellation: 8 }, scene);
        post.position = V3(sm.x + sm.nx * side * (hw + 1.2), 3.5, sm.z + sm.nz * side * (hw + 1.2));
        post.material = postMat;
        post.freezeWorldMatrix();
      }
      const banner = BABYLON.MeshBuilder.CreatePlane('bannerPlane',
        { width: (hw + 1.2) * 2, height: 1.4 }, scene);
      banner.position = V3(sm.x, 6.4, sm.z);
      banner.rotation.y = Math.PI / 2 - Math.atan2(sm.tz, sm.tx) + Math.PI / 2;
      banner.material = bannerMat;
      banner.freezeWorldMatrix();
    }

    // ---------------- kerbs (visual) ----------------
    {
      const kerbRed = flatMat(scene, 'kerbRed', C3(0.85, 0.2, 0.16), 0.15);
      const kerbWhite = flatMat(scene, 'kerbWhite', C3(0.93, 0.93, 0.93), 0.15);
      const baseR = BABYLON.MeshBuilder.CreateBox('kerbR', { width: 1.0, height: 0.07, depth: 2.1 }, scene);
      const baseW = BABYLON.MeshBuilder.CreateBox('kerbW', { width: 1.0, height: 0.07, depth: 2.1 }, scene);
      baseR.material = kerbRed;
      baseW.material = kerbWhite;
      const matR = [], matW = [];
      const stepN = 1; // one kerb block per sample (2 m)
      for (const kerb of track.kerbs) {
        for (let i = kerb.i0, k = 0; i <= kerb.i1; i += stepN, k++) {
          const sm = S[RCTrack.wrapIndex(i, n)];
          const off = hw + 0.55;
          const px = sm.x + sm.nx * kerb.side * off;
          const pz = sm.z + sm.nz * kerb.side * off;
          const rotY = Math.PI / 2 - Math.atan2(sm.tz, sm.tx);
          const mat = BABYLON.Matrix.RotationY(rotY).multiply(
            BABYLON.Matrix.Translation(px, 0.035, pz));
          (k % 2 ? matW : matR).push(mat);
        }
      }
      const pack = (arr) => {
        const buf = new Float32Array(arr.length * 16);
        arr.forEach((m, i) => m.copyToArray(buf, i * 16));
        return buf;
      };
      if (matR.length) baseR.thinInstanceSetBuffer('matrix', pack(matR), 16, true);
      else baseR.setEnabled(false);
      if (matW.length) baseW.thinInstanceSetBuffer('matrix', pack(matW), 16, true);
      else baseW.setEnabled(false);
    }

    // ---------------- barriers (match the physics walls) ----------------
    {
      const barRed = flatMat(scene, 'barRed', C3(0.8, 0.16, 0.14));
      const barWhite = flatMat(scene, 'barWhite', C3(0.9, 0.9, 0.92));
      const baseR = BABYLON.MeshBuilder.CreateBox('barR', { width: 0.5, height: 0.85, depth: 2.1 }, scene);
      const baseW = BABYLON.MeshBuilder.CreateBox('barW', { width: 0.5, height: 0.85, depth: 2.1 }, scene);
      baseR.material = barRed;
      baseW.material = barWhite;
      const matR = [], matW = [];
      for (const wall of track.walls) {
        for (let i = wall.i0, k = 0; i <= wall.i1; i++, k++) {
          const sm = S[RCTrack.wrapIndex(i, n)];
          const px = sm.x + sm.nx * wall.side * wall.offset;
          const pz = sm.z + sm.nz * wall.side * wall.offset;
          const rotY = Math.PI / 2 - Math.atan2(sm.tz, sm.tx);
          const mat = BABYLON.Matrix.RotationY(rotY).multiply(
            BABYLON.Matrix.Translation(px, 0.42, pz));
          (k % 2 ? matW : matR).push(mat);
        }
      }
      const pack = (arr) => {
        const buf = new Float32Array(arr.length * 16);
        arr.forEach((m, i) => m.copyToArray(buf, i * 16));
        return buf;
      };
      if (matR.length) baseR.thinInstanceSetBuffer('matrix', pack(matR), 16, true);
      if (matW.length) baseW.thinInstanceSetBuffer('matrix', pack(matW), 16, true);
    }

    // ---------------- trees (thin instances, quality-scaled) ----------------
    const treeState = { mesh: null, max: 0 };
    {
      const trunk = BABYLON.MeshBuilder.CreateCylinder('trunk',
        { height: 1.6, diameter: 0.55, tessellation: 6 }, scene);
      trunk.position.y = 0.8;
      const crown = BABYLON.MeshBuilder.CreateCylinder('crown',
        { height: 3.4, diameterTop: 0, diameterBottom: 3.1, tessellation: 7 }, scene);
      crown.position.y = 3.2;
      trunk.material = flatMat(scene, 'trunkMat', C3(0.42, 0.3, 0.2));
      crown.material = flatMat(scene, 'crownMat', C3(pal.crown[0], pal.crown[1], pal.crown[2]));
      const tree = BABYLON.Mesh.MergeMeshes([trunk, crown], true, true, undefined, false, true);
      tree.name = 'tree';

      const rng = mulberry32(20260712);
      const mats = [];
      let attempts = 0;
      while (mats.length < 260 && attempts < 6000) {
        attempts++;
        const x = (rng() - 0.5) * 560;
        const z = (rng() - 0.5) * 460;
        const q = RCTrack.query(track, x, z, null);
        if (Math.abs(q.d) < track.halfWidth + 9) continue;
        if (Math.abs(q.d) > 130) continue; // keep them near the circuit
        const s = 0.75 + rng() * 0.8;
        mats.push(BABYLON.Matrix.Scaling(s, s + rng() * 0.35, s)
          .multiply(BABYLON.Matrix.RotationY(rng() * Math.PI * 2))
          .multiply(BABYLON.Matrix.Translation(x, 0, z)));
      }
      treeState.mesh = tree;
      treeState.all = mats;
      treeState.max = mats.length;
    }
    function setTreeCount(count) {
      const use = treeState.all.slice(0, Math.min(count, treeState.max));
      const buf = new Float32Array(use.length * 16);
      use.forEach((m, i) => m.copyToArray(buf, i * 16));
      treeState.mesh.thinInstanceSetBuffer('matrix', buf, 16, true);
    }

    // ---------------- grandstand blocks near the straight ----------------
    {
      const standMat = flatMat(scene, 'stand', C3(0.5, 0.53, 0.6));
      for (let i = 0; i < 3; i++) {
        const smI = S[RCTrack.wrapIndex(Math.round((14 + i * 14) / track.step), n)];
        const box = BABYLON.MeshBuilder.CreateBox('stand' + i,
          { width: 12, height: 4.2, depth: 5 }, scene);
        box.position = V3(smI.x - smI.nx * (hw + 12), 2.1, smI.z - smI.nz * (hw + 12));
        box.rotation.y = Math.PI / 2 - Math.atan2(smI.tz, smI.tx);
        box.material = standMat;
        box.freezeWorldMatrix();
      }
    }

    // ---------------- car ----------------
    const car = buildCar(scene);

    // ---------------- AI opponent cars (Race mode; hidden otherwise) ----------------
    const roster = typeof RCOpponents !== 'undefined' ? RCOpponents.ROSTER : [];
    const opponents = roster.map((def, i) => {
      const nodes = buildCar(scene, C3(def.color[0], def.color[1], def.color[2]), 'ai' + i);
      nodes.root.setEnabled(false);
      return nodes;
    });

    // ---------------- ghost car (best-run replay) ----------------
    const ghost = buildGhost(scene);

    // ---------------- camera ----------------
    const camera = new BABYLON.FreeCamera('cam', V3(0, 30, -60), scene);
    camera.minZ = 0.3;
    camera.maxZ = 1900;
    camera.fov = 0.95;

    // ---------------- quality tiers ----------------
    let shadowGen = null;
    function applyQuality(q) {
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      if (q === 'high') {
        engine.setHardwareScalingLevel(1 / Math.min(dpr, 2));
        setTreeCount(260);
        if (!shadowGen) {
          shadowGen = new BABYLON.ShadowGenerator(1024, sun);
          car.root.getChildMeshes().forEach((m) => shadowGen.addShadowCaster(m));
          shadowGen.useExponentialShadowMap = true;
          shadowGen.bias = 0.002;
        }
      } else {
        if (shadowGen) { shadowGen.dispose(); shadowGen = null; }
        if (q === 'med') {
          engine.setHardwareScalingLevel(1);
          setTreeCount(150);
        } else {
          engine.setHardwareScalingLevel(1.4);
          setTreeCount(70);
        }
      }
    }

    return { scene, camera, car, opponents, ghost, applyQuality, sun };
  }

  // Translucent ghost car for best-run replay: simplified body, one shared
  // see-through material, no shadows, hidden until a replay is active.
  function buildGhost(scene) {
    const root = new BABYLON.TransformNode('ghostRoot', scene);
    const mat = new BABYLON.StandardMaterial('ghostMat', scene);
    mat.diffuseColor = C3(0.55, 0.75, 0.95);
    mat.emissiveColor = C3(0.25, 0.38, 0.5);
    mat.specularColor = C3(0, 0, 0);
    mat.alpha = 0.38;

    const body = BABYLON.MeshBuilder.CreateBox('gBody',
      { width: 1.8, height: 0.5, depth: 4.1 }, scene);
    body.position.y = 0.55;
    const cabin = BABYLON.MeshBuilder.CreateBox('gCabin',
      { width: 1.45, height: 0.5, depth: 1.7 }, scene);
    cabin.position.set(0, 1.0, -0.25);
    const nose = BABYLON.MeshBuilder.CreateBox('gNose',
      { width: 1.6, height: 0.3, depth: 0.9 }, scene);
    nose.position.set(0, 0.45, 2.35);
    for (const m of [body, cabin, nose]) {
      m.material = mat;
      m.parent = root;
      m.isPickable = false;
    }
    root.setEnabled(false);
    return { root };
  }

  // Low-poly car modeled facing +z. Returns nodes for game.js to animate.
  // paintColor/tag are optional (defaults = the player's red car).
  function buildCar(scene, paintColor, tag) {
    const id = tag || 'player';
    const root = new BABYLON.TransformNode('carRoot_' + id, scene);
    const bodyNode = new BABYLON.TransformNode('carBody_' + id, scene);
    bodyNode.parent = root;

    const paint = flatMat(scene, 'paint_' + id, paintColor || C3(0.85, 0.16, 0.12));
    const darkMat = flatMat(scene, 'carDark_' + id, C3(0.09, 0.09, 0.11));
    const glassMat = flatMat(scene, 'glass_' + id, C3(0.25, 0.4, 0.55));
    const lightMat = flatMat(scene, 'lightM_' + id, C3(1, 0.95, 0.7), 0.8);
    const tailMat = flatMat(scene, 'tailM_' + id, C3(0.9, 0.1, 0.1), 0.6);

    const body = BABYLON.MeshBuilder.CreateBox('body',
      { width: 1.8, height: 0.5, depth: 4.1 }, scene);
    body.position.y = 0.55;
    body.material = paint;
    body.parent = bodyNode;

    const nose = BABYLON.MeshBuilder.CreateBox('nose',
      { width: 1.6, height: 0.3, depth: 0.9 }, scene);
    nose.position.set(0, 0.45, 2.35);
    nose.material = paint;
    nose.parent = bodyNode;

    const cabin = BABYLON.MeshBuilder.CreateBox('cabin',
      { width: 1.45, height: 0.5, depth: 1.7 }, scene);
    cabin.position.set(0, 1.0, -0.25);
    cabin.material = glassMat;
    cabin.parent = bodyNode;

    const spoiler = BABYLON.MeshBuilder.CreateBox('spoiler',
      { width: 1.7, height: 0.08, depth: 0.5 }, scene);
    spoiler.position.set(0, 1.05, -2.05);
    spoiler.material = darkMat;
    spoiler.parent = bodyNode;
    for (const sx of [-0.6, 0.6]) {
      const strut = BABYLON.MeshBuilder.CreateBox('strut',
        { width: 0.08, height: 0.3, depth: 0.3 }, scene);
      strut.position.set(sx, 0.92, -2.0);
      strut.material = darkMat;
      strut.parent = bodyNode;
    }
    for (const sx of [-0.55, 0.55]) {
      const head = BABYLON.MeshBuilder.CreateBox('head',
        { width: 0.35, height: 0.14, depth: 0.06 }, scene);
      head.position.set(sx, 0.62, 2.81);
      head.material = lightMat;
      head.parent = bodyNode;
      const tail = BABYLON.MeshBuilder.CreateBox('tail',
        { width: 0.4, height: 0.12, depth: 0.06 }, scene);
      tail.position.set(sx, 0.68, -2.08);
      tail.material = tailMat;
      tail.parent = bodyNode;
    }

    // wheels: pivot (steering yaw) -> hub (rolling spin) -> cylinder
    const tireMat = flatMat(scene, 'tire', C3(0.08, 0.08, 0.09));
    const wheels = [];
    const positions = [
      { x: -0.85, z: 1.45, front: true }, { x: 0.85, z: 1.45, front: true },
      { x: -0.85, z: -1.45, front: false }, { x: 0.85, z: -1.45, front: false },
    ];
    for (const p of positions) {
      const pivot = new BABYLON.TransformNode('wpivot', scene);
      pivot.parent = root;
      pivot.position.set(p.x, 0.33, p.z);
      const hub = new BABYLON.TransformNode('whub', scene);
      hub.parent = pivot;
      const cyl = BABYLON.MeshBuilder.CreateCylinder('wheel',
        { height: 0.28, diameter: 0.66, tessellation: 9 }, scene);
      cyl.rotation.z = Math.PI / 2;
      cyl.material = tireMat;
      cyl.parent = hub;
      cyl.convertToFlatShadedMesh();
      wheels.push({ pivot, hub, front: p.front });
    }

    return { root, bodyNode, body, wheels };
  }

  const api = { createScene };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.RCScene = api;
})(typeof window !== 'undefined' ? window : globalThis);
