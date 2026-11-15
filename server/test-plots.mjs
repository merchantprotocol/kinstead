// Copyright (c) 2026 Merchant Protocol. All rights reserved.
/* In-process tests: a map's 30 plots are recycled from offline identities, never from online ones. */
import assert from 'node:assert/strict';
import { GameRoom } from './src/index.js';

class FakeSocket {
  messages = [];
  send(value) { this.messages.push(JSON.parse(value)); }
  close() {}
}

class PlotHarness {
  constructor() {
    this.saved = new Map();
    const storage = {
      get: async (key) => this.saved.get(key),
      put: (key, value) => { this.saved.set(key, value); },
      delete: (key) => { this.saved.delete(key); },
    };
    this.room = new GameRoom({ storage, blockConcurrencyWhile: (fn) => fn() }, {});
    this.room.startTimer = () => {};
    this.clock = 1000;
  }

  /** a socket says hello; returns { ws, p, reply } */
  async hello(cid) {
    await new Promise((resolve) => setTimeout(resolve, 0));   // the room finishes loading its storage first
    const ws = new FakeSocket(), p = { id: null, cid: null, name: '', slot: -1, x: 0, z: 0, joined: false };
    this.room.sockets.set(ws, p);
    const realNow = Date.now;
    Date.now = () => this.clock;
    try { await this.room.onMessage(ws, p, { t: 'hello', cid, name: cid }); } finally { Date.now = realNow; }
    this.clock += 1000;
    return { ws, p, reply: ws.messages.find((m) => m.t === 'welcome' || m.t === 'full') };
  }

  leave(session) {
    const realNow = Date.now;
    Date.now = () => this.clock;
    try { this.room.onClose(session.ws, session.p); } finally { Date.now = realNow; }
    this.clock += 1000;
  }

  /** a visit: join and leave again */
  async visit(cid) {
    const session = await this.hello(cid);
    if (session.reply.t === 'welcome') this.leave(session);
    return session;
  }

  cid(n) { return 'cid' + String(n).padStart(5, '0') + '-identity'; }
}

// risk: availability — the 31st identity on a map whose 30 plot-holders are all offline must still get a plot.
{
  const h = new PlotHarness();
  for (let n = 0; n < 30; n++) assert.equal((await h.visit(h.cid(n))).reply.t, 'welcome');
  const housed = h.room.plots[h.cid(0)].slot;
  h.room.world.houses[housed] = { owner: h.cid(0).slice(0, 8), name: 'housed', x: 1, z: 1, spec: {} };   // the oldest built a house
  const victimCid = h.cid(1), victim = victimCid.slice(0, 8), victimSlot = h.room.plots[victimCid].slot;
  h.room.world.pieces.v1 = { id: 'v1', type: 'palisade', owner: victim, x: 1, z: 1, hp: 400, hpMax: 400 };
  h.room.world.pieces.keep = { id: 'keep', type: 'palisade', owner: h.cid(2).slice(0, 8), x: 2, z: 2, hp: 400, hpMax: 400 };
  h.room.world.buildings['smithy:' + victim] = { id: 'smithy:' + victim, owner: victim, spec: {} };
  h.room.stores[victim + ':barrel'] = { id: victim + ':barrel', owner: victim, stock: 5 };
  h.room.world.farms.fields[victim + ':1,1'] = { owner: victim, i: 1, j: 1, age: 3 };
  h.room.markets[victim] = { owner: victim, stock: {}, prices: {} };
  h.room.respawns[victimCid] = { slot: victimSlot, x: 1, z: 1 };
  const watcher = await h.hello(h.cid(99));   // the 31st: takes the oldest house-less plot (identity #1's)
  assert.equal(watcher.reply.t, 'welcome');
  assert.equal(watcher.reply.slot, victimSlot);
  assert.equal(watcher.reply.evicted, false);
  assert.equal(h.room.plots[victimCid].slot, -1);
  assert.equal(h.room.plots[victimCid].evicted, true);
  assert.equal(h.room.world.pieces.v1, undefined);
  assert.ok(h.room.world.pieces.keep, 'another identity keeps its pieces');
  assert.equal(h.room.world.buildings['smithy:' + victim], undefined);
  assert.equal(h.room.stores[victim + ':barrel'], undefined);
  assert.equal(h.room.world.farms.fields[victim + ':1,1'], undefined);
  assert.equal(h.room.markets[victim], undefined);
  assert.equal(h.room.respawns[victimCid], undefined);
  assert.ok(h.room.world.houses[housed], 'a house-holder is recycled only after every house-less plot');
  const slots = Object.values(h.room.plots).map((plot) => plot.slot).filter((slot) => slot >= 0);
  assert.equal(new Set(slots).size, slots.length, 'no two identities share a plot');
  // the recycled identity comes back while another is online: a fresh plot (the next oldest, #2) and an evicted welcome
  const back = await h.hello(victimCid);
  assert.equal(back.reply.t, 'welcome');
  assert.equal(back.reply.evicted, true);
  assert.equal(back.reply.slot, h.room.plots[victimCid].slot);
  assert.notEqual(back.reply.slot, watcher.reply.slot);
  assert.equal(h.room.plots[h.cid(2)].slot, -1);
  assert.equal(h.room.world.pieces.keep, undefined);
  const stats = h.room.roomStats.snapshot();
  assert.equal(stats.online, 2);
  assert.equal(stats.plotsUsed, 30);
  assert.equal(stats.full, false);
}

