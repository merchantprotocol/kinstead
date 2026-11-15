/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGamePieces extends K.CastleGameGeometry {
    entities() {
      const out = this.home ? this.home.entities() : [];
      for (const p of this.castle.pieces) out.push(this.pieceEnt(p));
      if (this.mp) for (const e of this.mp.world.entities().concat(this.mp.stores.entities())) out.push(e);   // other settlers' walls, gates and doors
      for (const source of this.entitySources ? this.entitySources.values() : []) out.push(...source.entities());
      return out;
    }
    addEntitySource(source) {
      if (!this.entitySources) this.entitySources = new Map();
      if (this.entitySources.has(source.id)) this.removeEntitySource(source.id);
      this.entitySources.set(source.id, source);
      return source;
    }
    removeEntitySource(id) {
      const source = this.entitySources && this.entitySources.get(id);
      if (!source) return false;
      this.entitySources.delete(id);
      source.dispose();
      return true;
    }
    pieceEnt(p) {
      if (!p.ent) { const [w, d] = CastleArt.size(p.type); p.ent = { id: 'c-p' + p.uid, type: 'c_piece', piece: p, x: p.x, z: p.z, y: 0,
      r: K.Breacher.GATES.has(p.type) ? Math.max(w, d) / 2 : Math.max(0.5, Math.min(w, d) / 2 + 0.2), h: { watchtower: 4.6, great_hall: 2.8,
      gatehouse: 3, stone_gate: 3.2, stone_wall: 3.4, stone_tower: 4 }[p.type] || 1.8 }; }
      p.ent.name = this.data.piece(p.type).name + (p.level >= 2 ? ' · Level 2' : ''); return p.ent;
    }
    pieceRadius(p) { const [w, d] = CastleArt.size(p.type); return Math.max(w, d) / 2; }
    addPieceMesh(p) {
      const m = this.art.piece(p.type, { level: p.level }); this.place(m, p.x, p.z, p.rot); this.meshes.set('p' + p.uid, m); m.userData.piece = p;
      if (p.frosted || this.castle.isFrosted(p)) this.setFrost(p, true);
      if (K.Breacher.GATES.has(p.type) && !p.bridge) p.bridge = p.type === 'gate' ? new K.WoodGate(this, p) : new K.Drawbridge(this, p);
      if (K.Breacher.GATES.has(p.type) && this.flags) { const lx = p.type === 'gate' ? 1.05 : 2.25;
      this.flags.flag('g' + p.uid, p.x + lx * Math.cos(p.rot || 0), p.z - lx * Math.sin(p.rot || 0), this.banners.meId, p.type === 'gate' ? 2.6 : 3.8); }
      // your colours on your gate
      this.blockPiece(p); return m;
    }
    /* a piece's footprint blocks the ground (walls a hair longer so a run of them has no gaps) */
    /* tiles wolves may never step on: the house, and every gate (you walk through a gate; a wolf does not) */
    /* where a gate goes for the pointer at p: it lines up with a fence run next to it, else follows R. Returns { x, z, rot }. */
    gateSpot(p) {
      const i = Math.floor(p.x / TILE), j = Math.floor(p.z / TILE), turned = Math.round((this.rotExtra || 0) / (Math.PI / 2)) % 2 === 1;
      const spotX = { x: (i + 1) * TILE, z: (j + 0.5) * TILE, rot: 0 }, spotZ = { x: (i + 0.5) * TILE, z: (j + 1) * TILE, rot: Math.PI / 2 };
      const wallAt = (x, z) => { const q = this.pieceAt(x, z, 0.05); return q && !K.Breacher.GATES.has(q.type); };
      if (!turned) { if (wallAt(spotX.x - 1.25, spotX.z) || wallAt(spotX.x + 1.25, spotX.z)) return spotX;
      if (wallAt(spotZ.x, spotZ.z - 1.25) || wallAt(spotZ.x, spotZ.z + 1.25)) return spotZ; return spotX; }
      return spotZ;
    }
    /* the blacksmith is placed by BuildingSite (104-castle-site.js) */
    /* any building of yours: wolves never go in */
    insideBuilding(x, z) { return !!this.R.buildings.at(Math.floor(x / TILE), Math.floor(z / TILE)); }
    gateTilesOf(p) { const out = [], [w, d] = CastleArt.size(p.type); this.rectTiles(p.x, p.z, w, d, p.rot, (i, j) => out.push(i + ',' + j)); return out; }
    isSanctuary(x, z) { return this.insideBuilding(x, z) || this.gateTiles.has(Math.floor(x / TILE) + ',' + Math.floor(z / TILE)); }
    blockPiece(p) {
      if (K.Breacher.GATES.has(p.type)) { if (p.bridge) p.bridge.apply(); return;
      }   // a gate's tiles follow its leaves or bridge: shut, nothing passes; open, you do
      if (p.type === 'gate_old') { const nav = this.play.nav;
      this.rectTiles(p.x, p.z, 2, 0.5, p.rot, (i, j) => { this.occ[j * nav.w + i] = 1; this.gateTiles.add(i + ',' + j); }); return;
      }   // occupied for building, but you can walk through
      const [w, d] = CastleArt.size(p.type);
      if (this.floors.handles(p.type)) { this.floors.block(p); return; }   // a workshop you can walk into: only its walls block
      this.blockRect(p.x, p.z, this.walls.handles(p.type) ? w + 0.04 : w, d, p.rot, p.type === 'gatehouse'); }
    /* the piece standing on this ground point, or null */
    pieceAt(x, z, pad = 0.2) {
      for (const p of this.castle.pieces) {
        const [w, d] = CastleArt.size(p.type), c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.x, dz = z - p.z;
        if (Math.abs(dx * c - dz * s) <= w / 2 + pad && Math.abs(dx * s + dz * c) <= d / 2 + pad) return p;
      }
      return null;
    }
    /* take a piece down: it comes apart, the ground clears, and half its cost drops as pickups to collect */
    demolishPiece(p, opts = {}) {
      const c = this.castle; if (!c.canDemolish(p)) { this.cui.toast('Restored ruins stay standing.'); return false; }
      if (this.mp && !this.mp.quiet) this.mp.op({ k: 'piece-', id: this.mp.pieceId(p) });
      const r = c.demolish(p), m = this.meshes.get('p' + p.uid), [w, d] = CastleArt.size(p.type), fx = this.tools.effects, y = this.play.nav.y(p.x, p.z);
      if (m) { this.group.remove(m); this.meshes.delete('p' + p.uid); }
      if (p.bridge) { p.bridge.dispose(); p.bridge = null; }
      if (this.flags) this.flags.unflag('g' + p.uid);
      this.unblockRect(p.x, p.z, this.walls.handles(p.type) ? w + 0.04 : w, d, p.rot);
      if (K.Breacher.GATES.has(p.type)) this.gateTilesOf(p).forEach((k) => this.gateTiles.delete(k));
      for (const q of c.pieces) if (Math.hypot(q.x - p.x, q.z - p.z) < Math.max(w, d) + 6) this.blockPiece(q);
      // a neighbour sharing a corner tile keeps it blocked
      this.sound.play('crack'); this.shake(0.12); this.puff(p.x, p.z);
      fx.burst(p.type === 'stone_wall' || p.type === 'stone_gate' ? 'stone' : 'wood', p.x, y + 0.6, p.z, 12, 3.2);
      if (opts.refund !== false) for (const [res, n] of Object.entries(r.refund)) { const k = Math.min(n, 6);
      for (let i = 0; i < k; i++) fx.spawnPickup(res, Math.floor(n / k) + (i < n % k ? 1 : 0), p.x + (Math.random() - 0.5) * w * 0.5, y + 0.6,
      p.z + (Math.random() - 0.5) * d, 2.6, true); }
      this.play.refreshProps(); this.changed(); return true;
    }
    redrawPiece(p) { const old = this.meshes.get('p' + p.uid); if (old) this.group.remove(old); const m = this.art.piece(p.type, { level: p.level });
    this.place(m, p.x, p.z, p.rot); this.meshes.set('p' + p.uid, m); m.userData.piece = p; if (this.castle.isFrosted(p)) this.setFrost(p, true); return m; }
    setFrost(p, on) {
      const m = this.meshes.get('p' + p.uid); if (!m) return; const cur = m.children.find((c) => c.userData.frost);
      if (on && !cur) { const f = this.art.frostShell(p.type); f.userData.frost = true; m.add(f); } else if (!on && cur) m.remove(cur);
    }
    pop(obj, s0 = 0.2) { obj.scale.setScalar(s0); obj.userData.popT = 0; obj.userData.s0 = s0; (this.pops = this.pops || []).push(obj); }

    /* ---------- actions (the interaction registry asks these) ---------- */
  }
  K.CastleGamePieces = CastleGamePieces;
})(typeof window !== 'undefined' ? window : globalThis);
