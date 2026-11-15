/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  class BuilderApp extends K.BuilderAppInput {
    static byId(id) { return document.getElementById(id); }
    resize() {
      const tb = BuilderApp.byId('top').offsetHeight || 46;
      BuilderApp.byId('tools').style.top = BuilderApp.byId('insp').style.top = (tb + 18) + 'px';
      BuilderApp.byId('insp').style.maxHeight = `calc(100vh - ${tb + 80}px)`;
      const w = Math.round(this.stage.clientWidth) || 1600, h = Math.round(this.stage.clientHeight) || 900;
      this.applySize(w, h);
    }
    applySize(w, h) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), pr = this.quality === 2 ? dpr : Math.min(dpr, 1) * this.quality;
      this.renderer3.setPixelRatio(pr); this.renderer3.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      this.post.setSize(Math.round(w * pr), Math.round(h * pr));
    }
    renderFrame() {
      const dist = this.rig.cur.dist;
      this.post.focus = dist;
      this.post.band = Math.max(dist * 0.07, this.play.active ? 2.4 : 0);
      this.post.range = Math.max(dist * 0.22, this.play.active ? 4 : 0);
      const tgt = new V3(this.rig.cur.tx, this.rig.cur.ty, this.rig.cur.tz);
      this.renderer.update(this.time, this.camera, this.post.h, tgt, dist, this.rig.cur.pitch);
      this.post.render(this.renderer.scene, this.camera, this.time);
      if (this.overlay.scene.visible) {
        const r = this.renderer3;
        r.autoClear = false;
        r.setRenderTarget(null);
        r.clearDepth();
        r.render(this.overlay.scene, this.camera);
        r.autoClear = true;
      }
    }
    frame() {
      const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.time = this.fixedTime !== null ? this.fixedTime : this.time + dt;
      if (this.play.active) this.play.update(this.fixedTime !== null ? 1 / 60 : dt);
      this.rig.update(this.fixedTime !== null ? 1 : dt, this.time);
      this.renderer.work(this.renderer.pending > 0 ? 12 : 4);
      this.renderFrame();
      if (this.play.active) this.play.ui.frame(dt);
      else if (!this.roleT || now - this.roleT > 400) { this.roleT = now; this.overlay.roles(); }
      this.frames.push(now); while (this.frames.length && now - this.frames[0] > 1000) this.frames.shift();
      if (!this.fpsT || now - this.fpsT > 500) {
        this.fpsT = now;
        const pending = this.renderer.pending;
        const jobs = pending ? ` · painting ${pending} chunk jobs` : '';
        BuilderApp.byId('sFps').textContent = `${this.frames.length} fps${jobs}`;
      }
    }
    /* test hook: deterministic capture at a given size and time (same as the diorama's) */
    capture(w, h, t, view, sharp) {
      this.renderer.finishAll(); const q = this.quality; if (sharp) this.quality = 2;
      if (view === 'closeup') this.frameHero(true);
      else if (view === 'overview') {
        const bridge = this.doc.objects.find((object) => object.kind === 'bridge');
        this.rig.set({
          tx: bridge.a[0] - 1.8, ty: 0, tz: bridge.a[1] - 0.4,
          yaw: -0.2, pitch: 0.7, dist: 21,
        }, true);
      }
      this.applySize(w, h); this.fixedTime = t; this.overlay.scene.visible = false; this.frame(); this.overlay.scene.visible = true; this.fixedTime = null;
      const url = this.renderer3.domElement.toDataURL('image/jpeg', 0.9); this.quality = q; this.resize(); return url;
    }
  }
  K.BuilderApp = BuilderApp;
})(typeof window !== 'undefined' ? window : globalThis);
