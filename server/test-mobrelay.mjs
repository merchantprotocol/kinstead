import test from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from './src/index.js';
import { MobRelay } from './src/MobRelay.js';

class FakeSocket {
  messages = [];
  send(value) { this.messages.push(JSON.parse(value)); }
  close() {}
  take(type) { const out = this.messages.filter((m) => m.t === type); this.messages = []; return out; }
}

class RelayHarness {
  constructor() {
    const records = new Map();
    const storage = { get: async (k) => records.get(k), put: (k, v) => records.set(k, v), delete: (k) => records.delete(k) };
    this.room = new GameRoom({ storage, blockConcurrencyWhile: (work) => work() }, {});
    this.room.startTimer = () => {};
  }

  async join(cid, x, z, mv) {
    const ws = new FakeSocket();
    const player = { id: null, cid: null, name: '', slot: -1, x: 0, z: 0, y: 0, f: 0, s: 'idle', tool: '', hp: 0, joined: false };
    this.room.sockets.set(ws, player);
    await this.room.onMessage(ws, player, { t: 'hello', cid, name: cid, mv });
    player.x = x;
    player.z = z;
    ws.messages = [];
    return { ws, player };
  }

  flush() {
    for (let i = 0; i < MobRelay.FLUSH_EVERY; i++) this.room.mobRelay.tick(this.room.online());
  }
}

const wolves = (n, x, z) => Array.from({ length: n }, (_, i) => ['w' + i, 'wolf', x + i, z, 0, 0, 'walk', 30, 30, 'Wolf ' + i]);
const ready = () => new Promise((resolve) => setTimeout(resolve, 0));

test('mob lists are not relayed per message: one batched, near-only flush carries them', async () => {
  // risk: 30-player load and data accuracy — every client must see the right creatures without a message storm.
  const h = new RelayHarness(); await ready();
  const ann = await h.join('ann-mobs-client', 100, 100, 2), bo = await h.join('bo-mobs-client', 110, 100, 2);
  const far = await h.join('far-mobs-client', 400, 400, 2);
  bo.ws.messages = [];
  for (let i = 0; i < 5; i++) await h.room.onMessage(ann.ws, ann.player, { t: 'mobs', list: wolves(3, 100, 100) });
  assert.equal(bo.ws.messages.filter((m) => m.t === 'mobs' || m.t === 'mobz').length, 0, 'nothing is forwarded when it arrives');
  h.flush();
  const [first, ...rest] = bo.ws.take('mobz');
  assert.equal(rest.length, 0);
  const [owner, full, rows, meta, gone] = first.o[0];
  assert.deepEqual([owner, full, rows.length, gone], [ann.player.id, 1, 3, []]);
  assert.deepEqual(rows[1], ['w1', 101, 100, 0, 0, 'walk', 30]);
  assert.deepEqual(meta[1], ['w1', 'wolf', 30, 'Wolf 1']);
  assert.equal(far.ws.take('mobz').length, 0, 'a player 400 m away is not sent them');
  assert.equal(ann.ws.take('mobz').length, 0, 'an owner is never sent its own creatures');

  h.flush();
  assert.equal(bo.ws.take('mobz').length, 0, 'unchanged lists cost nothing');

  const moved = wolves(3, 100, 100);
  moved[2][2] = 150.04;
  await h.room.onMessage(ann.ws, ann.player, { t: 'mobs', list: moved.slice(1) });
  h.flush();
  const delta = bo.ws.take('mobz')[0].o[0];
  assert.deepEqual(delta, [ann.player.id, 0, [['w2', 150, 100, 0, 0, 'walk', 30]], [], ['w0']]);
});

test('v2 deltas: static facts once, changed rows, removals, and leaving range or the room', async () => {
  // risk: synchronization — a recipient must never keep ghosts or miss a new creature.
  const h = new RelayHarness(); await ready();
  const ann = await h.join('ann-v2-client', 50, 50, 2), bo = await h.join('bo-v2-client', 60, 50, 2);
  await h.room.onMessage(ann.ws, ann.player, { t: 'mobs', v: 2, full: 1, u: [['b1', 52, 50, 0, 1.2, 'idle', 160]], n: [['b1', 'bear', 160, 'Bear']] });
  await h.room.onMessage(ann.ws, ann.player, { t: 'mobs', v: 2, u: [['x9', 1, 1, 0, 0, 'idle', 5]] });
  h.flush();
  const first = bo.ws.take('mobz')[0].o[0];
  assert.deepEqual(first[2], [['b1', 52, 50, 0, 1.2, 'idle', 160]], 'a row with no static facts is ignored');
  assert.deepEqual(first[3], [['b1', 'bear', 160, 'Bear']]);

  await h.room.onMessage(ann.ws, ann.player, { t: 'mobs', v: 2, u: [['b1', 53, 50, 0, 1.2, 'attack', 150]] });
  h.flush();
  assert.deepEqual(bo.ws.take('mobz')[0].o[0], [ann.player.id, 0, [['b1', 53, 50, 0, 1.2, 'attack', 150]], [], []]);

  bo.player.x = 300;
  h.flush();
  assert.deepEqual(bo.ws.take('mobz')[0].out, [ann.player.id], 'walking away drops that owner');
  bo.player.x = 60;
  h.flush();
  assert.equal(bo.ws.take('mobz')[0].o[0][1], 1, 'coming back gets the whole list again');

  await h.room.onMessage(ann.ws, ann.player, { t: 'mobs', v: 2, g: ['b1'] });
  h.flush();
  assert.deepEqual(bo.ws.take('mobz')[0].out, [ann.player.id], 'an owner with no creatures left is dropped');

  h.room.onClose(ann.ws, ann.player);
  assert.equal(h.room.mobRelay.owners.has(ann.player.id), false, 'a player who leaves takes their creatures along');
});

test('stale clients still get whole per-owner lists, and the nearest owners win the budget', async () => {
  // risk: backward compatibility and 30-player load
  const h = new RelayHarness(); await ready();
  const old = await h.join('old-client-xx', 100, 100);
  const owners = [];
  for (let i = 0; i < 8; i++) owners.push(await h.join('owner-' + i + '-client', 100 + i * 5, 100, 2));
  for (const [i, o] of owners.entries()) await h.room.onMessage(o.ws, o.player, { t: 'mobs', list: wolves(20, 100 + i * 5, 100) });
  h.flush();
  const legacy = old.ws.take('mobs');
  assert.ok(legacy.length >= 1);
  assert.deepEqual(legacy[0].list[0].length, 10);
  const sent = legacy.reduce((n, m) => n + m.list.length, 0);
  assert.ok(sent <= MobRelay.BUDGET + 20, `budget respected (${sent})`);
  assert.deepEqual(legacy.map((m) => m.from)[0], owners[0].player.id, 'nearest owner first');
});
