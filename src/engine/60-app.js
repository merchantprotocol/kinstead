/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const U = K.BuilderAppUtils;

  /* The World Builder. A thin root: it owns the shared editor state (document, camera, renderer, selection,
     tool) and composes one collaborator per responsibility. Public methods are one-line delegations kept for
     the pages, the play mode, the castle game and the tools that call the app directly. */
  class BuilderApp {
    constructor() {
      this.stage = U.byId('stage');
      this.quality = +U.byId('qual').value;
      this.renderer3 = this.createGLRenderer();
      this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 400);
      this.rig = new K.CameraRig(this.camera);
      this.post = new K.PostPipeline(this.renderer3);
      this.renderer = new K.WorldRenderer(this.renderer3);
      this.overlay = null;
      this.history = new K.History();
      this.ui = {
        size: { paint: 3, height: 3, carve: 4 }, terrain: K.T.PATH, hmode: 'raise', step: 0.5, level: 0, cmode: 'carve', depth: -8.5,
        wallH: 2.4, ruin: 2.0, pillars: true, floor: true, bridgeW: 1.6, prop: 'pine', propS: 1,
      };
      this.time = 0; this.last = performance.now(); this.fixedTime = null; this.frames = []; this.view = 'orbit';
      this.store = null; this.savedId = null; this.dirtySince = false; this.sel = null; this.hoverP = null;
      this.viewport = new K.EditorViewport(this);
      this.session = new K.EditorSession(this);
      this.edits = new K.EditorHistory(this);
      this.storage = new K.EditorStorage(this);
      this.files = new K.EditorExport(this);
      this.selection = new K.SelectionController(this);
      this.inspector = new K.SelectionPanel(this);
      this.editorUI = new K.EditorUI(this);
      this.controls = new K.EditorControls(this);
      this.input = new K.InputController(this);
      this.interiors = K.EditorInteriors ? new K.EditorInteriors(this) : null;
      this.tools = this.createTools();
      this.play = new K.PlayMode(this);
    }
    createGLRenderer() {
      const r = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * (this.quality === 2 ? 1 : this.quality));
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.toneMapping = THREE.NoToneMapping;
      this.stage.appendChild(r.domElement);
      r.domElement.tabIndex = 0;
      return r;
    }
    createTools() {
      const tools = {
        select: new K.SelectTool(this), paint: new K.PaintTool(this), height: new K.HeightTool(this), carve: new K.CarveTool(this),
        wall: new K.WallTool(this), room: new K.RoomTool(this), bridge: new K.BridgeTool(this), prop: new K.PropTool(this),
      };
      if (this.interiors) this.interiors.registerTools(tools);
      return tools;
    }
    start() {
      this.overlay = new K.EditorOverlay(this);
      if (this.interiors) this.interiors.attach();
      this.editorUI.buildToolbar();
      this.controls.bind();
      this.input.bind();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.setTool('select');
      this.session.generate(4242, 64, 48, true);
      this.storeReady = this.storage.initStore();
      const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
      // the castle page draws nothing (and keeps its loading screen up) until its own world is ready
      if (G.KINSTEAD_HOLD_LOADING) { this.deferLoop = loop; return this; }
      loop();
      const loading = U.byId('loading');
      if (loading) { loading.classList.add('done'); setTimeout(() => loading.remove(), 500); }
      return this;
    }
    /** begin drawing frames (the castle page calls this once its world is in) */
    startLoop() { if (this.deferLoop) { const f = this.deferLoop; this.deferLoop = null; f(); } }
    get doc() { return this.renderer.doc; }
    frame() { this.viewport.frame(); }
    resize() { this.viewport.resize(); }
    capture(w, h, t, view, sharp) { return this.viewport.capture(w, h, t, view, sharp); }
    pickGround(sx, sy) { return this.viewport.pickGround(sx, sy); }
    panBy(dx, dy, from) { this.viewport.panBy(dx, dy, from); }
    setView(view) { this.editorUI.setView(view); }
    setTool(name) { this.editorUI.setTool(name); }
    setPlay(on) { this.editorUI.setPlay(on); }
    panel() { this.editorUI.panel(); }
    toast(text) { this.editorUI.toast(text); }
    ask(title, text, ok, danger) { return this.editorUI.ask(title, text, ok, danger); }
    select(id) { this.selection.select(id); }
    pushOp(op) { this.edits.pushOp(op); }
    commitObjects(label, fn) { this.edits.commitObjects(label, fn); }
    setDoc(doc, label) { this.session.setDoc(doc, label); }
    loadText(text) { return this.session.loadText(text); }
    serialize() { return this.session.serialize(); }
    updateDirty() { this.storage.updateDirty(); }
  }
  K.BuilderApp = BuilderApp;
})(typeof window !== 'undefined' ? window : globalThis);