// risk: availability/data loss — an online player's plot is never taken; 30 online players means a real 'full'.
{
  const h = new PlotHarness(), sessions = [];
  for (let n = 0; n < 30; n++) sessions.push(await h.hello(h.cid(n)));
  const before = JSON.stringify(h.room.plots);
  h.room.world.pieces.p0 = { id: 'p0', type: 'gate', owner: h.cid(0).slice(0, 8), x: 0, z: 0, hp: 700, hpMax: 700 };
  const late = await h.hello(h.cid(77));
  assert.equal(late.reply.t, 'full');
  assert.equal(JSON.stringify(h.room.plots), before);
  assert.ok(h.room.world.pieces.p0);
  assert.equal(h.room.roomStats.snapshot().full, true);
  h.leave(sessions[29]);   // one leaves: now the newcomer gets exactly that plot
  const next = await h.hello(h.cid(78));
  assert.equal(next.reply.t, 'welcome');
  assert.equal(next.reply.slot, sessions[29].p.slot);
}

// risk: availability — the oldest offline identity goes first (last-seen order), across saves of the plot table.
{
  const h = new PlotHarness();
  for (let n = 0; n < 30; n++) await h.visit(h.cid(n));
  await h.visit(h.cid(0));   // #0 came back recently: #1 is now the longest away
  assert.ok(h.room.plots[h.cid(0)].seen > h.room.plots[h.cid(29)].seen);
  const late = await h.hello(h.cid(55));
  assert.equal(h.room.plots[h.cid(1)].slot, -1);
  assert.ok(h.room.plots[h.cid(0)].slot >= 0);
  assert.equal(late.reply.slot, h.saved.get('plots')[h.cid(55)].slot);
}

// risk: data accuracy — a coop is 120/120 on the server, walls keep their break-in toughness, old saves are clamped.
{
  const h = new PlotHarness();
  const owner = { id: 'owner123', cid: 'owner123-x', name: 'o', joined: true };
  h.room.applyOp(owner, { k: 'piece+', id: 'c1', type: 'coop', x: 0, z: 0 });
  h.room.applyOp(owner, { k: 'piece+', id: 'w1', type: 'palisade', x: 0, z: 0 });
  h.room.applyOp(owner, { k: 'piece+', id: 'u1', type: 'mystery_thing', x: 0, z: 0 });
  assert.deepEqual([h.room.world.pieces.c1.hp, h.room.world.pieces.c1.hpMax], [120, 120]);
  assert.equal(h.room.world.pieces.w1.hpMax, 400);
  assert.equal(h.room.world.pieces.u1.hpMax, 900);
  const { PieceHp } = await import('./src/PieceHp.js');
  const stale = { c: { type: 'coop', hp: 895, hpMax: 900 } };
  PieceHp.shared.normalize(stale);
  assert.deepEqual([stale.c.hp, stale.c.hpMax], [120, 120]);
}
console.log('plot recycling + piece hp: ok');
