/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · camera-centred chunk streaming, the plan only (no THREE): which ground chunks should exist around the view,
   at which detail, which to create next and which to let go. The renderer (30-render.js) carries the plan out.
     lod 0  full detail (near the view)      lod 1  low detail (out to the far radius)
   A chunk is dropped, or lowered, only once it is a hysteresis distance past its radius, so a player walking back
   and forth across a border does not rebuild the same chunk every step. Creation is budgeted per call and nearest first. */
(function (G) {
  const K = (G.K = G.K || {});

  class ChunkStreamer {
    /* o: { ncx, ncz, chunkM, nearM, farM, hysteresisM, budget } */
    constructor(o) { Object.assign(this, { hysteresisM: 16, budget: 6 }, o); }
    key(ci, cj) { return cj * this.ncx + ci; }
    /** metres from (x,z) to the nearest point of chunk (ci,cj) */
    dist(ci, cj, x, z) {
      const s = this.chunkM, x0 = ci * s, z0 = cj * s;
      const dx = x < x0 ? x0 - x : x > x0 + s ? x - x0 - s : 0, dz = z < z0 ? z0 - z : z > z0 + s ? z - z0 - s : 0;
      return Math.hypot(dx, dz);
    }
    /** the detail a chunk this far away should have, or -1 for none */
    lodFor(d) { return d <= this.nearM ? 0 : d <= this.farM ? 1 : -1; }
    /** live: Map key -> lod. Returns { create:[{key,ci,cj,lod}], relod:[{key,ci,cj,lod}], drop:[key] } */
    plan(x, z, live) {
      const s = this.chunkM, reach = this.farM + this.hysteresisM, want = [], relod = [], drop = [];
      const ci0 = Math.max(0, Math.floor((x - reach) / s)), ci1 = Math.min(this.ncx - 1, Math.floor((x + reach) / s));
      const cj0 = Math.max(0, Math.floor((z - reach) / s)), cj1 = Math.min(this.ncz - 1, Math.floor((z + reach) / s));
      for (let cj = cj0; cj <= cj1; cj++) for (let ci = ci0; ci <= ci1; ci++) {
        const k = this.key(ci, cj), d = this.dist(ci, cj, x, z), have = live.get(k), lod = this.lodFor(d);
        if (have == null) { if (lod >= 0) want.push({ key: k, ci, cj, lod, d }); continue; }
        if (have === 1 && lod === 0) relod.push({ key: k, ci, cj, lod: 0, d });   // walked up to it: full detail
        else if (have === 0 && d > this.nearM + this.hysteresisM) relod.push({ key: k, ci, cj, lod: 1, d });   // well behind you: cheaper
      }
      for (const k of live.keys()) {
        const ci = k % this.ncx, cj = (k - ci) / this.ncx;
        if (this.dist(ci, cj, x, z) > reach) drop.push(k);
      }
      const byD = (a, b) => a.d - b.d; want.sort(byD); relod.sort(byD);
      const ups = relod.filter((r) => r.lod === 0), downs = relod.filter((r) => r.lod === 1);
      const create = want.slice(0, this.budget), up = ups.slice(0, Math.max(0, this.budget - create.length));
      return { create, relod: up.concat(downs.slice(0, this.budget)), drop, waiting: want.length - create.length + ups.length - up.length };
    }
  }

  K.ChunkStreamer = ChunkStreamer;
})(typeof window !== 'undefined' ? window : globalThis);
