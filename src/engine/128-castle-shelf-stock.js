/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Reads and moves shop inventory through the economy's existing owner market ledger. */
(function (G) {
  const K = G.K;

  class ShelfStock {
    static GOODS = {
      bakery: ['bread'],
      butcher: ['beef'],
      library: ['potion_heal', 'potion_speed', 'potion_strength', 'potion_warmth'],
      stable: ['saddle', 'horse'],
    };
    static COLORS = {
      bread: 'wheatGold', beef: 'paintRed', potion_heal: 'potionPink', potion_speed: 'potionTeal',
      potion_strength: 'paintPurple', potion_warmth: 'paintOrange', saddle: 'woodDark', horse: 'woodLight',
    };

    /** `owner` is the shop owner's player id; '' means this player's own shop, whoever this player turns out to be */
    constructor(game, type, owner) { this.game = game; this.type = type; this.fixedOwner = owner || ''; }

    /** the local player's id once multiplayer is up (a shop restored before joining resolves to it later) */
    localId() { const mp = this.game.mp; return (mp && mp.net && mp.net.id) || ''; }

    get owner() { return this.fixedOwner || this.localId(); }

    mine() { return !this.fixedOwner || this.fixedOwner === this.localId(); }

    goods(slot) {
      const available = this.stock(), explicit = ShelfStock.GOODS[this.type];
      const rows = Object.entries(available).filter(([good, count]) => good !== 'gold' && count > 0);
      const selected = explicit ? rows.filter(([good]) => explicit.includes(good)) : rows.sort((a, b) => b[1] - a[1]);
      const half = Math.ceil(selected.length / 2);
      if (explicit) {
        return selected.map(([good, total]) => ({
          good,
          count: slot === 'inside' ? Math.ceil(total / 2) : Math.floor(total / 2),
        })).filter((row) => row.count > 0);
      }
      return (slot === 'inside' ? selected.slice(0, half) : selected.slice(half)).map(([good, count]) => ({ good, count }));
    }

    stock() {
      const game = this.game, workers = game.workers;
      if (!this.mine()) return (workers.markets.get(this.owner) || {}).stock || {};
      const market = workers.cook.market;
      return market ? game.economy.ledger(market).goods : {};
    }

    count(good) { return this.stock()[good] | 0; }

    take(good, requested) {
      const game = this.game, market = game.workers.cook.market;
      if (!market || !Number.isInteger(requested) || requested < 1) return 0;
      const ledger = game.economy.ledger(market), amount = Math.min(ledger.amount(good), requested);
      const added = game.castle.add(good, amount);
      if (added <= 0) { game.cui.toast('Your stores are full.'); return 0; }
      ledger.take(good, added);
      game.workers.pubSig = '';
      game.play.float(game.play.me, `+${added}`, 'loot');
      game.sound.play('gather');
      game.play.refreshProps();
      game.changed();
      return added;
    }

    color(good) { return ShelfStock.COLORS[good] || 'gold'; }
  }

  Object.assign(K, { ShelfStock });
})(typeof window !== 'undefined' ? window : globalThis);
