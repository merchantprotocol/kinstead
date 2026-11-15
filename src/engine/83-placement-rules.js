/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · PlacementRules: may a new piece go here? Free ground, nobody standing on it, dirt only where the ground can
   take it, and never a wall that seals the Keep in. Also where a gate lines up and which way a new piece faces. */
(function (G) {
  const K = G.K;
  const { TILE } = K;

  class PlacementRules {
    constructor(game) { this.g = game; }
    /** why a new piece can't go at (x, z) turned by rot, or null when it can */
    placementOk(type, x, z, rot) {
      const g = this.g, [w, d] = K.CastleArt.size(type), nav = g.play.nav;
      if (type === 'dirt') return this.dirtOk(x, z);
      if (type === 'field') return g.economy.plantOk(x, z);
      if (type === 'blacksmith') return null;   // the blacksmith is placed by BuildingSite (104-castle-site.js)
      let bad = null;
      g.ground.rectTiles(x, z, w + 0.2, d + 0.2, rot, (i, j) => {
        const k = j * nav.w + i;
        if (g.occ[k] || g.R.buildings.at(i, j)) bad = 'something is in the way';
        else if (!nav.walk[k] || nav.deck[k]) bad = bad || 'the ground is not clear';
      });
      const me = g.play.me;
      if (!bad && Math.hypot(me.x - x, me.z - z) < Math.min(w, d) / 2 + 0.2) bad = 'you are standing there';
      return bad;
    }
    /** a piece may never seal the Keep in: its approach must still reach the wilds (walls need the Gatehouse as the way in) */
    wouldWallOffKeep(type, x, z, rot) {
      const g = this.g, nav = g.play.nav, [w, d] = K.CastleArt.size(type), gate = type === 'gatehouse', saved = [];
      g.ground.rectTiles(x, z, w, d, rot, (i, j, lx) => {
        if (gate && Math.abs(lx) <= 0.75) return;
        const k = j * nav.w + i;
        saved.push([k, nav.walk[k]]);
        nav.walk[k] = 0;
      });
      const L = g.L, a = g.keepEnt.goal || [L.keep.x, L.keep.z + L.keep.r + 1];
      const open = L.outside.some((o) => nav.find(a[0], a[1], o.x, o.z, { range: 1.5 }));
      for (const [k, v] of saved) nav.walk[k] = v;
      return !open;
    }
    /** a new piece faces away from the Keep, plus the player's own quarter turns */
    autoRot(x, z) {
      const L = this.g.L;
      return Math.atan2(-(x - L.keep.x), -(z - L.keep.z)) + (this.g.rotExtra || 0);
    }
    /** dirt goes on free ground, one cube per press; it stacks. Never bury anyone. */
    dirtOk(x, z) {
      const g = this.g, play = g.play, [i, j] = play.doc.tileOf(x, z), cx = (i + 0.5) * TILE, cz = (j + 0.5) * TILE;
      for (const a of play.actors) {
        if (!a.alive && a !== play.me) continue;
        const reach = TILE / 2 + (a.r || 0.3);
        if (Math.abs(a.x - cx) < reach && Math.abs(a.z - cz) < reach) return a === play.me ? 'you are standing there' : 'something is standing there';
      }
      return g.tools.editor.canRaise(i, j) ? null : 'the ground cannot take dirt here';
    }
    /** where a gate goes for the pointer at p: it lines up with a fence run next to it, else follows R. Returns { x, z, rot }. */
    gateSpot(p) {
      const i = Math.floor(p.x / TILE), j = Math.floor(p.z / TILE);
      const turned = Math.round((this.g.rotExtra || 0) / (Math.PI / 2)) % 2 === 1;
      const spotX = { x: (i + 1) * TILE, z: (j + 0.5) * TILE, rot: 0 }, spotZ = { x: (i + 0.5) * TILE, z: (j + 1) * TILE, rot: Math.PI / 2 };
      if (turned) return spotZ;
      if (this.wallAt(spotX.x - 1.25, spotX.z) || this.wallAt(spotX.x + 1.25, spotX.z)) return spotX;
      if (this.wallAt(spotZ.x, spotZ.z - 1.25) || this.wallAt(spotZ.x, spotZ.z + 1.25)) return spotZ;
      return spotX;
    }
    wallAt(x, z) {
      const q = this.g.pieceSet.pieceAt(x, z, 0.05);
      return !!q && !K.Breacher.GATES.has(q.type);
    }
  }

  K.PlacementRules = PlacementRules;
})(typeof window !== 'undefined' ? window : globalThis);
