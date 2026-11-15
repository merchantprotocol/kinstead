import assert from 'node:assert/strict';
import test from 'node:test';
import { Markets } from './src/Markets.js';

const makeRoom = () => {
  const sent = [], stored = [], broadcasts = [];
  const owner = { id: 'owner-socket' }, buyer = { id: 'buyer-socket' };
  const room = {
    markets: { owner: { owner: 'owner', name: 'Ann', x: 2, z: 2, stock: { bread: 30 }, prices: { bread: 2 } } },
    sales: {},
    state: { storage: { put: (...args) => stored.push(args) } },
    byId: (id) => [id === 'owner' ? owner : buyer],
    sameTeam: () => false,
    near: () => true,
    send: (socket, message) => sent.push({ socket, message }),
    broadcast: (message) => broadcasts.push(message),
  };
  new Markets().install(room);
  return { room, sent, stored, broadcasts, owner, buyer };
};

test('shop purchase can take more than 20 items and removes exactly that stock once', () => {
  // risk: stock duplication and owner proceeds accuracy
  const { room, sent, owner, buyer } = makeRoom();
  room.onBuy({ id: 'buyer', name: 'Bo' }, { owner: 'owner', good: 'bread', n: 25 });

  assert.equal(room.markets.owner.stock.bread, 5);
  assert.deepEqual(sent.map(({ socket, message }) => [socket.id, message.t, message.n, message.gold, message.cost]), [
    ['owner-socket', 'sold', 25, 50, undefined],
    ['buyer-socket', 'bought', 25, undefined, 50],
  ]);
});

test('shop buy refuses a quantity above actual inventory without changing stock', () => {
  // risk: negative inventory from stale/oversized shelf quantities
  const { room, sent } = makeRoom();
  room.onBuy({ id: 'buyer', name: 'Bo' }, { owner: 'owner', good: 'bread', n: 31 });

  assert.equal(room.markets.owner.stock.bread, 30);
  assert.equal(sent.at(-1).message.t, 'buyfail');
  assert.equal(sent.at(-1).message.why, 'The clerk does not have that many.');
});
