/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · WorkShedArt: the open-air sheds workers ply their trade under: posts and a roof over the woodcutter's
   chopping yard, a lean-to against the quarry face, a hay shed in front of the farm's barn, a roofed hay rack in the
   cattle paddock. Posts go in the piece's kit; roofs go in its roof part, which lifts away when you walk underneath. */
(function (G) {
  const K = G.K;

  class WorkShedArt {
    /** posts [[x, z]...], post height, beams [[cx, z, len]...], roof [mat, cx, y, cz, w, d, tiltX, tiltZ] */
    static SHEDS = {
      woodcutter: { posts: [[-0.55, 0.28], [1.22, 0.28], [-0.55, 1.05], [1.22, 1.05]], h: 1.5, beams: [[0.335, 0.28, 1.85], [0.335, 1.05, 1.85]],
        roof: ['roofBrown', 0.335, 1.54, 0.665, 2.0, 1.05, -0.18, 0] },
      quarry: { posts: [[-1.05, 0.38], [0.32, 0.38]], h: 1.42, beams: [[-0.365, 0.38, 1.5]], roof: ['roofBrown', -0.365, 1.5, 0.05, 1.6, 0.9, -0.3, 0] },
      farm: { posts: [[-1.45, 0.72], [-0.5, 0.72], [-1.45, 1.22], [-0.5, 1.22]], h: 1.48, beams: [[-0.975, 0.72, 1.0], [-0.975, 1.22, 1.0]],
        roof: ['slate', -0.975, 1.5, 0.97, 1.15, 0.75, -0.15, 0] },
      barn: { posts: [[0.82, -1.15], [1.55, -1.15], [0.82, -0.5], [1.55, -0.5]], h: 1.4, beams: [], roof: ['slate', 1.185, 1.42, -0.825, 0.95, 0.85, 0, 0.12] },
    };
    constructor(k) { this.k = k; this.roofKit = k.roof || (k.roof = new K.VoxKit()); }
    draw(type) {
      const s = WorkShedArt.SHEDS[type]; if (!s) return this.k;
      for (const [x, z] of s.posts) this.k.box('woodDark', x, 0, z, 0.08, s.h, 0.08);
      for (const [cx, z, len] of s.beams) this.k.box('woodMid', cx, s.h - 0.08, z, len, 0.08, 0.1);
      const [mat, cx, y, cz, w, d, tx, tz] = s.roof;
      this.roofKit.box(mat, cx, y, cz, w, 0.07, d, 0, tx, tz);
      this.roofKit.box('snow', cx, y + 0.08, cz - 0.03, w - 0.1, 0.03, d * 0.8, 0, tx, tz);
      return this.k;
    }
  }

  K.WorkShedArt = WorkShedArt;
})(typeof window !== 'undefined' ? window : globalThis);
