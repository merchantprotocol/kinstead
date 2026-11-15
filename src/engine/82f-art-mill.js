/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · MillArt: the mill on the storehouse's right side, a building you walk into. An open-fronted timber shed with
   a stone back wall and half a side wall; a pair of millstones on a timber cradle (the runner stone is a separate part that
   turns while the miller grinds), a hopper of wheat, a flour spout, sacks of wheat waiting and flour done, a weighing beam,
   and hay bales stacked by the side wall. Its roof is drawn into the kit's roof part, which lifts away when you walk in. */
(function (G) {
  const K = G.K, CYL = K.VoxKit.CYL;

  class MillArt {
    static X0 = 0.18;
    static X1 = 2.38;
    static Z0 = -1.2;
    static Z1 = 0.92;
    static H = 1.62;
    /** k: the storehouse's kit (its .roof and .spin parts are filled in here); o: { level } */
    constructor(k, o = {}) { this.k = k; this.big = (o.level || 1) >= 2; this.roofKit = k.roof || (k.roof = new K.VoxKit()); }
    get mx() { return (MillArt.X0 + MillArt.X1) / 2; }
    get mz() { return (MillArt.Z0 + MillArt.Z1) / 2; }
    draw() { this.shell(); this.roof(); this.stones(); this.sacks(); this.hay(); this.sign(); return this.k; }
    shell() {
      const k = this.k, { X0, X1, Z0, Z1, H } = MillArt, mx = this.mx, mz = this.mz;
      k.box('stoneMid', mx, 0, mz, X1 - X0 + 0.06, 0.06, Z1 - Z0 + 0.06); k.box('planks', mx, 0.06, mz, X1 - X0 - 0.06, 0.02, Z1 - Z0 - 0.06);
      k.box('stoneLight', mx, 0.06, Z0 + 0.08, X1 - X0, H - 0.06, 0.16);                 // the stone back wall
      k.box('whitewash', X1 - 0.06, 0.06, (Z0 + 0.1) / 2 - 0.05, 0.12, H - 0.06, 1.25);    // half a side wall: the rest is open
      for (const [x, z] of [[X0 + 0.06, Z1 - 0.06], [X1 - 0.06, Z1 - 0.06], [mx, Z1 - 0.06], [X1 - 0.06, 0.12]]) k.box('woodDark', x, 0.06, z, 0.12,
          H - 0.06, 0.12);
      k.box('woodDark', mx, H - 0.1, Z1 - 0.06, X1 - X0, 0.12, 0.14); k.box('woodDark', X1 - 0.06, H - 0.1, mz, 0.14, 0.12, Z1 - Z0);
      for (const x of [X0 + 0.5, mx, X1 - 0.5]) k.box('woodMid', x, H - 0.12, mz, 0.08, 0.08, Z1 - Z0 - 0.2);   // joists, seen when the roof lifts
    }
    /** a gable roof, ridge along x, on the roof part */
    roof() {
      const r = this.roofKit, { X0, X1, Z0, Z1, H } = MillArt, w = X1 - X0 + 0.2, d = Z1 - Z0, a = 0.5, half = d / 2 + 0.16, L = half / Math.cos(a);
      const yb = H + (d / 2 - half / 2) * Math.tan(a), top = H + (d / 2) * Math.tan(a);
      for (const s of [-1, 1]) r.box('roofRed', this.mx, yb, this.mz + s * half / 2, w, 0.09, L, 0, s * a);
      r.box('woodDark', this.mx, top - 0.02, this.mz, w + 0.04, 0.12, 0.12); r.box('snow', this.mx, top + 0.08, this.mz, w, 0.04, 0.18);
      for (const s of [-1, 1]) for (let y = H; y < top - 0.02; y += 0.06) {
        const hw = (top - y) / Math.tan(a); r.box('whitewash', this.mx + s * (w / 2 - 0.12), y, this.mz, 0.04, 0.06, Math.max(0.02, hw * 2));
      }
    }
    /** the bed stone and its cradle, the turning runner stone, the hopper and the spout */
    stones() {
      const k = this.k, sx = 1.45, sz = -0.45;
      k.box('woodMid', sx, 0.06, sz, 0.95, 0.24, 0.95); k.geo('stoneMid', CYL, sx, 0.4, sz, 0, 0, 0, 0.42, 0.18, 0.42);
      k.geo('paintWhite', CYL, sx, 0.31, sz, 0, 0, 0, 0.45, 0.02, 0.45);
      const sp = new K.VoxKit();
      sp.geo('stoneLight', CYL, 0, 0.08, 0, 0, 0, 0, 0.38, 0.16, 0.38); sp.geo('stoneDark', CYL, 0, 0.165, 0, 0, 0, 0, 0.07, 0.02, 0.07);
      sp.box('woodLight', 0.3, 0.16, 0, 0.05, 0.36, 0.05); sp.box('woodDark', 0.3, 0.5, 0, 0.08, 0.06, 0.08);
      for (let i = 0; i < 4; i++) sp.box('stoneDark', 0, 0.161, 0, 0.7, 0.004, 0.02, i * Math.PI / 4);
      k.spin = { kit: sp, at: [sx, 0.49, sz] };
      for (const s of [-1, 1]) k.box('woodDark', sx + s * 0.32, 0.06, sz - 0.42, 0.06, 1.25, 0.06);
      k.box('woodDark', sx, 1.25, sz - 0.42, 0.7, 0.06, 0.08);
      k.box('woodLight', sx, 0.95, sz - 0.18, 0.34, 0.26, 0.34);
      k.box('wheatGold', sx, 1.2, sz - 0.18, 0.28, 0.03, 0.28);
      k.box('woodLight', sx, 0.78, sz - 0.18, 0.08, 0.18, 0.08);
      k.box('woodLight', sx + 0.48, 0.3, sz + 0.05, 0.2, 0.06, 0.08, 0, 0, -0.4); k.box('paintWhite', sx + 0.6, 0.06, sz + 0.06, 0.22, 0.1, 0.22);
    }
    sack(x, y, z, ry, mat) {
      const k = this.k;
      k.box(mat, x, y, z, 0.23, 0.22, 0.18, ry);
      k.box(mat, x, y + 0.22, z, 0.16, 0.06, 0.12, ry);
      k.box('rope', x, y + 0.26, z, 0.11, 0.04, 0.09, ry);
    }
    /** wheat waiting (gold) by the back wall, flour done (white) by the front, and a weighing beam */
    sacks() {
      const k = this.k;
      for (let i = 0; i < (this.big ? 6 : 4); i++) this.sack(0.48 + (i % 3) * 0.26, 0.08 + Math.floor(i / 3) * 0.3, -0.85 + (i % 2) * 0.04, i * 0.4,
          'wheatGold');
      for (let i = 0; i < (this.big ? 5 : 3); i++) this.sack(0.5 + (i % 3) * 0.27, 0.08 + Math.floor(i / 3) * 0.3, 0.45 + (i % 2) * 0.05, -i * 0.5,
          'paintWhite');
      k.box('woodDark', 0.62, 0.06, 0.05, 0.06, 1.2, 0.06); k.box('woodDark', 0.62, 1.22, 0.05, 0.6, 0.05, 0.05);
      k.box('rope', 0.4, 0.9, 0.05, 0.02, 0.32, 0.02); k.box('ironDark', 0.4, 0.84, 0.05, 0.16, 0.04, 0.16);
    }
    bale(x, y, z, ry) { const k = this.k; k.box('hay', x, y, z, 0.48, 0.28, 0.32, ry); k.box('rope', x, y - 0.005, z, 0.33, 0.29, 0.03, ry); }
    /** hay bales two high along the side wall, and a pitchfork against them */
    hay() {
      const R = Math.PI / 2;
      this.bale(2.0, 0.08, -0.15, R);
      this.bale(2.0, 0.08, 0.35, R);
      this.bale(2.0, 0.36, 0.1, R + 0.1);
      if (this.big) this.bale(2.0, 0.36, 0.55, R);
      this.k.box('woodLight', 1.68, 0.06, 0.62, 0.035, 1.15, 0.035, 0, 0, 0.18); this.k.box('steel', 1.58, 1.16, 0.62, 0.16, 0.03, 0.03);
    }
    /** a board over the opening with wheat sheaves and a loaf on it */
    sign() {
      const k = this.k, x = this.mx, y = MillArt.H + 0.02, z = MillArt.Z1 + 0.04;
      k.box('woodDark', x, y, z, 0.68, 0.34, 0.05); k.box('paintWhite', x, y + 0.03, z + 0.012, 0.62, 0.28, 0.05);
      for (let i = -1; i <= 1; i++) k.box('wheatGold', x - 0.13 + i * 0.05, y + 0.06, z + 0.05, 0.03, 0.22, 0.02, 0, 0, i * 0.3);
      k.box('bread', x + 0.13, y + 0.1, z + 0.05, 0.18, 0.09, 0.02);
    }
  }

  K.MillArt = MillArt;
})(typeof window !== 'undefined' ? window : globalThis);
