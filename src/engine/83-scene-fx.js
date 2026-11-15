/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · SceneFx: the small touches in the castle scene. Placing a mesh on the ground, the pop-up of a new piece,
   snow puffs, tower tracers, shaking pieces and camera, flickering flames and the fog at the edge of the world. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  class SceneFx {
    constructor(game) { this.g = game; this.pops = []; this.tracers = []; this.shakeT = 0; }
    /** put obj on the ground at (x, z), turned by rot, in the castle group */
    place(obj, x, z, rot) {
      obj.position.set(x, this.g.play.nav.y(x, z) - 0.02, z);
      obj.rotation.y = rot || 0;
      this.g.group.add(obj);
      return obj;
    }
    /** obj grows from s0 to full size with a little overshoot */
    pop(obj, s0 = 0.2) {
      obj.scale.setScalar(s0);
      obj.userData.popT = 0;
      obj.userData.s0 = s0;
      this.pops.push(obj);
    }
    puff(x, z) {
      const play = this.g.play;
      for (let i = 0; i < 6; i++) {
        const px = x + (Math.random() - 0.5) * 1.2, pz = z + (Math.random() - 0.5) * 1.2;
        play.ui.float(px, play.nav.y(x, z) + 0.6 + Math.random() * 0.6, pz, '❄', 'snow');
      }
    }
    shake(s) { this.shakeT = Math.max(this.shakeT, s); }
    /** a short line of light from a to b (an arrow, a bolt) */
    tracer(a, b, color) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y + 1.1, a.z), new THREE.Vector3(b.x, b.y + 0.7, b.z)]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: color || 0xffe6a0, transparent: true, opacity: 1 }));
      l.userData.t = 0;
      this.g.group.add(l);
      this.tracers.push(l);
    }
    update(dt) {
      this.pops = this.pops.filter((o) => this.growPop(o, dt));
      this.tracers = this.tracers.filter((l) => this.fadeTracer(l, dt));
      this.jiggleMeshes(dt);
      this.fitFog();
      this.shakeCamera(dt);
    }
    growPop(o, dt) {
      o.userData.popT += dt;
      const k = Math.min(1, o.userData.popT / 0.45), q = k - 1, back = 1 + 2.70158 * q * q * q + 1.70158 * q * q;
      o.scale.setScalar(o.userData.s0 + (1 - o.userData.s0) * back);
      return k < 1;
    }
    fadeTracer(l, dt) {
      l.userData.t += dt;
      l.material.opacity = 1 - l.userData.t / 0.25;
      if (l.userData.t <= 0.25) return true;
      this.g.group.remove(l);
      l.geometry.dispose();
      l.material.dispose();
      return false;
    }
    /** hit pieces shake; flames flicker */
    jiggleMeshes(dt) {
      const t = this.g.play.t;
      for (const m of this.g.meshes.values()) {
        if (m.userData.shake > 0) {
          m.userData.shake -= dt;
          m.position.x += (Math.random() - 0.5) * 0.04;
        }
        m.traverse((o) => { if (o.userData.flame) o.scale.y = 0.85 + 0.25 * Math.sin(t * 11 + o.id); });
      }
    }
    /** the far edge of the world always fades out, at any zoom */
    fitFog() {
      const g = this.g, fog = g.R.scene.fog, dd = g.app.rig.cur.dist, ws = g.weather.fogScale;
      if (!fog) return;
      fog.near = dd + 8 * ws;
      fog.far = dd + 32 * ws;
    }
    shakeCamera(dt) {
      if (this.shakeT <= 0) return;
      this.shakeT -= dt;
      const goal = this.g.play.app.rig.goal;
      goal.tx += (Math.random() - 0.5) * this.shakeT * 0.6;
      goal.tz += (Math.random() - 0.5) * this.shakeT * 0.6;
    }
  }

  K.SceneFx = SceneFx;
})(typeof window !== 'undefined' ? window : globalThis);
