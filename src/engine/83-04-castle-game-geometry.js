/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameGeometry extends K.CastleGameScene {
    rectTiles(x, z, w, d, rot, fn) {
      const nav = this.play.nav, c = Math.cos(rot), s = Math.sin(rot), R = Math.hypot(w, d) / 2 + TILE;
      const [i0, j0] = nav.tile(x - R, z - R), [i1, j1] = nav.tile(x + R, z + R);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (!nav.inside(i, j)) continue; const [px, pz] = nav.centre(i, j), dx = px - x, dz = pz - z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2) fn(i, j, lx, lz);
      }
    }
    blockRect(x, z, w, d, rot, gate) {
      const nav = this.play.nav;
      this.rectTiles(x, z, w, d, rot, (i, j, lx) => { const k = j * nav.w + i; this.occ[k] = 1; if (!gate || Math.abs(lx) > 0.75) nav.walk[k] = 0; });
      const me = this.play.me, aloft = !!this.ramparts && this.ramparts.onRamparts(me);   // up on the walls: a new piece below never moves you
      if (me && !aloft && !nav.standable(me.x, me.z)) {
        const q = nav.nearestOk(...nav.tile(me.x, me.z), 8);
        if (q) { [me.x, me.z] = nav.centre(...q); me.path = null; }
      }
    }
    unblockRect(x, z, w, d, rot) { const nav = this.play.nav;
    this.rectTiles(x, z, w, d, rot, (i, j) => { const k = j * nav.w + i; this.occ[k] = 0; nav.walk[k] = 1; }); }

    /* ---------- entities the player can click ---------- */
  }
  K.CastleGameGeometry = CastleGameGeometry;
})(typeof window !== 'undefined' ? window : globalThis);
