/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  /* sky, sun and rim light, plus a fixed pool of point lights handed to the light sources nearest the view */
  class WorldLighting {
    constructor(scene) {
      this.scene = scene;
      scene.add(new THREE.HemisphereLight('#7f9cd0', '#1c2230', 1.25));
      this.sun = this.makeSun();
      const rim = new THREE.DirectionalLight('#6d8ee0', 0.6);
      rim.position.set(30, 12, -10);
      scene.add(rim);
      // a fixed pool keeps the shaders stable
      this.pool = [];
      for (let i = 0; i < 6; i++) {
        const light = new THREE.PointLight('#ff8a3c', 0, 9, 1.4);
        light.position.set(0, -50, 0);
        scene.add(light);
        this.pool.push(light);
      }
    }
    makeSun() {
      const sun = new THREE.DirectionalLight('#ffd6a8', 2.4), sc = sun.shadow.camera;
      this.sunOff = new THREE.Vector3(-10, 9, 9);
      sun.castShadow = true;
      sun.shadow.mapSize.set(4096, 4096);
      Object.assign(sc, { left: -24, right: 24, top: 20, bottom: -20, near: 1, far: 70 });
      sun.shadow.bias = -0.0006;
      sun.shadow.normalBias = 0.03;
      sun.shadow.radius = 2;
      this.scene.add(sun, sun.target);
      return sun;
    }
    /** light the nearest sources to the view target, flickering fires and the staff glow */
    update(t, sources, target, dist) {
      for (const s of sources) s.d = (s.x - target.x) ** 2 + (s.z - target.z) ** 2;
      sources.sort((a, b) => a.d - b.d);
      this.pool.forEach((light, i) => this.assign(light, sources[i], t));
      this.followView(target, dist);
    }
    assign(light, s, t) {
      if (!s) { light.intensity = 0; light.position.set(0, -60, 0); return; }
      light.position.set(s.x, s.y, s.z);
      light.color.setHex(s.color);
      light.distance = s.dist;
      light.decay = s.staff ? 1.5 : 1.4;
      const flicker = 0.82 + 0.12 * Math.sin(t * 13 + s.ph) + 0.08 * Math.sin(t * 29 + s.ph * 3);
      light.intensity = s.staff ? 3.2 + Math.sin(t * 2.2) * 0.8 : s.base * flicker;
    }
    /* sun + shadow frustum follow the view so big worlds keep crisp shadows */
    followView(target, dist) {
      const span = Math.max(14, dist * 1.25), sc = this.sun.shadow.camera;
      const tx = Math.round(target.x * 4) / 4, tz = Math.round(target.z * 4) / 4;
      this.sun.target.position.set(tx, 0, tz);
      this.sun.position.set(tx + this.sunOff.x, this.sunOff.y, tz + this.sunOff.z);
      if (sc.right === span) return;
      Object.assign(sc, { left: -span, right: span, top: span * 0.85, bottom: -span * 0.85, far: 90 });
      sc.updateProjectionMatrix();
    }
  }
  K.WorldLighting = WorldLighting;
})(typeof window !== 'undefined' ? window : globalThis);
