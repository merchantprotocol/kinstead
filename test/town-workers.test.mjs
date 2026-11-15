/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* The busy town: walkable workshop floors, bedtime (bunkhouse, cottage or the fire), carts that only move with a worker
   on the handles and deliver exactly their load, and trades that keep producing while their worker is busy.
   Runs the real engine modules in a Node VM context with a tiny stand-in for the game around them. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'engine');

/** the engine modules under test, loaded into one sandbox with stand-ins for THREE and VoxKit */
class TownSandbox {
  constructor() {
    class Group { constructor() { this.children = []; this.position = { set() {} }; this.rotation = {}; } add(c) { this.children.push(c); } remove() {} }
    class VoxKit { box() {} geo() {} meshes() { return []; } }
    VoxKit.CYL = {}; VoxKit.CYL8 = {};
    const K = { TILE: 0.5, VoxKit, CastleArt: { size: (t) => ({ farm: [3, 2.5], silo: [1.6, 1.6], market: [1, 1], coop: [1.6, 1.4] }[t] || [2, 2]) } };
    this.ctx = vm.createContext({ console, Math, Object, Map, Set, JSON, K, THREE: { Group } });
    this.ctx.globalThis = this.ctx; this.ctx.window = this.ctx;
    for (const f of ['82e-workshop-layout.js', '120d-work-spots.js', '120c-work-errands.js', '119a-castle-cart.js', '120e-worker-job.js',
      '120g-worker-cook.js', '120n-town-night.js', '120p-haulage.js']) vm.runInContext(fs.readFileSync(path.join(ENGINE, f), 'utf8'), this.ctx, { filename: f });
  }
  get K() { return this.ctx.K; }
}

/** a ledger like the economy's: amounts with a cap */
class FakeLedger {
  constructor(cap = 999) { this.goods = {}; this.cap = cap; }
  amount(g) { return this.goods[g] || 0; }
  total() { return Object.values(this.goods).reduce((a, b) => a + b, 0); }
  add(g, n) { const k = Math.min(n, this.cap - this.total()); if (k > 0) this.goods[g] = this.amount(g) + k; return Math.max(0, k); }
  take(g, n) { const k = Math.min(n, this.amount(g)); this.goods[g] = this.amount(g) - k; return k; }
}

/** just enough of the castle game for workers, carts and bedtime */
class FakeTown {
  constructor(K) {
    this.ledgers = new Map(); this.carts = []; const self = this;
    this.g = {
      halls: {}, home: { built: false }, L: { keep: { x: 50, z: 50, r: 2 } }, isNightish: () => this.night,
      play: { nav: { standable: () => true, y: () => 0 }, face() {} }, group: { add() {}, remove() {} }, R: { bmats: {} },
      economy: { carts: this.carts, ledger: (p) => self.ledger(p), of: () => [] },
    };
    this.g.economy.g = this.g;
    this.night = false; this.workers = { g: this.g, jobs: [], keepers: new Map(), night: null, say() {}, later() {} };
    this.workers.night = new K.TownNight(this.workers); this.workers.haulage = new K.Haulage(this.workers);
  }
  ledger(p) { if (!this.ledgers.has(p.uid)) this.ledgers.set(p.uid, new FakeLedger(p.cap)); return this.ledgers.get(p.uid); }
  /** a worker standing somewhere, with a view that records what it is told */
  actor(x, z) { return { x, z, hidden: false, view: { setVisible(v) { this.visible = v; }, carry: null, haul: false } }; }
}

/** runs the logic steps an Errands list queued (walking is instant here) */
const runSteps = (e) => { for (const s of e.steps) { if (s.go) { e.a.x = s.go.x; e.a.z = s.go.z; } if (s.fn) s.fn(); } e.steps = []; };

test('workshop floors: the mill floor and the woodcutter yard are walkable, the warehouse and the cabin are not', () => {   // risk: collision / getting stuck
  const { K } = new TownSandbox(), L = K.WorkshopLayout;
  assert.equal(L.solidAt('storehouse', 1.0, 0.5), false, 'standing in the mill, in front of the millstones');
  assert.equal(L.solidAt('storehouse', -1.0, -0.4), true, 'inside the warehouse walls');
  assert.equal(L.solidAt('storehouse', 1.45, -0.45), true, 'on the millstones themselves');
  assert.equal(L.solidAt('woodcutter', 0.3, 0.9), false, 'the chopping yard under the shed');
  assert.equal(L.solidAt('woodcutter', -0.45, -0.45), true, 'the log cabin');
  assert.equal(L.solidAt('chapel', 0, 0), true, 'a building with no layout is solid all over');
  assert.equal(L.solids('chapel'), null);
});

test('bedtime: workers sleep in the bunkhouse, else the cottage, else huddle at the Keep fire', () => {   // risk: workers stranded outside at night
  const { K } = new TownSandbox(), town = new FakeTown(K), job = { a: null };
  town.workers.jobs.push(job);
  assert.equal(town.workers.night.bed(job).kind, 'fire');
  town.g.home = { built: true, doorPoint: { x: 10, z: 12 }, center: { x: 10, z: 10 } };
  assert.equal(town.workers.night.bed(job).kind, 'cottage');
  town.g.halls.bunkhouse = { spec: { x: 40, z: 40, footprint: { w: 12, h: 8 }, doors: [{ x: 5, z: 7, side: 's', w: 2 }], furniture: [] } };
  const bed = town.workers.night.bed(job);
  assert.equal(bed.kind, 'bunkhouse');
  assert.deepEqual([bed.door.x, bed.door.z], [(40 + 5 + 1) * 0.5, (40 + 7 + 1.8) * 0.5]);
});

