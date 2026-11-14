/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Asset Lab (lab.html): one tiny snowy plot, one asset standing on it, rendered with the game's
   own WorldRenderer, lights, materials, snow and post pipeline, next to the Grok reference image it must match.
     LabCatalog     every hero and every Grok item id, with its reference image URL and default view
     RefImage       loads a reference, finds its opaque bounding box (for framing) and draws it for compares
     LabLighting    studio (light grey, like the refs) / game dusk / night campfire presets on the game's lights
     LabSubject     builds what stands on the plot: a K.Models registry model when there is one, else today's model
     RefFramer      puts the camera at the reference's 3/4 angle and fits the model to the reference's framing
     LabStage       renderer + plot + camera + post; frame(dt) is callable by hand (hidden tabs have no rAF)
     LabView        split / overlay / wipe compare modes, toolbar, picker, snapshot compare PNGs
   Automation (hidden browser tabs): window.lab.select(id), lab.step(n), lab.snapshot() -> PNG data URL, lab.perf(n). */
(function (G) {
  const K = (G.K = G.K || {}), KV = G.KV, THREE = G.THREE;

  /* ---------------- what can be shown ---------------- */
  class LabCatalog {
    static HEROES = ['knight', 'ranger', 'mage', 'troll'];
    static GROUPS = [
      ['Heroes', (id) => id.startsWith('hero_')],
      ['Castle pieces', (id) => !!(K.CASTLE_SIZE && K.CASTLE_SIZE[id]) || id === 'heartfire_hearth'],
      ['Level 2', (id) => id.endsWith('_lv2')],
      ['Weapons', (id) => /sword|blade|brand/.test(id)],
      ['Furniture', () => true],
    ];
    /* default reference views: yaw (radians, camera toward +x), pitch, vertical fov (degrees) */
    static VIEW_HERO = { yaw: 0.36, pitch: 0.16, fov: 18, fit: 'height' };
    static VIEW_ITEM = { yaw: 0.86, pitch: 0.5, fov: 18, fit: 'both' };

    constructor(models, art, win) { this.models = models; this.art = art || { base: 'art/', ids: [] }; this.win = win; }
    ids() {
      const set = new Set([...LabCatalog.HEROES.map((r) => 'hero_' + r), ...this.art.ids, ...this.models.ids()]);
      return [...set];
    }
    grouped() {
      const left = new Set(this.ids()), out = [];
      for (const [name, test] of LabCatalog.GROUPS) { const ids = [...left].filter(test).sort(); ids.forEach((i) => left.delete(i)); if (ids.length) out.push([name, ids]); }
      return out;
    }
    isHero(id) { return id.startsWith('hero_'); }
    refUrl(id) {
      const w = this.win || {}, lab = 'lab/' + id + '.png';
      if (this.isHero(id)) return (w.KINSTEAD_LAB_INLINE && w.KINSTEAD_LAB_INLINE[lab]) || lab;
      return (w.KINSTEAD_ART_INLINE && w.KINSTEAD_ART_INLINE[id]) || this.art.base + id + '.webp';
    }
    view(id) { const m = this.models.meta(id); return Object.assign({}, this.isHero(id) ? LabCatalog.VIEW_HERO : LabCatalog.VIEW_ITEM, m && m.view); }
  }

  /* ---------------- the reference image ---------------- */
  class RefImage {
    constructor(url) { this.url = url; this.img = null; this.box = [0, 0, 1, 1]; this.aspect = 1; }
    load() {
      return new Promise((res) => {
        const img = new Image(); img.decoding = 'async';
        img.onload = () => { this.img = img; this.aspect = img.naturalWidth / img.naturalHeight; this.box = RefImage.opaqueBox(img); res(this); };
        img.onerror = () => { console.warn('reference image missing: ' + this.url.slice(0, 80)); res(this); };
        img.src = this.url;
      });
    }
    /* normalised [x0, y0, x1, y1] of the pixels with alpha > 40 */
    static opaqueBox(img) {
      const w = 256, h = Math.max(1, Math.round(256 * img.naturalHeight / img.naturalWidth)), c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 < 0 ? [0, 0, 1, 1] : [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h];
    }
    imageData(w = 256) { return K.Palette && this.img ? K.Palette.pixels(this.img, w) : null; }
  }

  /* ---------------- lighting presets ---------------- */
  class LabLighting {
    static STUDIO_BG = '#d3d5d9';
    constructor(world) {
      this.world = world; const S = world.scene;
      this.hemi = S.children.find((o) => o.isHemisphereLight); this.rim = S.children.find((o) => o.isDirectionalLight && o !== world.sun);
      this.game = this.capture(); this.name = 'game'; this.fire = null;
    }
    capture() {
      const w = this.world, S = w.scene;
      return { bg: S.background.clone(), fog: [S.fog.color.clone()], hemi: [this.hemi.color.clone(), this.hemi.groundColor.clone(), this.hemi.intensity],
        sun: [w.sun.color.clone(), w.sun.intensity, w.sunOff.clone()], rim: this.rim ? [this.rim.color.clone(), this.rim.intensity] : null };
    }
    restore() {
      const g = this.game, w = this.world, S = w.scene;
      S.background.copy(g.bg); S.fog.color.copy(g.fog[0]); this.hemi.color.copy(g.hemi[0]); this.hemi.groundColor.copy(g.hemi[1]); this.hemi.intensity = g.hemi[2];
      w.sun.color.copy(g.sun[0]); w.sun.intensity = g.sun[1]; w.sunOff.copy(g.sun[2]); if (this.rim) { this.rim.color.copy(g.rim[0]); this.rim.intensity = g.rim[1]; }
    }
    /* name: 'studio' | 'game' | 'night'; fireAt: [x, y, z] for the night campfire */
    apply(name, fireAt) {
      const w = this.world, S = w.scene; this.restore(); this.name = name;
      w.lightSrc = w.lightSrc.filter((s) => !s.labFire);
      if (this.fire) { this.fire.parent && this.fire.parent.remove(this.fire); this.fire = null; }
      const studio = name === 'studio';
      w.snow.points.visible = !studio; w.fogLayers.forEach((f) => (f.m.visible = !studio));
      if (studio) {
        S.background.set(LabLighting.STUDIO_BG); S.fog.color.set(LabLighting.STUDIO_BG);
        this.hemi.color.set('#eef1f7'); this.hemi.groundColor.set('#6c6f76'); this.hemi.intensity = 1.25;
        w.sun.color.set('#fff1dc'); w.sun.intensity = 2.0; w.sunOff.set(-7, 11, 8);
        if (this.rim) { this.rim.color.set('#ffffff'); this.rim.intensity = 0.55; }
      } else if (name === 'night') {
        S.background.set('#080b14'); S.fog.color.set('#0c1222');
        this.hemi.color.set('#30447a'); this.hemi.groundColor.set('#07080d'); this.hemi.intensity = 0.55;
        w.sun.color.set('#8aa4e0'); w.sun.intensity = 0.35;
        if (this.rim) this.rim.intensity = 0.25;
        if (fireAt) {
          w.lightSrc.push({ x: fireAt[0], y: fireAt[1] + 0.45, z: fireAt[2], color: 0xff8a3c, base: 5, dist: 8, ph: 0.3, labFire: true });
          this.fire = new THREE.Group(); this.fire.position.set(fireAt[0], fireAt[1], fireAt[2]);
          const log = new THREE.MeshLambertMaterial({ color: '#4a2e1a' });
          for (const r of [0.3, -0.5, 1.6]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), log); m.rotation.y = r; m.position.y = 0.05; this.fire.add(m); }
          const f = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.5) })); f.position.y = 0.28; this.fire.add(f);
          w.scene.add(this.fire);
        }
      }
      return this;
    }
  }

  /* ---------------- what stands on the plot ---------------- */
  class LabSubject {
    /* catalog: LabCatalog; world: K.WorldRenderer (its BuildingMaterials feed the fallback castle art) */
    constructor(catalog, world) { this.catalog = catalog; this.world = world; this.art = new K.CastleArt(world.bmats); this.cache = new K.VoxelModelCache(KV.CharacterSculptor, () => K.Models); }
    /* -> { object3d, rig, anim, source: 'registry'|'fallback'|'none', model, height } */
    build(id) {
      if (this.catalog.isHero(id)) {
        const role = id.slice(5), reg = K.Models.rigFor(role), model = reg || KV.CharacterSculptor.build(role);
        const rig = new KV.VoxelRig(model, { rest: (model && model.rest) || KV.CharacterSculptor.REST[role] });
        return { object3d: rig.group, rig, anim: new KV.VoxelAnimator(rig, { phase: 0 }), source: reg ? 'registry' : 'fallback', model, height: model.height };
      }
      const lv2 = id.endsWith('_lv2'), type = lv2 ? id.slice(0, -4) : id;
      if (K.CASTLE_SIZE && K.CASTLE_SIZE[type]) {
        const hd = K.Models.pieceFor(type, lv2 ? 2 : 1), g = this.art.piece(type, { level: lv2 ? 2 : 1 });
        return { object3d: g, source: hd && (!lv2 || hd.lv2) ? 'registry' : 'fallback', model: hd && hd.model };
      }
      const m = K.Models.get(id);
      if (m) { const g = m.object3d(); for (const f of m.flamesM()) g.add(this.art.flame(f)); return { object3d: g, source: 'registry', model: m }; }
      return { object3d: new THREE.Group(), source: 'none' };
    }
  }

  /* ---------------- camera framing at the reference angle ---------------- */
  class RefFramer {
    /* fits camera (PerspectiveCamera) so that object's screen bounding box lands on the reference's opaque box.
       view: { yaw, pitch, fov }; refBox: normalised [x0, y0, x1, y1] (y down) -> { target, dist } */
    static fit(camera, object, view, refBox, around) {
      camera.fov = view.fov; camera.updateProjectionMatrix();
      object.updateMatrixWorld(true);
      const pts = RefFramer.points(object); if (!pts.length) return null;
      const box = new THREE.Box3().setFromPoints(pts), target = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      let dist = Math.max(size.x, size.y, size.z) * 3.5 + 1;
      const dir = new THREE.Vector3(Math.sin(view.yaw) * Math.cos(view.pitch), Math.sin(view.pitch), Math.cos(view.yaw) * Math.cos(view.pitch));
      const want = { cx: (refBox[0] + refBox[2]) - 1, cy: 1 - (refBox[1] + refBox[3]), h: (refBox[3] - refBox[1]) * 2, w: (refBox[2] - refBox[0]) * 2 };
      const v = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
      for (let it = 0; it < 12; it++) {
        camera.position.copy(target).addScaledVector(dir, dist); camera.lookAt(target); camera.updateMatrixWorld(true);
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const p of pts) { v.copy(p).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
        const hk = (y1 - y0) / want.h, wk = (x1 - x0) / want.w, k = view.fit === 'height' ? hk : view.fit === 'width' ? wk : (hk + wk) / 2;   // match the reference's height (heroes) or height and width on average
        dist *= k;
        const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist, halfW = halfH * camera.aspect;
        right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
        const dx = ((x0 + x1) / 2 / k - want.cx) * halfW, dy = ((y0 + y1) / 2 / k - want.cy) * halfH;
        target.addScaledVector(right, dx).addScaledVector(up, dy);
      }
      camera.position.copy(target).addScaledVector(dir, dist); camera.lookAt(target);
      return { target, dist, dir };
    }
    /* a sample of the object's vertices in world space (bounding-box corners are too loose for a silhouette fit) */
    static points(object) {
      const out = [], v = new THREE.Vector3();
      object.traverse((o) => {
        if (!o.isMesh || !o.visible || !o.geometry || o.layers.mask !== 1 || (o.material && o.material.colorWrite === false)) return;
        const P = o.geometry.attributes.position; if (!P) return;
        const step = Math.max(1, Math.floor(P.count / 4000));
        for (let i = 0; i < P.count; i += step) {
          v.fromBufferAttribute(P, i);
          if (o.isSkinnedMesh) o.applyBoneTransform(i, v);
          out.push(v.clone().applyMatrix4(o.matrixWorld));
        }
      });
      return out;
    }
  }

  /* ---------------- renderer, plot, camera, post ---------------- */
  class LabStage {
    static PLOT_TILES = 14;   // 7 x 7 m of snow: room for one building or one hero

    constructor(canvasHost) {
      const r = (this.gl = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.NoToneMapping;
      canvasHost.appendChild(r.domElement); this.canvas = r.domElement;
      this.camera = new THREE.PerspectiveCamera(18, 1, 0.1, 200);
      this.post = new K.PostPipeline(r); this.post.enabled.dof = false;
      this.world = new K.WorldRenderer(r);
      const N = LabStage.PLOT_TILES, doc = new K.WorldDoc(N, N, { name: 'Asset Lab', seed: 7 });   // all snow, flat
      this.world.setDoc(doc); this.doc = doc;
      this.centre = new THREE.Vector3(doc.wu / 2, 0, doc.hu / 2);
      this.plot = LabStage.makePlot(); this.plot.position.copy(this.centre); this.world.scene.add(this.plot);
      this.showPlot(true);
      this.lighting = new LabLighting(this.world);
      this.time = 0; this.orbit = false; this.orbitYaw = 0; this.view = null; this.fit = null;
      this.state = 'idle'; this.stateT = 0; this.subject = null;
    }
    /* the one plot: a small snowy voxel tile patch (stone sides, lumpy snow top), top surface at y = 0 */
    static makePlot() {
      const KVm = KV.StaticVoxelModel, S = K.Shapes, P = S.palette({ snow: '#e9eef2', snowS: '#c9d6e0', snowB: '#f7f9fb', stone: '#6f747b', stoneD: '#4d5258', stoneL: '#8d9299' });
      const m = new KVm('lab_plot', { size: 0.05 }), p = m.part();
      S.basePatch(p, { cx: 0, cz: 0, rx: 34, rz: 34, y0: 0, h: 4, square: true, wobble: 0.06, seed: 5 }, S.mottle([[P.stone, 5], [P.stoneD, 3], [P.stoneL, 2]], 51), S.mottle([[P.snow, 6], [P.snowS, 2], [P.snowB, 2]], 52));
      const g = m.object3d(); g.children.forEach((c) => (c.position.y = -4 * 0.05)); g.name = 'lab:plot'; return g;
    }
    /* the plot replaces the world's terrain chunks (lights, snow, fog and post stay the game's own) */
    showPlot(on) { this.plot.visible = on; this.world.chunks.forEach((c) => { if (c.group) c.group.visible = false; }); }
    setSize(w, h) {
      this.w = w; this.h = h;
      this.gl.setPixelRatio(1); this.gl.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.post.setSize(w, h);
    }
    /* put a subject ({ object3d, rig, anim, ... } from LabSubject) on the plot */
    show(subject) {
      if (this.subject) { this.world.scene.remove(this.subject.object3d); if (this.subject.rig) this.subject.rig.dispose(); }
      this.world.lightSrc = this.world.lightSrc.filter((s) => !s.labModel);
      this.subject = subject; const o = subject.object3d;
      o.position.copy(this.centre); this.world.scene.add(o);
      o.traverse((m) => { if (m.isMesh && !m.userData.flame && m.material && !m.material.isMeshBasicMaterial) { m.castShadow = m.castShadow !== false; m.receiveShadow = true; } });
      if (subject.model && subject.model.lightsM) for (const [x, y, z, s] of subject.model.lightsM()) this.world.lightSrc.push({ x: this.centre.x + x, y: y, z: this.centre.z + z, color: 0xffa04a, base: 2.2 * s, dist: 3.5, ph: x * 7, labModel: true });
      if (subject.anim) subject.anim.apply('idle', 0, 0, 0.016);
      this.state = 'idle'; this.stateT = 0;
    }
    frameTo(view, refBox) { this.view = view; this.orbitYaw = 0; this.fit = RefFramer.fit(this.camera, this.subject.object3d, view, refBox); return this.fit; }
    setAnim(state) { this.state = state; this.stateT = 0; }
    fireSpot() { return [this.centre.x - 1.1, 0, this.centre.z + 1.3]; }
    /* one frame; dt in seconds. Callable by hand (hidden tabs have no requestAnimationFrame) */
    frame(dt = 1 / 60) {
      this.time += dt; this.stateT += dt;
      const s = this.subject;
      if (s && s.anim) {
        if (this.state === 'attack' && this.stateT > 0.75) this.stateT = 0;   // loop the swing in the lab
        s.anim.apply(this.state, this.stateT, this.time, dt);
      }
      const f = this.fit;
      if (f) {
        if (this.orbit) this.orbitYaw += dt * 0.6;
        const v = this.view, yaw = v.yaw + this.orbitYaw;
        const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(v.pitch), Math.sin(v.pitch), Math.cos(yaw) * Math.cos(v.pitch));
        const piv = this.orbitYaw ? this.centre.clone().setY(f.target.y) : f.target;
        this.camera.position.copy(piv).addScaledVector(dir, f.dist); this.camera.lookAt(piv);
      }
      const tgt = f ? f.target : this.centre, dist = f ? f.dist : 8;
      this.world.work(4);
      this.world.update(this.time, this.camera, this.h || 600, tgt, dist, this.view ? this.view.pitch : 0.5);
      this.world.scene.fog.near = dist + 20; this.world.scene.fog.far = dist + 80;
      this.post.render(this.world.scene, this.camera, this.time);
    }
    ready() { return this.world.ready(20000); }
  }

  /* ---------------- the page ---------------- */
  class LabView {
    static MODES = ['split', 'overlay', 'wipe'];
    constructor(doc, win) {
      this.doc = doc; this.win = win; this.mode = 'split'; this.opacity = 0.5; this.wipe = 0.5; this.id = null; this.ref = null;
      this.catalog = new LabCatalog(K.Models, K.CASTLE_ART, win);
    }
    $(id) { return this.doc.getElementById(id); }
    async start() {
      this.stage = new LabStage(this.$('renderPane'));
      this.subjects = new LabSubject(this.catalog, this.stage.world);
      this.buildPicker(); this.bindToolbar();
      await this.stage.ready();
      this.win.addEventListener('resize', () => this.layout());
      const want = new URLSearchParams(this.win.location.search || '').get('asset');
      await this.select(want && this.catalog.ids().includes(want) ? want : 'hero_knight');
      this.loop();
      const l = this.$('loading'); if (l) l.remove();
      return this;
    }
    buildPicker() {
      const reg = new Set(K.Models.ids());
      this.$('picker').innerHTML = this.catalog.grouped().map(([g, ids]) => `<h3>${g}</h3>` + ids.map((id) => {
        const hd = reg.has(id) || (id.startsWith('hero_') && reg.has(id));
        return `<button data-id="${id}" class="pick${hd ? ' hd' : ''}" title="${id}">${id.replace(/_/g, ' ')}${hd ? '<b>HD</b>' : ''}</button>`;
      }).join('')).join('');
      this.$('picker').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) this.select(b.dataset.id); };
    }
    bindToolbar() {
      const on = (id, fn) => { const el = this.$(id); if (el) el.addEventListener(el.type === 'range' || el.type === 'checkbox' ? 'input' : 'click', fn); };
      this.doc.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => this.setMode(b.dataset.mode)));
      this.doc.querySelectorAll('[data-light]').forEach((b) => (b.onclick = () => this.setLight(b.dataset.light)));
      this.doc.querySelectorAll('[data-anim]').forEach((b) => (b.onclick = () => this.setAnim(b.dataset.anim)));
      on('opacity', (e) => { this.opacity = +e.target.value; this.applyMode(); });
      on('wipe', (e) => { this.wipe = +e.target.value; this.applyMode(); });
      on('orbit', (e) => { this.stage.orbit = e.target.checked; if (!this.stage.orbit) this.stage.orbitYaw = 0; });
      on('dof', (e) => { this.stage.post.enabled.dof = e.target.checked; });
      on('plot', (e) => this.stage.showPlot(e.target.checked));
      on('bSnap', () => this.downloadSnapshot());
      on('bReframe', () => this.reframe());
    }
    async select(id) {
      this.id = id;
      this.doc.querySelectorAll('.pick').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
      this.ref = await new RefImage(this.catalog.refUrl(id)).load();
      this.$('refImg').src = this.ref.img ? this.ref.img.src : '';
      this.$('refImg2').src = this.$('refImg').src;
      const s = this.subjects.build(id); this.stage.show(s);
      this.$('anims').hidden = !s.rig;
      this.$('info').textContent = `${id} · ${s.source === 'registry' ? 'HD model (src/models/' + id + '.js)' : s.source === 'fallback' ? 'today\'s model (no src/models/' + id + '.js yet)' : 'no 3D model yet'}` + (s.model && s.model.voxelCount ? ` · ${s.model.voxelCount.toLocaleString()} voxels · ${Math.round(s.model.tris || LabView.tris(s.object3d)).toLocaleString()} tris` : '');
      this.layout();
      if (!this.light) this.setLight('studio'); else this.setLight(this.light);
      return s;
    }
    static tris(o) { let n = 0; o.traverse((m) => { if (m.isMesh && m.geometry && m.geometry.index) n += m.geometry.index.count / 3; }); return n; }
    /* the render stage matches the reference's aspect, as tall as the window allows */
    layout() {
      const a = this.ref && this.ref.img ? this.ref.aspect : 1, bar = this.$('toolbar').offsetHeight || 60;
      const availH = Math.max(200, (this.win.innerHeight || 800) - bar - 24), availW = Math.max(200, (this.win.innerWidth || 1200) - 220 - 24);
      const per = this.mode === 'split' ? availW / 2 - 8 : availW;
      let h = Math.round(Math.min(availH, per / a)), w = Math.round(h * a);
      if (this.forced) { w = this.forced[0]; h = this.forced[1]; }
      for (const el of [this.$('refPane'), this.$('renderPane')]) { el.style.width = w + 'px'; el.style.height = h + 'px'; }
      this.stage.setSize(w, h);
      if (this.stage.subject) this.reframe();
      this.applyMode();
    }
    reframe() { this.stage.frameTo(this.catalog.view(this.id), this.ref ? this.ref.box : [0.1, 0.1, 0.9, 0.9]); }
    setMode(m) { this.mode = m; this.doc.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m)); this.layout(); }
    applyMode() {
      const m = this.mode, over = this.$('refImg2');
      this.$('refPane').hidden = m !== 'split';
      over.hidden = m === 'split';
      over.style.opacity = m === 'overlay' ? this.opacity : 1;
      over.style.clipPath = m === 'wipe' ? `inset(0 ${(1 - this.wipe) * 100}% 0 0)` : 'none';
      this.$('opacityWrap').hidden = m !== 'overlay'; this.$('wipeWrap').hidden = m !== 'wipe';
    }
    setLight(name) {
      this.light = name; this.stage.lighting.apply(name, this.stage.fireSpot());
      const pc = this.$('plot'); if (pc) { pc.checked = name !== 'studio'; this.stage.showPlot(pc.checked); }
      this.doc.querySelectorAll('[data-light]').forEach((b) => b.classList.toggle('on', b.dataset.light === name));
      this.doc.body.dataset.light = name;
    }
    setAnim(a) { this.stage.setAnim(a); this.doc.querySelectorAll('[data-anim]').forEach((b) => b.classList.toggle('on', b.dataset.anim === a)); }
    loop() {
      if (!this.win.requestAnimationFrame) return;
      let last = performance.now();
      const tick = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!this.paused) this.stage.frame(dt); this.raf = this.win.requestAnimationFrame(tick); };
      this.raf = this.win.requestAnimationFrame(tick);
    }

    /* ---- automation + snapshots ---- */
    step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) this.stage.frame(dt); return this.stage.time; }
    /* side-by-side PNG: the reference on the studio grey (left) | the live render (right), labelled */
    snapshot(label) {
      this.stage.frame(1 / 60);
      const W = this.stage.w, H = this.stage.h, c = this.doc.createElement('canvas'); c.width = W * 2; c.height = H + 28;
      const g = c.getContext('2d'); g.fillStyle = '#d3d5d9'; g.fillRect(0, 0, c.width, c.height);
      if (this.ref && this.ref.img) g.drawImage(this.ref.img, 0, 28, W, H);
      g.drawImage(this.stage.canvas, W, 28, W, H);
      g.fillStyle = '#20242c'; g.font = '600 14px system-ui, sans-serif';
      g.fillText('Reference (Grok)', 10, 19); g.fillText(`In game: ${this.id} · ${this.light}${label ? ' · ' + label : ''}`, W + 10, 19);
      return c.toDataURL('image/png');
    }
    downloadSnapshot() {
      const a = this.doc.createElement('a'); a.href = this.snapshot(); a.download = `compare-${this.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`; a.click();
    }
    /* ms per rendered frame over n frames (gl.finish via a 1-pixel readback each frame) */
    perf(n = 120) {
      const gl = this.stage.gl.getContext(), px = new Uint8Array(4); this.stage.frame(1 / 60);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { this.stage.frame(1 / 60); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      return (performance.now() - t0) / n;
    }
    /* force the stage to an exact pixel size (automation: compare at a fixed resolution) */
    size(w, h) { this.forced = w ? [w, h] : null; this.layout(); return [this.stage.w, this.stage.h]; }
  }

  K.Lab = { LabCatalog, RefImage, LabLighting, LabSubject, RefFramer, LabStage, LabView };
})(typeof window !== 'undefined' ? window : globalThis);
