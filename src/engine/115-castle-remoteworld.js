/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* RemoteWorld: other people's edits, applied to your map: their walls and gates, cottages and halls, dug ground,
   felled trees (RemoteTerrain), and their doors (RemoteDoors). */
(function (G) {
  const K = G.K;
  const TILE = K.TILE;

  class RemoteWorld {
    constructor(game, net) {
      this.g = game;
      this.net = net;
      this.pieces = new Map();
      this.cottages = new Set();
      this.owners = {};
      this.terrain = new K.RemoteTerrain(game);
      this.remoteDoors = new K.RemoteDoors(game, this.owners);
      this.doors = this.remoteDoors.by;   // slot -> { door, owner, hp, max, name }
      this.objDirty = false;
      this.propsDirty = false;
      this.houseAt = {};
    }

    get play() {
      return this.g.play;
    }

    /** a burst of other people's changes (a player joining sends dozens) is applied once per frame, not once per change */
    flush() {
      if (this.objDirty) {
        this.objDirty = false;
        this.play.R.objectsChanged(false);
      }
      if (this.propsDirty) {
        this.propsDirty = false;
        this.play.refreshProps();
      }
    }

    /** everything the server holds, applied in one go (join, or coming back after a dropped connection) */
    snapshot(m) {
      const world = m.world || {};
      const me = this.net.id;
      this.applyClaims(m.claimed);
      for (const b of Object.values(world.buildings || {})) {
        if (b.owner !== me) this.building(b.id, b.spec);
      }
      for (const p of Object.values(world.pieces || {})) {
        if (p.owner !== me) this.addPiece(p);
      }
      this.terrain.applyTiles(Object.values(world.tiles || {}));
      this.remoteDoors.apply(world.doors, false);
      this.applyGates(m.gates);
      this.terrain.applyNodes(Object.values(world.nodes || {}));
      this.objDirty = true;
      this.propsDirty = true;
    }

    /** the server's full picture (a periodic check, or after a dropped connection): add what is missing, remove what is gone */
    reconcile(m) {
      if (!m.world) return null;
      const me = this.net.id;
      const serverPieces = m.world.pieces || {};
      for (const p of Object.values(serverPieces)) {
        if (p.owner !== me && !this.pieces.has(p.id)) this.addPiece(p);
      }
      for (const id of [...this.pieces.keys()]) {
        if (!serverPieces[id]) this.removePiece(id);
      }
      this.applyClaims(m.claimed);
      for (const b of Object.values(m.world.buildings || {})) {
        if (b.owner !== me) this.building(b.id, b.spec);
      }
      this.remoteDoors.apply(m.world.doors, true);
      this.applyGates(m.gates);
      this.propsDirty = true;
      return Object.keys(serverPieces);
    }

    /** who holds which plot, and their cottages */
    applyClaims(claimed) {
      for (const c of claimed || []) {
        this.owners[c.id] = c.name;
        this.owners[c.slot] = c.name;
        if (c.slot !== this.g.L.slot && c.spec) this.cottage(c.slot, c.spec, c.id);
      }
    }

    applyGates(gates) {
      for (const [id, open] of Object.entries(gates || {})) this.gateState(id, !!open);
    }

    /** one edit someone else made */
    apply(op, from) {
      if (op.k === 'piece+') this.addPiece(Object.assign({ owner: from }, op));
      else if (op.k === 'piece-') this.removePiece(op.id);
      else if (op.k === 'tile') this.terrain.setTile(op.i, op.j, op.h, op.te, true);
      else if (op.k === 'tiles') this.terrain.applyTiles(op.list);
      else if (op.k === 'node') this.applyNodes([op]);
      else if (op.k === 'bld+') this.building(op.id, op.spec);
      else if (op.k === 'bld-') this.removeBuilding(op.id);
      if (op.k === 'piece+' || op.k === 'piece-') this.propsDirty = true;
    }

    /** trees or rocks someone else felled or moved; the scenery redraws on the next flush */
    applyNodes(nodes) {
      this.terrain.applyNodes(nodes);
      this.objDirty = true;
    }

    /** a resync's tiles */
    applyTiles(tiles) {
      this.terrain.applyTiles(tiles);
    }

    /** a settler's cottage on their plot */
    cottage(slot, given, owner) {
      const id = 'home:' + slot;
      if (this.cottages.has(id) || slot === this.g.L.slot || !given) return;
      this.cottages.add(id);
      const spec = Object.assign({}, given, { id });
      this.building(id, spec);
      if (owner) this.markHouse(slot, spec, owner);
      const obj = this.play.doc.obj(id);
      if (!obj) return;
      this.remoteDoors.add(slot, obj, null);
      this.g.play.refreshProps();
    }

    /** where their house stands (for gates that let you out) and their banner on it */
    markHouse(slot, spec, owner) {
      const foot = spec.footprint;
      this.houseAt[owner] = { x: (spec.x + foot.w / 2) * TILE, z: (spec.z + foot.h / 2) * TILE };
      this.g.flags.flag('rh' + slot, (spec.x + foot.w) * TILE + 0.35, spec.z * TILE - 0.3, owner, 3.6);
    }

    building(id, spec) {
      const g = this.g;
      const doc = this.play.doc;
      if (doc.obj(id)) return;
      const normal = K.BuildingSpec.normalize(Object.assign({}, spec, { id }));
      if (/^home:/.test(id)) normal.noDoorLeaves = true;
      doc.objects.push(normal);
      const shop = /^(market|bakery|butcher|library|stable):(.+)$/.exec(id);
      if (shop) g.addEntitySource(new K.ShopShelfSet(g, shop[1], normal, shop[2], normal.shopTurns || 0));
      g.R.syncBuildings(true);
      this.play.nav.applyBuildings(g.R.buildings);
      this.play.bplay.dirty();
      this.play.refreshProps();
    }

    removeBuilding(id) {
      const doc = this.play.doc;
      const index = doc.objects.findIndex((o) => o.id === id);
      this.g.removeEntitySource(id);
      if (index < 0) return;
      doc.objects.splice(index, 1);
      this.g.R.syncBuildings(true);
      this.play.nav.applyBuildings(this.g.R.buildings);
      this.play.refreshProps();
    }

    /** how wide a piece blocks the ground (walls overlap a little so they join) */
    blockWidth(rec) {
      return this.g.walls.handles(rec.p.type) ? rec.w + 0.04 : rec.w;
    }

    addPiece(p) {
      const g = this.g;
      if (this.pieces.has(p.id) || !g.data.piece(p.type)) return;
      const mesh = g.art.piece(p.type, { level: 1 });
      g.place(mesh, p.x, p.z, p.rot);
      const [w, d] = K.CastleArt.size(p.type);
      const rec = { p, mesh, w, d, hp: p.hp, hpMax: p.hpMax, gate: null };
      if (K.Breacher.GATES.has(p.type)) rec.gate = this.makeGate(p);
      else g.blockRect(p.x, p.z, this.blockWidth(rec), d, p.rot, false);
      this.pieces.set(p.id, rec);
      if (p.type === 'fire_pot') g.R.placeDynamics();
    }

    /** their gate: shut to you unless you hold the key */
    makeGate(p) {
      const g = this.g;
      const rot = p.rot || 0;
      const at = { x: p.x, z: p.z, rot, type: p.type, uid: 'r' + p.id };
      const gate = p.type === 'gate' ? new K.WoodGate(g, at) : new K.Drawbridge(g, at);
      gate.remote = true;
      gate.apply();
      const reach = p.type === 'gate' ? 1.05 : 2.25;
      g.flags.flag('rg' + p.id, p.x + reach * Math.cos(rot), p.z - reach * Math.sin(rot), p.owner, p.type === 'gate' ? 2.6 : 3.8);
      return gate;
    }

    removePiece(id) {
      const rec = this.pieces.get(id);
      if (!rec) return;
      const g = this.g;
      const p = rec.p;
      g.group.remove(rec.mesh);
      this.pieces.delete(id);
      if (rec.gate) {
        rec.gate.dispose();
        g.flags.unflag('rg' + id);
      }
      const width = K.Breacher.GATES.has(p.type) ? rec.w : this.blockWidth(rec);
      g.unblockRect(p.x, p.z, width, rec.d, p.rot);
      this.reblockAround(p);
    }

    /** unblocking one piece may have cleared ground its neighbours still stand on */
    reblockAround(p) {
      const g = this.g;
      for (const q of g.castle.pieces) {
        if (Math.hypot(q.x - p.x, q.z - p.z) < 6) g.blockPiece(q);
      }
      for (const other of this.pieces.values()) {
        if (other.gate || Math.hypot(other.p.x - p.x, other.p.z - p.z) >= 6) continue;
        g.blockRect(other.p.x, other.p.z, this.blockWidth(other), other.d, other.p.rot, false);
      }
    }

    /** a settler's gate opened or shut (the server only says so if the key was right) */
    gateState(id, open) {
      const rec = this.pieces.get(id);
      if (!rec || !rec.gate || rec.gate.open === open) return;
      rec.gate.open = open;
      rec.gate.apply();
    }

    /** names of other people's things follow their banner (their team's name, once they have one) */
    relabel() {
      for (const rec of this.pieces.values()) {
        if (rec.ent) rec.ent.name = this.labelOf(rec);
      }
      this.remoteDoors.relabel();
    }

    labelOf(rec) {
      const owner = this.g.banners.label(rec.p.owner, this.owners[rec.p.owner]);
      return `${owner}'s ${this.g.data.piece(rec.p.type).name.toLowerCase()}`;
    }

    /** things on other people's plots you can click: their walls and gates, and their doors */
    entities() {
      const out = [];
      for (const [id, rec] of this.pieces) {
        if (!rec.ent) rec.ent = this.pieceEntity(id, rec);
        out.push(rec.ent);
      }
      out.push(...this.remoteDoors.entities());
      return out;
    }

    pieceEntity(id, rec) {
      const p = rec.p;
      const radius = K.Breacher.GATES.has(p.type)
        ? Math.max(rec.w, rec.d) / 2
        : Math.max(0.5, Math.min(rec.w, rec.d) / 2 + 0.2);
      const y = this.play.nav.y(p.x, p.z);
      return { id: 'rp:' + id, type: 'c_rpiece', rec, x: p.x, z: p.z, y, r: radius, h: 1.8, name: this.labelOf(rec) };
    }

  }

  K.RemoteWorld = RemoteWorld;
})(typeof window !== 'undefined' ? window : globalThis);
