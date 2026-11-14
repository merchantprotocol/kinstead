/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · drawing walls. A wall piece is one section; walls are laid on a fence lattice (a node every
   section-length, offset so a wall runs along a row of tiles). Click once for a single section; press and
   drag to lay as many as you like, turning corners as the pointer turns. Each section is placed with the
   normal rules (cost, blocked ground, the Keep stays reachable), so the stroke simply stops where you are
   blocked or out of materials. Anywhere on the map: there is no glow or hearth limit. */
(function (G) {
  const K = G.K;
  const { CastleArt } = K;
  const OFF = 0.25;                                  // lattice offset: puts the wall's centre line on a tile row, so it blocks tiles
  const MAX_STEPS = 80;

  /** One press-drag-release in progress. */
  class Stroke {
    constructor(type, node) { this.type = type; this.last = node; this.tried = 0; this.built = 0; this.stopped = false; }
  }

  class WallDrawer {
    constructor(game) { this.g = game; this.stroke = null; }
    handles(type) { return WallDrawer.TYPES.has(type); }
    spacing(type) { return CastleArt.size(type)[0]; }
    /** the wall piece being placed right now, or null */
    get placing() { const P = this.g.cui && this.g.cui.placing; return P && this.handles(P.type) ? P : null; }
    ground(sx, sy) { return this.g.app.pickGround(sx, sy); }

    /* ---------- lattice maths ---------- */
    node(type, p) { const s = this.spacing(type); return [Math.round((p.x - OFF) / s), Math.round((p.z - OFF) / s)]; }
    xy(type, [i, j]) { const s = this.spacing(type); return [i * s + OFF, j * s + OFF]; }
    /** the section nearest a point: { x, z, rot } (rot 0 runs along x, a quarter turn along z) */
    edgeAt(type, p) {
      const s = this.spacing(type), u = (p.x - OFF) / s, v = (p.z - OFF) / s, fu = u - Math.floor(u), fv = v - Math.floor(v);
      if (Math.min(fv, 1 - fv) <= Math.min(fu, 1 - fu)) return { x: (Math.floor(u) + 0.5) * s + OFF, z: Math.round(v) * s + OFF, rot: 0 };
      return { x: Math.round(u) * s + OFF, z: (Math.floor(v) + 0.5) * s + OFF, rot: Math.PI / 2 };
    }

    /* ---------- the stroke ---------- */
    /** pointer pressed: true when this press starts a wall stroke */
    down(sx, sy) {
      const P = this.placing; if (!P) return false;
      const p = this.ground(sx, sy); if (p) this.stroke = new Stroke(P.type, this.node(P.type, p));
      return true;
    }
    drag(sx, sy) {
      const s = this.stroke; if (!s) return;
      this.g.cui.moveGhost(sx, sy);
      const p = this.ground(sx, sy); if (!p) return;
      const target = this.node(s.type, p);
      for (let n = 0; n < MAX_STEPS && !s.stopped && (s.last[0] !== target[0] || s.last[1] !== target[1]); n++) {
        const di = target[0] - s.last[0], dj = target[1] - s.last[1];
        const next = Math.abs(di) >= Math.abs(dj) ? [s.last[0] + Math.sign(di), s.last[1]] : [s.last[0], s.last[1] + Math.sign(dj)];
        this.lay(s, s.last, next); s.last = next;
      }
    }
    up(sx, sy) {
      const s = this.stroke; this.stroke = null; if (!s) return;
      const g = this.g, cui = g.cui;
      if (s.tried === 0) { const p = this.ground(sx, sy); if (p) { const e = this.edgeAt(s.type, p); g.buildAt(s.type, e.x, e.z, e.rot, false); } }   // a plain click: one section, with the reason if it can't go there
      else if (s.built > 1) cui.toast(`${s.built} sections of ${g.data.piece(s.type).name.toLowerCase()}.`);
      if (g.castle.blocker(s.type)) cui.stopPlacing(); else cui.moveGhost(sx, sy);
    }
    /** one section between two lattice nodes */
    lay(s, a, b) {
      const g = this.g, why = g.castle.blocker(s.type);
      if (why) { s.stopped = true; g.cui.toast(`${g.data.piece(s.type).name}: ${why}.`); g.sound.play('clank'); return; }
      const [ax, az] = this.xy(s.type, a), [bx, bz] = this.xy(s.type, b);
      s.tried++; if (g.buildAt(s.type, (ax + bx) / 2, (az + bz) / 2, a[1] === b[1] ? 0 : Math.PI / 2, true)) s.built++;
    }
    cancel() { this.stroke = null; }
  }
  WallDrawer.TYPES = new Set(['palisade', 'stone_wall']);

  K.WallDrawer = WallDrawer;
})(typeof window !== 'undefined' ? window : globalThis);
