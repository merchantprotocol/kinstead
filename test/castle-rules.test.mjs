/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Castle mode business rules: economy tick + caps, payback, Castle Level gates, raid losses,
   recipe consumption and the save round trip. Runs the real engine module in a Node VM context. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/game-data-castle.json'), 'utf8'));

function engine() {
  const sb = { console, Math, Date, JSON, Object, Set, Map };
  sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/engine/80-castle-rules.js'), 'utf8'), sb, { filename: '80-castle-rules.js' });
  return sb.K;
}
const K = engine();
const data = () => new K.CastleData(RAW);
const fresh = () => { const c = new K.Castle(data()); c.extraHas = (t) => t === 'cottage'; c.light(); return c; };   // the cottage is built outside the piece list: tests start with it standing
const give = (c, o) => { for (const [r, n] of Object.entries(o)) c.stores[r] = n; };

test('economy: a Woodcutter makes 15 wood a minute; at the cap it stacks what it makes and hands it over when there is room', () => {   // risk: core economy
  const c = fresh(); give(c, { wood: 30, stone: 10 });
  assert.equal(c.build('woodcutter', { x: 1, z: 1 }).ok, true);
  assert.equal(c.amount('wood'), 0);
  for (let i = 0; i < 600; i++) c.tick(0.1);                       // 60 s
  assert.equal(c.amount('wood'), 15);
  c.stores.wood = 150; for (let i = 0; i < 600; i++) c.tick(0.1);
  assert.equal(c.amount('wood'), 160, 'clipped at the base cap of 160');
  assert.equal(c.isFull(c.pieces[0]), true);
  assert.ok(Math.round(c.pieces[0].held.wood) === 5, 'the 5 that did not fit wait at the woodcutter');
  c.stores.wood = 100; c.tick(0.1); assert.ok(c.amount('wood') > 100 && c.pieces[0].held.wood < 5, 'room again: the stack goes in');
});

test('cost: every extra building of a kind costs 1.6x the last; walls never get dearer; selling refunds half of what that one cost', () => {   // risk: money
  const c = fresh(); give(c, { wood: 500, stone: 500 });
  assert.deepEqual({ ...c.buildCost('woodcutter') }, { wood: 30, stone: 10 }); c.build('woodcutter');
  assert.deepEqual({ ...c.buildCost('woodcutter') }, { wood: 48, stone: 16 }); c.build('woodcutter');
  assert.deepEqual({ ...c.buildCost('palisade') }, { wood: 2 }); c.build('palisade'); assert.deepEqual({ ...c.buildCost('palisade') }, { wood: 2 });
  assert.deepEqual({ ...c.refundFor(c.pieces[1]) }, { wood: 24, stone: 8 }, 'the second woodcutter cost 48/16');
});

test('economy: a Storehouse raises caps; a frosted producer makes nothing until dawn + 60 s', () => {   // risk: core economy
  const c = fresh(); c.hearthCap = 4; give(c, { wood: 300, stone: 300 });
  c.build('gatehouse'); c.build('woodcutter');                     // 8 points -> CL2 unlocks the Storehouse
  assert.equal(c.cl(), 2);
  assert.equal(c.build('storehouse').ok, false, 'a Storehouse needs a Quarry first'); c.build('quarry');
  assert.equal(c.build('storehouse').ok, true);
  assert.equal(c.caps().wood, 560); assert.equal(c.caps().iron, 160); assert.equal(c.caps().ember_shard, 40);
  const lodge = c.pieces.find((p) => p.type === 'woodcutter');
  c.stores.wood = 0; assert.equal(c.frost(lodge), true);
  c.tick(60); assert.equal(c.amount('wood'), 0, 'frosted all night');
  c.thawAtDawn(); c.tick(30); assert.equal(c.amount('wood'), 0, 'still frosted for the first 60 s of the day');
  c.tick(31); c.tick(60); assert.ok(c.amount('wood') >= 5);
});

