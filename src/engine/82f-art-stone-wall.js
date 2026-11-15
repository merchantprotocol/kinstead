/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the stone wall's art: one 0.5 m square of curtain wall as tall as the stone gate. Pale dressed blocks in
   staggered courses on all four faces, a walkway slab on top at the rampart height, and a merlon on each corner of the
   square, so a run drawn in either direction has a crenellated parapet on both sides and a clear walk down the middle.

     StoneWallArt   draws one square into a VoxKit; registered with K.CastleArt */
(function (G) {
  const K = G.K;

  /* Local-only connectivity derived from tile occupancy. Bits: N=1, E=2, S=4, W=8. */
  class WallConnections {
    static mask(piece, pieces) {
      const family = (type) => type === 'palisade' ? 'wood' : type === 'stone_wall' ? 'stone' : null;
      const mine = family(piece.type); if (!mine || piece.broken) return 0;
      let mask = 0;
      for (const p of pieces) {
        if (p === piece || p.broken) continue;
        const dx = p.x - piece.x, dz = p.z - piece.z;
        const wall = !!family(p.type), endpoint = ['gate', 'stone_gate', 'stone_tower'].includes(p.type);
        if (!wall && !endpoint) continue;
        const [w, d] = K.CastleArt.size(p.type), c = Math.abs(Math.cos(p.rot || 0)), s = Math.abs(Math.sin(p.rot || 0));
        const extentX = (c * w + s * d) / 2, extentZ = (s * w + c * d) / 2, alongX = Math.abs(dx) > Math.abs(dz), halfExtent = alongX ? extentX : extentZ;
        const gap = wall ? 0.5 : 0.25 + halfExtent;
        if (Math.abs(dx) < 0.03 && Math.abs(dz + gap) < 0.03) mask |= 1;
        if (Math.abs(dz) < 0.03 && Math.abs(dx - gap) < 0.03) mask |= 2;
        if (Math.abs(dx) < 0.03 && Math.abs(dz - gap) < 0.03) mask |= 4;
        if (Math.abs(dz) < 0.03 && Math.abs(dx + gap) < 0.03) mask |= 8;
      }
      return mask;
    }
  }
  K.WallConnections = WallConnections;

  class StoneWallArt {
    constructor() { this.tones = ['stoneLight', 'whitewash', 'stoneLight', 'stoneLight', 'whitewash']; }
    draw(k, opts = {}) {
      const top = K.RampartPlan.WALK, slab = top - 0.08;
      const mask = opts.wallMask || 0;
      k.box('stoneDark', 0, 0, 0, 0.5, 0.2, 0.5);                       // footing
      k.box('stoneDark', 0, 0.2, 0, 0.44, slab - 0.2, 0.44);            // mortar core
      for (const [bit, x, z, sx, sz] of [[1, 0, -0.125, 0.28, 0.25], [2, 0.125, 0, 0.25, 0.28], [4, 0, 0.125, 0.28, 0.25], [8, -0.125, 0, 0.25, 0.28]]) if (mask & bit) {
        k.box('stoneDark', x, 0.2, z, sx, slab - 0.2, sz);
      }
      this.courses(k, 0.2, slab);
      k.box('stoneMid', 0, slab, 0, 0.5, 0.08, 0.5);                    // walkway slab
      k.box('stoneLight', 0, top, 0, 0.18, 0.32, 0.18); // central post, no merlons crossing joints
      return k;
    }
    /* staggered block faces, the same on all four sides so a run looks right in either direction */
    courses(k, y0, y1) {
      for (let c = 0, y = y0; y < y1 - 0.05; c++, y += 0.39) {
        const h = Math.min(0.37, y1 - y), a = this.tones[c % this.tones.length], b = this.tones[(c + 2) % this.tones.length];
        const row = c % 2 ? [[0, 0.25, a], [0.19, 0.12, b], [-0.19, 0.12, b]] : [[-0.125, 0.245, a], [0.125, 0.245, b]];
        for (const [x, w, mat] of row) {
          for (const s of [-1, 1]) {
            k.box(mat, x, y, s * 0.23, w, h, 0.04);
            k.box(mat, s * 0.23, y, x, 0.04, h, w);
          }
        }
      }
    }
  }

  K.StoneWallArt = StoneWallArt;
  K.CastleArt.register('stone_wall', new StoneWallArt());
})(typeof window !== 'undefined' ? window : globalThis);
