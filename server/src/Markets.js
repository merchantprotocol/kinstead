// Copyright (c) 2026 Merchant Protocol. All rights reserved.
import { ShopReach } from './ShopReach.js';

export class Markets {
  cleanOffers(offers) {
    const clean = {};
    for (const [key, value] of Object.entries(offers || {}).slice(0, 24)) {
      if (!/^[a-z_]{1,16}$/.test(key)) continue;
      clean[key] = Math.max(0, Math.min(9999, value | 0));
    }
    return clean;
  }

  onMarket(p, m) {
    const market = this.markets[p.id] = {
      owner: p.id, name: p.name, x: +m.x || 0, z: +m.z || 0,
      stock: this.cleanOffers(m.stock), prices: this.cleanOffers(m.prices),
    };
    this.state.storage.put('markets', this.markets);
    this.broadcast({ t: 'market', m: market }, null);
  }

  onBuy(p, m) {
    const [ws] = this.byId(p.id);
    const market = this.markets[String(m.owner || '')];
    const good = String(m.good || ''), amount = Math.max(1, Math.min(999, m.n | 0));
    const fail = (why) => this.send(ws, { t: 'buyfail', why });
    if (!market || market.owner === p.id) return fail('There is no clerk here to buy from.');
    if (!this.shopReach.allows(p, market, m.at)) return fail('Walk up to the market stalls to trade.');
    const teammate = this.sameTeam(p.id, market.owner);
    const price = teammate ? 0 : market.prices[good] | 0;
    if (!teammate && !price) return fail('That is not for sale.');
    if ((market.stock[good] | 0) < amount) return fail('The clerk does not have that many.');
    market.stock[good] -= amount;
    const sale = { good, n: amount, gold: price * amount, by: p.name };
    const [ownerSocket] = this.byId(market.owner);
    if (ownerSocket) this.send(ownerSocket, { t: 'sold', ...sale });
    else {
      (this.sales[market.owner] = this.sales[market.owner] || []).push(sale);
      this.state.storage.put('sales', this.sales);
    }
    this.state.storage.put('markets', this.markets);
    this.send(ws, { t: 'bought', owner: market.owner, good, n: amount, cost: price * amount });
    this.broadcast({ t: 'market', m: market }, null);
  }

  takeSales(id) {
    const sales = this.sales[id] || [];
    if (sales.length) { delete this.sales[id]; this.state.storage.put('sales', this.sales); }
    return sales;
  }

  install(room) {
    room.shopReach = new ShopReach((a, b, range) => room.near(a, b, range));
    for (const method of ['cleanOffers', 'onMarket', 'onBuy', 'takeSales']) room[method] = this[method].bind(room);
  }
}