test('gathering: node yield + CL gather bonus + kin perks, clipped at the cap', () => {   // risk: core economy
  const c = fresh();
  assert.equal(c.gather('wood', 2), 2);                           // CL1: +0
  c.kin.add('pinewarden'); assert.equal(c.gatherYield('wood', 2), 3);
  c.stores.wood = 159; assert.equal(c.gather('wood', 2), 1, 'only 1 fits under the cap');
});

test('payback: lodge 2.7, quarry 3.3, restored hall 1.8, lodge L2 9.3 / 7.0 with a Smithy', () => {   // risk: money
  const c = fresh(); c.hearthCap = 4;
  assert.equal(c.paybackFor('woodcutter').toFixed(1), '2.7');
  assert.equal(c.paybackFor('quarry').toFixed(1), '3.3');
  assert.equal(c.paybackFor('great_hall').toFixed(1), '3.5');
  assert.equal(c.paybackFor('great_hall', { ruin: true }).toFixed(1), '1.8');
  assert.equal(c.paybackFor('palisade'), null, 'non-producers have no payback');
  give(c, { wood: 300, stone: 300, iron: 40 });
  c.build('gatehouse'); const lodge = c.build('woodcutter').piece;
  assert.equal(c.upgradePayback(lodge).toFixed(1), '9.3');
  c.build('smithy', {}, { ruin: true });
  assert.deepEqual({ ...c.upgradeCost(lodge) }, { wood: 60, stone: 45 }, 'Smithy takes 25% off, rounded up');
  assert.equal(c.upgradePayback(lodge).toFixed(1), '7.0');
  assert.equal(new K.Payback(data()).line({ wood: 6, stone: 4 }, { wood: 6 }), '+6 wood/min · pays for itself in 1.7 min');
});

test('ruins repair at half cost, rounded up, once', () => {   // risk: money
  const c = fresh(); give(c, { wood: 4, stone: 3 });
  assert.deepEqual({ ...c.buildCost('gatehouse', { ruin: true }) }, { wood: 4, stone: 3 });
  assert.equal(c.build('gatehouse', {}, { ruin: true }).ok, true);
  assert.equal(c.amount('wood'), 0); assert.equal(c.amount('stone'), 0);
  assert.equal(c.ruins.gatehouse, true);
  give(c, { wood: 10, stone: 10 });
  assert.equal(c.build('gatehouse', {}, { ruin: true }).ok, false, 'a ruin restores only once');
});

test('Castle Level: thresholds from distinct piece types, gates, and the hearth cap', () => {   // risk: core rules
  const c = new K.Castle(data()); c.extraHas = (t) => t === 'cottage';
  assert.equal(c.cl(), 0); assert.equal(c.blocker('palisade', { ignoreCost: true }), null, 'you can build before the hearth is lit');
  assert.match(c.blocker('storehouse', { ignoreCost: true }), /Quarry/, 'the building tree still gates what you can build');
  c.light(); assert.equal(c.cl(), 1);
  give(c, { wood: 300, stone: 300 });
  assert.match(c.blocker('storehouse'), /Quarry/);
  c.build('palisade'); c.build('palisade');
  assert.equal(c.score(), 2, 'a second palisade adds nothing');
  c.build('gatehouse'); c.build('woodcutter'); c.build('quarry'); assert.ok(c.score() >= 10); assert.equal(c.cl(), 2);
  assert.equal(c.blocker('storehouse'), null);
  assert.match(c.blocker('mine', { ignoreCost: true }), /Iron Hills/);
  c.flags.add('zone:iron_hills'); assert.equal(c.blocker('mine', { ignoreCost: true }), null);
  assert.match(c.blocker('ember_forge', { ignoreCost: true }), /Castle Level 4/);
  // every piece -> 54 points, but the hearth caps you at 4 until the troll's heart
  const all = new K.Castle(data()); all.light(); for (const id of all.data.pieceIds()) if (id !== 'keep') all.pieces.push({ uid: all.nextUid++, type: id, level: 1 });
  assert.equal(all.score(), 54); assert.equal(all.cl(), 4); assert.equal(all.nextLevel().capped, true);
  assert.match(all.blocker('heartfire_hearth'), /not enough/);
  all.stores.troll_heart = 1; all.stores.stone = 6;
  assert.equal(all.build('heartfire_hearth').ok, true); assert.equal(all.cl(), 5);
  assert.equal(all.amount('troll_heart'), 0, 'the heart is consumed'); assert.equal(all.glowRadius(), 60);
});

