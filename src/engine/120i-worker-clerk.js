/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Clerk: stands at your market stalls and sells to passing traders and to other players, at the prices you set.
   Between customers walks the four stalls stacking, straightening and sweeping, and fetches the carts of buildings that
   have no keeper of their own (the coop's eggs, the silo's spare wheat). */
(function (G) {
  const K = G.K;

  class Clerk extends K.WorkerJob {
    static STALLS = [[-4.0, 'lift'], [-1.0, 'sweep'], [1.0, 'lift'], [4.0, 'knead']];
    constructor(w) { super(w, { role: 'clerk', sprite: 'clerk', name: 'Clerk', tint: null, speed: 1.2, scale: 0.95 }); this.t = 40; }
    get post() { const m = this.market; if (!m) return null; const r = m.rot || 0; return { x: m.x - Math.sin(r) * 0.15, z: m.z - Math.cos(r) * 0.15 }; }
    update(dt) { const p = this.post; if (p && !this.a) this.spawn(p); else if (!p && this.a) this.despawn(); this.t -= dt || 0; }
    report() {
      const m = this.market; if (!m) return ['No market, no customers.'];
      const l = this.eco.ledger(m), w = this.w, on = Object.entries(w.prices).filter(([, pr]) => pr > 0);
      const stock = Object.entries(l.goods).filter(([g, n]) => n > 0 && g !== 'gold').sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g,
          n]) => `${n} ${K.CastleData.resName(g)}`);
      return [stock.length ? `On the stalls: ${stock.join(', ')}.` : 'The stalls are bare. The carts bring whatever your town makes.',
        `I have taken ${l.amount('gold')} gold so far. It is in the market for you.`,
        `I sell ${on.length} kinds of goods at the prices you set. Other settlers pay; your own team takes what they need for free.`,
        w.sold ? `Today I sold ${w.sold} lots.` : 'No sales yet today.'];
    }
    idle(e) {
      const p = this.post, m = this.market; if (!p) return;
      if (this.t <= 0 && this.sell(e, p, m)) return;
      if (this.w.haulage.takeOrphan(this, e)) return;   // eggs from the coop, surplus wheat from the silo
      const [sx, pose] = Clerk.STALLS[this.loop++ % Clerk.STALLS.length], at = K.WorkSpots.local(m, sx * 0.85, -0.55), face = K.WorkSpots.local(m, sx, -0.2);
      e.go(at.x, at.z).work(2.5 + Math.random() * 1.5, pose, face).go(p.x, p.z).work(1, 'talk', K.WorkSpots.local(m, 0, 4));
    }
    /** a passing trader buys a little of something you have priced */
    sell(e, p, m) {
      this.t = 45 + Math.random() * 30; const l = this.eco.ledger(m), on = Object.entries(this.w.prices).filter(([g, pr]) => pr > 0 && l.amount(g) >= 1);
      if (!on.length) return false;
      const [good, pr] = on[Math.floor(Math.random() * on.length)], n = Math.min(l.amount(good), 1 + Math.floor(Math.random() * 4));
      l.take(good, n); l.add('gold', n * pr); this.w.sold = (this.w.sold || 0) + 1;
      e.go(p.x, p.z).say('Thank you kindly!', 2).work(2, 'talk', K.WorkSpots.local(m, 0, 4));
      this.g.cui.toast(`A passing trader bought ${n} ${K.CastleData.resName(good)} from your clerk for ${n * pr} gold.`); this.g.changed();
      return true;
    }
  }

  K.Clerk = Clerk;
})(typeof window !== 'undefined' ? window : globalThis);
