/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Haulage: every cart is pulled by its building's own worker. When a cart is loaded and waiting in front of a
   building, its keeper (farmer, cowherd, woodcutter, quarryman) walks out, takes the handles, pulls it to the silo, market
   or storehouse, unloads it, and pulls it home empty. Carts from buildings with no keeper of their own (the coop's eggs,
   the silo's surplus wheat) are fetched by the market clerk. A cart whose worker is busy or asleep waits parked. */
(function (G) {
  const K = G.K;

  class Haulage {
    constructor(workers) { this.w = workers; }
    get carts() { return this.w.g.economy.carts.filter((c) => !c.crew && !c.done && !c.booked); }
    /** queue the haul of a cart waiting at this keeper's own building; true if they took one */
    take(keeper, e) { const cart = this.carts.find((c) => c.from === keeper.p); return !!cart && this.haul(keeper, cart, e); }
    /** the clerk fetches carts from buildings that have no keeper of their own; true if they took one */
    takeOrphan(job, e) { const cart = this.carts.find((c) => !this.w.keepers.has(c.from.uid)); return !!cart && this.haul(job, cart, e); }
    /** walk to the handles, pull it to where it goes, unload, pull it home and put it away */
    haul(job, cart, e) {
      cart.booked = true; const h = cart.handles, drop = cart.route.drop, park = cart.route.park;
      e.go(h.x, h.z).work(1, 'lift', cart).then(() => cart.take(job.a));
      e.go(drop.x, drop.z).then(() => cart.letGo()).work(2, 'lift', cart).then(() => cart.unload());
      e.say(Haulage.LINES[cart.good] || 'Delivery!', 2).then(() => cart.take(job.a));
      e.go(park.x, park.z).then(() => cart.finish());
      return true;
    }
  }
  Haulage.LINES = { wheat: 'Wheat from the fields!', egg: 'Eggs for the stalls.', milk: 'Fresh milk.', beef: 'Beef for the stalls.',
      wood: 'Timber for the stores.', stone: 'Stone for the stores.' };

  K.Haulage = Haulage;
})(typeof window !== 'undefined' ? window : globalThis);
