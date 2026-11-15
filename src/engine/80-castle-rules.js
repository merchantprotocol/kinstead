/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Castle mode rules: the economy, Castle Level, payback, crafting, raid losses, the day/dusk
   cycle, the Hearthbook and the save format. Plain data + logic (no DOM, no THREE), so the same code
   runs in the game and in `node --test`. Every number comes from game-data-castle.json (K.CASTLE_DATA). */
(function (G) {
  const K = (G.K = G.K || {});
  const RES = ['wood', 'stone', 'dirt', 'food', 'arrow', 'iron', 'gold', 'ember_shard'];
  const KEY_ITEMS = ['troll_heart'];

  /* ---------- the data, with lookups and the one item vocabulary ---------- */
  class CastleData {
    constructor(raw) {
      if (!raw) throw new Error('Castle data missing');
      this.raw = raw; this.pieces = raw.castlePieces; this.keepUpgrade = raw.keepUpgrade;
      this.clTable = raw.castleLevel.table; this.thresholds = raw.castleLevel.thresholds;
      this.resources = RES.slice(); this.keyItems = KEY_ITEMS.slice();
      this.alias = CastleData.buildAlias(raw);
    }
    /* every old id the engine used (log, ore, coins, sword…) -> the castle id */
    static buildAlias(raw) {
      const a = Object.assign({}, raw.itemAliases || {});
      for (const r of Object.values(raw.resources || {})) for (const old of r.existingIds || []) if (old !== r.id) a[old] = r.id;
      for (const it of Object.values(raw.items || {})) for (const old of it.existingIds || []) if (old !== it.id && !a[old]) a[old] = it.id;
      return a;
    }
    canon(id) { return this.alias[id] || id; }
    piece(id) { return id === this.keepUpgrade.id ? Object.assign({ category: 'keep upgrade', castlePoints: 0 }, this.keepUpgrade) : this.pieces[id] || null; }
    pieceIds() { return Object.keys(this.pieces); }
    /* CL table row; CL 0 (unlit keep) uses CL 1 hero stats but no glow */
    row(cl) { const r = this.clTable.find((x) => x.CL === Math.max(1, cl)) || this.clTable[0]; return cl <= 0 ? Object.assign({}, r, { glowRadiusM: 0, thawDps: 0 }) : r; }
    recipe(id) { return this.raw.recipes.find((r) => r.id === id) || null; }
    recipeFor(itemId) { return this.raw.recipes.find((r) => r.outputs[itemId]) || null; }
    item(id) { return this.raw.items[this.canon(id)] || null; }
    enemy(id) { return this.raw.enemies.find((e) => e.id === id) || null; }
    node(id) { return this.raw.harvestNodes.find((n) => n.id === id) || null; }
    valueSec(r) { const x = this.raw.resources[r]; return x && x.valueSec ? x.valueSec : 0; }
    hero(id) { return this.raw.heroes.roster.find((h) => h.id === id) || null; }
    get swingSec() { return this.raw.combat.swingSec; }
  }

  /* ---------- costs ---------- */
  class Cost {
    static value(cost, data) { let s = 0; for (const [r, n] of Object.entries(cost || {})) s += n * data.valueSec(r); return s; }
    static scale(cost, frac) { const o = {}; for (const [r, n] of Object.entries(cost || {})) o[r] = Math.max(1, Math.ceil(n * frac)); return o; }
    static discount(cost, pct) { const o = {}; for (const [r, n] of Object.entries(cost || {})) o[r] = Math.ceil(n * (100 - pct) / 100); return o; }
    static isEmpty(cost) { return !cost || !Object.values(cost).some((n) => n > 0); }
  }

  /* payback minutes = value of what you pay / value of what it makes per minute */
  class Payback {
    constructor(data) { this.data = data; }
    minutes(cost, perMin) { const out = Cost.value(perMin, this.data); return out > 0 ? Cost.value(cost, this.data) / out : null; }
    /* "+6 wood/min · pays for itself in 1.7 min" */
    line(cost, perMin) {
      const m = this.minutes(cost, perMin); if (m == null) return '';
      const gain = Object.entries(perMin).map(([r, n]) => `+${n} ${CastleData.resName(r)}/min`).join(' · ');
      return `${gain} · pays for itself in ${m.toFixed(1)} min`;
    }
  }
  CastleData.NAMES = { wood: 'wood', stone: 'stone', dirt: 'dirt', food: 'food', arrow: 'arrows', iron: 'iron', gold: 'gold', ember_shard: 'ember', troll_heart: "troll's heart" };
  CastleData.resName = (r) => CastleData.NAMES[r] || r;

  /* ---------- the castle: pieces, stores, Castle Level, production, crafting, raid losses ---------- */
  class Castle {
    constructor(data) {
      this.data = data; this.payback = new Payback(data);
      this.stores = {}; for (const r of RES.concat(KEY_ITEMS)) this.stores[r] = 0;
      this.pieces = []; this.nextUid = 1; this.lit = false; this.hearthCap = 0;
      this.ruins = {}; for (const r of data.raw.ruins) this.ruins[r.id] = false;
      this.kin = new Set(); this.weapons = new Set(); this.flags = new Set(); this.t = 0;
    }
    /* ---- Castle Level ---- */
    builtTypes() { const s = new Set(this.pieces.map((p) => p.type)); if (this.lit) s.add('keep'); return s; }
    has(type) { return this.builtTypes().has(type) || !!(this.extraHas && this.extraHas(type)); }   // extraHas: things built outside the piece list (the blacksmith building)
    count(type) { return this.pieces.filter((p) => p.type === type).length; }
    score() { let s = 0; for (const t of this.builtTypes()) { const p = this.data.piece(t); s += p ? p.castlePoints || 0 : 0; } return s; }
    cl() {
      if (!this.lit) return 0;
      const s = this.score(); let best = 1;
      for (const [lv, need] of Object.entries(this.data.thresholds)) if (s >= need && +lv <= this.hearthCap) best = Math.max(best, +lv);
      return Math.min(best, this.hearthCap);
    }
    /* the next CL and how many points it needs (null at the hearth cap) */
    nextLevel() {
      const cl = this.cl(); if (cl >= 5) return null;
      if (cl >= this.hearthCap) return { cl: cl + 1, capped: true };
      const need = this.data.thresholds[cl + 1]; return { cl: cl + 1, need, have: this.score(), capped: false };
    }
    row() { return this.data.row(this.cl()); }
    glowRadius() { return this.row().glowRadiusM; }
    /* ---- storage ---- */
    storehouses() { return this.pieces.filter((p) => p.type === 'storehouse'); }
    caps() {
      const c = Object.assign({}, this.data.raw.storage.base), sh = this.data.pieces.storehouse;
      for (const p of this.storehouses()) { const add = p.level >= 2 ? sh.levels[0].storageCap : sh.storageCap; for (const [r, n] of Object.entries(add)) c[r] = (c[r] || 0) + n; }
      return c;
    }
    protectPct() { const sh = this.data.pieces.storehouse; let pct = 0; for (const p of this.storehouses()) pct = Math.max(pct, p.level >= 2 ? sh.levels[0].protectsPct : sh.protectsPct); return pct; }
    /* add to stores, clipped at the cap; returns how much went in */
    add(r, n) {
      if (n <= 0) return 0;
      if (KEY_ITEMS.includes(r)) { this.stores[r] += n; return n; }
      const cap = this.caps()[r]; if (cap == null) return 0;
      const before = this.stores[r]; this.stores[r] = Math.min(cap, before + n); return this.stores[r] - before;
    }
    amount(r) { return Math.floor(this.stores[r] + 1e-9); }
    canAfford(cost) { for (const [r, n] of Object.entries(cost || {})) if (this.amount(r) < n) return false; return true; }
    missing(cost) { const o = {}; for (const [r, n] of Object.entries(cost || {})) if (this.amount(r) < n) o[r] = n - this.amount(r); return o; }
    spend(cost) { if (!this.canAfford(cost)) return false; for (const [r, n] of Object.entries(cost || {})) this.stores[r] = Math.max(0, this.stores[r] - n); return true; }
    /* ---- production ---- */
    producesOf(p) { const d = this.data.piece(p.type); if (!d || !d.produces) return null; return p.level >= 2 && d.levels ? d.levels[0].produces : d.produces; }
    isFrosted(p) { return !!p.frosted || (p.frostedUntil || 0) > this.t; }
    producers() { return this.pieces.filter((p) => this.producesOf(p)); }
    rates() {
      const r = {};
      for (const p of this.producers()) { if (this.isFrosted(p)) continue; for (const [k, n] of Object.entries(this.producesOf(p))) r[k] = (r[k] || 0) + n; }
      return r;
    }
    isFull(p) { const pr = this.producesOf(p), caps = this.caps(); return !!pr && Object.keys(pr).every((r) => this.stores[r] >= caps[r] - 1e-9); }
    /* advance production by dt seconds; returns { gains: {r: n}, ticks: [{piece, r, n}] } where ticks are whole-unit pops */
    tick(dt) {
      this.t += dt; const gains = {}, ticks = [];
      for (const p of this.producers()) {
        if (this.isFrosted(p)) continue;
        p.acc = p.acc || {};
        for (const [r, perMin] of Object.entries(this.producesOf(p))) {
          const got = this.add(r, perMin * dt / 60); gains[r] = (gains[r] || 0) + got;
          p.acc[r] = (p.acc[r] || 0) + got;
          if (p.acc[r] >= 1) { const n = Math.floor(p.acc[r]); p.acc[r] -= n; ticks.push({ piece: p, r, n }); }
        }
      }
      return { gains, ticks };
    }
    /* ---- gathering: node yield + CL gather bonus + kin perks ---- */
    gatherYield(r, base) {
      let n = base + this.row().gatherBonus;
      if (r === 'wood' && this.kin.has('pinewarden')) n += 1;
      if (r === 'stone' && this.kin.has('rime_brute')) n += 1;
      return n;
    }
    gather(r, base) { return this.add(r, this.gatherYield(r, base)); }
    /* ---- building ---- */
    isRuinType(type) { return Object.prototype.hasOwnProperty.call(this.ruins, type) && type !== 'keep'; }
    ruinOpen(type) { return this.isRuinType(type) && !this.ruins[type]; }
    buildCost(type, { ruin = false } = {}) {
      const d = this.data.piece(type); if (!d) return null;
      return ruin ? Cost.scale(d.cost, this.data.raw.ruinRules.repairCostFraction) : Object.assign({}, d.cost);
    }
    zoneOpen(z) { return z === 'castle_hill' || this.flags.has('zone:' + z); }
    /* why a piece can't be built right now (null = it can) */
    blocker(type, { ruin = false, ignoreCost = false } = {}) {
      const d = this.data.piece(type); if (!d) return 'unknown piece';
      if (type === 'keep') return 'the Keep is lit from its hearth';
      if (type === this.data.keepUpgrade.id && this.has(type)) return 'already bound';
      if (Math.max(1, this.cl()) < d.requiresCastleLevel) return `needs Castle Level ${d.requiresCastleLevel}`;   // an unlit Keep still counts as level 1: you can build from the start
      for (const req of d.buildRequires || []) if (!this.has(req)) return `needs a ${this.data.piece(req).name}`;
      if (d.requiresZone && !this.zoneOpen(d.requiresZone)) return 'the Iron Hills are still frozen';
      if (ruin && !this.ruinOpen(type)) return 'already restored';
      if (!ignoreCost && !this.canAfford(this.buildCost(type, { ruin }))) return 'not enough resources';
      return null;
    }
    /* ---- taking down: half of what it cost comes back (restored ruins stay standing) ---- */
    canDemolish(p) { return !!p && !this.ruins[p.type] && this.pieces.includes(p); }
    refundFor(p) {
      const half = (cost) => { const o = {}; for (const [r, n] of Object.entries(cost || {})) { const h = Math.floor(n / 2); if (h > 0) o[r] = h; } return o; };
      const out = half(this.buildCost(p.type));
      if (p.level >= 2) for (const [r, n] of Object.entries(half(this.upgradeCost(p)))) out[r] = (out[r] || 0) + n;
      return out;
    }
    demolish(p) { if (!this.canDemolish(p)) return { ok: false }; const refund = this.refundFor(p); this.pieces.splice(this.pieces.indexOf(p), 1); return { ok: true, refund }; }
    build(type, at = {}, { ruin = false } = {}) {
      const why = this.blocker(type, { ruin }); if (why) return { ok: false, why };
      this.spend(this.buildCost(type, { ruin }));
      if (type === this.data.keepUpgrade.id) { this.hearthCap = this.data.keepUpgrade.hearthCap; this.flags.add('built:' + type); return { ok: true, piece: null }; }
      const d = this.data.piece(type);
      const p = { uid: this.nextUid++, type, level: 1, x: at.x || 0, z: at.z || 0, rot: at.rot || 0, hp: d.hp || 100, ruin: !!ruin };
      this.pieces.push(p); if (ruin) this.ruins[type] = true;
      return { ok: true, piece: p };
    }
    /* the Keep: lit for free with the ember lantern */
    light() { if (this.lit) return false; this.lit = true; this.hearthCap = this.data.pieces.keep.hearthCap; this.ruins.keep = true; return true; }
    /* ---- Level 2 upgrades (Smithy: 25% off) ---- */
    upgradeInfo(p) { const d = this.data.piece(p.type); return d && d.levels && p.level < 2 ? d.levels[0] : null; }
    upgradeCost(p) {
      const lv = this.upgradeInfo(p); if (!lv) return null;
      return this.has('smithy') ? Cost.discount(lv.cost, this.data.pieces.smithy.upgradeDiscountPct) : Object.assign({}, lv.cost);
    }
    upgradeBlocker(p, ignoreCost) {
      const lv = this.upgradeInfo(p); if (!lv) return 'no upgrade';
      if (this.cl() < lv.requiresCastleLevel) return `needs Castle Level ${lv.requiresCastleLevel}`;
      if (!ignoreCost && !this.canAfford(this.upgradeCost(p))) return 'not enough resources';
      return null;
    }
    upgrade(p) { const why = this.upgradeBlocker(p); if (why) return { ok: false, why }; this.spend(this.upgradeCost(p)); p.level = 2; this.flags.add('upgraded:' + p.type); return { ok: true }; }
    /* ---- payback for the Build card ---- */
    paybackFor(type, { ruin = false } = {}) { const d = this.data.piece(type); return d && d.produces ? this.payback.minutes(this.buildCost(type, { ruin }), d.produces) : null; }
    upgradePayback(p) {
      const lv = this.upgradeInfo(p), base = this.producesOf(p); if (!lv || !lv.produces || !base) return null;
      const gain = {}; for (const [r, n] of Object.entries(lv.produces)) gain[r] = n - (base[r] || 0);
      return this.payback.minutes(this.upgradeCost(p), gain);
    }
    /* ---- crafting: one bag (the stores) ---- */
    stationReady(station) { return station === 'keep' ? this.lit : this.has(station); }
    craftBlocker(recipeId) {
      const r = this.data.recipe(recipeId); if (!r) return 'unknown recipe';
      if (!this.stationReady(r.station)) return `needs a ${(this.data.piece(r.station) || {}).name || r.station}`;
      for (const out of Object.keys(r.outputs)) if (this.weapons.has(out)) return 'already forged';
      if (!this.canAfford(r.inputs)) return 'not enough resources';
      return null;
    }
    craft(recipeId) {
      const why = this.craftBlocker(recipeId); if (why) return { ok: false, why };
      const r = this.data.recipe(recipeId); this.spend(r.inputs);
      for (const out of Object.keys(r.outputs)) this.weapons.add(out);
      return { ok: true, items: Object.keys(r.outputs) };
    }
    bestWeapon() { let best = null; for (const id of this.weapons) { const it = this.data.item(id); if (it && (!best || it.tier > best.tier)) best = it; } return best; }
    /* ---- the hero: level = Castle Level + best weapon ---- */
    heroStats() {
      const row = this.row(), w = this.bestWeapon(), wAtk = w ? w.atk : this.data.raw.combat.bareHandsAtk;
      return { hpMax: row.heroMaxHP, atk: wAtk + row.heroAtkBonus, weapon: w ? w.id : null, power: Math.floor(row.heroMaxHP / 10) + (w ? w.atk : 0) + row.heroAtkBonus };
    }
    keepHpMax() { return this.row().keepHP; }
    /* ---- raids: a lost night costs 10% of UNPROTECTED stores; buildings are never touched ---- */
    raidLoss() {
      const pct = this.data.raw.aiRaids.lossPctOfUnprotected, prot = this.protectPct(), lost = {};
      for (const r of RES) {
        const have = this.amount(r), unprotected = have - Math.floor(have * prot / 100), n = Math.floor(unprotected * pct / 100);
        if (n > 0) { this.stores[r] -= n; lost[r] = n; }
      }
      return lost;
    }
    /* raider touched a producer outside the walls: no production until dawn + 60 s */
    frost(p) { if (!this.producesOf(p) || p.frosted) return false; p.frosted = true; return true; }
    thawAtDawn() { const sec = 60; for (const p of this.pieces) if (p.frosted) { p.frosted = false; p.frostedUntil = this.t + sec; } }
    /* ---- the Hearthbook ---- */
    hearthbook() {
      const S = this.data.raw.hearthbook.sections, built = this.builtTypes(), out = [];
      const ticked = (sec, id) => {
        if (sec === 'Castle') return id === this.data.keepUpgrade.id ? this.hearthCap >= 5 : built.has(id);
        if (sec === 'Upgrades') return this.pieces.some((p) => p.type + '_lv2' === id && p.level >= 2);
        if (sec === 'Ruins restored') return !!this.ruins[id];
        if (sec === 'Kin') return this.kin.has(id);
        if (sec === 'Arms') return this.weapons.has(id);
        if (sec === 'Frost pushed back') return this.flags.has(id === 'rime_troll' ? 'killed:rime_troll' : 'survived:' + id);
        return false;
      };
      let done = 0, total = 0;
      for (const [sec, ids] of Object.entries(S)) {
        const rows = ids.map((id) => ({ id, done: ticked(sec, id) })); done += rows.filter((r) => r.done).length; total += rows.length;
        out.push({ section: sec, rows });
      }
      return { sections: out, done, total, pct: total ? Math.round(100 * done / total) : 0 };
    }
    /* ---- objectives: always the first three unfinished, the first one glowing ---- */
    objectiveDone(o) {
      const [verb, what] = o.doneWhen.split(' ');
      if (verb === 'lit') return this.lit;
      if (verb === 'built') return what === this.data.keepUpgrade.id ? this.hearthCap >= 5 : this.has(what);
      if (verb === 'crafted') return this.weapons.has(what);
      if (verb === 'survived') return this.flags.has('survived:' + what) || this.flags.has('ended:' + what);
      if (verb === 'killed') return this.flags.has('killed:' + what);
      return false;
    }
    objectives() { return this.data.raw.objectives.map((o) => Object.assign({ done: this.objectiveDone(o) }, o)); }
    currentGoals(n = 3) { return this.objectives().filter((o) => !o.done).slice(0, n); }   // goals met early drop out of the list
    /* ---- save ---- */
    toJSON() {
      return { v: 1, stores: Object.assign({}, this.stores), pieces: this.pieces.map((p) => ({ uid: p.uid, type: p.type, level: p.level, x: +p.x.toFixed(3), z: +p.z.toFixed(3), rot: +(p.rot || 0).toFixed(3), hp: p.hp, ruin: !!p.ruin, frosted: !!p.frosted, frostedUntil: p.frostedUntil || 0 })),
        nextUid: this.nextUid, lit: this.lit, hearthCap: this.hearthCap, ruins: Object.assign({}, this.ruins), kin: [...this.kin], weapons: [...this.weapons], flags: [...this.flags], t: +this.t.toFixed(2) };
    }
    static fromJSON(data, o) {
      const c = new Castle(data); if (!o || o.v !== 1) return c;
      Object.assign(c.stores, o.stores || {}); c.pieces = (o.pieces || []).filter((p) => data.piece(p.type)).map((p) => Object.assign({}, p));
      c.nextUid = o.nextUid || c.pieces.reduce((m, p) => Math.max(m, p.uid + 1), 1); c.lit = !!o.lit; c.hearthCap = o.hearthCap || 0;
      Object.assign(c.ruins, o.ruins || {}); c.kin = new Set(o.kin || []); c.weapons = new Set(o.weapons || []); c.flags = new Set(o.flags || []); c.t = o.t || 0;
      return c;
    }
  }

  /* ---------- day / dusk cycle ---------- */
  class DayCycle {
    constructor(data, state) {
      this.data = data; this.phases = data.raw.dayNight.phases; this.warnSec = 30; this.retrySec = 90;
      Object.assign(this, { idx: 0, t: 0, override: null, warned: false }, state || {});
    }
    get phase() { return this.phases[this.idx]; }
    get kind() { return this.phase.kind; }
    get isNight() { return this.kind === 'night'; }
    length() { return this.override != null ? this.override : this.phase.sec; }
    remaining() { const L = this.length(); return L == null ? null : Math.max(0, L - this.t); }
    /* advance; returns a list of events: {type:'warn'|'dusk'|'dawn', phase} */
    tick(dt) {
      const ev = []; const L = this.length(); this.t += dt;
      if (L == null) return ev;
      if (this.kind === 'day' && !this.warned && L - this.t <= this.warnSec && this.idx + 1 < this.phases.length) { this.warned = true; ev.push({ type: 'warn', phase: this.phases[this.idx + 1] }); }
      if (this.t >= L) ev.push(this.advance());
      return ev;
    }
    advance(opts = {}) {
      const was = this.phase; if (this.idx + 1 >= this.phases.length) return { type: 'end', phase: was };
      this.idx++; this.t = 0; this.warned = false; this.override = null;
      if (this.kind === 'day' && opts.lost) this.override = this.retrySec;
      return { type: this.isNight ? 'dusk' : 'dawn', phase: this.phase, from: was };
    }
    /* the Keep bell: dusk now */
    ringBell() { if (this.kind !== 'day' || this.length() == null || this.idx + 1 >= this.phases.length) return null; return this.advance(); }
    toJSON() { return { idx: this.idx, t: +this.t.toFixed(2), override: this.override, warned: this.warned }; }
  }

  /* ---------- the save slot (localStorage-like store injected, so tests use a Map) ---------- */
  class CastleSave {
    constructor(storage, key = CastleSave.KEY) { this.storage = storage; this.key = key; }
    write(snapshot) { try { this.storage.setItem(this.key, JSON.stringify(Object.assign({ savedAt: Date.now() }, snapshot))); return true; } catch (e) { return false; } }
    read() { try { const s = this.storage.getItem(this.key); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
    clear() { try { this.storage.removeItem(this.key); } catch (e) { /* blocked */ } }
    exists() { return !!this.read(); }
  }
  CastleSave.KEY = 'kinstead.castle.v1';
  /* the browser's localStorage, or an in-memory stand-in where it is blocked (data: URLs, private modes) */
  CastleSave.defaultStorage = () => {
    try { const s = G.localStorage; s.getItem(CastleSave.KEY); return s; } catch (e) { /* blocked */ }
    if (!G.__kinsteadMemStore) { const m = new Map(); G.__kinsteadMemStore = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
    return G.__kinsteadMemStore;
  };

  Object.assign(K, { CastleData, CastleCost: Cost, Payback, Castle, DayCycle, CastleSave, CASTLE_RES: RES });
})(typeof window !== 'undefined' ? window : globalThis);
