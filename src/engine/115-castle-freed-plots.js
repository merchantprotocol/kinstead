/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · FreedPlots: the server took back a plot from a settler who has been away longest (the map was full).
   Their cottage and door leave your map now; their walls and buildings go with the 'op' removals that follow.
   If it was YOUR plot (you were away when it happened), the welcome says evicted and you start on a fresh one. */
(function (G) {
  const K = G.K;

  class FreedPlots {
    constructor(multiplayer) {
      this.mp = multiplayer;
    }

    /** listen for the server's word; a reconnect welcome that says evicted means your plot was recycled meanwhile */
    listen(net) {
      net.on('plotfree', (m) => this.free(m));
      net.on('welcome', (m) => { if (m.evicted) this.mp.onEvicted(); });
    }

    free(m) {
      const world = this.mp.world, g = this.mp.g, slot = m.slot;
      if (slot == null || slot === g.L.slot) return;
      const id = 'home:' + slot, door = world.doors.get(slot);
      if (door && door.door && door.door.leaf) g.group.remove(door.door.leaf);
      world.doors.delete(slot);
      world.cottages.delete(id);
      world.removeBuilding(id);
      if (g.flags && g.flags.unflag) g.flags.unflag('rh' + slot);
      delete world.owners[slot];
      if (m.owner) delete world.houseAt[m.owner];
    }
  }

  K.FreedPlots = FreedPlots;
})(typeof window !== 'undefined' ? window : globalThis);
