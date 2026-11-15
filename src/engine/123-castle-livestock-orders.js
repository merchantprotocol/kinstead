/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Standing animal purchases owned by the livestock stock model. */
(function (G) {
  const K = G.K;

  class LivestockOrders {
    constructor(stock) {
      this.stock = stock;
      this.orders = new Map();
    }
    get(p) {
      return this.orders.get(p.uid) || { enabled: false, target: 1, every: 60, remaining: 60 };
    }
    configure(p, changes) {
      if (!['coop', 'barn'].includes(p.type)) return false;
      const old = this.get(p);
      const max = K.LIVESTOCK[p.type === 'coop' ? 'chicken' : 'cow'].max;
      const order = {
        enabled: changes.enabled == null ? old.enabled : !!changes.enabled,
        target: Math.max(1, Math.min(max, Math.floor(changes.target == null ? old.target : changes.target))),
        every: Math.max(60, Math.min(3600, Math.floor(changes.every == null ? old.every : changes.every))),
        remaining: old.remaining,
      };
      this.orders.set(p.uid, order);
      return true;
    }
    tick(dt) {
      for (const [uid, order] of this.orders) {
        if (!order.enabled) continue;
        const p = this.stock.g.castle.pieces.find((piece) => piece.uid === uid);
        if (!p) { this.orders.delete(uid); continue; }
        if (this.stock.herd(p).length >= order.target) continue;
        const kind = p.type === 'coop' ? 'chicken' : 'cow';
        if (this.stock.eco.wheatHeld() < K.LIVESTOCK[kind].price) continue;
        order.remaining -= dt;
        if (order.remaining > 0) continue;
        if (this.stock.buy(p, { quiet: true })) order.remaining = order.every;
        else order.remaining = 1;
      }
    }
    toJSON() { return Object.fromEntries(this.orders); }
    restore(saved) {
      for (const [uid, order] of Object.entries(saved || {})) {
        const p = this.stock.g.castle.pieces.find((piece) => piece.uid === +uid);
        if (p) this.configure(p, order);
      }
    }
  }

  K.LivestockOrders = LivestockOrders;
})(typeof window !== 'undefined' ? window : globalThis);
