import { OwnerWipe } from './OwnerWipe.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/**
 * Frees a plot for a newcomer when every plot is taken: a map has a fixed number of plots, but any number of
 * identities can visit it over time. The plot of the OFFLINE identity seen longest ago is cleared and handed over:
 * identities that never built a house go first, then the oldest last-seen time. An online player's plot is never taken.
 * The old identity keeps a tombstone (slot -1, evicted) so it gets a fresh plot and an evicted welcome if it returns.
 */
export class PlotRecycler {
  static TOMBSTONES = 300;   // remembered recycled identities; beyond this the oldest are forgotten
  static HOUSE_GRACE_MS = 7 * 24 * 3600 * 1000;   // a town is only recycled once its owner has been away this long

  /** a plot with a house is someone's town: only take it back if we KNOW they've been gone a week (unknown = keep) */
  static townIsAbandoned(house, seen, now) {
    return !house || (seen > 0 && now - seen > PlotRecycler.HOUSE_GRACE_MS);
  }

  constructor(room) {
    this.room = room;
  }

  /** cids and owner ids of everyone connected right now */
  onlineIds() {
    const ids = new Set();
    for (const player of this.room.online()) {
      if (player.cid) ids.add(player.cid);
      if (player.id) ids.add(player.id);
    }
    return ids;
  }

  /** the cid holding this slot (its plots entry), or null */
  holderOf(slot) {
    for (const [cid, plot] of Object.entries(this.room.plots)) if (plot.slot === slot) return cid;
    return null;
  }

  /** when the owner id (cid prefix) was last seen, from their plots entry */
  seenOf(ownerId) {
    for (const [cid, plot] of Object.entries(this.room.plots)) if (cid.slice(0, 8) === ownerId) return plot.seen || 0;
    return 0;
  }

  /** every slot that may be taken back, best first */
  candidates(slots) {
    const online = this.onlineIds(), list = [];
    for (let slot = 0; slot < slots; slot++) {
      const cid = this.holderOf(slot), house = this.room.world.houses[slot];
      if (cid && online.has(cid)) continue;
      if (house && online.has(house.owner)) continue;
      if (!cid && !house) continue;
      const seen = cid ? this.room.plots[cid].seen || 0 : this.seenOf(house.owner);
      if (!PlotRecycler.townIsAbandoned(house, seen, Date.now())) continue;
      list.push({ slot, cid, house: !!house, seen });
    }
    return list.sort((a, b) => (a.house - b.house) || (a.seen - b.seen) || (a.slot - b.slot));
  }

  /** take back the best plot; returns its slot, or -1 when everyone holding one is online */
  reclaim(slots) {
    const best = this.candidates(slots)[0];
    if (!best) return -1;
    this.clear(best.slot, best.cid);
    return best.slot;
  }

  /** wipe the slot and everything its holder owns, telling everyone online */
  clear(slot, cid) {
    const room = this.room, house = room.world.houses[slot];
    delete room.world.houses[slot];
    delete room.world.doors[slot];
    if (cid) {
      const plot = room.plots[cid];
      room.plots[cid] = { slot: -1, name: plot.name, evicted: true, seen: plot.seen || 0 };
      new OwnerWipe(room, cid).run();
      room.evictSave(cid);
    }
    room.ver.p++;
    room.ver.g++;
    room.dirty = true;
    this.prune();
    room.state.storage.put('plots', room.plots);
    room.broadcast({ t: 'plotfree', slot, owner: house ? house.owner : cid ? cid.slice(0, 8) : null });
  }

  /** keep the tombstone list bounded: forget the oldest recycled identities */
  prune() {
    const plots = this.room.plots;
    const stones = Object.entries(plots).filter(([, plot]) => plot.slot < 0).sort((a, b) => (a[1].seen || 0) - (b[1].seen || 0));
    for (const [cid] of stones.slice(0, Math.max(0, stones.length - PlotRecycler.TOMBSTONES))) delete plots[cid];
  }

  install(room) {
    room.plotRecycler = new PlotRecycler(room);
  }
}
