import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GameRoom } from './src/index.js';

class FakeSocket {
  messages = [];
  send(value) { this.messages.push(JSON.parse(value)); }
  close() {}
}

class RoomHarness {
  constructor() {
    this.records = new Map();
    const storage = {
      get: async (key) => this.records.get(key),
      put: (key, value) => this.records.set(key, value),
      delete: (key) => this.records.delete(key),
    };
    this.room = new GameRoom({ storage, blockConcurrencyWhile: (work) => work() }, {});
    this.room.startTimer = () => {};
  }

  async ready() { await new Promise((resolve) => setTimeout(resolve, 0)); }

  socket() {
    const ws = new FakeSocket();
    const player = { id: null, cid: null, name: '', slot: -1, x: 0, z: 0, y: 0, f: 0, s: 'idle', tool: '', hp: 0, joined: false };
    this.room.sockets.set(ws, player);
    return { ws, player };
  }
}

function comparable(value) {
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['epoch', 'now', 'until', 'at'].includes(key))
      .map(([key, item]) => [key, comparable(item)]));
  }
  if (typeof value === 'string' && /^t[a-z0-9]{5}$/.test(value)) return '<team-id>';
  return value;
}

// risk: synchronization/data integrity — the full join/team/trade/leave wire log must stay compatible.
{
  const expected = JSON.parse(await readFile(new URL('./test-data/oop-sequence.expected.json', import.meta.url), 'utf8'));
  const harness = new RoomHarness(); await harness.ready();
  const alice = harness.socket(), bobby = harness.socket();
  await harness.room.onMessage(alice.ws, alice.player, { t: 'hello', cid: 'alice-client', name: 'Alice' });
  await harness.room.onMessage(bobby.ws, bobby.player, { t: 'hello', cid: 'bobby-client', name: 'Bobby' });
  await harness.room.onMessage(alice.ws, alice.player, { t: 'team', a: 'invite', to: bobby.player.id });
  const team = Object.keys(harness.room.teams)[0];
  await harness.room.onMessage(bobby.ws, bobby.player, { t: 'team', a: 'accept', team });
  await harness.room.onMessage(alice.ws, alice.player, { t: 'market', x: alice.player.x, z: alice.player.z, stock: { wood: 5 }, prices: { wood: 3 } });
  bobby.player.x = alice.player.x; bobby.player.z = alice.player.z;
  await harness.room.onMessage(bobby.ws, bobby.player, { t: 'buy', owner: alice.player.id, good: 'wood', n: 2 });
  harness.room.onClose(bobby.ws, bobby.player);
  assert.deepEqual(comparable({ alice: alice.ws.messages, bobby: bobby.ws.messages }), expected);
}
console.log('OOP protocol sequence matches the pre-refactor wire log');
