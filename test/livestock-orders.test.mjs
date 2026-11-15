import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const K = { LIVESTOCK: { chicken: { max: 12, price: 5 }, cow: { max: 8, price: 10 } } };
const context = { K, globalThis: { K } };
vm.runInNewContext(readFileSync(new URL('../src/engine/123-castle-livestock-orders.js', import.meta.url), 'utf8'), context);
const LivestockOrders = K.LivestockOrders;

class StockFixture {
  constructor() {
    this.g = { castle: { pieces: [{ uid: 7, type: 'coop' }] } };
    this.herds = new Map([[7, []]]);
    this.wheat = 20;
    this.buys = 0;
    this.eco = { wheatHeld: () => this.wheat };
    this.orders = new LivestockOrders(this);
  }
  herd(piece) { return this.herds.get(piece.uid); }
  buy(piece, options) {
    const herd = this.herd(piece);
    if (this.wheat < 5 || herd.length >= 12) return false;
    this.wheat -= 5;
    herd.push({});
    this.buys++;
    return options.quiet;
  }
}

test('livestock order tops up to target on its interval and stops at target', () => {
  // risk: money — recurring purchases must spend only once per interval and stop at the configured cap.
  const stock = new StockFixture(), [coop] = stock.g.castle.pieces;
  stock.orders.configure(coop, { enabled: true, target: 2, every: 60 });
  stock.orders.tick(59);
  assert.equal(stock.buys, 0);
  stock.orders.tick(1);
  assert.equal(stock.buys, 1);
  assert.equal(stock.wheat, 15);
  stock.orders.tick(60);
  assert.equal(stock.buys, 2);
  stock.orders.tick(600);
  assert.equal(stock.buys, 2);
});

test('livestock order pauses when wheat is short and resumes after save/restore', () => {
  // risk: money / persistence — unaffordable orders must not spend, and reload must retain enabled target state.
  const stock = new StockFixture(), [coop] = stock.g.castle.pieces;
  stock.wheat = 0;
  stock.orders.configure(coop, { enabled: true, target: 3, every: 60 });
  stock.orders.tick(60);
  assert.equal(stock.buys, 0);
  const saved = JSON.parse(JSON.stringify(stock.orders.toJSON()));
  const restored = new LivestockOrders(stock);
  restored.restore(saved);
  stock.orders = restored;
  stock.wheat = 5;
  stock.orders.tick(60);
  assert.equal(stock.buys, 1);
  assert.equal(stock.herd(coop).length, 1);
});
