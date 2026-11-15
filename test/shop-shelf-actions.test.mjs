import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const stockSource = readFileSync(new URL('../src/engine/128-castle-shelf-stock.js', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/engine/129-castle-shop-shelf-set.js', import.meta.url), 'utf8');
const loadShopShelfSet = () => {
  const context = {
    K: {
      TILE: 1,
      CastleData: { resName: (good) => good },
      Interactions: { register() {} },
    },
  };
  vm.createContext(context);
  vm.runInContext(stockSource, context);
  const RealStock = context.K.ShelfStock;
  context.K.ShelfStock = class extends RealStock {
    count() { return 3; }
    take(...args) { this.game.calls.push(['take', ...args]); }
  };
  vm.runInContext(source, context);
  return context.K.ShopShelfSet;
};

const INSIDE = { slot: 'inside', x: 2, z: 2, y: 0.15 };

const makeGame = (viewer, teamOwner = false) => {
  const calls = [];
  return {
    calls,
    mp: { net: { id: viewer, on() {} }, mayUse: (owner) => owner === viewer || (teamOwner && owner === 'owner') },
    workers: { buy: (...args) => calls.push(['buy', ...args]), setPrices: () => calls.push(['prices']) },
    cui: { toast: (text) => calls.push(['toast', text]) },
    castle: { amount: () => 100 },
    play: { refreshProps() {} },
    sound: { play() {} },
    changed() {},
    stock: { take: (...args) => calls.push(['take', ...args]) },
  };
};

test('visitor shelf interaction offers only the talk-to-shopkeeper path', () => {
  // risk: visitors getting a free stock-transfer path
  const Set = loadShopShelfSet();
  const game = makeGame('visitor');
  const spec = { id: 'bakery:owner', x: 0, z: 0, footprint: { w: 4, h: 4 } };
  const set = new Set(game, 'bakery', spec, 'owner');
  const actions = set.actions(game, INSIDE, [{ good: 'bread', count: 3 }]);

  assert.equal(actions.length, 1);
  actions[0].run();
  assert.deepEqual(game.calls, [['toast', 'Talk to the baker to buy.']]);
});

test('teammate shelf take uses the existing server buy path at displayed quantity', () => {
  // risk: bypassing authoritative shared stock / free-team policy
  const Set = loadShopShelfSet();
  const game = makeGame('teammate', true);
  const spec = { id: 'bakery:owner', x: 0, z: 0, footprint: { w: 4, h: 4 } };
  const set = new Set(game, 'bakery', spec, 'owner');
  const actions = set.actions(game, INSIDE, [{ good: 'bread', count: 7 }]);

  actions.find((action) => action.id === 'shop-take-bread-all').run();
  assert.deepEqual(game.calls, [['buy', 'owner', 'bread', 7, INSIDE]]);
});

test('owner shelf take and pricing use the owner ledger and existing price controls', () => {
  // risk: duplicate owner inventory or stock loss while setting prices
  const Set = loadShopShelfSet();
  const game = makeGame('owner');
  const spec = { id: 'bakery:owner', x: 0, z: 0, footprint: { w: 4, h: 4 } };
  const set = new Set(game, 'bakery', spec, 'owner');
  const actions = set.actions(game, INSIDE, [{ good: 'bread', count: 3 }]);

  actions.find((action) => action.id === 'shop-take-bread-all').run();
  actions.find((action) => action.id === 'shop-prices').run();
  assert.deepEqual(game.calls, [['take', 'bread', 3], ['prices']]);
});

test('a shop restored before multiplayer starts belongs to the local player once joined', () => {
  // risk: owner locked out of their own shop stock after rejoin (QA prod bug)
  const Set = loadShopShelfSet();
  const game = makeGame('ann');
  const mp = game.mp;
  game.mp = null;
  const spec = { id: 'bakery:local', x: 0, z: 0, footprint: { w: 4, h: 4 } };
  const set = new Set(game, 'bakery', spec, '');
  game.mp = mp;

  assert.equal(set.owner, 'ann');
  const counter = set.counterActions(game, { x: 3, z: 5 });
  assert.deepEqual(counter.map((action) => action.id).join(), 'shop-prices');
  const actions = set.actions(game, INSIDE, [{ good: 'bread', count: 3 }]);
  actions.find((action) => action.id === 'shop-take-bread-all').run();
  assert.deepEqual(game.calls, [['take', 'bread', 3]]);
});

test('another player still sees a remote owner shop as theirs to trade with', () => {
  // risk: lazy owner resolution handing a visitor the owner's controls
  const Set = loadShopShelfSet();
  const game = makeGame('visitor');
  const spec = { id: 'bakery:owner', x: 0, z: 0, footprint: { w: 4, h: 4 } };
  const set = new Set(game, 'bakery', spec, 'owner');

  assert.equal(set.owner, 'owner');
  assert.equal(set.counterActions(game, { x: 3, z: 5 }).map((action) => action.id).join(), 'shop-trade');
});
