import { ServerConfig } from './ServerConfig.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
export class PlayerRegistry {
  claim(cid, name) {
    const mine = this.plots[cid];
    if (mine && mine.slot >= 0) { mine.name = name; return mine.slot; }
    let slot = this.freeSlot();
    if (slot < 0) slot = this.plotRecycler.reclaim(ServerConfig.MAX_PLAYERS);
    if (slot < 0) return -1;   // every plot is held by someone online: the world really is full
    this.plots[cid] = { slot, name, seen: Date.now() };
    if (mine && mine.evicted) this.plots[cid].evicted = true;   // recycled while away: the client drops its old castle
    this.state.storage.put('plots', this.plots);
    return slot;   // a plot, nothing more: the house appears when its settler builds it
  }

  freeSlot() {
    const taken = new Set([...Object.values(this.plots).map((p) => p.slot), ...Object.keys(this.world.houses).map(Number)]);
    for (let s = 0; s < ServerConfig.MAX_PLAYERS; s++) if (!taken.has(s)) return s;
    return -1;
  }

  /** remember when this identity was last here, so the plot of whoever has been away longest is freed first */
  touch(cid) {
    const plot = this.plots[cid];
    if (!plot) return;
    plot.seen = Date.now();
    this.state.storage.put('plots', this.plots);
  }

  onHome(p, op) {
    if (op.id !== 'home:' + p.slot || !op.spec || !op.spec.footprint) return;
    const sp = op.spec, x = (sp.x + sp.footprint.w / 2) * 0.5, z = (sp.z + sp.footprint.h / 2) * 0.5, old = this.world.houses[p.slot];
    if (old && old.owner !== p.id && this.world.doors[p.slot] && this.world.doors[p.slot].owner !== p.id) return;   // someone else holds it now
    this.world.houses[p.slot] = { owner: p.id, name: p.name, x, z, spec: sp };
    if (!this.world.doors[p.slot]) this.world.doors[p.slot] = { owner: p.id, hp: ServerConfig.DOOR_HP, hpMax: ServerConfig.DOOR_HP, broken: false };
    this.dirty = true; this.ver.p++; this.broadcast({ t: 'house', slot: p.slot, owner: p.id, name: p.name, x, z, spec: sp, door: this.world.doors[p.slot] });
  }

  async evictSave(cid) {
    const raw = await this.state.storage.get('save:' + cid); if (!raw) return;
    try { const sv = JSON.parse(raw),
    keep = sv.extras || {};
    sv.castle.pieces = [];
    sv.hero = null;
    sv.nodes = {};
    sv.extras = { weapons: keep.weapons,
    held: keep.held,
    xp: keep.xp };
    this.state.storage.put('save:' + cid,
    JSON.stringify(sv));
    } catch (e) { /* unreadable save: leave it */ }
  }
  evict(ownerId) {
    const cid = Object.keys(this.plots).find((c) => c.slice(0, 8) === ownerId);
    if (!cid) return;
    this.evictSave(cid);
    const plot = this.plots[cid], slot = this.freeSlot();
    // no free plot: a tombstone, so they get a fresh one (recycled if need be) when they come back
    this.plots[cid] = { slot, name: plot.name, evicted: true, seen: plot.seen || 0 };
    this.state.storage.put('plots', this.plots);
  }

  install(room) {
    for (const method of ['claim', 'freeSlot', 'touch', 'onHome', 'evictSave', 'evict']) room[method] = this[method].bind(room);
  }
}
