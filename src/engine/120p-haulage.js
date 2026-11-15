/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Haulage: every cart is pulled by its building's own worker. When a cart is loaded and waiting in front of a
   building, its keeper (farmer, henwife, cowherd, granary keeper, woodcutter, quarryman) walks out, takes the handles,
   pulls it to the silo, market or storehouse, unloads it, and pulls it home empty. A cart whose worker is busy or asleep
   waits parked. */
(function (G) {
  const K = G.K;

  class Haulage {
    constructor(workers) { this.w = workers; }
    /** the cart waiting for this keeper, if any */
    waiting(keeper) { return this.w.g.economy.carts.find((c) => c.from === keeper.p && !c.crew && !c.done && !c.booked) || null; }
    /** queue the haul for this keeper if a cart is waiting; true if they took it */
    take(keeper, e) {
      const cart = this.waiting(keeper); if (!cart) return false; cart.booked = true;
      const h = cart.handles, drop = cart.route.drop, park = cart.route.park;
      e.go(h.x, h.z).work(1, 'lift', cart).then(() => cart.take(keeper.a));
      e.go(drop.x, drop.z).then(() => cart.letGo()).work(2, 'lift', cart).then(() => cart.unload());
      e.say(Haulage.LINES[cart.good] || 'Delivery!', 2).then(() => cart.take(keeper.a));
      e.go(park.x, park.z).then(() => cart.finish());
      return true;
    }
  }
  Haulage.LINES = { wheat: 'Wheat from the fields!', egg: 'Eggs for the stalls.', milk: 'Fresh milk.', beef: 'Beef for the stalls.', wood: 'Timber for the stores.', stone: 'Stone for the stores.' };

  K.Haulage = Haulage;
})(typeof window !== 'undefined' ? window : globalThis);
