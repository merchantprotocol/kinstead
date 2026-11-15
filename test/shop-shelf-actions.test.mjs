import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/engine/129-castle-shop-shelf-set.js', import.meta.url), 'utf8');
const loadShopShelfSet = () => {
  const context = {
    K: {
      TILE: 1,
      CastleData: { resName: (good) => good },
      Interactions: { register() {} },
      ShelfStock: class {
        constructor(game) { this.game = game; }
        count() { return 3; }
        take(...args) { this.game.calls.push(['take', ...args]); }
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.K.ShopShelfSet;
};

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
  const actions = set.actions(game, 'inside', [{ good: 'bread', count: 3 }]);

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
  const actions = set.actions(game, 'inside', [{ good: 'bread', count: 7 }]);

  actions.find((action) => action.id === 'shop-take-bread-all').run();
  assert.deepEqual(game.calls, [['buy', 'owner', 'bread', 7]]);
});

test('owner shelf take and pricing use the owner ledger and existing price controls', () => {
  // risk: duplicate owner inventory or stock loss while setting prices
  const Set = loadShopShelfSet();
  const game = makeGame('owner');
  const spec = { id: 'bakery:owner', x: 0, z: 0, footprint: { w: 4, h: 4 } };
  const set = new Set(game, 'bakery', spec, 'owner');
  const actions = set.actions(game, 'inside', [{ good: 'bread', count: 3 }]);

  actions.find((action) => action.id === 'shop-take-bread-all').run();
  actions.find((action) => action.id === 'shop-prices').run();
  assert.deepEqual(game.calls, [['take', 'bread', 3], ['prices']]);
});