test('bedtime: a worker walks into the bunkhouse and is hidden asleep; at dawn they come back out of its door', () => {   // risk: workers vanish or never wake
  const { K } = new TownSandbox(), town = new FakeTown(K);
  town.g.halls.bunkhouse = { spec: { x: 40, z: 40, footprint: { w: 12, h: 8 }, doors: [{ x: 5, z: 7, side: 's', w: 2 }], furniture: [] } };
  const job = new K.WorkerJob(town.workers, { role: 'test', name: 'Test' }); job.a = town.actor(0, 0); town.workers.jobs.push(job);
  const e = new K.Errands(town.g, job.a, job);
  town.night = true; job.next(e, 0.05); runSteps(e);
  assert.equal(job.asleep, true); assert.equal(job.a.hidden, true);
  job.next(e, 0.05); assert.equal(e.steps.length, 0, 'asleep: nothing more to do until dawn');
  town.night = false; job.next(e, 0.05); runSteps(e);
  assert.equal(job.asleep, false); assert.equal(job.a.hidden, false);
  const door = K.WorkSpots.door(town.g.halls.bunkhouse.spec); assert.deepEqual([job.a.x, job.a.z], [door.x, door.z]);
});

test('carts: a loaded cart waits parked until a worker takes it, and delivers exactly its load (the overflow goes back)', () => {   // risk: goods lost or duplicated
  const { K } = new TownSandbox(), town = new FakeTown(K), eco = town.g.economy;
  const farm = { uid: 1, type: 'farm', x: 10, z: 10, rot: 0 }, silo = { uid: 2, type: 'silo', x: 30, z: 10, rot: 0, cap: 6 };
  const cart = new K.Cart(eco, farm, silo, 'wheat', 10), park = cart.route.park;
  for (let i = 0; i < 50; i++) cart.update(0.1);
  assert.deepEqual([cart.x, cart.z], [park.x, park.z], 'nobody on the handles: it does not move');
  const a = town.actor(cart.handles.x, cart.handles.z); cart.take(a); a.x += 5; cart.update(0.1);
  assert.ok(Math.hypot(cart.x - a.x, cart.z - a.z) < 1.0, 'it trails right behind the worker pulling it');
  assert.equal(a.view.haul, true);
  cart.unload();
  assert.equal(town.ledger(silo).amount('wheat'), 6, 'the silo takes what fits');
  assert.equal(town.ledger(farm).amount('wheat'), 4, 'the rest goes back to the farm');
  cart.unload(); assert.equal(town.ledger(silo).amount('wheat'), 6, 'unloading twice delivers nothing more');
  cart.finish(); assert.equal(cart.update(0.1), false); assert.equal(a.view.haul, false);
});

test('haulage: a keeper only takes carts from their own building; the clerk takes carts from buildings with no keeper; never twice', () => {   // risk: duplicate deliveries
  const { K } = new TownSandbox(), town = new FakeTown(K), eco = town.g.economy;
  const farm = { uid: 1, type: 'farm', x: 10, z: 10 }, coop = { uid: 3, type: 'coop', x: 20, z: 10 }, market = { uid: 4, type: 'market', x: 40, z: 10 };
  eco.carts.push(new K.Cart(eco, coop, market, 'egg', 10));
  const farmer = { p: farm, a: town.actor(10, 12) }; town.workers.keepers.set(farm.uid, farmer);
  const e1 = new K.Errands(town.g, farmer.a, farmer);
  assert.equal(town.workers.haulage.take(farmer, e1), false, 'the coop cart is not the farmer’s');
  eco.carts.push(new K.Cart(eco, farm, market, 'wheat', 10));
  assert.equal(town.workers.haulage.take(farmer, e1), true);
  assert.equal(town.workers.haulage.take(farmer, new K.Errands(town.g, farmer.a, farmer)), false, 'already booked');
  const clerk = { a: town.actor(40, 12), w: town.workers }, e2 = new K.Errands(town.g, clerk.a, clerk);
  assert.equal(town.workers.haulage.takeOrphan(clerk, e2), true, 'the clerk fetches the coop’s eggs');
  runSteps(e2);
  assert.equal(town.ledger(market).amount('egg'), 10); assert.equal(eco.carts[0].done, true);
});

test('trades keep producing while their worker is busy: the cook’s cooldown runs down every frame, not only when idle', () => {   // risk: economy stalls (regression)
  const { K } = new TownSandbox(), town = new FakeTown(K), market = { uid: 9, type: 'market', x: 0, z: 0 };
  K.MEALS = [{ id: 'bread', name: 'bread', need: { wheat: 3 } }];
  town.g.economy.of = (t) => (t === 'market' ? [market] : []); town.g.purse = { hearth: { tray: [] } };
  town.ledger(market).add('wheat', 9);
  const cook = new K.Cook(town.workers); cook.cool = 6;
  for (let i = 0; i < 119; i++) cook.tick(0.05);   // 5.95 s of a busy day: still cooling down
  assert.equal(cook.mealToCook(0.05), null);
  cook.tick(0.05); cook.tick(0.05);
  assert.equal(cook.mealToCook(0.05).id, 'bread', 'the next meal is due even though idle() was never called meanwhile');
});
