/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the townsfolk (see docs/ECONOMY.md, phase 3). They live in your buildings and work from the marketplace.
   Workers is the town's roll: it hires one worker per building (Cook, Smith, Clerk, a Keeper per workshop, a HallJob per
   walk-in shop), runs them, and owns what they share: the work poses (WorkPoser), the speech bubbles (TalkBubbles), the
   shop stations (ShopWork), each keeper's routine (KeeperRoutines), the carts they haul (Haulage), the baker's round
   (BakerRound), bedtime (TownNight) and street chatter (SmallTalk). It also keeps your prices, trades with other players
   over the server, and saves. */
(function (G) {
  const K = G.K;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const PRICE = { potion_heal: 12, potion_speed: 10, potion_strength: 10, potion_warmth: 8, wheat: 1, bread: 3, egg: 2, milk: 2, beef: 5, food: 2, arrow: 1, wood: 1, stone: 1, iron: 4, dirt: 1 };
  const MEALS = [
    { id: 'stew', name: 'beef stew', need: { beef: 1, milk: 1, wheat: 1 } },
    { id: 'omelette', name: 'omelette', need: { egg: 2, milk: 1 } },
    { id: 'cooked_meat', name: 'roast meat', need: { beef: 1 } },
    { id: 'bread', name: 'bread', need: { wheat: 3 } },
  ];
  const POTIONS = { potion_heal: 'healing potion', potion_speed: 'potion of speed', potion_strength: 'potion of strength', potion_warmth: 'potion of warmth' };

  class Workers {
    constructor(game) {
      this.g = game; this.prices = Object.assign({}, PRICE); this.clock = 0; this.timers = [];
      this.poser = new K.WorkPoser(new K.WorkProps(game.R.bmats)); this.shop = new K.ShopWork(new K.Stations(game));
      this.routines = new K.KeeperRoutines(this); this.haulage = new K.Haulage(this); this.baker = new K.BakerRound(this);
      this.night = new K.TownNight(this); this.chatter = new K.SmallTalk(this);
      this.bubbles = typeof document !== 'undefined' ? new K.TalkBubbles(game) : null;
      this.cook = new K.Cook(this); this.smith = new K.Smith(this); this.clerk = new K.Clerk(this);
      this.pubT = 2; this.pubSig = ''; this.markets = new Map(); this.hooked = false;
      this.keepers = new Map(); this.keepT = 0; this.halls = new Map(); this.buffs = {};
    }
    /** run fn after s seconds of game time */
    later(s, fn) { this.timers.push({ at: this.clock + s, fn }); }
    /** a speech bubble over a worker */
    say(a, text, t) { if (this.bubbles) this.bubbles.say(a, text, t); }
    runTimers(dt) {
      this.clock += dt; if (!this.timers.length) return;
      const due = this.timers.filter((t) => t.at <= this.clock); if (!due.length) return;
      this.timers = this.timers.filter((t) => t.at > this.clock); for (const t of due) t.fn();
    }
    /** the millstone turns while the miller grinds */
    turnStones(dt) {
      for (const k of this.keepers.values()) {
        const s = k.p.type === 'storehouse' && k.spinner; if (s && s.turning > 0) { s.turning -= dt; s.rotation.y += dt * 1.6; }
      }
    }
    get jobs() { return [this.cook, this.smith, this.clerk, ...this.keepers.values(), ...this.halls.values()]; }
    /** one keeper per workshop and farm building; they go when the building goes */
    syncKeepers() {
      const live = new Set();
      for (const p of this.g.castle.pieces) {
        if (!K.Keeper.runs(p.type)) continue;
        live.add(p.uid); if (!this.keepers.has(p.uid)) this.keepers.set(p.uid, new K.Keeper(this, p));
      }
      for (const [uid, k] of this.keepers) if (!live.has(uid)) { k.despawn(); this.keepers.delete(uid); }
    }
    /** talk to someone: they tell you how it is going */
    talk(a) {
      const j = this.jobs.find((x) => x.a === a); if (!j) return; const lines = j.report();
      this.g.cui.modal(`<h2>${j.opts.name}</h2>${lines.map((t) => `<p>${t}</p>`).join('')}`, [{ label: 'Thanks', pri: true }]);
      if (j.a) { j.a.path = null; this.g.play.face(j.a, this.g.play.me); }
    }
    update(dt) {
      if ((this.keepT -= dt) <= 0) { this.keepT = 2; this.syncKeepers(); this.syncHalls(); }
      for (const j of this.jobs) j.update(dt);
      this.runTimers(dt); this.turnStones(dt);
      if (this.bubbles) { this.bubbles.update(dt); this.chatter.update(dt); }
      const mp = this.g.mp; if (!mp) return; if (!this.hooked) this.hook(mp);
      if ((this.pubT -= dt) <= 0) { this.pubT = 5; this.publish(); }
    }
    syncHalls() { for (const t of Object.keys(this.g.halls || {})) if (K.HallJob.runs(t) && !this.halls.has(t)) this.halls.set(t, new K.HallJob(this, t)); }
    hallBuilt() { this.keepT = 0; }
    /* ---------- food and potions from your purse ---------- */
    buff(k) { return (this.buffs[k] || 0) > this.g.play.t; }
    get speedMul() { return this.buff('speed') ? 1.5 : 1; }
    get strengthMul() { return this.buff('strength') ? 1.5 : 1; }
    /** click bread or a potion in your purse: eat or drink it. false for anything else */
    use(id) {
      const g = this.g, c = g.castle, P = g.play, p = P.player, max = g.vitals.hpMax; if (c.amount(id) < 1) return false;
      if (id === 'bread') { if (p.hp >= max - 0.5) { g.cui.toast('You are not hungry.'); return true; } c.spend({ bread: 1 }); p.heal(14); P.float(P.me, '+14', 'heal'); g.sound.play('gather'); g.changed(); return true; }
      if (!POTIONS[id]) return false; c.spend({ [id]: 1 }); g.sound.play('fanfare');
      if (id === 'potion_heal') { p.heal(40); P.float(P.me, '+40', 'heal'); }
      else { const k = id.slice(7), sec = k === 'warmth' ? 120 : 60; this.buffs[k] = P.t + sec; P.float(P.me, { speed: 'Swift!', strength: 'Strong!', warmth: 'Warm!' }[k], 'heal'); g.cui.toast(`You drink the ${POTIONS[id]}: it lasts ${sec} seconds.`); }
      g.changed(); return true;
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
      for (const [g, n] of Object.entries(l.goods)) if (n >= 1 && g !== 'gold') stock[g] = Math.floor(n);   // everything shows (your team may take any of it); outsiders only see what has a price
      for (const [g, pr] of Object.entries(this.prices)) if (pr > 0) prices[g] = pr;
      const sig = JSON.stringify([stock, prices, Math.round(mk.x), Math.round(mk.z)]); if (sig === this.pubSig) return; this.pubSig = sig;
      mp.net.send({ t: 'market', x: mk.x, z: mk.z, stock, prices });
    }
    buy(owner, good, n) {
      const g = this.g, m = this.markets.get(owner); if (!m) return; const cost = g.mp.mayUse(owner) ? 0 : (m.prices[good] || 0) * n;   // your team takes for free
      if (g.castle.amount('gold') < cost) { g.cui.toast(`That costs ${cost} gold. You have ${g.castle.amount('gold')}.`); g.sound.play('clank'); return; }
      g.mp.net.send({ t: 'buy', owner, good, n });
    }
    bought(m) {
      const g = this.g, c = g.castle; c.spend({ gold: m.cost }); const got = c.add(m.good, m.n);
      g.cui.toast(`${m.cost ? 'You bought' : 'You took'} ${m.n} ${K.CastleData.resName(m.good)}${m.cost ? ` for ${m.cost} gold` : ''}.${got < m.n ? ' Your purse was full; the rest is lost.' : ''}`); g.sound.play('gather'); g.changed();
      const mk = this.markets.get(m.owner); if (mk && mk.stock) mk.stock[m.good] = Math.max(0, (mk.stock[m.good] || 0) - m.n); if (this.tradeWith === m.owner) this.trade(m.owner);
    }
    /** someone bought from your clerk (now, or while you were away) */
    sold(s) {
      const g = this.g, mk = this.cook.market; if (!mk) return; const l = g.economy.ledger(mk); l.take(s.good, s.n); l.add('gold', s.gold);
      g.cui.toast(s.gold ? `${s.by} bought ${s.n} ${K.CastleData.resName(s.good)} from your clerk for ${s.gold} gold.` : `${s.by} (your team) took ${s.n} ${K.CastleData.resName(s.good)} from your market.`); g.changed(); this.pubSig = '';
    }
    /** the trading window at another player's market */
    trade(owner) {
      const g = this.g, m = this.markets.get(owner); this.tradeWith = owner;
      if (!m || !Object.entries(m.stock || {}).some(([gd, n]) => n > 0 && (g.mp.mayUse(owner) || (m.prices || {})[gd] > 0))) { g.cui.modal(`<h2>The clerk shrugs</h2><p>Nothing is for sale here right now.</p>`, [{ label: 'Leave', pri: true }]); return; }
      const team = g.mp.mayUse(owner), verb = team ? 'Take' : 'Buy';
      const rows = Object.entries(m.stock).filter(([gd, n]) => n > 0 && (team || m.prices[gd] > 0)).map(([gd, n]) => `<div class="trow"><b>${K.CastleData.resName(gd)}</b> <span>${n} in stock${team ? '' : ` · ${m.prices[gd]} gold each`}</span> <button class="cb" data-buy="${gd}" data-n="1">${verb} 1</button> <button class="cb" data-buy="${gd}" data-n="5">${verb} 5</button></div>`).join('');
      g.cui.modal(`<h2>${m.name || 'A settler'}'s market</h2><p>${team ? 'Your team: take what you need, free.' : `You have ${g.castle.amount('gold')} gold.`}</p><div class="trade">${rows}</div>`, [{ label: 'Done', pri: true, run: () => { this.tradeWith = null; } }]);
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
    dispose() { for (const j of this.jobs) j.despawn(); if (this.bubbles) this.bubbles.dispose(); }
  }

  Object.assign(K, { Workers, MEALS, MARKET_PRICES: PRICE, POTIONS });
})(typeof window !== 'undefined' ? window : globalThis);
