/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the rampart layer: a second, player-only nav grid with one walk height per rampart tile (the tops of
   your stone walls, stone towers and stone gate). It reuses NavGrid's A* and string-pulling; nothing else ever
   searches it, so raiders keep the ground grid and its climb rules, and the gate opening stays a ground passage.

     RampartLayer   which tiles are walk, and how high */
(function (G) {
  const K = G.K;
  const UP_STEP = 0.7;   // the steepest step along the walk (onto the gate's flanking towers is 0.64)

  class RampartLayer extends K.NavGrid {
    /* w x h tiles starting at world tile (ox, oz): only the box around your walls, never the whole (possibly huge) world */
    constructor(w, h, ox = 0, oz = 0) { super({ w, h, ox, oz }, {}); }
    build() {
      this.w = this.doc.w; this.h = this.doc.h; this.ox = this.doc.ox; this.oz = this.doc.oz;
      const n = this.w * this.h;
      this.S = new Float32Array(n); this.walk = new Uint8Array(n); this.edge = new Uint8Array(n);
      this.deck = new Uint8Array(n); this.free = new Uint8Array(n);
      this.top = 0; this.low = Infinity; this.count = 0;
    }
    /** make tile (i, j) part of the walk at height y */
    set(i, j, y) {
      i -= this.ox; j -= this.oz;   // world tile -> this window
      if (!this.inside(i, j)) return;
      const k = j * this.w + i; if (!this.walk[k]) this.count++;
      this.walk[k] = 1; this.S[k] = y; this.top = Math.max(this.top, y); this.low = Math.min(this.low, y);
    }
    has(x, z) { const [i, j] = this.tile(x, z); return this.inside(i, j) && this.walk[j * this.w + i] === 1; }
    /** the walk height at (x, z), or null off the ramparts */
    y(x, z) { return this.has(x, z) ? this.S[this.key(x, z)] : null; }
    key(x, z) { const [i, j] = this.tile(x, z); return j * this.w + i; }
    find(sx, sz, gx, gz, opts = {}) { return super.find(sx, sz, gx, gz, Object.assign({}, opts, { maxStep: UP_STEP })); }
  }

  K.RampartLayer = RampartLayer;
})(typeof window !== 'undefined' ? window : globalThis);
