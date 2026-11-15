/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, T = K.TILE;
  const DOOR_STEP = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

  /* A compact furnished village on a flattened snowy shelf, with clear doors and paths. WorldGenerator applies it
     to every generated world of at least 50 x 38 tiles when this module is loaded (the builder and play pages). */
  class StarterVillage {
    constructor(doc) { this.doc = doc; }
    apply(w, h) {
      const d = this.doc;
      if (w < 50 || h < 38) return d;
      const specs = [
        K.makeBuilding('cottage', 2, 3, d.uid('b'), d.seed),
        K.makeBuilding('smithy', 2, 19, d.uid('b'), d.seed + 1),
        K.makeBuilding('stable', 22, 3, d.uid('b'), d.seed + 2),
      ];
      // Keep the three footprints clear of generated cliffs, ruins and props, including their approach lanes.
      const boxes = specs.map((b) => [b.x - 1, b.z - 1, b.x + b.footprint.w + 2, b.z + b.footprint.h + 3]);
      d.objects = d.objects.filter((o) => !boxes.some((box) => this.overlaps(this.tileBox(o), box)));
      for (const [x, z, x1, z1] of boxes) this.flatten(x, z, Math.min(x1, w - 1), Math.min(z1, h - 1));
      this.flatten(15, 14, 21, 23);
      d.objects.push(
        { id: d.uid('p'), kind: 'prop', type: 'res:ore', x: 8.75, z: 8.25, s: 1, seed: d.seed },
        { id: d.uid('p'), kind: 'prop', type: 'res:pine', x: 10.25, z: 8.25, s: 1, seed: d.seed + 1 },
      );
      d.objects.push(...specs);
      d.objects = d.objects.filter((o) => o.type !== 'start');
      d.objects.push(this.startAt(specs[0]));
      return d;
    }
    /* an object's extent in tiles: [x0, z0, x1, z1] */
    tileBox(o) {
      if (o.kind === 'prop') return [o.x / T, o.z / T, o.x / T, o.z / T];
      const pts = o.kind === 'bridge' ? [o.a, o.b] : o.pts, xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
      return [Math.min(...xs) / T, Math.min(...zs) / T, Math.max(...xs) / T, Math.max(...zs) / T];
    }
    overlaps(b, [x, z, x1, z1]) { return b[0] <= x1 && b[2] >= x && b[1] <= z1 && b[3] >= z; }
    flatten(x0, z0, x1, z1) {
      const d = this.doc;
      for (let j = z0; j <= z1; j++) {
        for (let i = x0; i <= x1; i++) {
          d.terrain[d.idx(i, j)] = K.T.SNOW;
          d.height[d.idx(i, j)] = 0;
        }
      }
    }
    /* the player starts two tiles outside the cottage's front door */
    startAt(cottage) {
      const door = cottage.doors.find((x) => x.kind === 'exterior') || cottage.doors[0], step = DOOR_STEP[door.side];
      const sx = cottage.x + door.x + step[0] * 2, sz = cottage.z + door.z + step[1] * 2;
      return { id: this.doc.uid('p'), kind: 'prop', type: 'start', hero: 'warden', x: (sx + 0.5) * T, z: (sz + 0.5) * T, s: 1, seed: this.doc.seed };
    }
  }
  K.StarterVillage = StarterVillage;
})(typeof window !== 'undefined' ? window : globalThis);