test('raid loss: 10% of unprotected stores, a Storehouse guards half, buildings never touched', () => {   // risk: irreversible loss
  const c = fresh(); c.hearthCap = 4; give(c, { wood: 60, stone: 40, iron: 9, gold: 20, ember_shard: 5 });
  c.build('palisade'); const before = JSON.stringify(c.pieces);
  give(c, { wood: 60, stone: 40, iron: 9, gold: 20, ember_shard: 5 });
  assert.deepEqual({ ...c.raidLoss() }, { wood: 6, stone: 4, gold: 2 }, 'iron 9 and ember 5 lose 0 (rounds down)');
  assert.equal(c.amount('wood'), 54);
  assert.equal(JSON.stringify(c.pieces), before, 'no building lost or damaged');
  const s = fresh(); s.hearthCap = 4; give(s, { wood: 300, stone: 300 });
  s.build('gatehouse'); s.build('woodcutter'); s.build('quarry'); s.build('storehouse'); give(s, { wood: 100, stone: 60 });
  assert.equal(s.protectPct(), 50);
  assert.deepEqual({ ...s.raidLoss() }, { wood: 5, stone: 3 }, 'half is guarded');
});

test('crafting: recipes consume their inputs from the one bag and need their station', () => {   // risk: core rules
  const c = fresh(); give(c, { wood: 3, stone: 4 });
  assert.equal(c.craft('craft_stoneblade').ok, true);
  assert.equal(c.amount('wood'), 0); assert.equal(c.amount('stone'), 0); assert.equal(c.weapons.has('stoneblade'), true);
  assert.equal(c.craft('craft_stoneblade').ok, false, 'one of each weapon');
  give(c, { wood: 2, iron: 6, gold: 4 });
  assert.match(c.craftBlocker('craft_iron_sword'), /Smithy/);
  c.pieces.push({ uid: 99, type: 'smithy', level: 1 });
  assert.equal(c.craft('craft_iron_sword').ok, true);
  assert.deepEqual([c.amount('wood'), c.amount('iron'), c.amount('gold')], [0, 0, 0]);
  give(c, { iron: 4, ember_shard: 5, gold: 6 });
  c.pieces.push({ uid: 100, type: 'ember_forge', level: 1 });
  assert.match(c.craftBlocker('craft_ember_brand'), /not enough/);
  assert.equal(c.amount('iron'), 4, 'a failed craft takes nothing');
});

test('hero: CL + best weapon (power 11 / 26 / 38 per the plan)', () => {   // risk: combat balance
  const c = fresh(); c.weapons.add('stoneblade'); assert.equal(c.heroStats().power, 11);
  c.hearthCap = 4; for (const t of ['gatehouse', 'woodcutter', 'quarry', 'mine', 'great_hall', 'smithy', 'storehouse', 'barracks']) c.pieces.push({ uid: c.nextUid++, type: t, level: 1 });
  c.weapons.add('iron_sword'); assert.equal(c.cl(), 4); assert.equal(c.heroStats().power, 26); assert.equal(c.heroStats().atk, 15);
  c.hearthCap = 5; c.weapons.add('ember_brand'); assert.equal(c.heroStats().power, 38);
  assert.equal(Math.ceil(300 / (20 + 3)), 14, 'troll: 14 Ember brand hits at CL4');
});

