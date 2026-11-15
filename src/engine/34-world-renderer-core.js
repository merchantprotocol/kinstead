/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { CH, PPU } = K;
  const { TILE, HQ, T, WorldDoc, PropBuilder } = K;
  class WorldRendererCore {
    constructor(renderer) {
      this.renderer = renderer; this.scene = new THREE.Scene();
      this.painter = new K.GroundPainter(7); this.texPainter = new K.TexturePainter(7); this.bank = new K.TextureBank(renderer);
      this.lib = new K.CharacterLibrary();
      this.pool = new K.PaintPool(); this.chunks = []; this.dyn = new Map(); this.lightSrc = []; this.anim = new Map(); this.fires = new Map(); this.actors = new Map(); this.propState = new Map();
      this.target = new V3();
      const S = this.scene;
      S.background = new THREE.Color('#1a2131');
      S.fog = new THREE.Fog('#26324a', 30, 70);
      this.sparkUni = { uTime: { value: 0 } };
      this.makeMaterials(); this.makeLights(); this.makeAtmosphere();
      // buildings: one BuildingSet for the whole world (meshes, interior lights, smoke, roof cut-away)
      this.bmats = new K.BuildingMaterials(this.bank);
      this.buildings = new K.BuildingSet({ mats: this.bmats, fireTex: this.fireTex, catalog: K.FURNITURE }).attach(this);
      this.buildingSig = null;
    }
    /* rebuild building meshes when (and only when) a building's JSON changed; force after terrain edits under them */
    syncBuildings(force) {
      const doc = this.doc, list = doc.buildings(), sig = JSON.stringify(list.map((b) => [b, doc.objects.indexOf(b) >= 0]));
      if (!force && sig === this.buildingSig) return false;
      this.buildingSig = sig;
      const inside = this.buildings.inside && this.buildings.inside.spec.id, cam = this.buildings.inside && this.buildings.inside.camera;
      this.buildings.setBuildings(list, doc);
      doc.floorAt = list.length ? (i, j) => this.buildings.floorY(i, j) : null;
      if (inside && this.buildings.get(inside)) { const b = this.buildings.get(inside); this.buildings.inside = b; b.setInterior(true, { camera: cam, snap: true }); }
      if (this.onBuildings) this.onBuildings();
      return true;
    }
    makeTopMaterial(tex, stex) {
      const m = new THREE.MeshLambertMaterial({ map: tex });
      const su = this.sparkUni;
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = su.uTime; sh.uniforms.sparkMap = { value: stex };
        sh.fragmentShader = 'uniform float uTime; uniform sampler2D sparkMap;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           vec4 spk = texture2D(sparkMap, vMapUv);
           float tw = spk.r * pow(max(0.0, sin(uTime*1.7 + spk.g*40.0 + (cameraPosition.x*0.9 + cameraPosition.z*0.6)*2.5)), 30.0);
           totalEmissiveRadiance += vec3(0.85,0.95,1.0) * tw * 4.0;`);
      };
      m.customProgramCacheKey = () => 'kinstead-top';
      return m;
    }
    makeMaterials() {
      const P = this.texPainter, B = this.bank;
      const cliffTex = B.pixel(P.cliff(false), { repeat: true }), rockTex = B.pixel(P.cliff(true), { repeat: true });
      cliffTex.wrapT = rockTex.wrapT = THREE.ClampToEdgeWrapping;
      const lam = (t, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ map: t }, o));
      const stoneTex = B.pixel(P.stoneAtlas()), snowTex = B.pixel(P.snowCap());
      this.mats = {
        cliff: lam(cliffTex), rock: lam(rockTex), stone: lam(stoneTex), snow: lam(snowTex),
        deck: lam(B.pixel(P.deck(), { repeat: true })), wood: lam(B.pixel(P.planks(32, 32))), crate: lam(B.pixel(P.planks(16, 16, true))),
        bark: lam(B.pixel(P.bark(), { repeat: true })), iron: lam(B.pixel(P.iron())),
        pine: lam(B.pixel(P.pine(), { repeat: true }), { flatShading: true }), boulder: lam(stoneTex, { flatShading: true }),
        fern: lam(B.pixel(P.fern(), { mips: false, flipY: true }), { alphaTest: 0.5, side: THREE.DoubleSide }),
        banner: lam(B.pixel(P.banner(), { mips: false, flipY: true }), { alphaTest: 0.5, side: THREE.DoubleSide }),
        hole: lam(B.pixel(WorldRenderer.pattern(K.ramp('#050b14', '#0b1a2a', '#10263c', '#1d4566', '#3a7499'), 21, 0.35))),
        ore: lam(B.pixel(WorldRenderer.pattern(K.ramp('#3a1a0a', '#7a3a14', '#b0602a', '#e09a4a', '#ffd08a'), 22, 0.6)), { flatShading: true }),
        leaf: lam(B.pixel(WorldRenderer.pattern(K.ramp('#10241a', '#1f4a2c', '#2f6a3c', '#4a8a50', '#9fd0b8'), 23, 0.55)), { flatShading: true }),
      };
      const fireFrames = P.fire();
      this.fireSheet = new K.PixelBuffer(16 * 4, 24); fireFrames.forEach((f, i) => this.fireSheet.blit(f, i * 16, 0));
      this.fireTex = B.pixel(this.fireSheet, { mips: false, flipY: true });
      this.spriteTex = {};
    }
    /* tiny dithered noise texture from a ramp (resource materials) */
    static pattern(pal, seed, spread) {
      const b = new K.PixelBuffer(16, 16);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) b.set(x, y, K.rampPick(pal, 0.5 + (K.hash2(x >> 1, y >> 1, seed) - 0.5) * spread * 2, x, y, 0.6));
      return b;
    }
    /* per-object visual state (e.g. a depleted ore vein) -> rebuild that object's chunk */
    setPropState(id, st) {
      if (st) this.propState.set(id, st); else this.propState.delete(id);
      const o = this.doc && this.doc.obj(id); const c = o && this.anchorChunk(o); if (c) c.propsDirty = true;
    }
    clearPropStates() { const ids = [...this.propState.keys()]; this.propState.clear(); ids.forEach((id) => this.setPropState(id, null)); }
    /* the static sprite markers placed in the editor (hidden while play mode spawns live actors) */
    setStaticActorsVisible(v) { for (const a of this.actors.values()) { a.group.visible = v; a.shadow.visible = v; } }
    makeLights() {
      const S = this.scene;
      S.add(new THREE.HemisphereLight('#7f9cd0', '#1c2230', 1.25));
      const sun = new THREE.DirectionalLight('#ffd6a8', 2.4);
      this.sunOff = new V3(-10, 9, 9);
      sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
      const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 70;
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2;
      S.add(sun, sun.target); this.sun = sun;
      const rim = new THREE.DirectionalLight('#6d8ee0', 0.6); rim.position.set(30, 12, -10); S.add(rim);
      // fixed pool of point lights handed to the light sources nearest the view (keeps shaders stable)
      this.lightPool = [];
      for (let i = 0; i < 6; i++) { const l = new THREE.PointLight('#ff8a3c', 0, 9, 1.4); l.position.set(0, -50, 0); S.add(l); this.lightPool.push(l); }
    }
    makeAtmosphere() {
      const N = 128, fb = new K.PixelBuffer(N, N), n = new K.Noise(3);
      const tile = (a, b) => n.fbm(a / 22, b / 22, 4);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const fx = x / N, fy = y / N;
        const s = tile(x, y) * (1 - fx) * (1 - fy) + tile(x + N, y) * fx * (1 - fy) + tile(x, y + N) * (1 - fx) * fy + tile(x + N, y + N) * fx * fy;
        fb.set(x, y, [255, 255, 255], Math.max(0, Math.min(255, (s - 0.32) * 520)));
      }
      this.fogTex = new THREE.CanvasTexture(this.bank.canvasOf(fb)); this.fogTex.wrapS = this.fogTex.wrapT = THREE.RepeatWrapping;
      this.fogLayers = [];
      this.snow = new K.SnowField(3400); this.scene.add(this.snow.points);
      this.embers = null;
    }
    buildFog() {
      this.fogLayers.forEach((f) => { this.scene.remove(f.m); f.m.geometry.dispose(); f.t.dispose(); });
      this.fogLayers = [];
      const doc = this.doc, wu = doc.wu, hu = doc.hu;
      [-7.6, -6.4, -5.2, -4.0, -2.9].forEach((y, i) => {
        const t = this.fogTex.clone(); t.needsUpdate = true; t.offset.set(i * 0.37, i * 0.21); t.repeat.set(wu / 7, hu / 8);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(wu, hu), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.07 + i * 0.025, depthWrite: false, color: '#6f86ad', fog: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(wu / 2, y, hu / 2); m.renderOrder = 3; this.scene.add(m); this.fogLayers.push({ m, t, sp: 0.004 + i * 0.002 });
      });
    }
    /* ---------- document binding ---------- */
    setDoc(doc) {
      this.chunks.forEach((c) => c.dispose()); this.chunks = []; this.pool.cancelAll();
      for (const id of [...this.dyn.keys()]) this.removeDyn(id);
      this.doc = doc;
      this.ncx = Math.ceil(doc.w / CH); this.ncz = Math.ceil(doc.h / CH);
      for (let cj = 0; cj < this.ncz; cj++) for (let ci = 0; ci < this.ncx; ci++) { const c = new K.Chunk(this, ci, cj); c.queuePaint(c.i0, c.j0, c.i1, c.j1); this.chunks.push(c); }
      this.buildFog();
      this.objectsChanged(true);
      this.pumpPaint();
    }
    chunkAt(i, j) { const ci = Math.floor(i / CH), cj = Math.floor(j / CH); if (ci < 0 || cj < 0 || ci >= this.ncx || cj >= this.ncz) return null; return this.chunks[cj * this.ncx + ci]; }
    anchorChunk(o) {
      const p = o.kind === 'building' ? [o.x * TILE, o.z * TILE] : o.kind === 'prop' ? [o.x, o.z] : o.kind === 'bridge' ? o.a : o.pts[0];
      const [i, j] = this.doc.tileOf(p[0], p[1]);
      return this.chunkAt(Math.max(0, Math.min(this.doc.w - 1, i)), Math.max(0, Math.min(this.doc.h - 1, j)));
    }
    static objBox(o) {
      if (o.kind === 'building') { const b = K.BuildingGeo.worldBox(o); return [b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1]; }
      if (o.kind === 'prop') return [o.x - 1, o.z - 1, o.x + 1, o.z + 1];
      const P = o.kind === 'bridge' ? [o.a, o.b] : o.pts; let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
      P.forEach(([x, z]) => { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); });
      return [a - 1.5, b - 1.5, c + 1.5, d + 1.5];
    }
    /* tiles changed in [i0,i1) x [j0,j1): repaint (with a 1-tile apron), rebuild terrain + props that sit there */
    tilesChanged(i0, j0, i1, j1) {
      const a0 = i0 - 1, b0 = j0 - 1, a1 = i1 + 1, b1 = j1 + 1;
      for (const c of this.chunks) {
        if (c.i1 <= a0 || c.i0 >= a1 || c.j1 <= b0 || c.j0 >= b1) continue;
        c.queuePaint(a0, b0, a1, b1); c.geoDirty = true;
      }
      const x0 = a0 * TILE, z0 = b0 * TILE, x1 = a1 * TILE, z1 = b1 * TILE;
      let bdirty = false;
      for (const o of this.doc.objects) {
        const bb = WorldRenderer.objBox(o); if (bb[2] < x0 || bb[0] > x1 || bb[3] < z0 || bb[1] > z1) continue;
        if (o.kind === 'building') { bdirty = true; continue; }    // a building's base height follows the terrain under it
        const c = this.anchorChunk(o); if (c) c.propsDirty = true;
      }
      if (bdirty) this.syncBuildings(true);
      this.placeDynamics();
    }
    objectsChanged(force) {
      const per = new Map();
      for (const o of this.doc.objects) { const c = this.anchorChunk(o); if (!c) continue; if (!per.has(c)) per.set(c, []); per.get(c).push(o); }
      this.chunkObjs = per;
      this.syncBuildings(force);
      for (const c of this.chunks) {
        const sig = JSON.stringify((per.get(c) || []).filter((o) => o.kind !== 'building'));
        if (force || sig !== c.sig) { c.sig = sig; c.propsDirty = true; }
      }
      // bridges change the ground for anything standing on them; just re-place all dynamics
      this.syncDynamics();
    }
    /* do queued rebuild work within a time budget; nearest chunks first */
    work(budgetMs = 10, sync = false) {
      const t0 = performance.now(), tg = this.target;
      const dist = (c) => Math.hypot((c.i0 + CH / 2) * TILE - tg.x, (c.j0 + CH / 2) * TILE - tg.z);
      const order = this.chunks.slice().sort((a, b) => dist(a) - dist(b));
      let busy = false;
      for (const c of order) if (c.geoDirty) { c.buildTerrain(); busy = true; }
      for (const c of order) if (c.propsDirty) { c.buildProps(this.chunkObjs.get(c) || []); busy = true; if (performance.now() - t0 > budgetMs * 2) break; }
      for (const c of order) {
        while (c.nDirty && performance.now() - t0 < budgetMs) { if (c.paintStep(sync ? null : this.pool)) busy = true; else break; }
        c.flushTex();
        if (performance.now() - t0 >= budgetMs) break;
      }
      this.pending = this.chunks.reduce((s, c) => s + (c.nDirty ? 1 : 0) + (c.inflight ? 1 : 0) + (c.propsDirty ? 1 : 0) + (c.geoDirty ? 1 : 0), 0);
      return busy;
    }
    /* keep the paint workers fed between frames (nearest chunks first) */
    pumpPaint() {
      if (!this.pool.ok) return; const tg = this.target;
      const order = this.chunks.filter((c) => c.nDirty).sort((a, b) => Math.hypot((a.i0 + CH / 2) * TILE - tg.x, (a.j0 + CH / 2) * TILE - tg.z) - Math.hypot((b.i0 + CH / 2) * TILE - tg.x, (b.j0 + CH / 2) * TILE - tg.z));
      for (const c of order) while (c.nDirty && this.pool.idle) if (!c.paintStep(this.pool)) break;
    }
    finishAll() {
      // bands still on worker threads are re-painted here (their late results are discarded by the version check)
      for (const c of this.chunks) { for (const b of c.flying) c.queuePaint(...b.rect); c.flying.clear(); c.inflight = 0; }
      let n = 0; do { this.work(1e9, true); } while (this.chunks.some((c) => c.nDirty || c.propsDirty || c.geoDirty) && ++n < 50); this.chunks.forEach((c) => c.flushTex()); }
    /* resolves once every chunk is painted and built (workers included) */
  }
  K.WorldRendererCore = WorldRendererCore;
})(typeof window !== 'undefined' ? window : globalThis);
