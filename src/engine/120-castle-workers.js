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
  const PRICE = { potion_heal: 12, potion_speed: 10, potion_strength: 10, potion_warmth: 8, wheat: 1, bread: 3, egg: 2, milk: 2, beef: 5, food: 2, arrow: 1, wood: 1, stone: 1, iron: 4, dirt: 1 };
  const MEALS = [
    { id: 'stew', name: 'beef stew', need: { beef: 1, milk: 1, wheat: 1 } },
    { id: 'omelette', name: 'omelette', need: { egg: 2, milk: 1 } },
    { id: 'cooked_meat', name: 'roast meat', need: { beef: 1 } },
    { id: 'bread', name: 'bread', need: { wheat: 3 } },
  ];
  const PANTRY_MAX = 8, COOK_TIME = 8, FORGE_TIME = 10;
  const POTIONS = { potion_heal: 'healing potion', potion_speed: 'potion of speed', potion_strength: 'potion of strength', potion_warmth: 'potion of warmth' };
  const ODDS = ['wood', 'stone', 'iron', 'wheat', 'egg', 'milk', 'beef', 'dirt'];

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
    constructor(w) { super(w, { role: 'cook', sprite: 'cook', name: 'Cook', tint: null, speed: 1.5, scale: 0.9 }); }
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
    report() {
      const n = this.meals(), m = this.market, out = [n ? `I have ${n} meal${n > 1 ? 's' : ''} ready on the kitchen hearth. Help yourself.` : 'The kitchen hearth is empty right now.'];
      if (!m) { out.push('We have no marketplace, so I have nothing to cook with. Build one and keep it stocked.'); return out; }
      const l = this.eco.ledger(m), can = MEALS.filter((r) => Object.entries(r.need).every(([g, k]) => l.amount(g) >= k)).map((r) => r.name);
      out.push(`In the market: ${['wheat', 'egg', 'milk', 'beef'].map((g) => `${l.amount(g)} ${K.CastleData.resName(g)}`).join(', ')}.`);
      out.push(can.length ? `I can make ${can.join(', ')}.` : 'I cannot cook anything: I need 3 wheat for bread, 2 eggs and a milk for an omelette, or beef, milk and wheat for a stew.');
      if (n >= PANTRY_MAX) out.push('The hearth is full, so I am resting until you eat something.'); return out;
    }
    backHome(e) { const d = this.home && this.home.doorPoint; if (d) { e.steps = []; e.go(d.x, d.z).then(() => this.show(false)); } }
  }

  class Smith extends Job {
    constructor(w) { super(w, { role: 'smith', sprite: 'smith', name: 'Smith', tint: null, speed: 1.4, scale: 1.05 }); this.orders = []; }
    get shop() { return this.g.smithy || null; }
    update() { if (this.shop && !this.a) { this.spawn(doorOf(this.shop)); this.show(false); } else if (!this.shop && this.a) this.despawn(); }
    /** you order something at the forge: he gathers the materials (market first, then your purse) and makes it */
    order(r) { this.orders.push(r); this.g.cui.toast(`The smith will make the ${r.name.toLowerCase()}. He fetches what he needs from the market first.`); }
    report() {
      const out = [], m = this.market, l = m ? this.eco.ledger(m) : null, c = this.g.castle;
      out.push(this.orders.length ? `I have ${this.orders.length} order${this.orders.length > 1 ? 's' : ''} to make: ${this.orders.map((r) => r.name.toLowerCase()).join(', ')}.` : 'No orders right now. Order weapons at the forge and I will fetch what I need.');
      out.push(`Wood: ${l ? l.amount('wood') : 0} in the market, ${c.amount('wood')} in your purse. Iron: ${l ? l.amount('iron') : 0} in the market, ${c.amount('iron')} in your purse.`);
      if (!m) out.push('With a marketplace I would make arrows for it whenever I am idle.'); else if (l.amount('wood') < 2) out.push('The market has no wood for arrows. Send some over and I will keep the racks full.'); else out.push(`The market has ${l.amount('arrow')} arrows. I make more whenever it is low.`);
      return out;
    }
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
    constructor(w) { super(w, { role: 'clerk', sprite: 'clerk', name: 'Clerk', tint: null, speed: 1.2, scale: 0.95 }); this.t = 40; }
    get post() { const m = this.market; if (!m) return null; const r = m.rot || 0; return { x: m.x - Math.sin(r) * 0.15, z: m.z - Math.cos(r) * 0.15 }; }
    update() { const p = this.post; if (p && !this.a) this.spawn(p); else if (!p && this.a) this.despawn(); }
    report() {
      const m = this.market; if (!m) return ['No market, no customers.']; const l = this.eco.ledger(m), w = this.w, on = Object.entries(w.prices).filter(([, pr]) => pr > 0);
      const stock = Object.entries(l.goods).filter(([g, n]) => n > 0 && g !== 'gold').sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, n]) => `${n} ${K.CastleData.resName(g)}`);
      return [stock.length ? `On the stalls: ${stock.join(', ')}.` : 'The stalls are bare. The carts bring whatever your town makes.', `I have taken ${l.amount('gold')} gold so far. It is in the market for you.`, `I sell ${on.length} kinds of goods at the prices you set. Other settlers pay; your own team takes what they need for free.`, w.sold ? `Today I sold ${w.sold} lots.` : 'No sales yet today.'];
    }
    idle(e, dt) {
      const p = this.post; if (!p) return; if (dist(this.a, p) > 0.8) { e.go(p.x, p.z); return; }
      if ((this.t -= dt) > 0) return; this.t = 45 + Math.random() * 30;   // a passing trader buys a little of something you have priced
      const l = this.eco.ledger(this.market), on = Object.entries(this.w.prices).filter(([g, pr]) => pr > 0 && l.amount(g) >= 1); if (!on.length) return;
      const [good, pr] = on[Math.floor(Math.random() * on.length)], n = Math.min(l.amount(good), 1 + Math.floor(Math.random() * 4));
      l.take(good, n); l.add('gold', n * pr); e.pause(2, 'action'); this.w.sold = (this.w.sold || 0) + 1;
      this.g.cui.toast(`A passing trader bought ${n} ${K.CastleData.resName(good)} from your clerk for ${n * pr} gold.`); this.g.changed();
    }
  }

  /** the person who runs a workshop or farm building: stands out front, and tells you how it is going */
  const KEEP = {
    farm: { name: 'Farmer', sprite: 'ranger', tint: 0xe8d090 }, coop: { name: 'Henwife', sprite: 'witch', tint: 0xf0e0c0 }, barn: { name: 'Cowherd', sprite: 'warden', tint: 0xd0b080 },
    woodcutter: { name: 'Woodcutter', sprite: 'ranger', tint: 0x9ac080 }, quarry: { name: 'Quarryman', sprite: 'warden', tint: 0xc0b8a8 }, storehouse: { name: 'Storekeeper', sprite: 'warden', tint: 0xb0c8a0 },
    silo: { name: 'Miller', sprite: 'ranger', tint: 0xf0e8d0 }, watchtower: { name: 'Archer', sprite: 'ranger', tint: 0xc8e0ff },
  };
  class Keeper extends Job {
    constructor(w, p) { const k = KEEP[p.type], look = (K.WORKER_LOOKS || {})[k.name]; super(w, { role: 'keep' + p.uid, sprite: look ? look.sprite : k.sprite, name: k.name, tint: look ? look.tint : k.tint, speed: 1.2 }); this.p = p; this.wanderT = Math.random() * 8; }
    get post() { const p = this.p, [, d] = K.CastleArt.size(p.type), r = p.rot || 0, o = d / 2 + 0.9; return { x: p.x + Math.sin(r) * o + Math.cos(r) * 0.6, z: p.z + Math.cos(r) * o - Math.sin(r) * 0.6 }; }
    update() { if (!this.a) { const at = this.post; if (this.g.play.nav.standable(at.x, at.z)) this.spawn(at); } }
    /** the woodcutter and the quarryman go out to real trees and rocks, work them and carry the load back; every few loads a cart takes it to your stores */
    courier(e) {
      const g = this.g, p = this.p, wood = p.type === 'woodcutter', kinds = wood ? ['c_tree'] : ['c_boulder', 'c_rubble'], P = g.play;
      let best = null, bd = 32; for (const n of g.forest.nodes) { if (!kinds.includes(n.type) || !g.forest.live(n)) continue; const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = n; } }
      if (!best) return false; const dx = p.x - best.x, dz = p.z - best.z, L = Math.hypot(dx, dz) || 1, r = (best.r || 0.5) + 0.55, at = { x: best.x + dx / L * r, z: best.z + dz / L * r };
      if (!P.nav.standable(at.x, at.z)) return false; const home = this.post;
      e.go(at.x, at.z).then(() => { if (this.a) P.face(this.a, best); }).pause(4.5, 'attack').go(home.x, home.z).pause(1, 'action').then(() => {
        this.trips = (this.trips || 0) + 1; if (this.trips % 3) return;
        const eco = g.economy, to = eco.of('storehouse').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] || eco.of('market')[0];
        if (to && Math.hypot(to.x - p.x, to.z - p.z) > 3 && eco.carts.length < 12) eco.carts.push(new K.Cart(eco, p, to, wood ? 'wood' : 'stone', 0));
      });
      return true;
    }
    idle(e, dt) {
      if ((this.wanderT -= dt) > 0) return; this.wanderT = 6 + Math.random() * 8;
      if ((this.p.type === 'woodcutter' || this.p.type === 'quarry') && this.courier(e)) { this.wanderT = 1; return; }
      const p = this.post, a = Math.random() * 6.283; e.go(p.x + Math.cos(a) * 0.8, p.z + Math.sin(a) * 0.8).pause(2 + Math.random() * 3, Math.random() < 0.4 ? 'action' : 'idle'); }
    report() {
      const g = this.g, p = this.p, c = g.castle, e = g.economy, l = e.ledger(p), held = Object.entries(p.held || {}).filter(([, n]) => n >= 1).map(([r, n]) => `${Math.floor(n)} ${K.CastleData.resName(r)}`);
      const full = held.length ? `Your purse and storehouses are full, so I have ${held.join(', ')} stacked here. Build a storehouse and I will send it over.` : null;
      switch (p.type) {
        case 'farm': { const f = [...e.fields.tiles.values()].filter((t) => e.nearestFarm((t.i + 0.5) * TILE, (t.j + 0.5) * TILE) === p), ripe = f.filter((t) => e.fields.stage(t) === 2).length;
          return [f.length ? `I tend ${f.length} squares of wheat. ${ripe} are golden now.` : 'I have no fields. Pick Wheat field in the drawer and draw squares around me.', `${l.amount('wheat')} wheat is waiting in the barn. A cart takes it to the silo every 10.`, 'The bigger the field, the more wheat.']; }
        case 'coop': { const h = e.stock.herd(p), out = h.filter((b) => b.exposed).length;
          return [h.length ? `${h.length} hens, each laying an egg a minute.` : 'No hens yet. Buy them here for 5 wheat each.', `${l.amount('egg')} eggs waiting. The carts take them to the market.`, out ? `${out} of them are outside your walls. Wolves will take them.` : (h.length ? 'They are safe inside the walls.' : '')].filter(Boolean); }
        case 'barn': { const h = e.stock.herd(p), hungry = h.filter((b) => !b.fed).length;
          return [h.length ? `${h.length} cows.` : 'No cows yet. Buy them here for 10 wheat each.', hungry ? `${hungry} are hungry. They need wheat in the silo or the market.` : (h.length ? 'They are fed and giving milk.' : ''), `${l.amount('milk')} milk and ${l.amount('beef')} beef here.`].filter(Boolean); }
        case 'woodcutter': case 'quarry': { const pr = c.producesOf(p) || {}, [r, n] = Object.entries(pr)[0] || ['wood', 0];
          return [`We cut ${n} ${K.CastleData.resName(r)} a minute${p.level >= 2 ? ' (upgraded)' : ''}.`, full || `It all goes straight to your stores. You hold ${c.amount(r)} of ${c.caps()[r]}.`]; }
        case 'storehouse': { const caps = c.caps(); return [`With your storehouses you can hold ${caps.wood} wood, ${caps.stone} stone, ${caps.iron} iron and ${caps.gold} gold.`, `Right now: ${c.amount('wood')} wood, ${c.amount('stone')} stone, ${c.amount('iron')} iron.`, 'Another storehouse holds even more, and raiders take less.']; }
        case 'silo': return [`${l.amount('wheat')} of 200 wheat in the silo.`, l.amount('wheat') >= 190 ? 'Nearly full: the extra goes to the market.' : 'Wheat from the farms comes here first.'];
        case 'watchtower': return ['I shoot anything hostile within 12 m of this tower.', 'Keep the tower inside your walls and it covers the gate.'];
      }
      return ['All is well.'];
    }
  }

  /** the people in your walk-in workshops: baker, butcher, alchemist, stablehand */
  const HALL = {
    bakery: { name: 'Baker', sprite: 'witch', tint: 0xfff4e0 }, butcher: { name: 'Butcher', sprite: 'warden', tint: 0xf0d0d0 },
    library: { name: 'Alchemist', sprite: 'witch', tint: 0xc0a0f0 }, stable: { name: 'Stablehand', sprite: 'ranger', tint: 0xd8c090 },
  };
  class HallJob extends Job {
    constructor(w, type) { const h = HALL[type], look = (K.WORKER_LOOKS || {})[h.name]; super(w, { role: type, sprite: look ? look.sprite : h.sprite, name: h.name, tint: look ? look.tint : h.tint, speed: 1.4 }); this.type = type; this.made = 0; this.cool = 4; }
    get hall() { const h = this.g.halls[this.type]; return h ? h.spec : null; }
    get door() { return this.hall && doorOf(this.hall); }
    update() { const d = this.door; if (d && !this.a) { this.spawn(d); if (this.type !== 'stable') this.show(false); } else if (!d && this.a) this.despawn(); }
    /** carry what was made to the market stalls */
    deliver(e, good, n, done) { const c = this.counter, d = this.door; if (!c) return; e.then(() => this.show(true)).go(c.x, c.z).pause(1.2, 'action').then(() => { this.eco.ledger(this.market).add(good, n); this.made += n; if (done) done(); }).go(d.x, d.z).then(() => this.show(false)); }
    idle(e, dt) {
      if ((this.cool -= dt) > 0) return; const g = this.g, eco = this.eco, m = this.market, c = this.counter, d = this.door; if (!d) return;
      if (this.type === 'stable') { this.cool = 10; const a = Math.random() * 6.283; e.go(d.x + Math.cos(a) * 1.2, d.z + Math.abs(Math.sin(a)) * 1.2).pause(3, 'action'); return; }
      if (!m || !c) { this.cool = 15; return; }
      const l = eco.ledger(m);
      if (this.type === 'bakery') {
        this.cool = 12; if (l.amount('bread') >= 60) return;
        if (l.amount('wheat') < 3 && !eco.takeWheat(3, false)) return; else if (l.amount('wheat') >= 3) { e.then(() => this.show(true)).go(c.x, c.z).pause(1, 'action').then(() => this.fetch({ wheat: 3 })); } else e.then(() => this.show(true));
        e.go(d.x, d.z).then(() => this.show(false)).pause(10); this.deliver(e, 'bread', 2, () => g.cui.toast('The baker brought 2 loaves of bread to the market.')); return;
      }
      if (this.type === 'butcher') {
        this.cool = 40; const st = eco.stock, pick = eco.of('barn').map((p) => [p, st.herd(p), 2, 'cow', 6]).concat(eco.of('coop').map((p) => [p, st.herd(p), 4, 'chicken', 2])).find(([, h, keep]) => h.length > keep);
        if (!pick) return; const [p, h, , kind, meat] = pick, at = { x: p.x + Math.sin(p.rot || 0) * 2, z: p.z + Math.cos(p.rot || 0) * 2 };
        e.then(() => this.show(true)).go(at.x, at.z).pause(2, 'action').then(() => { const b = h[h.length - 1]; if (!b) return false; st.remove(b); })
          .go(d.x, d.z).then(() => this.show(false)).pause(8); this.deliver(e, 'beef', meat, () => g.cui.toast(`The butcher brought ${meat} meat from a ${kind} to the market. He keeps your breeding stock.`)); return;
      }
      if (this.type === 'library') {
        this.cool = 30; const have = ODDS.filter((r) => l.amount(r) >= 1); if (have.length < 2 || Object.keys(POTIONS).reduce((n, k) => n + l.amount(k), 0) >= 30) return;
        const need = {}; for (let i = 0; i < 3; i++) { const r = have[Math.floor(Math.random() * have.length)]; need[r] = Math.min(l.amount(r), (need[r] || 0) + 1); }
        const pot = Object.keys(POTIONS)[Math.floor(Math.random() * 4)];
        e.then(() => this.show(true)).go(c.x, c.z).pause(1, 'action').then(() => this.fetch(need)).go(d.x, d.z).then(() => this.show(false)).pause(12);
        this.deliver(e, pot, 1, () => g.cui.toast(`The alchemist brewed a ${POTIONS[pot]} from ${Object.entries(need).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', ')}. It is in the market.`));
      }
    }
    report() {
      const m = this.market, l = m ? this.eco.ledger(m) : null, eco = this.eco;
      switch (this.type) {
        case 'bakery': return [m ? `The market has ${l.amount('wheat')} wheat and ${l.amount('bread')} loaves.` : 'Without a marketplace I have no wheat and nowhere to sell.', `I have baked ${this.made} loaves so far. Three wheat makes two loaves.`, 'Bread is food you can eat; wheat on its own is not.'];
        case 'butcher': { const cows = eco.of('barn').reduce((n, p) => n + eco.stock.herd(p).length, 0), hens = eco.of('coop').reduce((n, p) => n + eco.stock.herd(p).length, 0);
          return [`You have ${cows} cows and ${hens} chickens. I keep 2 cows a barn and 4 hens a coop to breed from, and butcher the rest.`, `I have brought ${this.made} meat to the market.`, 'Your cook turns the meat into meals.']; }
        case 'library': return [m ? `The market holds ${Object.keys(POTIONS).map((k) => `${l.amount(k)} ${POTIONS[k]}s`).join(', ')}.` : 'I need a marketplace to work from.', 'I take three odds and ends from the market and brew whatever the books suggest. Drink a potion by clicking it in your purse.', 'Healing mends you, speed and strength last a minute, warmth keeps the cold off for two.'];
        case 'stable': return ['The horses are fed and saddled when you want them.', 'Walk into the stable, saddle a horse and mount up. You ride far faster on open ground.'];
      }
      return ['All is well.'];
    }
  }

  class Workers {
    constructor(game) { this.g = game; this.prices = Object.assign({}, PRICE); this.cook = new Cook(this); this.smith = new Smith(this); this.clerk = new Clerk(this); this.pubT = 2; this.pubSig = ''; this.markets = new Map(); this.hooked = false; this.keepers = new Map(); this.keepT = 0; this.halls = new Map(); this.buffs = {}; }
    get jobs() { return [this.cook, this.smith, this.clerk, ...this.keepers.values(), ...this.halls.values()]; }
    /** one keeper per workshop and farm building; they go when the building goes */
    syncKeepers() {
      const live = new Set();
      for (const p of this.g.castle.pieces) if (KEEP[p.type]) { live.add(p.uid); if (!this.keepers.has(p.uid)) this.keepers.set(p.uid, new Keeper(this, p)); }
      for (const [uid, k] of this.keepers) if (!live.has(uid)) { k.despawn(); this.keepers.delete(uid); }
    }
    /** talk to someone: they tell you how it is going */
    talk(a) {
      const j = this.jobs.find((x) => x.a === a); if (!j) return; const lines = j.report();
      this.g.cui.modal(`<h2>${j.opts.name}</h2>${lines.map((t) => `<p>${t}</p>`).join('')}`, [{ label: 'Thanks', pri: true }]);
      if (j.a) { j.a.path = null; this.g.play.face(j.a, this.g.play.me); }
    }
    update(dt) {
      if ((this.keepT -= dt) <= 0) { this.keepT = 2; this.syncKeepers(); for (const t of Object.keys(this.g.halls || {})) if (HALL[t] && !this.halls.has(t)) this.halls.set(t, new HallJob(this, t)); }
      for (const j of this.jobs) j.update(dt);
      const mp = this.g.mp; if (!mp) return; if (!this.hooked) this.hook(mp);
      if ((this.pubT -= dt) <= 0) { this.pubT = 5; this.publish(); }
    }
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
    dispose() { for (const j of this.jobs) j.despawn(); }
  }

  Object.assign(K, { Workers, Errands, MEALS, MARKET_PRICES: PRICE, POTIONS });
})(typeof window !== 'undefined' ? window : globalThis);
