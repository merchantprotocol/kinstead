/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · ramparts: walk along the tops of your stone walls, over your stone gate, and up and down your stone
   towers. The ground NavGrid (58-nav.js) holds one height per tile and is shared with every creature, so the wall
   tops are NOT in it: they live in a player-only RampartLayer, and a tower's stairs (TowerStair) are the only way
   between the two. Raiders keep the ground and their old climb rules; the gate opening stays a ground passage.

     Ramparts   keeps the layer and stairs in step with your pieces, routes the hero between ground, stairs and
                walk, and drops the hero to the ground if the wall under it comes down */
(function (G) {
  const K = G.K;

  class Ramparts {
    constructor(game) {
      this.g = game; this.layer = null; this.stairs = []; this.sig = null; this.t = 0;
      this.walker = new K.RampartWalker(this); this.cursor = new K.RampartCursor(game, this);
      this.rebuild();
    }
    get play() { return this.g.play; }
    get nav() { return this.g.play.nav; }
    static handles(type) { return K.RampartPlan.walkable(type); }
    onRamparts(a) { return !!a && (a.layer === 'upper' || a.layer === 'stair'); }
    pick(sx, sy) { return this.cursor.pick(sx, sy); }
    towerSpot(p) { return this.cursor.towerSpot(p); }

    /* ---------- the layer ---------- */
    pieces() { return this.g.castle.pieces.filter((p) => Ramparts.handles(p.type) && p.hp > 0); }
    signature() { return this.pieces().map((p) => p.uid + ':' + p.x + ':' + p.z + ':' + p.rot).join('|'); }
    rebuild() {
      const nav = this.nav, towers = [], cells = [];
      for (const p of this.pieces()) {
        const base = nav.y(p.x, p.z) - 0.02, [w, d] = K.CastleArt.size(p.type);   // the mesh stands at nav.y - 0.02 (CastleGame.place)
        this.g.rectTiles(p.x, p.z, w, d, p.rot || 0, (i, j, lx) => cells.push([i, j, base + K.RampartPlan.topOf(p.type, lx)]));
        if (p.type === 'stone_tower') towers.push([p, base]);
      }
      // the layer covers only the box around the walls (plus an apron), not the whole world
      let i0 = 1e9, j0 = 1e9, i1 = -1e9, j1 = -1e9; for (const [i, j] of cells) { i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i); j1 = Math.max(j1, j); }
      if (!cells.length) { i0 = j0 = 0; i1 = j1 = 0; }
      i0 = Math.max(0, i0 - 4); j0 = Math.max(0, j0 - 4); i1 = Math.min(nav.w - 1, i1 + 4); j1 = Math.min(nav.h - 1, j1 + 4);
      const L = new K.RampartLayer(i1 - i0 + 1, j1 - j0 + 1, i0, j0);
      this.layer = L; this.stairs = []; this.sig = this.signature();
      for (const [i, j, y] of cells) L.set(i, j, y);
      for (const [p, base] of towers) this.addStairs(p, base);
    }
    /* a stair from every corner door with open ground outside it */
    addStairs(p, base) {
      for (const door of K.RampartPlan.DOORS) {
        const s = new K.TowerStair(p, base, door);
        if (this.nav.standable(s.door[0], s.door[1]) && !this.layer.has(s.door[0], s.door[1])) this.stairs.push(s);
      }
    }
    update(dt) {
      if ((this.t -= dt) > 0) return;
      this.t = 0.4;
      if (this.signature() !== this.sig) this.rebuild();
      const me = this.play.me; if (me && this.lostFooting(me)) this.drop(me);
    }
    /* the wall under you came down, or the tower you were climbing */
    lostFooting(a) {
      if (a.layer === 'upper') return !this.layer.has(a.x, a.z);
      if (a.layer !== 'stair') return false;
      const t = a.leg && a.leg.tower;
      return !t || t.hp <= 0 || !this.g.castle.pieces.includes(t);
    }
    drop(a) {
      const nav = this.nav; a.layer = 'ground'; a.leg = null; a.path = null;
      if (!nav.standable(a.x, a.z)) { const q = nav.nearestOk(...nav.tile(a.x, a.z), 8); if (q) [a.x, a.z] = nav.centre(...q); }
      a.y = nav.y(a.x, a.z);
    }

    /* ---------- routing ---------- */
    /** a path for actor a to (gx, gz): on the walk when `up`, else on the ground; tower stairs join the two. null if none. */
    route(a, gx, gz, up, opts = {}) {
      let head = [], sx = a.x, sz = a.z, lay = a.layer || 'ground';
      if (lay === 'stair') {   // half way up a flight: finish it, then go on from its end
        const run = a.leg && a.leg.run; if (!run) return null;
        head = run.slice(a.leg.idx);
        const e = run[run.length - 1]; sx = e[0]; sz = e[1]; lay = e[3];
      }
      let body;
      if (lay === 'ground' && !up) body = this.nav.find(sx, sz, gx, gz, opts);
      else if (lay === 'upper' && up) body = this.layer.find(sx, sz, gx, gz, opts);
      else body = this.viaStairs(sx, sz, gx, gz, lay === 'ground', opts);
      if (!body) return null;
      const out = head.concat(body); out.layered = true; return out;
    }
    /* the shortest way that changes layer: ground -> stair up -> walk, or walk -> stair down -> ground */
    viaStairs(sx, sz, gx, gz, goingUp, opts) {
      let best = null, bl = Infinity;
      const near = this.stairs.slice().sort((p, q) => p.detour(sx, sz, gx, gz) - q.detour(sx, sz, gx, gz)).slice(0, 6);
      for (const s of near) {
        const path = goingUp ? this.upBy(s, sx, sz, gx, gz, opts) : this.downBy(s, sx, sz, gx, gz, opts); if (!path) continue;
        const len = Ramparts.length([sx, sz], path); if (len < bl) { bl = len; best = path; }
      }
      return best;
    }
    upBy(s, sx, sz, gx, gz, opts) {
      const leg1 = Ramparts.ending(this.nav.find(sx, sz, s.door[0], s.door[1]), s.door); if (!leg1) return null;
      const leg2 = this.layer.find(s.top[0], s.top[1], gx, gz, opts); if (!leg2) return null;
      return leg1.concat(s.up, leg2);
    }
    downBy(s, sx, sz, gx, gz, opts) {
      const leg1 = Ramparts.ending(this.layer.find(sx, sz, s.top[0], s.top[1]), s.top); if (!leg1) return null;
      const leg2 = this.nav.find(s.door[0], s.door[1], gx, gz, opts); if (!leg2) return null;
      return leg1.concat(s.down, leg2);
    }
    /* a path that ends exactly on `at` (A* may stop on the tile centre) */
    static ending(path, at) {
      if (!path) return null;
      const e = path[path.length - 1];
      if (!e || Math.hypot(e[0] - at[0], e[1] - at[1]) > 0.02) path.push([at[0], at[1]]);
      return path;
    }
    static length(from, path) {
      let L = 0, [x, z] = from;
      for (const q of path) { L += Math.hypot(q[0] - x, q[1] - z); x = q[0]; z = q[1]; }
      return L;
    }
    /** someone handed the hero a plain ground path while it is up on the walls: down a tower first, then on to its end */
    adopt(a) {
      if (!this.onRamparts(a) || !a.path || !a.path.length || a.path.layered) return;
      const e = a.path[a.path.length - 1]; a.path = this.route(a, e[0], e[1], false);
    }
  }

  K.Ramparts = Ramparts;
})(typeof window !== 'undefined' ? window : globalThis);
