/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the stone wall's art: one 0.5 m square of curtain wall as tall as the stone gate. Pale dressed blocks in
   staggered courses on all four faces, a walkway slab on top at the rampart height, and a merlon on each corner of the
   square, so a run drawn in either direction has a crenellated parapet on both sides and a clear walk down the middle.

     StoneWallArt   draws one square into a VoxKit; registered with K.CastleArt */
(function (G) {
  const K = G.K;

  class StoneWallArt {
    constructor() { this.tones = ['stoneLight', 'whitewash', 'stoneLight', 'stoneLight', 'whitewash']; }
    draw(k) {
      const top = K.RampartPlan.WALK, slab = top - 0.08;
      k.box('stoneDark', 0, 0, 0, 0.5, 0.2, 0.5);                       // footing
      k.box('stoneDark', 0, 0.2, 0, 0.44, slab - 0.2, 0.44);            // mortar core
      this.courses(k, 0.2, slab);
      k.box('stoneMid', 0, slab, 0, 0.5, 0.08, 0.5);                    // walkway slab
      for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) k.box('stoneLight', x, top, z, 0.14, 0.32, 0.14);   // corner merlons
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
