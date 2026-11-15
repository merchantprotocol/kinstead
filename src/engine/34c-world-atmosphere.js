/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  /* background, distance fog, drifting low fog layers over the chasms, and falling snow */
  class WorldAtmosphere {
    constructor(scene, bank) {
      this.scene = scene;
      scene.background = new THREE.Color('#1a2131');
      scene.fog = new THREE.Fog('#26324a', 30, 70);
      this.fogTex = new THREE.CanvasTexture(bank.canvasOf(this.fogBuffer()));
      this.fogTex.wrapS = this.fogTex.wrapT = THREE.RepeatWrapping;
      this.layers = [];
      this.snow = new K.SnowField(3400);
      scene.add(this.snow.points);
    }
    /* seamless (tiling) fbm cloud alpha */
    fogBuffer() {
      const N = 128, fb = new K.PixelBuffer(N, N), n = new K.Noise(3);
      const tile = (a, b) => n.fbm(a / 22, b / 22, 4);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const fx = x / N, fy = y / N;
          const s = tile(x, y) * (1 - fx) * (1 - fy) + tile(x + N, y) * fx * (1 - fy)
            + tile(x, y + N) * (1 - fx) * fy + tile(x + N, y + N) * fx * fy;
          fb.set(x, y, [255, 255, 255], Math.max(0, Math.min(255, (s - 0.32) * 520)));
        }
      }
      return fb;
    }
    buildFog(doc) {
      this.layers.forEach((f) => { this.scene.remove(f.m); f.m.geometry.dispose(); f.t.dispose(); });
      this.layers = [];
      [-7.6, -6.4, -5.2, -4.0, -2.9].forEach((y, i) => this.layers.push(this.fogLayer(doc.wu, doc.hu, y, i)));
    }
    fogLayer(wu, hu, y, i) {
      const t = this.fogTex.clone();
      t.needsUpdate = true;
      t.offset.set(i * 0.37, i * 0.21);
      t.repeat.set(wu / 7, hu / 8);
      const material = new THREE.MeshBasicMaterial({
        map: t, transparent: true, opacity: 0.07 + i * 0.025, depthWrite: false, color: '#6f86ad', fog: false,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wu, hu), material);
      m.rotation.x = -Math.PI / 2;
      m.position.set(wu / 2, y, hu / 2);
      m.renderOrder = 3;
      this.scene.add(m);
      return { m, t, sp: 0.004 + i * 0.002 };
    }
    update(t, viewH, target, dist) {
      this.scene.fog.near = dist + 9;
      this.scene.fog.far = dist + 49;
      this.layers.forEach((f, i) => { f.t.offset.set(i * 0.37 + t * f.sp * 0.36, i * 0.21 + t * f.sp * 0.96); });
      this.snow.update(t, viewH, target);
    }
  }
  K.WorldAtmosphere = WorldAtmosphere;
})(typeof window !== 'undefined' ? window : globalThis);
