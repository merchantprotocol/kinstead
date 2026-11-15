import assert from 'node:assert/strict';
import test from 'node:test';
import { Markets } from './src/Markets.js';

const makeRoom = () => {
  const sent = [];
  const room = {
    markets: { ann: { owner: 'ann', name: 'Ann', x: 100, z: 100, stock: { bread: 18 }, prices: {} } },
    sales: {},
    state: { storage: { put() {} } },
    byId: () => [{ id: 'socket' }],
    sameTeam: (a, b) => [a, b].every((id) => id === 'ann' || id === 'bo'),
    near: (a, b, m) => Math.hypot(a.x - b.x, a.z - b.z) <= m,
    send: (socket, message) => sent.push(message),
    broadcast() {},
  };
  new Markets().install(room);
  return { room, sent };
};

test('teammate takes from a bakery shelf far from the owner market', () => {
  // risk: team sharing broken at shop shelves (QA prod bug: 13 m from market, 4 m from shelf)
  const { room, sent } = makeRoom();
  room.onBuy({ id: 'bo', name: 'Bo', x: 117, z: 100 }, { owner: 'ann', good: 'bread', n: 3, at: { x: 113, z: 100 } });

  assert.equal(sent.at(-1).t, 'bought');
  assert.equal(room.markets.ann.stock.bread, 15);
});

test('shelf trade refuses a buyer standing away from the stated shelf', () => {
  // risk: remote looting by naming a shelf you are not at
  const { room, sent } = makeRoom();
  room.onBuy({ id: 'bo', name: 'Bo', x: 130, z: 100 }, { owner: 'ann', good: 'bread', n: 3, at: { x: 113, z: 100 } });

  assert.equal(sent.at(-1).t, 'buyfail');
  assert.equal(room.markets.ann.stock.bread, 18);
});

test('shelf trade refuses a shelf point spoofed far from the owner grounds', () => {
  // risk: buying from anywhere on the map by claiming a shelf next to yourself
  const { room, sent } = makeRoom();
  room.onBuy({ id: 'bo', name: 'Bo', x: 300, z: 300 }, { owner: 'ann', good: 'bread', n: 3, at: { x: 301, z: 300 } });

  assert.equal(sent.at(-1).t, 'buyfail');
  assert.equal(room.markets.ann.stock.bread, 18);
});

test('plain market trade without a shelf keeps the 12 m market rule', () => {
  // risk: old clients either locked out or able to trade from afar
  const { room, sent } = makeRoom();
  room.onBuy({ id: 'bo', name: 'Bo', x: 113, z: 100 }, { owner: 'ann', good: 'bread', n: 1 });
  assert.equal(sent.at(-1).t, 'buyfail');
  room.onBuy({ id: 'bo', name: 'Bo', x: 110, z: 100 }, { owner: 'ann', good: 'bread', n: 1, at: 'junk' });
  assert.equal(sent.at(-1).t, 'bought');
  assert.equal(room.markets.ann.stock.bread, 17);
});
