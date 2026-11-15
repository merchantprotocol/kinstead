/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · PieceManager: the castle pieces standing in the world. Puts each piece's mesh in the scene (game.meshes),
   blocks its footprint, answers which piece stands where, redraws it, frosts it, and takes it down again. */
(function (G) {
  const K = G.K;

  class PieceManager {
    /* how tall each piece's click target is (default 1.8 m) */
    static ENT_HEIGHT = { watchtower: 4.6, great_hall: 2.8, gatehouse: 3, stone_gate: 3.2, stone_wall: 3.4, stone_tower: 4 };

    constructor(game) { this.g = game; }
    isGate(p) { return K.Breacher.GATES.has(p.type); }
    meshOf(p) { return this.g.meshes.get('p' + p.uid); }
    /** the clickable entity of a piece (made once, renamed when it levels up) */
    pieceEnt(p) {
      if (!p.ent) {
        const [w, d] = K.CastleArt.size(p.type);
        const r = this.isGate(p) ? Math.max(w, d) / 2 : Math.max(0.5, Math.min(w, d) / 2 + 0.2);
        p.ent = { id: 'c-p' + p.uid, type: 'c_piece', piece: p, x: p.x, z: p.z, y: 0, r, h: PieceManager.ENT_HEIGHT[p.type] || 1.8 };
      }
      p.ent.name = this.g.data.piece(p.type).name + (p.level >= 2 ? ' · Level 2' : '');
      return p.ent;
    }
    pieceRadius(p) {
      const [w, d] = K.CastleArt.size(p.type);
      return Math.max(w, d) / 2;
    }
    addPieceMesh(p) {
      const g = this.g, m = g.art.piece(p.type, { level: p.level });
      g.place(m, p.x, p.z, p.rot);
      g.meshes.set('p' + p.uid, m);
      m.userData.piece = p;
      if (p.frosted || g.castle.isFrosted(p)) this.setFrost(p, true);
      if (this.isGate(p) && !p.bridge) p.bridge = p.type === 'gate' ? new K.WoodGate(g, p) : new K.Drawbridge(g, p);
      if (this.isGate(p) && g.flags) this.flagGate(p);
      this.blockPiece(p);
      return m;
    }
    /** your colours on your gate */
    flagGate(p) {
      const g = this.g, lx = p.type === 'gate' ? 1.05 : 2.25, rot = p.rot || 0;
      g.flags.flag('g' + p.uid, p.x + lx * Math.cos(rot), p.z - lx * Math.sin(rot), g.banners.meId, p.type === 'gate' ? 2.6 : 3.8);
    }
    /** a piece's footprint blocks the ground (walls a hair longer so a run of them has no gaps) */
    blockPiece(p) {
      const g = this.g;
      if (this.isGate(p)) {   // a gate's tiles follow its leaves or bridge: shut, nothing passes; open, you do
        if (p.bridge) p.bridge.apply();
        return;
      }
      if (p.type === 'gate_old') { this.blockOldGate(p); return; }
      if (g.floors.handles(p.type)) { g.floors.block(p); return; }   // a workshop you can walk into: only its walls block
      const [w, d] = K.CastleArt.size(p.type);
      g.ground.blockRect(p.x, p.z, this.footWidth(p, w), d, p.rot, p.type === 'gatehouse');
    }
    /** occupied for building, but you can walk through */
    blockOldGate(p) {
      const g = this.g, nav = g.play.nav;
      g.ground.rectTiles(p.x, p.z, 2, 0.5, p.rot, (i, j) => {
        g.occ[j * nav.w + i] = 1;
        g.gateTiles.add(i + ',' + j);
      });
    }
    footWidth(p, w) { return this.g.walls.handles(p.type) ? w + 0.04 : w; }
    /** the piece standing on this ground point, or null */
    pieceAt(x, z, pad = 0.2) {
      for (const p of this.g.castle.pieces) {
        const [w, d] = K.CastleArt.size(p.type), c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.x, dz = z - p.z;
        if (Math.abs(dx * c - dz * s) <= w / 2 + pad && Math.abs(dx * s + dz * c) <= d / 2 + pad) return p;
      }
      return null;
    }
    /** take a piece down: it comes apart, the ground clears, and half its cost drops as pickups to collect */
    demolishPiece(p, opts = {}) {
      const g = this.g, c = g.castle;
      if (!c.canDemolish(p)) { g.cui.toast('Restored ruins stay standing.'); return false; }
      if (g.mp && !g.mp.quiet) g.mp.op({ k: 'piece-', id: g.mp.pieceId(p) });
      const r = c.demolish(p);
      this.removeFromWorld(p);
      this.clearGround(p);
      this.burstApart(p);
      if (opts.refund !== false) this.dropRefund(p, r.refund);
      g.play.refreshProps();
      g.changed();
      return true;
    }
    removeFromWorld(p) {
      const g = this.g, m = this.meshOf(p);
      if (m) { g.group.remove(m); g.meshes.delete('p' + p.uid); }
      if (p.bridge) { p.bridge.dispose(); p.bridge = null; }
      if (g.flags) g.flags.unflag('g' + p.uid);
    }
    clearGround(p) {
      const g = this.g, [w, d] = K.CastleArt.size(p.type);
      g.ground.unblockRect(p.x, p.z, this.footWidth(p, w), d, p.rot);
      if (this.isGate(p)) g.ground.gateTilesOf(p).forEach((k) => g.gateTiles.delete(k));
      for (const q of g.castle.pieces) {   // a neighbour sharing a corner tile keeps it blocked
        if (Math.hypot(q.x - p.x, q.z - p.z) < Math.max(w, d) + 6) this.blockPiece(q);
      }
    }
    burstApart(p) {
      const g = this.g, y = g.play.nav.y(p.x, p.z), stone = p.type === 'stone_wall' || p.type === 'stone_gate';
      g.sound.play('crack');
      g.shake(0.12);
      g.puff(p.x, p.z);
      g.tools.effects.burst(stone ? 'stone' : 'wood', p.x, y + 0.6, p.z, 12, 3.2);
    }
    dropRefund(p, refund) {
      const g = this.g, fx = g.tools.effects, y = g.play.nav.y(p.x, p.z), [w, d] = K.CastleArt.size(p.type);
      for (const [res, n] of Object.entries(refund)) {
        const k = Math.min(n, 6);
        for (let i = 0; i < k; i++) {
          const amount = Math.floor(n / k) + (i < n % k ? 1 : 0);
          fx.spawnPickup(res, amount, p.x + (Math.random() - 0.5) * w * 0.5, y + 0.6, p.z + (Math.random() - 0.5) * d, 2.6, true);
        }
      }
    }
    redrawPiece(p) {
      const g = this.g, old = this.meshOf(p);
      if (old) g.group.remove(old);
      const m = g.art.piece(p.type, { level: p.level });
      g.place(m, p.x, p.z, p.rot);
      g.meshes.set('p' + p.uid, m);
      m.userData.piece = p;
      if (g.castle.isFrosted(p)) this.setFrost(p, true);
      return m;
    }
    /** the old castle game's Keep mesh (survival has no Keep to draw) */
    redrawKeep() {
      const g = this.g;
      if (g.survival) return;
      if (g.keepMesh) g.group.remove(g.keepMesh);
      g.keepMesh = g.art.piece('keep', { ruin: !g.castle.lit });
      g.place(g.keepMesh, g.L.keep.x, g.L.keep.z, 0);
    }
    setFrost(p, on) {
      const m = this.meshOf(p);
      if (!m) return;
      const cur = m.children.find((c) => c.userData.frost);
      if (on && !cur) {
        const f = this.g.art.frostShell(p.type);
        f.userData.frost = true;
        m.add(f);
      } else if (!on && cur) m.remove(cur);
    }
  }

  K.PieceManager = PieceManager;
})(typeof window !== 'undefined' ? window : globalThis);
