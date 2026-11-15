/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { TILE, HQ, T, TERRAINS, PRESETS, WorldDoc, PropBuilder } = K;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;

  class BuilderAppSession {
    constructor() {
      this.stage = $('stage');
      const r = (this.renderer3 = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
      this.quality = +$('qual').value;
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * (this.quality === 2 ? 1 : this.quality) / (this.quality === 2 ? 1 : 1));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.NoToneMapping;
      this.stage.appendChild(r.domElement); r.domElement.tabIndex = 0;
      this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 400);
      this.rig = new K.CameraRig(this.camera);
      this.post = new K.PostPipeline(r);
      this.renderer = new K.WorldRenderer(r);
      this.overlay = null;
      this.history = new K.History();
      this.ui = { size: { paint: 3, height: 3, carve: 4 }, terrain: T.PATH, hmode: 'raise', step: 0.5, level: 0, cmode: 'carve', depth: -8.5, wallH: 2.4, ruin: 2.0, pillars: true, floor: true, bridgeW: 1.6, prop: 'pine', propS: 1 };
      this.tools = { select: new K.SelectTool(this), paint: new K.PaintTool(this), height: new K.HeightTool(this), carve: new K.CarveTool(this), wall: new K.WallTool(this), room: new K.RoomTool(this), bridge: new K.BridgeTool(this), prop: new K.PropTool(this) };
      this.time = 0; this.last = performance.now(); this.fixedTime = null; this.frames = []; this.view = 'orbit';
      this.play = new K.PlayMode(this); this.store = null; this.savedId = null; this.dirtySince = false;
    }
    start() {
      this.overlay = new K.EditorOverlay(this);
      this.buildToolbar(); this.bindUI(); this.bindInput();
      this.resize(); window.addEventListener('resize', () => this.resize());
      this.setTool('select');
      this.generate(4242, 64, 48, true);
      this.storeReady = this.initStore();
      const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
      if (G.KINSTEAD_HOLD_LOADING) this.deferLoop = loop; else loop();   // the castle page draws nothing until its own world is ready: no wasted frames of the placeholder while it loads
      if (!G.KINSTEAD_HOLD_LOADING) { const l = $('loading'); if (l) { l.classList.add('done'); setTimeout(() => l.remove(), 500); } }   // the castle page keeps the loading screen up until its own world is ready
      return this;
    }
    /** begin drawing frames (the castle page calls this once its world is in) */
    startLoop() { if (this.deferLoop) { const f = this.deferLoop; this.deferLoop = null; f(); } }
    get doc() { return this.renderer.doc; }
    /* ---- document lifecycle ---- */
    setDoc(doc, label) {
      if (this.play) { if (this.play.active) this.setPlay(false); this.play.reset(); }
      this.savedId = null;
      this.sel = null; this.history.clear(); this.renderer.setDoc(doc);
      this.rig.bounds = [0, 0, doc.wu, doc.hu];
      if (doc.camera) this.rig.set(doc.camera, true); else this.frameHero(true);
      if (this.overlay) this.overlay.clear();
      this.panel(); this.updateButtons(); this.status(label || ''); this.updateDirty();
    }
    generate(seed, w, h, quiet) {
      const t0 = performance.now();
      const doc = new K.WorldGenerator(seed).generate(w, h);
      this.setDoc(doc);
      if (!quiet) this.toast(`Generated seed ${seed} · ${w} × ${h} tiles · ${doc.objects.length} objects (${Math.round(performance.now() - t0)} ms)`);
      this.dirtySince = false; this.updateDirty();
    }
    newBlank(w, h, name, base) {
      const doc = new WorldDoc(w, h, { name, seed: 1 }); doc.terrain.fill(base | 0);
      this.setDoc(doc); this.rig.set({ tx: doc.wu / 2, tz: doc.hu / 2, ty: 0, dist: Math.max(16, doc.wu * 0.55), pitch: 0.75, yaw: -0.2 }, true);
      this.toast(`New blank world · ${w} × ${h} tiles`); this.dirtySince = false; this.updateDirty();
    }
    frameHero(snap) {
      const doc = this.doc, b = doc.objects.find((o) => o.kind === 'bridge');
      if (b) this.rig.set({ tx: b.a[0] + 0.7, ty: 0.7, tz: b.a[1] + 0.4, yaw: -0.1, pitch: 0.6, dist: 11.5 }, snap);
      else this.rig.set({ tx: doc.wu / 2, ty: 0, tz: doc.hu / 2, yaw: -0.2, pitch: 0.7, dist: 21 }, snap);
    }
    frameAll(snap) { const doc = this.doc; this.rig.set({ tx: doc.wu / 2, ty: 0, tz: doc.hu / 2 + doc.hu * 0.05, dist: Math.max(doc.wu, doc.hu * 1.4) * 1.25, pitch: this.view === 'top' ? 1.53 : 0.8, yaw: this.view === 'top' ? 0 : -0.2 }, snap); }
    /* ---- history ---- */
    pushOp(op) { this.history.push(op); this.updateButtons(); this.dirtySince = true; this.autosave(); }
    commitObjects(label, fn) {
      const before = JSON.stringify(this.doc.objects); fn(this.doc);
      const after = JSON.stringify(this.doc.objects); if (before === after) return;
      this.pushOp({ label, objs: [before, after] }); this.renderer.objectsChanged(); this.overlay.selection();
    }
    applyOp(op, which) {
      const doc = this.doc;
      if (op.tiles) { K.TileStroke.apply(doc, op.tiles, which); this.renderer.tilesChanged(...op.tiles.box); }
      if (op.objs) { doc.objects = JSON.parse(which === 'old' ? op.objs[0] : op.objs[1]); if (this.sel && !doc.obj(this.sel)) this.sel = null; this.renderer.objectsChanged(); }
      this.overlay.selection(); this.panel(); this.updateButtons();
    }
    undo() { this.tool.cancel(); const op = this.history.undo(); if (!op) return; this.applyOp(op, 'old'); this.toast('Undid ' + op.label); }
    redo() { this.tool.cancel(); const op = this.history.redo(); if (!op) return; this.applyOp(op, 'new'); this.toast('Redid ' + op.label); }
    updateButtons() { $('bUndo').disabled = !this.history.canUndo(); $('bRedo').disabled = !this.history.canRedo(); }
  }
  K.BuilderAppSession = BuilderAppSession;
})(typeof window !== 'undefined' ? window : globalThis);
