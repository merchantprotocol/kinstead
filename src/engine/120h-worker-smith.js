/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Smith: lives in your blacksmith. Fetches wood and iron from the market and forges what you order, hammering
   at the anvil in plain sight; with nothing ordered he makes arrows from the market's wood and carries them back to the clerk. */
(function (G) {
  const K = G.K;

  class Smith extends K.WorkerJob {
    static FORGE_TIME = 10;
    constructor(w) { super(w, { role: 'smith', sprite: 'smith', name: 'Smith', tint: null, speed: 1.4, scale: 1.05 }); this.orders = []; }
    get shop() { return this.g.smithy || null; }
    update() { if (this.shop && !this.a) this.spawn(K.WorkSpots.door(this.shop)); else if (!this.shop && this.a) this.despawn(); }
    /** you order something at the forge: he gathers the materials (market first, then your purse) and makes it */
    order(r) { this.orders.push(r); this.g.cui.toast(`The smith will make the ${r.name.toLowerCase()}. He fetches what he needs from the market first.`); }
    report() {
      const out = [], m = this.market, l = m ? this.eco.ledger(m) : null, c = this.g.castle;
      out.push(this.orders.length ? `I have ${this.orders.length} order${this.orders.length > 1 ? 's' : ''} to make: ${this.orders.map((r) => r.name.toLowerCase()).join(', ')}.` : 'No orders right now. Order weapons at the forge and I will fetch what I need.');
      out.push(`Wood: ${l ? l.amount('wood') : 0} in the market, ${c.amount('wood')} in your purse. Iron: ${l ? l.amount('iron') : 0} in the market, ${c.amount('iron')} in your purse.`);
      if (!m) out.push('With a marketplace I would make arrows for it whenever I am idle.');
      else if (l.amount('wood') < 2) out.push('The market has no wood for arrows. Send some over and I will keep the racks full.');
      else out.push(`The market has ${l.amount('arrow')} arrows. I make more whenever it is low.`);
      return out;
    }
    gather(cost) {
      const c = this.g.castle, l = this.market ? this.eco.ledger(this.market) : null;
      for (const [r, n] of Object.entries(cost)) if ((l ? l.amount(r) : 0) + c.amount(r) < n) return false;
      for (const [r, n] of Object.entries(cost)) { const k = l ? l.take(r, n) : 0; if (n - k > 0) c.spend({ [r]: n - k }); }
      return true;
    }
    idle(e, dt) {
      const shop = this.shop; if (!shop) return;
      const due = (this.cool -= dt) <= 0; if (due) this.cool = 8;
      if (due && this.orders[0]) { this.forgeOrder(e, shop); return; }
      const l = this.market && this.counter ? this.eco.ledger(this.market) : null;
      if (!due || !l || l.amount('wood') < 2 || l.amount('arrow') >= 80) { this.w.shop.queue(this, e, shop, 'smith', 7); return; }
      this.makeArrows(e, shop, l);
    }
    forgeOrder(e, shop) {
      const r = this.orders.shift(), door = K.WorkSpots.door(shop), c = this.counter;
      if (!this.gather(r.cost)) { this.g.cui.toast(`The smith cannot find the materials for the ${r.name.toLowerCase()}.`); return; }
      if (c) e.go(door.x, door.z).go(c.x, c.z).work(1.2, 'lift', this.market).carry('log').go(door.x, door.z).carry(null);
      this.w.shop.queue(this, e, shop, 'smith', Smith.FORGE_TIME);
      e.then(() => { this.g.forge.finish(r); this.g.cui.toast(`The smith finished the ${r.name.toLowerCase()}. It is on the forge.`); });
    }
    /** nothing ordered: arrows for the market, from the market's wood */
    makeArrows(e, shop, l) {
      const door = K.WorkSpots.door(shop), c = this.counter, m = this.market;
      e.go(door.x, door.z).go(c.x, c.z).work(1, 'lift', m).then(() => this.fetch({ wood: 2 })).carry('log').go(door.x, door.z).carry(null);
      this.w.shop.queue(this, e, shop, 'smith', Smith.FORGE_TIME);
      e.carry('arrows').go(door.x, door.z).go(c.x, c.z).work(1, 'lift', m).then(() => { l.add('arrow', 8); }).carry(null);
      this.meet(e, this.w.clerk, 'Eight more arrows for the rack.', 'Good, they sell well.');
      e.go(door.x, door.z);
    }
  }

  K.Smith = Smith;
})(typeof window !== 'undefined' ? window : globalThis);
