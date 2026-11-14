/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the start menu's backdrop: a world rendered with the game's diorama renderer
   (ground painting, sprites, depth of field, bloom) while the camera slowly orbits it. */
(function (G) {
  const K = (G.K = G.K || {}), THREE = G.THREE;

  class TitleScene {
    static ORBIT_SPEED = 0.045; // radians per second

    constructor(stage, settings) {
      this.stage = stage; this.settings = settings; this.time = 0; this.last = 0; this.raf = 0;
      const r = (this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }));
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.toneMapping = THREE.NoToneMapping;
      stage.appendChild(r.domElement);
      this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 400);
      this.rig = new K.CameraRig(this.camera); this.rig.drift = true;
      this.post = new K.PostPipeline(r);
      this.world = new K.WorldRenderer(r);
      this.onResize = () => this.resize();
      this.applySettings();
    }
    setDoc(doc) {
      this.world.setDoc(doc); this.rig.bounds = [0, 0, doc.wu, doc.hu];
      const focus = doc.objects.find((o) => o.kind === 'prop' && o.type === 'campfire') || doc.objects.find((o) => o.kind === 'bridge');
      const fx = focus ? (focus.x != null ? focus.x : focus.a[0]) : doc.wu / 2, fz = focus ? (focus.z != null ? focus.z : focus.a[1]) : doc.hu / 2;
      this.rig.set({ tx: fx, ty: 0, tz: fz, yaw: -0.4, pitch: 0.56, dist: 15 }, true);
      return this;
    }
    applySettings() {
      this.post.enabled.dof = this.settings.dof; this.post.enabled.bloom = this.settings.bloom; this.quality = +this.settings.quality;
      this.resize();
    }
    resize() {
      const w = Math.round(this.stage.clientWidth) || 1600, h = Math.round(this.stage.clientHeight) || 900;
      const dpr = Math.min(2, G.devicePixelRatio || 1), pr = this.quality === 2 ? dpr : Math.min(dpr, 1) * this.quality;
      this.gl.setPixelRatio(pr); this.gl.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      this.post.setSize(Math.round(w * pr), Math.round(h * pr));
    }
    frame(dt) {
      this.time += dt;
      this.rig.goal.yaw += dt * TitleScene.ORBIT_SPEED; this.rig.cur.yaw += dt * TitleScene.ORBIT_SPEED;
      this.rig.update(dt, this.time);
      this.world.work(this.world.pending > 0 ? 12 : 4);
      const c = this.rig.cur, dist = c.dist;
      this.post.focus = dist; this.post.band = dist * 0.07; this.post.range = dist * 0.22;
      this.world.update(this.time, this.camera, this.post.h, new THREE.Vector3(c.tx, c.ty, c.tz), dist, c.pitch);
      this.post.render(this.world.scene, this.camera, this.time);
    }
    start() {
      G.addEventListener('resize', this.onResize);
      this.last = performance.now();
      const loop = (now) => { const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.frame(dt); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
      return this;
    }
    stop() { cancelAnimationFrame(this.raf); G.removeEventListener('resize', this.onResize); }
  }

  K.TitleScene = TitleScene;
})(typeof window !== 'undefined' ? window : globalThis);
