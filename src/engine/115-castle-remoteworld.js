/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const TILE = K.TILE;
  class RemoteWorld {
    constructor(game, net) { this.g = game;
       this.net = net;
       this.pieces = new Map();
       this.byId = null;
       this.cottages = new Set();
       this.doors = new Map();
       this.owners = {};
       this.objDirty = false;
       this.propsDirty = false;
       this.houseAt = {};
      }   // doors: slot -> { door, owner, hp, max }
    get play() { return this.g.play;
      }
    /** a burst of other people's changes (a player joining sends dozens) is applied once per frame, not once per change */
    flush() {
      if (this.objDirty) { this.objDirty = false;
         this.play.R.objectsChanged(false);
        }
      if (this.propsDirty) { this.propsDirty = false;
         this.play.refreshProps();
        }
    }
    node(id) { if (!this.byId) { this.byId = new Map();
       for (const e of this.play.baseProps) this.byId.set(e.id, e);
       } return this.byId.get(id) || null;
      }
    /** everything the server holds, applied in one go (join, or coming back after a dropped connection) */
    snapshot(m) {
      const w = m.world || {}, me = this.net.id;
      for (const c of m.claimed || []) { this.owners[c.id] = c.name;
         this.owners[c.slot] = c.name;
         if (c.slot !== this.g.L.slot && c.spec) this.cottage(c.slot, c.spec, c.id);
        }
      for (const b of Object.values(w.buildings || {})) if (b.owner !== me) this.building(b.id, b.spec);
      for (const p of Object.values(w.pieces || {})) if (p.owner !== me) this.addPiece(p);
      let box = null;
         for (const t of Object.values(w.tiles || {})) { this.setTile(t[0], t[1], t[2], t[3], false);
         box = this.grow(box, t[0], t[1]);
        }
      if (box) this.play.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1);
      for (const [slot, d] of Object.entries(w.doors || {})) { const rec = this.doors.get(+slot);
         if (rec) { rec.owner = d.owner;
         rec.hp = d.hp;
         rec.max = d.hpMax;
         rec.door.broken = !!d.broken;
         rec.door.open = !!d.broken;
         rec.door.apply();
        } }
      for (const [id, open] of Object.entries(m.gates || {})) this.gateState(id, !!open);
      for (const n of Object.values(w.nodes || {})) this.nodeOp(n, true);
      this.objDirty = true;
        this.propsDirty = true;
    }
    /** the server's full picture (a periodic check, or after a dropped connection): add what is missing, remove what is gone */
    reconcile(m) {
      const me = this.net.id, g = this.g;
      if (m.world) {
        const pcs = m.world.pieces || {};
        for (const p of Object.values(pcs)) if (p.owner !== me && !this.pieces.has(p.id)) this.addPiece(p);
        for (const id of [...this.pieces.keys()]) if (!pcs[id]) this.removePiece(id);
        for (const c of m.claimed || []) { this.owners[c.id] = c.name;
           this.owners[c.slot] = c.name;
           if (c.slot !== g.L.slot && c.spec) this.cottage(c.slot, c.spec, c.id);
          }
        for (const b of Object.values(m.world.buildings || {})) if (b.owner !== me) this.building(b.id, b.spec);
        for (const [slot, d] of Object.entries(m.world.doors || {})) { const rec = this.doors.get(+slot);
           if (rec) { rec.owner = d.owner;
           rec.hp = d.hp;
           rec.max = d.hpMax;
           if (rec.door.broken !== !!d.broken) { rec.door.broken = !!d.broken;
           rec.door.open = !!d.broken;
           rec.door.apply();
          } } }
        for (const [id, open] of Object.entries(m.gates || {})) this.gateState(id, !!open);
        this.propsDirty = true;
        return Object.keys(pcs);
      }
      return null;
    }
    grow(b, i, j) { return b ? [Math.min(b[0], i), Math.min(b[1], j), Math.max(b[2], i), Math.max(b[3], j)] : [i, j, i, j];
      }
    apply(op, from) {
      if (op.k === 'piece+') this.addPiece(Object.assign({ owner: from }, op));
        else if (op.k === 'piece-') this.removePiece(op.id);
      else if (op.k === 'tile') this.setTile(op.i, op.j, op.h, op.te, true);
      else if (op.k === 'tiles') { let box = null;
         for (const t of op.list) { this.setTile(t[0], t[1], t[2], t[3], false);
         box = this.grow(box, t[0], t[1]);
         } if (box) this.play.R.tilesChanged(box[0], box[1], box[2] + 1, box[3] + 1);
         } else if (op.k === 'node') { this.nodeOp(op, false);
         this.objDirty = true;
        }
      else if (op.k === 'bld+') this.building(op.id, op.spec);
        else if (op.k === 'bld-') this.removeBuilding(op.id);
      if (op.k === 'piece+' || op.k === 'piece-') this.propsDirty = true;
    }
    /** a settler's cottage on their plot */
    cottage(slot, given, owner) {
      const id = 'home:' + slot;
         if (this.cottages.has(id) || slot === this.g.L.slot || !given) return;
        this.cottages.add(id);
      const spec = Object.assign({}, given, { id });
         this.building(id, spec);
         if (owner) this.houseAt[owner] = { x: (spec.x + spec.footprint.w / 2) * TILE, z: (spec.z + spec.footprint.h / 2) * TILE };
        if (owner) this.g.flags.flag('rh' + slot, (spec.x + spec.footprint.w) * TILE + 0.35, spec.z * TILE - 0.3, owner, 3.6);
      const obj = this.play.doc.obj(id);
         if (obj) { this.remoteDoor(slot, obj, null);
         this.g.play.refreshProps();
        }
    }
    building(id, spec) {
      const g = this.g, doc = this.play.doc;
         if (doc.obj(id)) return;
         const s = K.BuildingSpec.normalize(Object.assign({}, spec, { id }));
         if (/^home:/.test(id)) s.noDoorLeaves = true;
        doc.objects.push(s);
      const shop = /^(market|bakery|butcher|library|stable):(.+)$/.exec(id);
      if (shop) g.addEntitySource(new K.ShopShelfSet(g, shop[1], s, shop[2], s.shopTurns || 0));
      g.R.syncBuildings(true);
         this.play.nav.applyBuildings(g.R.buildings);
         this.play.bplay.dirty();
        this.play.refreshProps();
    }
    removeBuilding(id) { const doc = this.play.doc, i = doc.objects.findIndex((o) => o.id === id);
       this.g.removeEntitySource(id);
       if (i < 0) return;
       doc.objects.splice(i, 1);
       this.g.R.syncBuildings(true);
       this.play.nav.applyBuildings(this.g.R.buildings);
       this.play.refreshProps();
      }
    addPiece(p) {
      const g = this.g;
        if (this.pieces.has(p.id) || !g.data.piece(p.type)) return;
      const m = g.art.piece(p.type, { level: 1 });
         g.place(m, p.x, p.z, p.rot);
        const [w, d] = K.CastleArt.size(p.type), rec = { p, mesh: m, w, d, hp: p.hp, hpMax: p.hpMax, gate: null };
      if (K.Breacher.GATES.has(p.type)) { const o = { x: p.x, z: p.z, rot: p.rot || 0, type: p.type, uid: 'r' + p.id };
         rec.gate = p.type === 'gate' ? new K.WoodGate(g, o) : new K.Drawbridge(g, o);
         rec.gate.remote = true;
         rec.gate.apply();
         const lx = p.type === 'gate' ? 1.05 : 2.25;
         g.flags.flag('rg' + p.id, p.x + lx * Math.cos(p.rot || 0), p.z - lx * Math.sin(p.rot || 0), p.owner, p.type === 'gate' ? 2.6 : 3.8);
        }   // their gate: shut to you unless you hold the key
      else g.blockRect(p.x, p.z, g.walls.handles(p.type) ? w + 0.04 : w, d, p.rot, false);
      this.pieces.set(p.id, rec);
        if (p.type === 'fire_pot') g.R.placeDynamics();
    }
    removePiece(id) {
      const r = this.pieces.get(id);
         if (!r) return;
         this.g.group.remove(r.mesh);
         this.pieces.delete(id);
         if (r.gate) { r.gate.dispose();
         this.g.flags.unflag('rg' + id);
        }
      const g = this.g, p = r.p;
        g.unblockRect(p.x, p.z, K.Breacher.GATES.has(p.type) ? r.w : g.walls.handles(p.type) ? r.w + 0.04 : r.w, r.d, p.rot);
      for (const q of g.castle.pieces) if (Math.hypot(q.x - p.x, q.z - p.z) < 6) g.blockPiece(q);
      for (const o of this.pieces.values()) if (!o.gate && Math.hypot(o.p.x - p.x,
         o.p.z - p.z) < 6) g.blockRect(o.p.x,
         o.p.z,
         g.walls.handles(o.p.type) ? o.w + 0.04 : o.w,
         o.d,
         o.p.rot,
        false);
    }
    /** a settler's gate opened or shut (the server only says so if the key was right) */
    gateState(id, open) { const r = this.pieces.get(id);
       if (r && r.gate && r.gate.open !== open) { r.gate.open = open;
       r.gate.apply();
      } }
    /** a house door: drawn and blocked like your own, but opened only by the server's word */
    remoteDoor(slot, spec, owner) {
      if (this.doors.has(slot)) return this.doors.get(slot);
        const g = this.g;
      const door = new K.Door({ g, spec });
         door.locked = true;
         door.remote = true;
        door.apply();
      const rec = { slot, door, owner, hp: 3000, max: 3000, name: (this.owners[slot] || 'Settler') + "'s door" };
         door.ent = Object.assign({}, door.ent, { id: 'rd:' + slot, type: 'c_rdoor', rec, name: rec.name });
         this.doors.set(slot, rec);
        return rec;
    }
    doorMsg(m) {
      const rec = this.doors.get(m.slot), g = this.g;
         if (!rec) return;
        const d = rec.door;
      if (m.hp != null) { rec.hp = m.hp;
         rec.max = m.max || rec.max;
        }
      if (m.owner !== undefined && m.owner) rec.owner = m.owner;
      if (m.broken === true) { d.broken = true;
         d.open = true;
         g.sound.play('crack');
        }
      if (m.broken === false) { d.broken = false;
         if (m.open === undefined) d.open = false;
        }
      if (m.open !== undefined) d.open = !!m.open;
      d.apply();
    }
    /** things on other people's plots you can click: their walls and gates, and their doors */
    /** names of other people's things follow their banner (their team's name, once they have one) */
    relabel() { for (const r of this.pieces.values()) if (r.ent) r.ent.name = this.labelOf(r);
       for (const r of this.doors.values()) r.door.ent.name = `${this.g.banners.label(r.owner, this.owners[r.slot])}'s door`;
      }
    labelOf(r) { return `${this.g.banners.label(r.p.owner, this.owners[r.p.owner])}'s ${this.g.data.piece(r.p.type).name.toLowerCase()}`;
      }
    entities() {
      const out = [], y = (x, z) => this.play.nav.y(x, z);
      for (const [id, r] of this.pieces) {
        if (!r.ent) { const p = r.p, own = this.owners[p.owner] || 'a settler';
           r.ent = { id: 'rp:' + id,
              type: 'c_rpiece',
              rec: r,
              x: p.x,
              z: p.z,
              y: y(p.x,
              p.z),
              r: K.Breacher.GATES.has(p.type) ? Math.max(r.w,
              r.d) / 2 : Math.max(0.5,
              Math.min(r.w,
              r.d) / 2 + 0.2),
              h: 1.8,
             name: this.labelOf(r) };
          }
        out.push(r.ent);
      }
      for (const r of this.doors.values()) out.push(r.door.ent);
      return out;
    }
    setTile(i, j, h, te, redraw) {
      const d = this.play.doc, nav = this.play.nav;
         if (!d.inside(i, j)) return;
         const k = j * d.w + i;
        if (d.height[k] === h && d.terrain[k] === te) return;
      d.height[k] = h;
         d.terrain[k] = te;
         nav.S[k] = nav.surface((i + 0.5) * TILE, (j + 0.5) * TILE, d.hy(i, j));
        if (redraw) this.play.R.tilesChanged(i, j, i + 1, j + 1);
    }
    nodeOp(n, quiet) {
      const e = this.node(n.id);
         if (!e) return;
        const g = this.g, st = this.play.nodeState(e);
      if (n.st === 'felled') { if (st.charges <= 0) return;
         st.charges = 0;
         st.respawnAt = Infinity;
         g.R.setPropState(e.id, 'depleted');
         g.forest.free(e);
         g.tools.effects.burst(e.type === 'c_tree' ? 'wood' : 'stone', e.x, e.y + 0.6, e.z, 5, 2);
        }
      else if (n.st === 'moved') { g.forest.free(e);
         e.obj.x = n.x;
         e.obj.z = n.z;
         e.x = n.x;
         e.z = n.z;
         e.y = this.play.nav.y(n.x, n.z);
         st.charges = st.max;
         st.respawnAt = 0;
         g.R.propState.delete(e.id);
         g.forest.moved[e.id] = [n.x, n.z];
         this.play.nav.blockProp(e.obj);
        }
    }
  }

  /** the other players: walking about, with a name above their head */
  K.RemoteWorld = RemoteWorld;
})(typeof window !== 'undefined' ? window : globalThis);
