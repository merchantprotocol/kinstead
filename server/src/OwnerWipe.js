// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/** Removes everything one identity owns from the shared world: pieces, buildings, supplies, market, farms, respawn. */
export class OwnerWipe {
  constructor(room, cid) {
    this.room = room;
    this.cid = cid;
    this.owner = cid.slice(0, 8);
  }

  run() {
    this.pieces();
    this.buildings();
    this.stores();
    this.farms();
    this.market();
    this.respawn();
  }

  pieces() {
    const room = this.room;
    for (const [id, piece] of Object.entries(room.world.pieces)) {
      if (piece.owner !== this.owner) continue;
      delete room.world.pieces[id];
      delete room.gates[id];
      room.broadcast({ t: 'op', from: this.owner, op: { k: 'piece-', id } });
    }
  }

  buildings() {
    const room = this.room;
    for (const [id, building] of Object.entries(room.world.buildings)) {
      if (building.owner !== this.owner) continue;
      delete room.world.buildings[id];
      room.broadcast({ t: 'op', from: this.owner, op: { k: 'bld-', id } });
    }
  }

  stores() {
    const room = this.room;
    let changed = false;
    for (const [id, store] of Object.entries(room.stores)) {
      if (store.owner !== this.owner) continue;
      delete room.stores[id];
      changed = true;
      room.broadcast({ t: 'store', id, gone: true });
    }
    if (!changed) return;
    room.storesDirty = true;
    room.ver.s++;
  }

  farms() {
    const room = this.room, farms = room.world.farms;
    for (const group of ['fields', 'herds', 'goods']) {
      for (const [id, entry] of Object.entries(farms[group] || {})) if (entry.owner === this.owner) delete farms[group][id];
    }
    if (room.farmSync) room.farmSync.signatures.delete(this.owner);
    room.ver.f++;
    room.broadcast({ t: 'farm', owner: this.owner, fields: [], herds: [], goods: [] });
  }

  market() {
    const room = this.room;
    if (!room.markets[this.owner]) return;
    delete room.markets[this.owner];
    room.state.storage.put('markets', room.markets);
  }

  respawn() {
    const room = this.room;
    if (!room.respawns[this.cid]) return;
    delete room.respawns[this.cid];
    room.state.storage.put('respawns', room.respawns);
  }
}
