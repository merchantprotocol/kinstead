/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameScene extends K.CastleGameLifecycle {
    place(obj, x, z, rot) { obj.position.set(x, this.play.nav.y(x, z) - 0.02, z);
      obj.rotation.y = rot || 0;
      this.group.add(obj);
      return obj;
      }
    /* see-through: any castle mesh between the camera and the hero fades, so the hero is never lost behind a wall */
    updateOcclusion(dt) {
      if ((this.occT = (this.occT || 0) - dt) > 0) return;
        this.occT = 0.1;
      const me = this.play.me, cam = this.app && this.app.camera;
        if (!me || !cam) return;
      const V = this.occV || (this.occV = { o: new THREE.Vector3(), h: new THREE.Vector3(), d: new THREE.Vector3(), hit: new THREE.Vector3(),
      ray: new THREE.Ray() });
      const heroY = this.ramparts && this.ramparts.onRamparts(me) ? me.y : this.play.nav.y(me.x, me.z);
        // up on the walls: the hero's own height
      cam.getWorldPosition(V.o);
        V.h.set(me.x, heroY + 0.9, me.z);
      const far = V.o.distanceTo(V.h) - 0.4;
        V.ray.set(V.o, V.d.subVectors(V.h, V.o).normalize());
      for (const m of [...this.meshes.values(), this.keepMesh]) {
        if (!m || !m.parent) continue;
        if (this.floors.liftRoof(m, me)) continue;
          // you walked in under its roof: the roof lifts, the walls stay
        if (!m.userData.box || m.userData.popT < 0.5) m.userData.box = new THREE.Box3().setFromObject(m);
          // re-measure while a new piece pops up
        const hit = V.ray.intersectBox(m.userData.box, V.hit), fade = !!hit && V.o.distanceTo(V.hit) < far;
        if (fade !== !!m.userData.faded) this.setFaded(m, fade);
      }
    }
    setFaded(m, on) {
      m.userData.faded = on;
      m.traverse((o) => {
        if (!o.isMesh || o.userData.frost) return;
        if (on) { if (!o.userData.solidMat) { o.userData.solidMat = o.material;
        o.userData.fadeMat = (Array.isArray(o.material) ? o.material : [o.material]).map((x) => { const f = x.clone(); f.transparent = true;
        f.opacity = Math.min(x.opacity, 0.3);
          f.depthWrite = false;
          return f;
          });
        if (!Array.isArray(o.material)) o.userData.fadeMat = o.userData.fadeMat[0];
          } o.material = o.userData.fadeMat;
          }
        else if (o.userData.solidMat) o.material = o.userData.solidMat;
      });
    }
    redrawKeep() {
      if (this.survival) return;
      if (this.keepMesh) this.group.remove(this.keepMesh);
      this.keepMesh = this.art.piece('keep', { ruin: !this.castle.lit });
        this.place(this.keepMesh, this.L.keep.x, this.L.keep.z, 0);
    }

    /* ---------- tiles: nav blocking + occupancy ---------- */
  }
  K.CastleGameScene = CastleGameScene;
})(typeof window !== 'undefined' ? window : globalThis);
