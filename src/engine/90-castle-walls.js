/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · building by the square. A wall is a single square (one tile, 0.5 m): the wood wall is two cubes
   high, the stone wall one cube. Dirt is a cube you put on the ground: it raises the tile by one cube and can
   be stacked, so it is how you reshape the land. Click to place one, or press and drag to lay a line or any
   shape; the stroke follows the pointer one tile at a time (no diagonal gaps) and stops where you are blocked
   or run out of materials. Anywhere on the map: no hearth, no glow, no radius.

     Stroke        one press-drag-release in progress
     WallDrawer    turns pointer input into a Stroke of tiles and asks CastleGame.buildAt for each one */
(function (G) {
  const K = G.K;
  const { TILE } = K;
  const MAX_STEPS = 120;

  class Stroke {
    constructor(type, tile) { this.type = type; this.last = tile; this.tried = 0; this.built = 0; this.stopped = false; this.seen = new Set(); }
    key(i, j) { return i + ',' + j; }
  }

  class WallDrawer {
    constructor(game) { this.g = game; this.stroke = null; }
    /** which things are drawn tile by tile */
    handles(type) { return WallDrawer.TYPES.has(type); }
    /** the wall piece (or dirt) being placed right now, or null */
    get placing() { const P = this.g.cui && this.g.cui.placing; return P && this.handles(P.type) ? P : null; }
    ground(sx, sy) { return this.g.app.pickGround(sx, sy); }
    tile(p) { return [Math.floor(p.x / TILE), Math.floor(p.z / TILE)]; }
    centre(i, j) { return [(i + 0.5) * TILE, (j + 0.5) * TILE]; }
    /** where the ghost sits: the middle of the tile under the pointer */
    edgeAt(type, p) { const [i, j] = this.tile(p), [x, z] = this.centre(i, j); return { x, z, rot: 0 }; }

    /* ---------- the stroke ---------- */
    /** pointer pressed: place the first square at once; true when this press starts a stroke */
    down(sx, sy) {
      const P = this.placing; if (!P) return false;
      const p = this.ground(sx, sy); if (!p) return true;
      const [i, j] = this.tile(p), s = this.stroke = new Stroke(P.type, [i, j]); s.seen.add(s.key(i, j)); s.tried++;
      if (this.g.buildAt(P.type, ...this.centre(i, j), 0, false)) s.built++;   // not quiet: a single click explains why it can't go there
      return true;
    }
    drag(sx, sy) {
      const s = this.stroke; if (!s) return;
      this.g.cui.moveGhost(sx, sy);
      const p = this.ground(sx, sy); if (!p) return;
      const target = this.tile(p);
      for (let n = 0; n < MAX_STEPS && !s.stopped && (s.last[0] !== target[0] || s.last[1] !== target[1]); n++) {
        const di = target[0] - s.last[0], dj = target[1] - s.last[1];
        s.last = Math.abs(di) >= Math.abs(dj) ? [s.last[0] + Math.sign(di), s.last[1]] : [s.last[0], s.last[1] + Math.sign(dj)];   // one tile at a time, never diagonal
        this.lay(s, s.last[0], s.last[1]);
      }
    }
    up(sx, sy) {
      const s = this.stroke; this.stroke = null; if (!s) return;
      const g = this.g, cui = g.cui;
      if (s.built > 1) cui.toast(`${s.built} blocks.`);
      if (g.castle.blocker(s.type)) cui.stopPlacing(); else cui.moveGhost(sx, sy);
    }
    /** one more square on the path */
    lay(s, i, j) {
      const k = s.key(i, j); if (s.seen.has(k)) return; s.seen.add(k);
      const g = this.g, why = g.castle.blocker(s.type);
      if (why) { s.stopped = true; g.cui.toast(s.type === 'dirt' ? 'Out of dirt. Dig some with the shovel.' : `${g.data.piece(s.type).name}: ${why}.`); g.sound.play('clank'); return; }
      s.tried++; if (g.buildAt(s.type, ...this.centre(i, j), 0, true)) s.built++;
    }
    cancel() { this.stroke = null; }
  }
  WallDrawer.TYPES = new Set(['palisade', 'gate', 'stone_wall', 'dirt']);

  K.WallDrawer = WallDrawer; K.BuildStroke = Stroke;
})(typeof window !== 'undefined' ? window : globalThis);
