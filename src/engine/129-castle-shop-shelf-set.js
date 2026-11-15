/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Per-shop shelf meshes and clickable shopkeeper/shelf entities. */
(function (G) {
  const K = G.K, TILE = K.TILE;

  class ShopShelfSet {
    static TYPES = new Set(['bakery', 'butcher', 'library', 'stable', 'market']);
    static SHOPKEEPERS = { bakery: 'baker', butcher: 'butcher', library: 'alchemist', stable: 'stablekeeper', market: 'clerk' };
    static registerInteraction() {
      K.Interactions.register('c_shop_shelf', {
        color: 0xffcc7a,
        cursor: () => 'hand',
        name: (entity) => entity.name,
        actions: (entity, game) => entity.shelf.actions(game.ext),
        inspect: (entity) => ({ title: entity.name, sub: 'Shop shelf', body: entity.stockText, icon: 'bag', rows: [] }),
      });
    }

    constructor(game, type, spec, owner, turns = 0) {
      this.game = game;
      this.type = type;
      this.spec = spec;
      this.id = owner ? `${type}:${owner}` : spec.id;
      this.turns = turns;
      this.stock = new K.ShelfStock(game, type, owner);
      this.racks = new Map();
      this.parts = this.positions();
      this.disposed = false;
      if (game.net) game.net.on('market', (message) => {
        if (message.m && message.m.owner === this.owner) this.refreshInteractions();
      });
    }

    /** resolved on every use, so a shop restored before multiplayer started still belongs to the local player */
    get owner() { return this.stock.owner; }

    isOwner() { return this.stock.mine(); }

    positions() {
      const spec = this.spec, width = spec.footprint.w, depth = spec.footprint.h;
      const centerX = (spec.x + width / 2) * TILE, centerZ = (spec.z + depth / 2) * TILE;
      const direction = [[0, 1], [-1, 0], [0, -1], [1, 0]][this.turns % 4];
      const halfDepth = (this.turns % 2 ? width : depth) / 2 * TILE;
      const outsideX = centerX + direction[0] * (halfDepth + 1.2);
      const outsideZ = centerZ + direction[1] * (halfDepth + 1.2);
      return [
        { slot: 'inside', x: centerX, z: centerZ, y: 0.15 },
        { slot: 'outside', x: outsideX, z: outsideZ, y: 0.15 },
      ];
    }

    entities() {
      if (this.disposed) return [];
      const entities = [];
      for (const part of this.parts) {
        const goods = this.stock.goods(part.slot);
        this.refreshRack(part, goods);
        const names = goods.map(({ good, count }) => `${count} ${K.CastleData.resName(good)}`).join(', ');
        const shelf = {
          set: this, slot: part.slot, goods,
          actions: (game) => this.actions(game, part, goods),
        };
        entities.push({
          id: `shop-shelf:${this.id}:${part.slot}`, type: 'c_shop_shelf', shelf,
          x: part.x, z: part.z, y: this.game.play.nav.y(part.x, part.z) + part.y,
          r: 0.8, h: 1.3, name: `${this.type} ${part.slot} shelf`,
          stockText: names || 'Empty',
        });
      }
      const counter = this.parts[1];
      entities.push({
        id: `shop-counter:${this.id}`, type: 'c_shop_shelf',
        shelf: { actions: (game) => this.counterActions(game, { x: counter.x + 0.8, z: counter.z }) },
        x: counter.x + 0.8, z: counter.z, y: this.game.play.nav.y(counter.x + 0.8, counter.z),
        r: 0.7, h: 1.2, name: `Talk to the ${ShopShelfSet.SHOPKEEPERS[this.type]}`,
        stockText: 'Talk to the shopkeeper to buy.',
      });
      return entities;
    }

    refreshInteractions() { if (!this.disposed) this.game.play.refreshProps(); }

    actions(game, part, goods) {
      const isOwner = this.isOwner();
      const mayUse = game.mp ? game.mp.mayUse(this.owner) : isOwner;
      const available = goods.filter(({ good }) => this.stock.count(good) > 0);
      if (!isOwner && !mayUse) {
        const name = ShopShelfSet.SHOPKEEPERS[this.type];
        return [{
          id: 'shop-talk', label: 'Talk to the shopkeeper to buy', icon: 'hand',
          run: () => game.cui.toast(`Talk to the ${name} to buy.`),
        }];
      }
      const actions = [];
      for (const { good, count } of available) {
        const take = (amount) => isOwner ? this.stock.take(good, amount) : game.workers.buy(this.owner, good, amount, part);
        actions.push({ id: `shop-take-${good}-1`, label: `Take 1 ${K.CastleData.resName(good)}`, icon: 'hand', run: () => take(1) });
        if (count >= 5) actions.push({ id: `shop-take-${good}-5`, label: `Take 5 ${K.CastleData.resName(good)}`, icon: 'hand', run: () => take(5) });
        actions.push({ id: `shop-take-${good}-all`, label: `Take all ${K.CastleData.resName(good)} (${count})`, icon: 'hand', run: () => take(count) });
      }
      if (isOwner) actions.push({ id: 'shop-prices', label: 'Set shop prices', icon: 'coin', run: () => game.workers.setPrices() });
      if (!actions.length) actions.push({ id: 'shop-empty', label: 'The shelf is empty', icon: 'eye', run: () => game.cui.toast('The shelf is empty.') });
      return actions;
    }

    counterActions(game, at) {
      if (this.isOwner()) {
        return [{ id: 'shop-prices', label: 'Set shop prices', icon: 'coin', run: () => game.workers.setPrices() }];
      }
      return [{ id: 'shop-trade', label: `Talk to the ${ShopShelfSet.SHOPKEEPERS[this.type]}`, icon: 'coin', run: () => game.workers.trade(this.owner, at) }];
    }

    refreshRack(part, goods) {
      const signature = JSON.stringify(goods);
      const current = this.racks.get(part.slot);
      if (current && current.signature === signature) return;
      if (current) this.removeRack(current.group);
      const rack = new G.THREE.Group(), kit = new K.VoxKit();
      kit.box('woodDark', 0, 0.58, -0.13, 0.96, 0.06, 0.32);
      kit.box('woodDark', 0, 1.12, -0.13, 0.96, 0.06, 0.32);
      for (const x of [-0.46, 0.46]) kit.box('woodMid', x, 0.56, -0.13, 0.06, 1.18, 0.32);
      const entries = goods.flatMap(({ good, count }) => Array.from({ length: Math.min(8, Math.ceil(count / 2)) }, () => good));
      entries.forEach((good, index) => {
        const x = -0.34 + (index % 4) * 0.22, z = -0.12 + Math.floor(index / 4) * 0.08;
        const y = index < 4 ? 0.71 : 1.0;
        const color = this.stock.color(good);
        kit.box(color, x, y, z, 0.13, 0.13, 0.12);
      });
      for (const mesh of kit.meshes(this.game.R.bmats)) rack.add(mesh);
      rack.position.set(part.x, this.game.play.nav.y(part.x, part.z) + part.y, part.z);
      this.game.group.add(rack);
      this.racks.set(part.slot, { signature, group: rack });
    }

    removeRack(group) {
      group.traverse((object) => { if (object.geometry) object.geometry.dispose(); });
      this.game.group.remove(group);
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      for (const rack of this.racks.values()) this.removeRack(rack.group);
      this.racks.clear();
    }
  }

  ShopShelfSet.registerInteraction();
  Object.assign(K, { ShopShelfSet });
})(typeof window !== 'undefined' ? window : globalThis);
