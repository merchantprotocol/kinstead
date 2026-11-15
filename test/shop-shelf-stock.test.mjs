import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const stockSource = readFileSync(new URL('../src/engine/128-castle-shelf-stock.js', import.meta.url), 'utf8');
const loadShelfStock = () => {
  const context = { K: { TILE: 1 } };
  vm.createContext(context);
  vm.runInContext(stockSource, context);
  return context.K.ShelfStock;
};

test('owner shelf take transfers only accepted items out of the shared ledger', () => {
  // risk: duplicate goods / economy ledger accuracy
  const ShelfStock = loadShelfStock();
  const ledger = { goods: { bread: 8 }, amount: (good) => ledger.goods[good] || 0, take(good, n) { ledger.goods[good] -= n; } };
  const game = {
    workers: { cook: { market: {} }, pubSig: 'cached' },
    economy: { ledger: () => ledger },
    castle: { add: (_good, n) => Math.min(n, 3) },
    play: { me: {}, float() {}, refreshProps() {} },
    sound: { play() {} },
    changed() {},
    cui: { toast() {} },
  };
  const stock = new ShelfStock(game, 'bakery', 'owner');

  assert.equal(stock.take('bread', 5), 3);
  assert.equal(ledger.goods.bread, 5);
  assert.equal(game.workers.pubSig, '');
});

test('full owner stores leave shop stock untouched', () => {
  // risk: stock loss when the recipient has no capacity
  const ShelfStock = loadShelfStock();
  const ledger = { goods: { bread: 4 }, amount: (good) => ledger.goods[good] || 0, take(good, n) { ledger.goods[good] -= n; } };
  let message = '';
  const game = {
    workers: { cook: { market: {} }, pubSig: 'cached' },
    economy: { ledger: () => ledger },
    castle: { add: () => 0 },
    cui: { toast: (text) => { message = text; } },
  };
  const stock = new ShelfStock(game, 'bakery', 'owner');

  assert.equal(stock.take('bread', 1), 0);
  assert.equal(ledger.goods.bread, 4);
  assert.equal(message, 'Your stores are full.');
});

test('bakery shelf shares account for a single loaf without displaying duplicates', () => {
  // risk: displayed shelf quantities exceeding real owner stock
  const ShelfStock = loadShelfStock();
  const market = { goods: { bread: 1 } };
  const game = { workers: { cook: { market } }, economy: { ledger: () => market } };
  const stock = new ShelfStock(game, 'bakery', '');

  assert.deepEqual(JSON.parse(JSON.stringify(stock.goods('inside'))), [{ good: 'bread', count: 1 }]);
  assert.deepEqual(JSON.parse(JSON.stringify(stock.goods('outside'))), []);
});
