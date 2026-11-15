/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameEffects extends K.CastleGameCalendar {
    puff(x, z) { for (let i = 0; i < 6; i++) this.play.ui.float(x + (Math.random() - 0.5) * 1.2, this.play.nav.y(x, z) + 0.6 + Math.random() * 0.6,
    z + (Math.random() - 0.5) * 1.2, '❄', 'snow');
      }
    shake(s) { this.shakeT = Math.max(this.shakeT, s);
      }
    pushLights() {
      const R = this.R, c = this.castle, L = this.L, f = this.flareT > 0 ? 1 + Math.min(1.5, this.flareT) : 1;
      if (c.lit && this.home.built) R.lightSrc.push({ x: this.home.center.x - 1.6, y: 1.4, z: this.home.center.z - 0.4, color: 0xff8a3c,
      base: 16 * f * (0.6 + 0.4 * this.nightK), dist: Math.max(8, this.glowR * 1.5), ph: 0.3, fire: true });
      for (const p of c.pieces) if (p.type === 'ember_brazier' || p.type === 'ember_forge' || p.type === 'smithy') R.lightSrc.push({ x: p.x, y: 1.3,
      z: p.z, color: 0xff8a3c, base: 6, dist: 5, ph: p.uid, fire: true });
      const localPots = c.pieces.filter((p) => p.type === 'fire_pot');
      const remotePots = this.mp
        ? [...this.mp.world.pieces.values()].filter((r) => r.p.type === 'fire_pot').map((r) => r.p)
        : [];
      const pots = localPots.concat(remotePots);
      for (const p of pots) R.lightSrc.push({ x: p.x, y: 1.1, z: p.z, color: 0xff9a4a, base: 5 + 9 * this.nightK, dist: 9, ph: (p.uid || 0) + p.x,
      fire: true });
      // fire pots light the camp, brightest at night
    }
    /* thaw: snow tiles inside radius r become frozen earth / cobbles; animated as a wave over `dur` seconds */
    meltTo(r, dur) { /* the thawing ring around the hearth belonged to the old castle game: the snow stays snow */ }
    stepMelt(k) {
      const m = this.melt;
        if (!m) return;
        const r = K.CastleGameUtility.lerp(m.from, m.to, K.CastleGameUtility.clamp(k, 0, 1)), r0 = this.meltR || 0;
      if (r <= r0 + 0.01) { if (k >= 1) this.melt = null;
        return;
        }
      const doc = this.play.doc, L = this.L, T = K.T, [i0, j0] = doc.tileOf(L.keep.x - r, L.keep.z - r), [i1, j1] = doc.tileOf(L.keep.x + r, L.keep.z + r);
      let a = 1e9, b = 1e9, c = -1, d = -1;
      for (let j = Math.max(0, j0); j <= Math.min(doc.h - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(doc.w - 1, i1); i++) {
        const k2 = j * doc.w + i;
          if (doc.terrain[k2] !== T.SNOW) continue;
        const x = (i + 0.5) * TILE, z = (j + 0.5) * TILE, dd = Math.hypot(x - L.keep.x, z - L.keep.z);
          if (dd > r || dd <= r0 - 0.5) continue;
        doc.terrain[k2] = dd < 3.6 || K.hash2(i, j, 5) < 0.12 ? T.PATH : T.DIRT;
          a = Math.min(a, i);
          b = Math.min(b, j);
          c = Math.max(c, i);
          d = Math.max(d, j);
      }
      this.meltR = r;
        if (c >= 0) this.R.tilesChanged(a, b, c + 1, d + 1);
      if (k >= 1) this.melt = null;
    }
    thawAll(dur) { this.meltTo(80, dur);
      this.thawSnow = true;
      }
  }
  K.CastleGameEffects = CastleGameEffects;
})(typeof window !== 'undefined' ? window : globalThis);
