/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const U = K.BuilderAppUtils;

  /* the editor's canvas: sizing, the per-frame loop, drawing, capture, panning and picking the ground under the cursor */
  class EditorViewport {
    constructor(app) { this.app = app; this.roleTime = 0; this.fpsTime = 0; }
    get doc() { return this.app.doc; }
    resize() {
      const bar = U.byId('top').offsetHeight || 46;
      U.byId('tools').style.top = U.byId('insp').style.top = (bar + 18) + 'px';
      U.byId('insp').style.maxHeight = `calc(100vh - ${bar + 80}px)`;
      const stage = this.app.stage;
      this.applySize(Math.round(stage.clientWidth) || 1600, Math.round(stage.clientHeight) || 900);
    }
    applySize(w, h) {
      const app = this.app, dpr = Math.min(2, window.devicePixelRatio || 1);
      const ratio = app.quality === 2 ? dpr : Math.min(dpr, 1) * app.quality;
      app.renderer3.setPixelRatio(ratio);
      app.renderer3.setSize(w, h, false);
      app.camera.aspect = w / h;
      app.camera.updateProjectionMatrix();
      app.post.setSize(Math.round(w * ratio), Math.round(h * ratio));
    }
    renderFrame() {
      const app = this.app, cur = app.rig.cur, dist = cur.dist, playing = app.play.active;
      app.post.focus = dist;
      app.post.band = Math.max(dist * 0.07, playing ? 2.4 : 0);
      app.post.range = Math.max(dist * 0.22, playing ? 4 : 0);
      const target = new THREE.Vector3(cur.tx, cur.ty, cur.tz);
      app.renderer.update(app.time, app.camera, app.post.h, target, dist, cur.pitch);
      app.post.render(app.renderer.scene, app.camera, app.time);
      if (app.overlay.scene.visible) this.renderOverlay();
    }
    renderOverlay() {
      const r = this.app.renderer3;
      r.autoClear = false;
      r.setRenderTarget(null);
      r.clearDepth();
      r.render(this.app.overlay.scene, this.app.camera);
      r.autoClear = true;
    }
    frame() {
      const app = this.app, now = performance.now(), dt = Math.min(0.05, (now - app.last) / 1000), fixed = app.fixedTime !== null;
      app.last = now;
      app.time = fixed ? app.fixedTime : app.time + dt;
      if (app.play.active) app.play.update(fixed ? 1 / 60 : dt);
      app.rig.update(fixed ? 1 : dt, app.time);
      app.renderer.work(app.renderer.pending > 0 ? 12 : 4);
      this.renderFrame();
      if (app.play.active) app.play.ui.frame(dt);
      else if (now - this.roleTime > 400) { this.roleTime = now; app.overlay.roles(); }
      this.countFrame(now);
    }
    countFrame(now) {
      const frames = this.app.frames;
      frames.push(now);
      while (frames.length && now - frames[0] > 1000) frames.shift();
      if (now - this.fpsTime <= 500) return;
      this.fpsTime = now;
      const pending = this.app.renderer.pending, jobs = pending ? ` · painting ${pending} chunk jobs` : '';
      U.byId('sFps').textContent = `${frames.length} fps${jobs}`;
    }
    /* test hook: deterministic capture at a given size and time (same as the diorama's) */
    capture(w, h, t, view, sharp) {
      const app = this.app, quality = app.quality;
      app.renderer.finishAll();
      if (sharp) app.quality = 2;
      if (view === 'closeup') app.session.frameHero(true);
      else if (view === 'overview') this.frameOverview();
      this.applySize(w, h);
      app.fixedTime = t;
      app.overlay.scene.visible = false;
      this.frame();
      app.overlay.scene.visible = true;
      app.fixedTime = null;
      const url = app.renderer3.domElement.toDataURL('image/jpeg', 0.9);
      app.quality = quality;
      this.resize();
      return url;
    }
    frameOverview() {
      const bridge = this.doc.objects.find((object) => object.kind === 'bridge');
      this.app.rig.set({ tx: bridge.a[0] - 1.8, ty: 0, tz: bridge.a[1] - 0.4, yaw: -0.2, pitch: 0.7, dist: 21 }, true);
    }
    panBy(dx, dy, from) {
      const app = this.app, g = app.rig.goal, top = app.view === 'top';
      const s = g.dist * 0.0016 * (top ? 1.4 : 1), c = Math.cos(g.yaw), sn = Math.sin(g.yaw);
      g.tx = from.tx - (dx * c + dy * sn) * s;
      g.tz = from.tz - (-dx * sn + dy * c) * s / (top ? 1 : Math.max(0.5, Math.sin(g.pitch)));
      app.rig.clamp();
    }
    /* ray-march the tile heightfield (and bridge decks) under the cursor */
    pickGround(sx, sy) {
      const doc = this.doc;
      if (!doc) return null;
      const r = this.app.renderer3.domElement.getBoundingClientRect(), ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1), this.app.camera);
      const o = ray.ray.origin, d = ray.ray.direction;
      let prev = null;
      for (let t = 0; t < 400; t += 0.05) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        if (y < -30) break;
        const inside = x >= 0 && z >= 0 && x < doc.wu && z < doc.hu;
        if (inside && y <= doc.groundY(x, z)) return this.refineHit(o, d, prev == null ? t : prev, t);
        prev = t;
        if (t > 40) t += 0.05;
      }
      return this.planeHit(o, d);
    }
    /** bisect between the last point above ground and the first below it */
    refineHit(o, d, above, below) {
      const doc = this.doc;
      let a = above, b = below;
      for (let q = 0; q < 8; q++) {
        const m = (a + b) / 2;
        if (o.y + d.y * m <= doc.groundY(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m;
      }
      const px = o.x + d.x * b, pz = o.z + d.z * b;
      return { x: px, z: pz, y: doc.groundY(px, pz) };
    }
    /** fall back to the y=0 plane (lets you aim outside the world while dragging) */
    planeHit(o, d) {
      const doc = this.doc;
      if (d.y >= 0) return null;
      const t = -o.y / d.y, x = o.x + d.x * t, z = o.z + d.z * t;
      return x >= 0 && z >= 0 && x < doc.wu && z < doc.hu ? { x, z, y: 0 } : null;
    }
  }
  K.EditorViewport = EditorViewport;
})(typeof window !== 'undefined' ? window : globalThis);
