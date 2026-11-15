/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · HallJob: the people in your walk-in workshops (baker, butcher, alchemist, stablehand). They work in plain
   sight inside at the furniture of their trade, walk the town for what they need, and carry what they make to the clerk. */
(function (G) {
  const K = G.K;

  class HallJob extends K.WorkerJob {
    static get WHO() {
      return {
        bakery: { name: 'Baker', sprite: 'witch', tint: 0xfff4e0 }, butcher: { name: 'Butcher', sprite: 'warden', tint: 0xf0d0d0 },
        library: { name: 'Alchemist', sprite: 'witch', tint: 0xc0a0f0 }, stable: { name: 'Stablehand', sprite: 'ranger', tint: 0xd8c090 },
      };
    }
    static runs(type) { return !!HallJob.WHO[type]; }
    constructor(w, type) {
      const h = HallJob.WHO[type], look = (K.WORKER_LOOKS || {})[h.name];
      super(w, { role: type, sprite: look ? look.sprite : h.sprite, name: h.name, tint: look ? look.tint : h.tint, speed: 1.4 });
      this.type = type; this.made = 0; this.cool = 4;
    }
    get hall() { const h = this.g.halls[this.type]; return h ? h.spec : null; }
    get door() { return this.hall && K.WorkSpots.door(this.hall); }
    update() { const d = this.door; if (d && !this.a) this.spawn(d); else if (!d && this.a) this.despawn(); }
    /** carry what was made to the market stalls and hand it to the clerk */
    deliver(e, good, n, done, prop, line) {
      const c = this.counter, d = this.door; if (!c) return;
      e.carry(prop).go(d.x, d.z).go(c.x, c.z); this.meet(e, this.w.clerk, line || 'Fresh from the shop.', 'Lovely. I’ll put it out.');
      e.work(1.2, 'lift', this.market).then(() => { this.eco.ledger(this.market).add(good, n); this.made += n; if (done) done(); }).carry(null).go(d.x, d.z);
    }
    idle(e, dt) {
      const m = this.market, spec = this.hall; if (!spec) return;
      const due = this.cool <= 0;
      if (this.type === 'stable' || !due || !m || !this.counter) { if (due) this.cool = 6; this.w.shop.queue(this, e, spec, this.type, 7); return; }
      const ran = this.type === 'bakery' ? this.w.baker.round(this, e) : this.type === 'butcher' ? this.butcherRound(e) : this.brew(e);
      if (!ran) this.w.shop.queue(this, e, spec, this.type, 7);
    }
    /** the butcher fetches a spare cow or hen (a word with its keeper), cuts it up and takes the meat to market */
    butcherRound(e) {
      this.cool = 40; const eco = this.eco, st = eco.stock;
      const pick = eco.of('barn').map((p) => [p, st.herd(p), 2, 'cow', 6]).concat(eco.of('coop').map((p) => [p, st.herd(p), 4, 'chicken', 2])).find(([, h,
          keep]) => h.length > keep);
      if (!pick) return false;
      const [p, h, , kind, meat] = pick, d = this.door, to = { x: p.x + Math.sin(p.rot || 0) * 2, z: p.z + Math.cos(p.rot || 0) * 2 };
      e.go(d.x, d.z).go(to.x, to.z);
      this.meet(e, this.w.keepers.get(p.uid), kind === 'cow' ? 'One of the spare cows, please.' : 'A spare hen for the pot?',
          'Take that one. Mind, not one I’m breeding from.');
      e.work(2, 'lift', p).then(() => { const b = h[h.length - 1]; if (!b) return false; st.remove(b); return true; }).carry('meat').go(d.x, d.z).carry(null);
      this.w.shop.queue(this, e, this.hall, 'butcher', 8);
      this.deliver(e, 'beef', meat, () => this.g.cui.toast(`The butcher brought ${meat} meat from a ${kind} to the market. He keeps your breeding stock.`),
          'meat', 'Fresh cuts for the stall.');
      return true;
    }
    /** the alchemist takes three odds and ends from the market and brews a potion */
    brew(e) {
      this.cool = 30; const l = this.eco.ledger(this.market), POT = K.POTIONS, have = HallJob.ODDS.filter((r) => l.amount(r) >= 1);
      if (have.length < 2 || Object.keys(POT).reduce((n, k) => n + l.amount(k), 0) >= 30) return false;
      const need = {};
      for (let i = 0; i < 3; i++) { const r = have[Math.floor(Math.random() * have.length)];
        need[r] = Math.min(l.amount(r), (need[r] || 0) + 1);
        }
      const pot = Object.keys(POT)[Math.floor(Math.random() * 4)], d = this.door, c = this.counter;
      e.go(d.x, d.z).go(c.x, c.z).work(1, 'lift', this.market).then(() => this.fetch(need)).carry('crate').go(d.x, d.z).carry(null);
      this.w.shop.queue(this, e, this.hall, 'library', 12);
      const what = Object.entries(need).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', ');
      this.deliver(e, pot, 1, () => this.g.cui.toast(`The alchemist brewed a ${POT[pot]} from ${what}. It is in the market.`), 'potion',
          'A new brew for the shelf.');
      return true;
    }
    report() {
      const m = this.market, l = m ? this.eco.ledger(m) : null, eco = this.eco, POT = K.POTIONS;
      switch (this.type) {
        case 'bakery': return [m ? `The market has ${l.amount('wheat')} wheat and ${l.amount('bread')} loaves.` :
            'Without a marketplace I have no wheat and nowhere to sell.',
          `I have baked ${this.made} loaves so far. Three wheat makes two loaves.`, 'Bread is food you can eat; wheat on its own is not.'];
        case 'butcher': {
          const cows = eco.of('barn').reduce((n, p) => n + eco.stock.herd(p).length, 0), hens = eco.of('coop').reduce((n,
              p) => n + eco.stock.herd(p).length, 0);
          return [`You have ${cows} cows and ${hens} chickens. I keep 2 cows a barn and 4 hens a coop to breed from, and butcher the rest.`,
            `I have brought ${this.made} meat to the market.`, 'Your cook turns the meat into meals.'];
        }
        case 'library': return [m ? `The market holds ${Object.keys(POT).map((k) => `${l.amount(k)} ${POT[k]}s`).join(', ')}.` :
            'I need a marketplace to work from.',
          'I take three odds and ends from the market and brew whatever the books suggest. Drink a potion by clicking it in your purse.',
          'Healing mends you, speed and strength last a minute, warmth keeps the cold off for two.'];
        case 'stable': return ['The horses are fed and saddled when you want them.',
            'Walk into the stable, saddle a horse and mount up. You ride far faster on open ground.'];
      }
      return ['All is well.'];
    }
  }
  HallJob.ODDS = ['wood', 'stone', 'iron', 'wheat', 'egg', 'milk', 'beef', 'dirt'];

  K.HallJob = HallJob;
})(typeof window !== 'undefined' ? window : globalThis);
