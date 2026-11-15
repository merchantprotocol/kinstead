/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · getting through what you built. When a wolf or a bear wants something and the ordinary route is
   shut, a Breacher looks for the cheapest way through and works at it:
     - a wall or gate it is strong enough to break (a bear breaks wood walls, wood gates and a stone gate's drawbridge)
     - raised dirt it can dig down (wolves and bears both dig through dirt walls)
   and it gives up on what it cannot do: stone walls, and holes and cliffs (a wolf cannot cross a hole two blocks
   deep, a bear cannot cross one three deep: it only digs ground YOU raised, never fills in ground you dug).
     Breacher.rules(kind)   what each kind of creature can break and how far it can climb
     Breacher               plan + work, one creature at a time */
(function (G) {
  const K = G.K;
  const TILE = K.TILE;
  const BREAKABLE = { wolf: new Set([]), bear: new Set(['palisade', 'gate', 'stone_gate']) };   // pieces (stone walls are in neither)
  const CLIMB = { wolf: 0.55, bear: 1.05 };                                                       // metres: a bear steps two blocks, a wolf one
  const GATES = new Set(['gate', 'stone_gate']);

  class Breacher {
    constructor(game, actor, kind) { this.g = game; this.a = actor; this.kind = kind; this.plan = null; this.replan = 0; this.swing = 0; this.gaveUp = 0; }
    get nav() { return this.g.play.nav; }
    get doc() { return this.g.play.doc; }
    get climb() { return CLIMB[this.kind]; }
    breakable(piece) { return !!piece && BREAKABLE[this.kind].has(piece.type); }
    /** the piece standing on this tile, if any */
    pieceOn(i, j) { return this.map ? this.map.get(i + ',' + j) || null : null; }
    /** which piece covers which tile (rebuilt for each plan: cheap, and the search asks it thousands of times) */
    index() {
      const g = this.g, map = this.map = new Map();
      for (const p of g.castle.pieces) { const [w, d] = K.CastleArt.size(p.type); g.rectTiles(p.x, p.z, w, d, p.rot, (i, j) => map.set(i + ',' + j, p)); }
    }
    /** ground the player raised (so a creature may dig it down) */
    raised(i, j) { const k = j * this.doc.w + i, h0 = this.g.persist && this.g.persist.h0; return !!h0 && this.doc.height[k] > h0[k]; }
    /** tiles a plan may pass as if open: the walls and gates this creature can break */
    over() { return (i, j) => this.breakable(this.pieceOn(i, j)); }
    /** the way is open already? */
    openPath(gx, gz, range, blocker) { return this.nav.find(this.a.x, this.a.z, gx, gz, { range, maxNodes: 6000, blocked: blocker, maxStep: this.climb }); }
    /** the cheapest route allowing breaches, and the first thing on it that has to be broken or dug; or { stuck } */
    makePlan(gx, gz, range) {
      this.index(); const nav = this.nav, a = this.a, over = this.over(), tile = (x, z) => nav.tile(x, z);
      const extra = (i, j, ni, nj) => { const k = nj * nav.w + ni; let c = 0; if (this.breakable(this.pieceOn(ni, nj))) c += 14; if (Math.abs(nav.S[k] - nav.S[j * nav.w + i]) > this.climb) c += 60; return c; };   // prefer going around, then breaking, then digging
      const path = nav.find(a.x, a.z, gx, gz, { range, maxNodes: 9000, over, maxStep: 50, extra, blocked: (i, j) => this.g.gateTiles.has(i + ',' + j) && !over(i, j) });
      if (!path || !path.length) return { stuck: true };
      let prev = tile(a.x, a.z), px = a.x, pz = a.z; const through = [[a.x, a.z]];
      for (const [qx, qz] of path) {
        const len = Math.hypot(qx - px, qz - pz), n = Math.max(1, Math.ceil(len / 0.2));
        for (let s = 1; s <= n; s++) {
          const x = px + (qx - px) * s / n, z = pz + (qz - pz) * s / n, t = tile(x, z);
          if (t[0] === prev[0] && t[1] === prev[1]) continue;
          const ob = this.classify(prev, t); if (ob) return Object.assign(ob, { stand: through.slice(), from: prev, tile: t });
          prev = t; through.push([x, z]);
        }
        px = qx; pz = qz;
      }
      return { clear: true };
    }
    /** what stops a step from tile p to tile t, or null when it is open */
    classify(p, t) {
      const nav = this.nav, w = nav.w, k = t[1] * w + t[0], pk = p[1] * w + p[0], piece = this.pieceOn(t[0], t[1]);
      if (piece && GATES.has(piece.type) && piece.bridge && piece.bridge.open) return null;   // an open gate is just a way through
      if (piece && (!nav.walk[k] || GATES.has(piece.type) || this.g.gateTiles.has(t[0] + ',' + t[1]))) return this.breakable(piece) ? { piece } : { stuck: true };
      if (!nav.walk[k]) return { stuck: true };   // a tree, a rock, water, the house
      if (Math.abs(nav.S[k] - nav.S[pk]) > this.climb) { const hi = nav.S[k] > nav.S[pk] ? t : p; return this.raised(hi[0], hi[1]) ? { dig: hi } : { stuck: true }; }   // too steep: dig your dirt, give up on a hole or a cliff
      return null;
    }
    /** one tick of getting to (gx,gz). Returns 'clear' (walk normally), 'working', 'moving' or 'stuck'. */
    advance(gx, gz, range, dt) {
      const a = this.a, g = this.g; this.replan -= dt; this.swing -= dt;
      if (this.replan <= 0) { this.replan = 0.8; this.plan = this.makePlan(gx, gz, range); }
      const pl = this.plan; if (!pl || pl.stuck) return 'stuck'; if (pl.clear) return 'clear';
      const tx = (pl.tile[0] + 0.5) * TILE, tz = (pl.tile[1] + 0.5) * TILE, d = Math.hypot(tx - a.x, tz - a.z);
      if (d > 1.15) { if (this.pathFor !== pl || !a.path) { a.path = pl.stand.slice(1).concat([[(pl.from[0] + 0.5) * TILE, (pl.from[1] + 0.5) * TILE]]); this.pathFor = pl; } g.play.move(a, dt, a.speed); a.view.state !== 'run' && a.view.setState('run'); return 'moving'; }
      a.path = null; a.view.setFacing(tx - a.x, tz - a.z);
      if (this.swing <= 0) { this.swing = this.kind === 'bear' ? 0.9 : 1.1; this.work(pl); }
      return 'working';
    }
    work(pl) {
      const g = this.g, a = this.a, fx = g.tools.effects; a.view.setState('attack');
      if (pl.dig) {
        const [i, j] = pl.dig; if (!this.raised(i, j)) { this.replan = 0; return; }
        g.tools.editor.lower(i, j, false); g.sound.play('thunk'); fx.burst('dirt', (i + 0.5) * TILE, g.play.nav.y((i + 0.5) * TILE, (j + 0.5) * TILE) + 0.3, (j + 0.5) * TILE, 5, 2.2); this.replan = 0;
      } else if (pl.piece) {
        const hit = a.atk * (pl.piece.type === 'palisade' ? 1 : pl.piece.type === 'gate' ? 1.6 : 1); g.hurtStructure({ piece: pl.piece }, Math.round(hit)); this.replan = 0.3;
      }
    }
  }

  Breacher.GATES = GATES;
  K.Breacher = Breacher;
})(typeof window !== 'undefined' ? window : globalThis);
