/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Occlusion: see-through walls. Any castle mesh between the camera and the hero fades, so the hero is never
   lost behind a wall; a workshop you walk into lifts its roof instead. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  class Occlusion {
    constructor(game) {
      this.g = game;
      this.t = 0;
      this.v = { o: new THREE.Vector3(), h: new THREE.Vector3(), d: new THREE.Vector3(), hit: new THREE.Vector3(), ray: new THREE.Ray() };
    }
    update(dt) {
      this.t -= dt;
      if (this.t > 0) return;
      this.t = 0.1;
      const g = this.g, me = g.play.me, cam = g.app && g.app.camera, V = this.v;
      if (!me || !cam) return;
      const heroY = g.ramparts && g.ramparts.onRamparts(me) ? me.y : g.play.nav.y(me.x, me.z);   // up on the walls: the hero's own height
      cam.getWorldPosition(V.o);
      V.h.set(me.x, heroY + 0.9, me.z);
      const far = V.o.distanceTo(V.h) - 0.4;
      V.ray.set(V.o, V.d.subVectors(V.h, V.o).normalize());
      for (const m of [...g.meshes.values(), g.keepMesh]) this.check(m, me, far);
    }
    check(m, me, far) {
      const V = this.v;
      if (!m || !m.parent) return;
      if (this.g.floors.liftRoof(m, me)) return;   // you walked in under its roof: the roof lifts, the walls stay
      if (!m.userData.box || m.userData.popT < 0.5) m.userData.box = new THREE.Box3().setFromObject(m);   // re-measure while a new piece pops up
      const hit = V.ray.intersectBox(m.userData.box, V.hit), fade = !!hit && V.o.distanceTo(V.hit) < far;
      if (fade !== !!m.userData.faded) this.setFaded(m, fade);
    }
    setFaded(m, on) {
      m.userData.faded = on;
      m.traverse((o) => {
        if (!o.isMesh || o.userData.frost) return;
        if (on) {
          if (!o.userData.solidMat) this.makeFadeMat(o);
          o.material = o.userData.fadeMat;
        } else if (o.userData.solidMat) o.material = o.userData.solidMat;
      });
    }
    makeFadeMat(o) {
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const faded = list.map((x) => {
        const f = x.clone();
        f.transparent = true;
        f.opacity = Math.min(x.opacity, 0.3);
        f.depthWrite = false;
        return f;
      });
      o.userData.solidMat = o.material;
      o.userData.fadeMat = Array.isArray(o.material) ? faded : faded[0];
    }
  }

  K.Occlusion = Occlusion;
})(typeof window !== 'undefined' ? window : globalThis);
