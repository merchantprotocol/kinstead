/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · ThawEffects: snow giving way around the hearth. A melt wave turns snow tiles inside a radius into frozen
   earth and cobbles; the full thaw at the ending also stops the snowfall. */
(function (G) {
  const K = G.K;
  const { TILE } = K;

  class ThawEffects {
    constructor(game) { this.g = game; this.melt = null; this.meltR = 0; this.stepT = 0; this.thawSnow = false; }
    /** the thawing ring around the hearth belonged to the old castle game: the snow stays snow, so this starts no wave */
    meltTo() { /* intentionally empty */ }
    thawAll(dur) {
      this.meltTo(80, dur);
      this.thawSnow = true;
    }
    /** per frame: advance a running melt wave, and hide the snowfall once the ending has thawed the map */
    update(dt) {
      const m = this.melt;
      if (m) {
        m.t += dt;
        this.stepT -= dt;
        if (this.stepT <= 0 || m.t >= m.dur) { this.stepT = 0.35; this.step(m.t / m.dur); }
      }
      if (!this.thawSnow) return;
      const endT = this.g.dayEvents.endT;
      this.g.R.snow.points.visible = endT == null || endT < 3;
    }
    step(k) {
      const m = this.melt;
      if (!m) return;
      const r = m.from + (m.to - m.from) * Math.max(0, Math.min(1, k)), r0 = this.meltR;
      if (r > r0 + 0.01) this.thawRing(r, r0);
      if (k >= 1) this.melt = null;
    }
    thawRing(r, r0) {
      const g = this.g, doc = g.play.doc, keep = g.L.keep, T = K.T;
      const [i0, j0] = doc.tileOf(keep.x - r, keep.z - r), [i1, j1] = doc.tileOf(keep.x + r, keep.z + r);
      const box = { a: 1e9, b: 1e9, c: -1, d: -1 };
      for (let j = Math.max(0, j0); j <= Math.min(doc.h - 1, j1); j++) {
        for (let i = Math.max(0, i0); i <= Math.min(doc.w - 1, i1); i++) {
          const k = j * doc.w + i;
          if (doc.terrain[k] !== T.SNOW) continue;
          const dd = Math.hypot((i + 0.5) * TILE - keep.x, (j + 0.5) * TILE - keep.z);
          if (dd > r || dd <= r0 - 0.5) continue;
          doc.terrain[k] = dd < 3.6 || K.hash2(i, j, 5) < 0.12 ? T.PATH : T.DIRT;
          box.a = Math.min(box.a, i);
          box.b = Math.min(box.b, j);
          box.c = Math.max(box.c, i);
          box.d = Math.max(box.d, j);
        }
      }
      this.meltR = r;
      if (box.c >= 0) g.R.tilesChanged(box.a, box.b, box.c + 1, box.d + 1);
    }
  }

  K.ThawEffects = ThawEffects;
})(typeof window !== 'undefined' ? window : globalThis);
