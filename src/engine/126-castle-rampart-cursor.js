/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the cursor over the ramparts: which wall top, tower deck or gate walk is under the pointer (a click
   there walks you up), and where a stone tower sits when you place one (square on the tile grid).

     RampartCursor   screen point -> rampart point; pointer -> stone tower spot */
(function (G) {
  const K = G.K;
  const { TILE } = K;

  class RampartCursor {
    constructor(game, ramparts) { this.g = game; this.r = ramparts; }
    /** the rampart point under screen point (sx, sy), or null: march the camera ray down through the walk heights */
    pick(sx, sy) {
      const L = this.r.layer; if (!L || !L.count) return null;
      const ray = this.ray(sx, sy), o = ray.origin, d = ray.direction; if (d.y >= -1e-4) return null;
      const t0 = Math.max(0, (o.y - (L.top + 0.4)) / -d.y), t1 = (o.y - (L.low - 0.8)) / -d.y;
      for (let t = t0; t <= t1; t += 0.04) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, h = L.y(x, z);
        if (h != null && y <= h + 0.35) return { x, z, y: h };   // a hair above the walk counts (merlons, the hero's feet)
      }
      return null;
    }
    ray(sx, sy) {
      const THREE = G.THREE, app = this.g.app, r = app.renderer3.domElement.getBoundingClientRect(), caster = new THREE.Raycaster();
      caster.setFromCamera(new THREE.Vector2((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1), app.camera);
      return caster.ray;
    }
    /** where a stone tower goes for the pointer at p: centred on a tile, turned a whole quarter toward the Keep */
    towerSpot(p) {
      const i = Math.floor(p.x / TILE), j = Math.floor(p.z / TILE), q = Math.PI / 2;
      return { x: (i + 0.5) * TILE, z: (j + 0.5) * TILE, rot: Math.round(this.g.autoRot(p.x, p.z) / q) * q };
    }
  }

  K.RampartCursor = RampartCursor;
})(typeof window !== 'undefined' ? window : globalThis);
