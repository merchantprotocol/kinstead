/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;

  /* the open world: replacing, generating, loading and serializing the document, and framing the camera on it */
  class EditorSession {
    constructor(app) { this.app = app; }
    get doc() { return this.app.doc; }
    setDoc(doc, label) {
      const app = this.app;
      if (app.interiors) app.interiors.leave();
      if (app.play) {
        if (app.play.active) app.setPlay(false);
        app.play.reset();
      }
      app.savedId = null;
      app.sel = null;
      app.history.clear();
      app.renderer.setDoc(doc);
      app.rig.bounds = [0, 0, doc.wu, doc.hu];
      if (doc.camera) app.rig.set(doc.camera, true);
      else this.frameHero(true);
      if (app.overlay) app.overlay.clear();
      app.panel();
      app.edits.updateButtons();
      app.editorUI.status(label || '');
      app.updateDirty();
    }
    generate(seed, w, h, quiet) {
      const t0 = performance.now();
      const doc = new K.WorldGenerator(seed).generate(w, h);
      this.setDoc(doc);
      const ms = Math.round(performance.now() - t0);
      if (!quiet) this.app.toast(`Generated seed ${seed} · ${w} × ${h} tiles · ${doc.objects.length} objects (${ms} ms)`);
      this.markClean();
    }
    newBlank(w, h, name, base) {
      const doc = new K.WorldDoc(w, h, { name, seed: 1 });
      doc.terrain.fill(base | 0);
      this.setDoc(doc);
      const dist = Math.max(16, doc.wu * 0.55);
      this.app.rig.set({ tx: doc.wu / 2, tz: doc.hu / 2, ty: 0, dist, pitch: 0.75, yaw: -0.2 }, true);
      this.app.toast(`New blank world · ${w} × ${h} tiles`);
      this.markClean();
    }
    markClean() {
      this.app.dirtySince = false;
      this.app.updateDirty();
    }
    loadText(text) {
      let doc;
      try { doc = K.WorldDoc.fromJSON(JSON.parse(text)); } catch (e) { this.app.toast('Could not load: ' + e.message); return false; }
      this.setDoc(doc);
      this.app.toast(`Loaded "${doc.name}" · ${doc.w} × ${doc.h} tiles · ${doc.objects.length} objects`);
      return true;
    }
    serialize() {
      const doc = this.doc, app = this.app, goal = app.rig.goal;
      if (app.play.active) doc.game = app.play.snapshot();
      doc.camera = {
        tx: U.round3(goal.tx), ty: U.round3(goal.ty), tz: U.round3(goal.tz),
        yaw: U.round3(goal.yaw), pitch: U.round3(goal.pitch), dist: U.round3(goal.dist),
      };
      return doc.toJSON();
    }
    frameHero(snap) {
      const doc = this.doc, bridge = doc.objects.find((o) => o.kind === 'bridge');
      if (bridge) this.app.rig.set({ tx: bridge.a[0] + 0.7, ty: 0.7, tz: bridge.a[1] + 0.4, yaw: -0.1, pitch: 0.6, dist: 11.5 }, snap);
      else this.app.rig.set({ tx: doc.wu / 2, ty: 0, tz: doc.hu / 2, yaw: -0.2, pitch: 0.7, dist: 21 }, snap);
    }
    frameAll(snap) {
      const doc = this.doc, top = this.app.view === 'top';
      this.app.rig.set({
        tx: doc.wu / 2, ty: 0, tz: doc.hu / 2 + doc.hu * 0.05,
        dist: Math.max(doc.wu, doc.hu * 1.4) * 1.25, pitch: top ? 1.53 : 0.8, yaw: top ? 0 : -0.2,
      }, snap);
    }
  }
  K.EditorSession = EditorSession;
})(typeof window !== 'undefined' ? window : globalThis);
