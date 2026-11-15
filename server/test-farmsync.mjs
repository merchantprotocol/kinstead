import test from 'node:test';
import assert from 'node:assert/strict';
import { FarmSync } from './src/FarmSync.js';
import { GameRoom } from './src/index.js';

class FakeRoom {
  constructor() {
    this.world = {
      pieces: {
        'ann:1': { owner: 'ann', type: 'barn' },
        'ann:2': { owner: 'ann', type: 'coop' },
        'bo:1': { owner: 'bo', type: 'barn' },
      },
      farms: { fields: {}, herds: {}, goods: {} },
    };
    this.ver = { p: 1, f: 1 };
    this.dirty = false;
    this.messages = [];
  }

  broadcast(message) { this.messages.push(message); }
}

test('farm sync persists crop updates, owner-isolates herd state, and rejects foreign/invalid herds', () => {
  // risk: tenant isolation and world-state persistence
  const room = new FakeRoom(), sync = new FarmSync(room);
  sync.snapshot('ann', {
    fields: [[10, 20, 35], [11, 20, 999999], ['bad', 20, 10]],
    herds: [['ann:1', 'cow', 2], ['ann:2', 'chicken', 3], ['bo:1', 'cow', 8], ['ann:2', 'cow', 1]],
    goods: [['ann:1', { milk: 8, beef: 3 }], ['bo:1', { milk: 99 }], ['ann:2', { egg: 4 }]],
  });

  assert.deepEqual(Object.values(room.world.farms.fields).map(({ owner, i, j, age }) => [owner, i, j, age]), [
    ['ann', 10, 20, 35], ['ann', 11, 20, 180],
  ]);
  assert.deepEqual(Object.values(room.world.farms.herds).map(({ owner, piece, kind, count }) => [owner, piece, kind, count]), [
    ['ann', 'ann:1', 'cow', 2], ['ann', 'ann:2', 'chicken', 3],
  ]);
  assert.deepEqual(Object.values(room.world.farms.goods).map(({ owner, piece, goods }) => [owner, piece, goods]), [
    ['ann', 'ann:1', { milk: 8, beef: 3 }], ['ann', 'ann:2', { egg: 4 }],
  ]);
  assert.equal(room.dirty, true);
  assert.equal(room.ver.f, 2);
  assert.equal(room.ver.p, 1, 'farm changes have their own version, so a sync does not resend every piece');
  assert.equal(room.messages[0].t, 'farm');

  sync.snapshot('ann', { fields: [], herds: [['ann:1', 'cow', 1]], goods: [] });
  assert.equal(Object.keys(room.world.farms.fields).length, 0);
  assert.equal(Object.keys(room.world.farms.herds).length, 1);
  assert.equal(Object.values(room.world.farms.herds)[0].count, 1);
  assert.equal(Object.keys(room.world.farms.goods).length, 0);
});

test('an unchanged farm snapshot is not rebroadcast and does not bump any version', () => {
  // risk: 30-player load — every player re-sends its farm every 8 s; unchanged ones must cost nothing.
  const room = new FakeRoom(), sync = new FarmSync(room);
  const farm = () => ({ fields: [[1, 2, 30]], herds: [['ann:1', 'cow', 2]], goods: [] });
  assert.ok(sync.snapshot('ann', farm()));
  assert.equal(sync.snapshot('ann', farm()), null);
  assert.equal(room.messages.length, 1);
  assert.equal(room.ver.f, 2);
  const grown = farm();
  grown.fields[0][2] = 31;
  assert.ok(sync.snapshot('ann', grown));
  assert.equal(room.messages.length, 2);
  assert.equal(room.ver.f, 3);
  assert.equal(Object.values(room.world.farms.fields)[0].age, 31);
});

test('an empty farm snapshot is required and malformed updates leave durable state untouched', () => {
  // risk: data integrity
  const room = new FakeRoom(), sync = new FarmSync(room);
  room.world.farms.fields['ann:1,2'] = { owner: 'ann', i: 1, j: 2, age: 2 };
  assert.equal(sync.snapshot('ann', { fields: {}, herds: [] }), false);
  assert.equal(Object.keys(room.world.farms.fields).length, 1);
});

test('joined players receive persisted farm state after the room is recreated', async () => {
  // risk: synchronization/rejoin — fields and herds must survive Durable Object eviction.
  const storage = new Map();
  const state = {
    storage: {
      get: async (key) => storage.get(key),
      put: async (key, value) => storage.set(key, structuredClone(value)),
      delete: async (key) => storage.delete(key),
    },
    blockConcurrencyWhile: (work) => work(),
  };
  const room = new GameRoom(state, {});
  room.startTimer = () => {};
  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = () => ({ messages: [], send(value) { this.messages.push(JSON.parse(value)); }, close() {} });
  const annWs = socket(), ann = { id: null, cid: null, name: '', slot: -1, x: 0, z: 0, y: 0, f: 0, s: 'idle', tool: '', hp: 0, joined: false };
  const boWs = socket(), bo = { id: null, cid: null, name: '', slot: -1, x: 0, z: 0, y: 0, f: 0, s: 'idle', tool: '', hp: 0, joined: false };
  room.sockets.set(annWs, ann);
  room.sockets.set(boWs, bo);
  await room.onMessage(annWs, ann, { t: 'hello', cid: 'ann-farm-client', name: 'Ann' });
  await room.onMessage(boWs, bo, { t: 'hello', cid: 'bo-farm-client', name: 'Bo' });
  await room.onMessage(annWs, ann, { t: 'op', op: { k: 'piece+', id: ann.id + ':4', type: 'barn', x: 30, z: 30 } });
  await room.onMessage(annWs, ann, { t: 'farm', farm: { fields: [[3, 4, 84]], herds: [[ann.id + ':4', 'cow', 2]] } });
  assert.ok(annWs.messages.some((message) => message.t === 'welcome'));
  assert.ok(boWs.messages.some((message) => message.t === 'farm' && message.owner === ann.id));
  room.save();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const restarted = new GameRoom(state, {});
  restarted.startTimer = () => {};
  await new Promise((resolve) => setTimeout(resolve, 0));
  const boRejoinWs = socket(), boRejoin = { id: null, cid: null, name: '', slot: -1, x: 0, z: 0, y: 0, f: 0, s: 'idle', tool: '', hp: 0, joined: false };
  restarted.sockets.set(boRejoinWs, boRejoin);
  await restarted.onMessage(boRejoinWs, boRejoin, { t: 'hello', cid: 'bo-farm-client', name: 'Bo' });
  const welcome = boRejoinWs.messages.find((message) => message.t === 'welcome');
  assert.equal(Object.values(welcome.world.farms.fields)[0].age, 84);
  assert.equal(Object.values(welcome.world.farms.herds)[0].count, 2);
});
