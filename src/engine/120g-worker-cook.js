/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Cook: lives in your cottage. Fetches wheat, eggs, milk and beef from the market (a word with the clerk at the
   stalls) and cooks meals into your kitchen hearth; between meals tends the hearth, kneads and tidies the pantry, in sight. */
(function (G) {
  const K = G.K;

  class Cook extends K.WorkerJob {
    static PANTRY_MAX = 8;
    static COOK_TIME = 8;
    constructor(w) { super(w, { role: 'cook', sprite: 'cook', name: 'Cook', tint: null, speed: 1.5, scale: 0.9 }); }
    get home() { return this.g.home.built ? this.g.home : null; }
    update() { if (this.home && !this.a) this.spawn(this.home.doorPoint); else if (!this.home && this.a) this.despawn(); }
    meals() { return this.g.purse.hearth.tray.reduce((s, t) => s + (t.n || 1), 0); }
    /** the meal the market's goods make right now, if the hearth has room and it is time */
    mealToCook(dt) {
      if (this.cool > 0) return null; this.cool = 6;
      const m = this.market; if (!m || this.meals() >= Cook.PANTRY_MAX) return null;
      const l = this.eco.ledger(m); return K.MEALS.find((r) => Object.entries(r.need).every(([g, n]) => l.amount(g) >= n)) || null;
    }
    idle(e, dt) {
      const home = this.home; if (!home) return;
      const meal = this.mealToCook(dt); if (!meal) { this.w.shop.queue(this, e, home.spec, 'cook', 7); return; }
      const door = home.doorPoint, c = this.counter;
      e.go(door.x, door.z).go(c.x, c.z).work(1.2, 'lift', this.market).then(() => this.fetch(meal.need) || (this.backHome(e), false)).carry('tray');
      this.meet(e, this.w.clerk, 'Something for the pot, please.', 'Fresh in today.');
      e.go(door.x, door.z).carry(null); this.w.shop.queue(this, e, home.spec, 'cook', Cook.COOK_TIME);
      e.then(() => { this.g.purse.hearth.addMeal(meal.id); this.g.cui.toast(`Your cook made ${meal.name}. It is on the kitchen hearth.`); this.g.changed(); });
    }
    report() {
      const n = this.meals(), m = this.market,
          out = [n ? `I have ${n} meal${n > 1 ? 's' : ''} ready on the kitchen hearth. Help yourself.` : 'The kitchen hearth is empty right now.'];
      if (!m) { out.push('We have no marketplace, so I have nothing to cook with. Build one and keep it stocked.'); return out; }
      const l = this.eco.ledger(m), can = K.MEALS.filter((r) => Object.entries(r.need).every(([g, k]) => l.amount(g) >= k)).map((r) => r.name);
      out.push(`In the market: ${['wheat', 'egg', 'milk', 'beef'].map((g) => `${l.amount(g)} ${K.CastleData.resName(g)}`).join(', ')}.`);
      out.push(can.length ? `I can make ${can.join(', ')}.` :
          'I cannot cook anything: I need 3 wheat for bread, 2 eggs and a milk for an omelette, or beef, milk and wheat for a stew.');
      if (n >= Cook.PANTRY_MAX) out.push('The hearth is full, so I am resting until you eat something.'); return out;
    }
    backHome(e) { const d = this.home && this.home.doorPoint; if (d) { e.steps = []; e.go(d.x, d.z); } }
  }

  K.Cook = Cook;
})(typeof window !== 'undefined' ? window : globalThis);
