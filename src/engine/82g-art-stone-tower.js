/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the stone tower's art: a 1.5 m square stone shell with an open doorway in each corner (walls join the
   middle of a face, so the corners stay clear), a stair that climbs one and a half turns round the inside
   (K.RampartPlan.STAIR) and an open deck at the rampart height with a merlon over each corner door.

     StoneTowerArt   draws the tower into a VoxKit; registered with K.CastleArt */
(function (G) {
  const K = G.K;
  const HALF = 0.75, THICK = 0.2, GAP = 0.3, DOOR_H = 1.15;

  class StoneTowerArt {
    draw(k) {
      const top = K.RampartPlan.WALK;
      k.box('stoneDark', 0, 0, 0, 1.56, 0.16, 1.56);
      for (let f = 0; f < 4; f++) this.face(k, f, top);
      for (const [sx, sz] of K.RampartPlan.DOORS) this.doorHead(k, sx * (HALF - GAP / 2), sz * (HALF - GAP / 2), top);
      this.stair(k);
      this.deck(k, top);
      return k;
    }
    /* one face wall between the two corner doors, f quarter turns round the tower */
    face(k, f, top) {
      const a = f * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), turned = f % 2 === 1;
      const put = (mat, lx, y, lz, w, h, d) => k.box(mat, lx * c + lz * s, y, -lx * s + lz * c, turned ? d : w, h, turned ? w : d);
      const span = (HALF - GAP) * 2, z = HALF - THICK / 2;
      put('stoneLight', 0, 0.16, z, span, top - 0.24, THICK);
      for (const y of [0.6, 1.3, 2.0, 2.7]) put('stoneMid', 0, y, HALF - 0.005, span, 0.02, 0.012);   // mortar courses
      put('ironDark', 0, 2.2, HALF + 0.002, 0.07, 0.4, 0.01);                                          // arrow slit
    }
    /* the stone over a corner doorway */
    doorHead(k, x, z, top) {
      k.box('stoneMid', x, DOOR_H - 0.06, z, GAP + 0.04, 0.1, GAP + 0.04);
      k.box('stoneLight', x, DOOR_H, z, GAP, top - 0.08 - DOOR_H, GAP);
    }
    /* steps along the stair corners */
    stair(k) {
      const P = K.RampartPlan.STAIR;
      for (let s = 0; s + 1 < P.length; s++) {
        const [x0, z0, y0] = P[s], [x1, z1, y1] = P[s + 1];
        for (let q = 0; q < 5; q++) {
          const u = (q + 0.5) / 5;
          k.box(q % 2 ? 'stoneMid' : 'stoneLight', x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - 0.12, z0 + (z1 - z0) * u, 0.3, 0.12, 0.3);
        }
      }
    }
    /* the open deck, its hatch over the stair head, a merlon on each corner and a pennant */
    deck(k, top) {
      k.box('stoneMid', 0, top - 0.16, 0, 1.6, 0.1, 1.6);                // corbel band
      k.box('stoneMid', 0, top - 0.08, 0, 1.5, 0.08, 1.5);
      k.box('woodDark', 0.38, top - 0.075, 0.38, 0.36, 0.08, 0.36);
      for (const x of [-0.6, 0.6]) {
        for (const z of [-0.6, 0.6]) {
          k.box('stoneLight', x, top, z, 0.3, 0.4, 0.3);
          k.box('stoneMid', x, top + 0.4, z, 0.34, 0.05, 0.34);
        }
      }
      k.box('woodDark', 0.6, top + 0.45, 0.6, 0.04, 0.9, 0.04);
      k.box('paintRed', 0.6, top + 1.12, 0.75, 0.02, 0.2, 0.28);
    }
  }

  K.StoneTowerArt = StoneTowerArt;
  K.CastleArt.register('stone_tower', new StoneTowerArt());
})(typeof window !== 'undefined' ? window : globalThis);