test('day cycle: warning 30 s before dusk, dusk, dawn, a lost night gives a 90 s day', () => {   // risk: core loop
  const d = new K.DayCycle(data());
  assert.equal(d.kind, 'day'); assert.equal(d.length(), 270);
  let ev = d.tick(239); assert.equal(ev.length, 0);
  ev = d.tick(2); assert.equal(ev[0].type, 'warn');
  ev = d.tick(30); assert.equal(ev[0].type, 'dusk'); assert.equal(d.phase.id, 'night1');
  assert.equal(d.advance({ lost: true }).type, 'dawn'); assert.equal(d.length(), 90);
  const b = new K.DayCycle(data()); assert.equal(b.ringBell().type, 'dusk', 'the bell starts dusk early');
  const last = new K.DayCycle(data(), { idx: 4 }); assert.equal(last.length(), null); assert.equal(last.tick(999).length, 0, 'day 3 has no timer');
});

test('hearthbook: % complete ticks with progress', () => {   // risk: completion tracking
  const c = new K.Castle(data()); const hb0 = c.hearthbook();
  assert.equal(hb0.total, 35); assert.equal(hb0.done, 0);
  c.light(); give(c, { wood: 4, stone: 3 }); c.build('gatehouse', {}, { ruin: true }); c.flags.add('survived:night1');
  const hb = c.hearthbook();
  assert.equal(hb.done, 5, 'keep + gatehouse (Castle), keep + gatehouse (Ruins), night1'); assert.equal(hb.pct, 14);
});

test('save: a castle and its day survive a JSON round trip through the save slot', () => {   // risk: data loss
  const c = fresh(); c.hearthCap = 4; give(c, { wood: 300, stone: 300, gold: 10 });
  c.build('gatehouse', { x: 3, z: 4, rot: 1.5 }, { ruin: true }); const lodge = c.build('woodcutter', { x: 7.25, z: 2 }).piece;
  c.upgrade(lodge); c.kin.add('pinewarden'); c.weapons.add('stoneblade'); c.flags.add('survived:night1'); c.frost(lodge); c.tick(12.5);
  const day = new K.DayCycle(data(), { idx: 2, t: 33.3 });
  const mem = new Map(), storage = { setItem: (k, v) => mem.set(k, v), getItem: (k) => mem.get(k) ?? null, removeItem: (k) => mem.delete(k) };
  const slot = new K.CastleSave(storage);
  assert.equal(slot.exists(), false);
  assert.equal(slot.write({ castle: c.toJSON(), day: day.toJSON(), hero: [1, 2] }), true);
  const back = slot.read(), c2 = K.Castle.fromJSON(data(), back.castle), d2 = new K.DayCycle(data(), back.day);
  assert.equal(JSON.stringify(c2.toJSON()), JSON.stringify(c.toJSON()));
  assert.equal(c2.cl(), c.cl()); assert.equal(c2.amount('wood'), c.amount('wood'));
  assert.equal(c2.pieces[1].level, 2); assert.equal(c2.isFrosted(c2.pieces[1]), true);
  assert.equal(d2.phase.id, 'day2'); assert.equal(d2.t, 33.3);
  slot.clear(); assert.equal(slot.read(), null);
});

test('item ids: old engine ids resolve to the castle ids', () => {   // risk: one shared bag
  const d = data();
  assert.equal(d.canon('log'), 'wood'); assert.equal(d.canon('ore'), 'iron'); assert.equal(d.canon('iron_ore'), 'iron');
  assert.equal(d.canon('coins'), 'gold'); assert.equal(d.canon('sword'), 'iron_sword'); assert.equal(d.canon('rusted_sword'), 'stoneblade');
  assert.equal(d.canon('stone'), 'stone');
});

test('goals: an objective finished early drops out of the goal list', () => {   // risk: core business rule (guided progression)
  const c = fresh(); give(c, { wood: 100, stone: 100 });
  assert.equal(c.build('woodcutter', { x: 1, z: 1 }).ok, true);       // o3 done before o2
  const ids = c.currentGoals(3).map((o) => o.id);
  assert.deepEqual(ids, ['o2', 'o4', 'o5']);
  assert.equal(c.currentGoals(20).some((o) => o.id === 'o3'), false);
});
