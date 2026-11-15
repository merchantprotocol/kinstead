/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · GroundOccupancy: which ground tiles the castle takes. A footprint marks tiles occupied for building
   (game.occ) and blocks them for walking (play.nav.walk); gate tiles (game.gateTiles) are sanctuary wolves never enter. */
(function (G) {
  const K = G.K;
  const { TILE } = K;

  class GroundOccupancy {
    constructor(game) { this.g = game; }
    get nav() { return this.g.play.nav; }
    /** call fn(i, j, lx, lz) for every tile whose centre lies in the w x d rectangle at (x, z) turned by rot */
    rectTiles(x, z, w, d, rot, fn) {
      const nav = this.nav, c = Math.cos(rot), s = Math.sin(rot), R = Math.hypot(w, d) / 2 + TILE;
      const [i0, j0] = nav.tile(x - R, z - R), [i1, j1] = nav.tile(x + R, z + R);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (!nav.inside(i, j)) continue;
          const [px, pz] = nav.centre(i, j), dx = px - x, dz = pz - z;
          const lx = dx * c - dz * s, lz = dx * s + dz * c;
          if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2) fn(i, j, lx, lz);
        }
      }
    }
    /** occupy and block a rectangle (a gatehouse leaves its middle walkable); the hero is moved off it if it lands on them */
    blockRect(x, z, w, d, rot, gate) {
      const nav = this.nav, g = this.g;
      this.rectTiles(x, z, w, d, rot, (i, j, lx) => {
        const k = j * nav.w + i;
        g.occ[k] = 1;
        if (!gate || Math.abs(lx) > 0.75) nav.walk[k] = 0;
      });
      this.nudgeHeroOff();
    }
    nudgeHeroOff() {
      const nav = this.nav, me = this.g.play.me;
      const aloft = !!this.g.ramparts && this.g.ramparts.onRamparts(me);   // up on the walls: a new piece below never moves you
      if (!me || aloft || nav.standable(me.x, me.z)) return;
      const q = nav.nearestOk(...nav.tile(me.x, me.z), 8);
      if (!q) return;
      [me.x, me.z] = nav.centre(...q);
      me.path = null;
    }
    unblockRect(x, z, w, d, rot) {
      const nav = this.nav, g = this.g;
      this.rectTiles(x, z, w, d, rot, (i, j) => {
        const k = j * nav.w + i;
        g.occ[k] = 0;
        nav.walk[k] = 1;
      });
    }
    /** any building of yours: wolves never go in */
    insideBuilding(x, z) { return !!this.g.R.buildings.at(Math.floor(x / TILE), Math.floor(z / TILE)); }
    gateTilesOf(p) {
      const out = [], [w, d] = K.CastleArt.size(p.type);
      this.rectTiles(p.x, p.z, w, d, p.rot, (i, j) => out.push(i + ',' + j));
      return out;
    }
    /** tiles wolves may never step on: the house, and every gate (you walk through a gate; a wolf does not) */
    isSanctuary(x, z) { return this.insideBuilding(x, z) || this.g.gateTiles.has(Math.floor(x / TILE) + ',' + Math.floor(z / TILE)); }
  }

  K.GroundOccupancy = GroundOccupancy;
})(typeof window !== 'undefined' ? window : globalThis);
