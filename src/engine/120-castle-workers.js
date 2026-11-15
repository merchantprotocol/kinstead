/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the townsfolk (see docs/ECONOMY.md, phase 3). They live in your buildings and work from the marketplace.
     Errands     a worker's to-do list: walk somewhere, wait, do something
     Cook        lives in your cottage: fetches wheat, eggs, milk and beef from the market and cooks meals into your kitchen hearth
     Smith       lives in your blacksmith: fetches wood and iron from the market and forges what you order; spare arrows go to market
     Clerk       stands at your market stalls and sells to passing traders and to other players, at the prices you set
     Workers     all of them, prices, trading with other players over the server, saving */
(function (G) {
  const K = G.K, TILE = K.TILE;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const PRICE = { wheat: 1, bread: 3, egg: 2, milk: 2, beef: 5, food: 2, arrow: 1, wood: 1, stone: 1, iron: 4, dirt: 1 };
  const MEALS = [
    { id: 'stew', name: 'beef stew', need: { beef: 1, milk: 1, wheat: 1 } },
    { id: 'omelette', name: 'omelette', need: { egg: 2, milk: 1 } },
    { id: 'bread', name: 'bread', need: { wheat: 3 } },
  ];
  const PANTRY_MAX = 8, COOK_TIME = 8, FORGE_TIME = 10;

  /** a worker's to-do list, run one step at a time */
  class Errands {
    constructor(game, a, job) { this.g = game; this.a = a; this.job = job; this.steps = []; this.repath = 0; }
    go(x, z) { this.steps.push({ go: { x, z } }); return this; }
    then(fn) { this.steps.push({ fn }); return this; }
    pause(t, anim = 'idle') { this.steps.push({ wait: t, anim }); return this; }
    get busy() { return this.steps.length > 0; }
    update(dt) {
      const a = this.a, P = this.g.play, st = (s) => { if (a.view.state !== s && a.view.state !== 'hurt') a.view.setState(s); };
      if (!this.steps.length) { this.job.idle(this, dt); if (!this.steps.length) { st('idle'); return; } }
      const s = this.steps[0];
      if (s.go) {
        if (dist(a, s.go) < 0.7) { this.steps.shift(); a.path = null; return; }
        if (!a.path || !a.path.length) {
          if ((this.repath -= dt) > 0) return; this.repath = 1;
          a.path = P.nav.find(a.x, a.z, s.go.x, s.go.z, { range: 0.6, maxNodes: 40000 }) || null;
          if (!a.path) { s.fail = (s.fail || 0) + 1; if (s.fail > 3) { a.x = s.go.x; a.z = s.go.z; this.steps.shift(); } return; }   // no way round: they get there anyway (a worker never stands stuck)
        }
        P.move(a, dt, a.speed); st('walk'); return;
      }
      if (s.wait != null) { st(s.anim); if ((s.wait -= dt) <= 0) this.steps.shift(); return; }
      this.steps.shift(); if (s.fn && s.fn() === false) this.steps = [];   // a step that fails ends the errand
    }
  }

  /** the door of a building spec, just outside */
  const doorOf = (spec) => { const d = spec.doors.find((q) => q.kind !== 'interior') || spec.doors[0], F = spec.footprint;
    let x = spec.x + d.x + (d.side === 'n' || d.side === 's' ? d.w / 2 : 0), z = spec.z + d.z + (d.side === 'e' || d.side === 'w' ? d.w / 2 : 0);
    if (d.side === 's') z += 1.8; else if (d.side === 'n') z -= 0.8; else if (d.side === 'e') x += 1.8; else x -= 0.8; void F; return { x: x * TILE, z: z * TILE }; };

  class Job {
    constructor(w, opts) { this.w = w; this.g = w.g; this.cool = 3; this.a = null; this.opts = opts; }
    get eco() { return this.g.economy; }
    get market() { return this.eco.of('market')[0] || null; }
    /** the spot in front of the market stalls where a worker stands to fetch */
    get counter() { const m = this.market; if (!m) return null; const r = m.rot || 0; return { x: m.x + Math.sin(r) * 1.6, z: m.z + Math.cos(r) * 1.6 }; }
    spawn(at) {
      const o = this.opts, g = this.g;
      const a = g.addActor({ id: 'wk:' + o.role, role: 'npc', spriteId: o.sprite, name: o.name, x: at.x, z: at.z, hpMax: 60, atk: 0, def: 0, speed: o.speed || 1.6, cd: 1, reach: 1, r: 0.3, scale: o.scale || 0.95, level: 1 });
      a.hostile = false; a.worker = o.role; a.type = 'c_worker'; if (o.tint != null) a.view.setTint(o.tint); a.brain = new Errands(g, a, this); this.a = a; return a;
    }
    despawn() { if (this.a) { this.g.removeActor(this.a); this.a = null; } }
    show(on) { if (this.a) { this.a.view.setVisible(on); this.a.hidden = !on; } }
    /** take goods from the market (and only from there); false if it is not all there any more */
    fetch(need) { const l = this.eco.ledger(this.market); if (!Object.entries(need).every(([r, n]) => l.amount(r) >= n)) return false; for (const [r, n] of Object.entries(need)) l.take(r, n); return true; }
  }

  class Cook extends Job {
    constructor(w) { super(w, { role: 'cook', sprite: 'witch', name: 'Cook', tint: 0xffd8b0, speed: 1.5, scale: 0.9 }); }
    get home() { return this.g.home.built ? this.g.home : null; }
    update() { if (this.home && !this.a) { this.spawn(this.home.doorPoint); this.show(false); } else if (!this.home && this.a) this.despawn(); }
    meals() { return this.g.purse.hearth.tray.reduce((s, t) => s + (t.n || 1), 0); }
    idle(e, dt) {
      if ((this.cool -= dt) > 0) return; this.cool = 6; const m = this.market, c = this.counter; if (!m || !this.home || this.meals() >= PANTRY_MAX) return;
      const l = this.eco.ledger(m), meal = MEALS.find((r) => Object.entries(r.need).every(([g, n]) => l.amount(g) >= n)); if (!meal) return;
      const door = this.home.doorPoint;
      e.then(() => this.show(true)).go(c.x, c.z).pause(1.5, 'action').then(() => this.fetch(meal.need) || (this.backHome(e), false))
        .go(door.x, door.z).then(() => this.show(false)).pause(COOK_TIME)
        .then(() => { this.g.purse.hearth.addMeal(meal.id); this.g.cui.toast(`Your cook made ${meal.name}. It is on the kitchen hearth.`); this.g.changed(); });
    }
    backHome(e) { const d = this.home && this.home.doorPoint; if (d) { e.steps = []; e.go(d.x, d.z).then(() => this.show(false)); } }
  }

  class Smith extends Job {
    constructor(w) { super(w, { role: 'smith', sprite: 'warden', name: 'Smith', tint: 0x9a8a7a, speed: 1.4, scale: 1.05 }); this.orders = []; }
    get shop() { return this.g.smithy || null; }
    update() { if (this.shop && !this.a) { this.spawn(doorOf(this.shop)); this.show(false); } else if (!this.shop && this.a) this.despawn(); }
    /** you order something at the forge: he gathers the materials (market first, then your purse) and makes it */
    order(r) { this.orders.push(r); this.g.cui.toast(`The smith will make the ${r.name.toLowerCase()}. He fetches what he needs from the market first.`); }
    gather(cost) {
      const c = this.g.castle, l = this.market ? this.eco.ledger(this.market) : null;
      for (const [r, n] of Object.entries(cost)) if ((l ? l.amount(r) : 0) + c.amount(r) < n) return false;
      for (const [r, n] of Object.entries(cost)) { const k = l ? l.take(r, n) : 0; if (n - k > 0) c.spend({ [r]: n - k }); } return true;
    }
    idle(e, dt) {
      if ((this.cool -= dt) > 0) return; this.cool = 8; const door = this.shop && doorOf(this.shop), c = this.counter; if (!door) return;
      const r = this.orders[0];
      if (r) {
        if (!this.gather(r.cost)) { this.orders.shift(); this.g.cui.toast(`The smith cannot find the materials for the ${r.name.toLowerCase()}.`); return; } this.orders.shift();
        if (c) e.then(() => this.show(true)).go(c.x, c.z).pause(1.2, 'action');
        e.go(door.x, door.z).then(() => this.show(false)).pause(FORGE_TIME).then(() => { this.g.forge.finish(r); this.g.cui.toast(`The smith finished the ${r.name.toLowerCase()}. It is on the forge.`); });
        return;
      }
      const m = this.market; if (!m || !c) return; const l = this.eco.ledger(m);   // nothing ordered: arrows for the market, from the market's wood
      if (l.amount('wood') < 2 || l.amount('arrow') >= 80) return;
      e.then(() => this.show(true)).go(c.x, c.z).pause(1, 'action').then(() => this.fetch({ wood: 2 })).go(door.x, door.z).then(() => this.show(false)).pause(FORGE_TIME)
        .then(() => this.show(true)).go(c.x, c.z).pause(1, 'action').then(() => { l.add('arrow', 8); }).go(door.x, door.z).then(() => this.show(false));
    }
  }

  class Clerk extends Job {
    constructor(w) { super(w, { role: 'clerk', sprite: 'ranger', name: 'Clerk', tint: 0xc8e0ff, speed: 1.2, scale: 0.95 }); this.t = 40; }
    get post() { const m = this.market; if (!m) return null; const r = m.rot || 0; return { x: m.x - Math.sin(r) * 0.15, z: m.z - Math.cos(r) * 0.15 }; }
    update() { const p = this.post; if (p && !this.a) this.spawn(p); else if (!p && this.a) this.despawn(); }
    idle(e, dt) {
      const p = this.post; if (!p) return; if (dist(this.a, p) > 0.8) { e.go(p.x, p.z); return; }
      if ((this.t -= dt) > 0) return; this.t = 45 + Math.random() * 30;   // a passing trader buys a little of something you have priced
      const l = this.eco.ledger(this.market), on = Object.entries(this.w.prices).filter(([g, pr]) => pr > 0 && l.amount(g) >= 1); if (!on.length) return;
      const [good, pr] = on[Math.floor(Math.random() * on.length)], n = Math.min(l.amount(good), 1 + Math.floor(Math.random() * 4));
      l.take(good, n); l.add('gold', n * pr); e.pause(2, 'action');
      this.g.cui.toast(`A passing trader bought ${n} ${K.CastleData.resName(good)} from your clerk for ${n * pr} gold.`); this.g.changed();
    }
  }

  class Workers {
    constructor(game) { this.g = game; this.prices = Object.assign({}, PRICE); this.cook = new Cook(this); this.smith = new Smith(this); this.clerk = new Clerk(this); this.pubT = 2; this.pubSig = ''; this.markets = new Map(); this.hooked = false; }
    get jobs() { return [this.cook, this.smith, this.clerk]; }
    update(dt) {
      for (const j of this.jobs) j.update(dt);
      const mp = this.g.mp; if (!mp) return; if (!this.hooked) this.hook(mp);
      if ((this.pubT -= dt) <= 0) { this.pubT = 5; this.publish(); }
    }
    /* ---------- trading with other players ---------- */
    hook(mp) {
      this.hooked = true; const net = mp.net, w = net.welcome || {};
      for (const m of w.markets || []) this.markets.set(m.owner, m); for (const s of w.sales || []) this.sold(s);
      net.on('welcome', (m) => { for (const x of m.markets || []) this.markets.set(x.owner, x); for (const s of m.sales || []) this.sold(s); });
      net.on('market', (m) => { if (m.m) this.markets.set(m.m.owner, m.m); });
      net.on('bought', (m) => this.bought(m)); net.on('sold', (m) => this.sold(m)); net.on('buyfail', (m) => this.g.cui.toast(m.why || 'The clerk could not sell you that.'));
    }
    /** what your market has for sale, for everyone to see */
    publish() {
      const mk = this.cook.market, mp = this.g.mp; if (!mk || !mp) return; const l = this.g.economy.ledger(mk), stock = {}, prices = {};
      for (const [g, pr] of Object.entries(this.prices)) if (pr > 0 && l.amount(g) > 0) { stock[g] = l.amount(g); prices[g] = pr; }
      const sig = JSON.stringify([stock, prices, Math.round(mk.x), Math.round(mk.z)]); if (sig === this.pubSig) return; this.pubSig = sig;
      mp.net.send({ t: 'market', x: mk.x, z: mk.z, stock, prices });
    }
    buy(owner, good, n) {
      const g = this.g, m = this.markets.get(owner); if (!m) return; const cost = (m.prices[good] || 0) * n;
      if (g.castle.amount('gold') < cost) { g.cui.toast(`That costs ${cost} gold. You have ${g.castle.amount('gold')}.`); g.sound.play('clank'); return; }
      g.mp.net.send({ t: 'buy', owner, good, n });
    }
    bought(m) {
      const g = this.g, c = g.castle; c.spend({ gold: m.cost }); const got = c.add(m.good, m.n);
      g.cui.toast(`You bought ${m.n} ${K.CastleData.resName(m.good)} for ${m.cost} gold.${got < m.n ? ' Your purse was full; the rest is lost.' : ''}`); g.sound.play('gather'); g.changed();
      const mk = this.markets.get(m.owner); if (mk && mk.stock) mk.stock[m.good] = Math.max(0, (mk.stock[m.good] || 0) - m.n); if (this.tradeWith === m.owner) this.trade(m.owner);
    }
    /** someone bought from your clerk (now, or while you were away) */
    sold(s) {
      const g = this.g, mk = this.cook.market; if (!mk) return; const l = g.economy.ledger(mk); l.take(s.good, s.n); l.add('gold', s.gold);
      g.cui.toast(`${s.by} bought ${s.n} ${K.CastleData.resName(s.good)} from your clerk for ${s.gold} gold.`); g.changed(); this.pubSig = '';
    }
    /** the trading window at another player's market */
    trade(owner) {
      const g = this.g, m = this.markets.get(owner); this.tradeWith = owner;
      if (!m || !Object.keys(m.stock || {}).length) { g.cui.modal(`<h2>The clerk shrugs</h2><p>Nothing is for sale here right now.</p>`, [{ label: 'Leave', pri: true }]); return; }
      const rows = Object.entries(m.stock).map(([gd, n]) => `<div class="trow"><b>${K.CastleData.resName(gd)}</b> <span>${n} in stock · ${m.prices[gd]} gold each</span> <button class="cb" data-buy="${gd}" data-n="1">Buy 1</button> <button class="cb" data-buy="${gd}" data-n="5">Buy 5</button></div>`).join('');
      g.cui.modal(`<h2>${m.name || 'A settler'}'s market</h2><p>You have ${g.castle.amount('gold')} gold.</p><div class="trade">${rows}</div>`, [{ label: 'Done', pri: true, run: () => { this.tradeWith = null; } }]);
      const box = g.cui.$('cModal'), prev = box.onclick; box.onclick = (e) => { const b = e.target.closest('[data-buy]'); if (b) { this.buy(owner, b.dataset.buy, +b.dataset.n); return; } prev(e); };
    }
    /** your own prices, set at your market */
    setPrices() {
      const g = this.g, P = this.prices, rows = () => Object.keys(PRICE).map((gd) => `<div class="trow"><b>${K.CastleData.resName(gd)}</b> <button class="cb" data-p="${gd}" data-d="-1">−</button> <span>${P[gd] ? P[gd] + ' gold' : 'not for sale'}</span> <button class="cb" data-p="${gd}" data-d="1">+</button></div>`).join('');
      const draw = () => { g.cui.modal(`<h2>Your clerk's prices</h2><p>Passing traders and other players buy at these prices. The gold lands in your market.</p><div class="trade">${rows()}</div>`, [{ label: 'Done', pri: true }]);
        const box = g.cui.$('cModal'), prev = box.onclick; box.onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { P[b.dataset.p] = Math.max(0, Math.min(99, (P[b.dataset.p] || 0) + +b.dataset.d)); this.pubSig = ''; g.changed(); draw(); return; } prev(e); }; };
      draw();
    }
    /* ---------- saving ---------- */
    toJSON() { return { prices: this.prices, meals: this.g.purse.hearth.tray.map((t) => [t.id, t.n || 1]), orders: this.smith.orders.map((r) => r.id) }; }
    restore(x) {
      if (!x) return; Object.assign(this.prices, x.prices || {}); for (const [id, n] of x.meals || []) for (let i = 0; i < n; i++) this.g.purse.hearth.addMeal(id);
      for (const id of x.orders || []) { const r = this.g.forge && this.g.forge.recipe(id); if (r) this.smith.orders.push(r); }
    }
    dispose() { for (const j of this.jobs) j.despawn(); }
  }

  Object.assign(K, { Workers, Errands, MEALS, MARKET_PRICES: PRICE });
})(typeof window !== 'undefined' ? window : globalThis);
