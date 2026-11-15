/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* StoreSync: your barrels and piles, kept on the server so raiders can take from them, and everyone else's shown to you. */
(function (G) {
  const K = G.K;

  class StoreSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      this.net.on('stores', (m) => this.onStores(m));
      this.net.on('store', (m) => this.onStore(m));
      this.net.on('stock', (m) => this.onStock(m));
      this.net.on('took', (m) => this.giveTaken(m.res, m.n));
      this.net.on('raided', (m) => this.onRaided(m));
    }

    get remote() {
      return this.mp.stores;
    }

    own(store) {
      return store.stock != null && store.present;
    }

    describe(store) {
      return {
        id: store.id,
        kind: store.kind,
        name: store.name,
        res: store.res,
        x: +store.x.toFixed(2),
        z: +store.z.toFixed(2),
        stack: store.stack || 1,
        stock: store.stock,
      };
    }

    publishStores() {
      const list = this.g.home.stores.filter((s) => this.own(s)).map((s) => this.describe(s));
      this.net.send({ t: 'stores', list });
    }

    storeAdd(store) {
      if (this.own(store)) this.net.send(Object.assign({ t: 'store' }, this.describe(store)));
    }

    storeGone(store) {
      this.net.send({ t: 'store', id: store.id, gone: true });
    }

    stockDelta(store, delta) {
      if (delta) this.net.send({ t: 'stock', id: store.id, d: delta });
    }

    /** on joining: take the server's word for what is in your barrels (raiders may have been), then show everyone else's */
    syncStores(list) {
      const me = this.mp.me;
      const mine = list.filter((s) => s.owner === me);
      if (mine.length) this.reconcileMine(mine);
      else this.publishStores();
      for (const store of list) {
        if (store.owner !== me) this.remote.upsert(store);
      }
    }

    localId(serverId) {
      return serverId.slice(this.mp.me.length + 1);
    }

    reconcileMine(mine) {
      const home = this.g.home;
      const byId = new Map(mine.map((s) => [this.localId(s.id), s]));
      for (const store of home.stores.slice()) {
        if (store.stock == null) continue;
        const server = byId.get(store.id);
        byId.delete(store.id);
        if (server) this.setLocalStock(store, server.stock);
        else if (store.pile) this.setLocalStock(store, 0);
        else this.storeAdd(store);
      }
      for (const server of byId.values()) {
        if (server.kind !== 'pile' || server.stock <= 0) continue;
        home.dropPile(server.res, server.x, server.z, server.stock, null, this.localId(server.id), true);
      }
    }

    setLocalStock(store, stock) {
      store.stock = stock;
      if (store.refresh && store.stock > 0) store.refresh();
      store.sync();
    }

    /** a resync: show what others hold now, and re-announce any of yours the server lost */
    reconcileResync(list) {
      const me = this.mp.me;
      const others = list.filter((s) => s.owner !== me);
      const ids = new Set(others.map((s) => s.id));
      for (const store of others) this.remote.upsert(store);
      for (const id of [...this.remote.by.keys()]) {
        if (!ids.has(id)) this.remote.gone(id);
      }
      const mine = new Set(list.filter((s) => s.owner === me).map((s) => this.localId(s.id)));
      for (const store of this.g.home.stores) {
        if (this.own(store) && !mine.has(store.id)) this.storeAdd(store);
      }
    }

    onStores(m) {
      if (m.mine) return;
      this.remote.dropOwner(m.owner);
      for (const store of m.list) this.remote.upsert(store);
    }

    onStore(m) {
      if (m.gone) this.remote.gone(m.id);
      else this.remote.upsert(m.s);
    }

    onStock(m) {
      const prefix = this.mp.me + ':';
      if (!m.id.startsWith(prefix)) {
        this.remote.setStock(m.id, m.stock);
        return;
      }
      const localId = m.id.slice(prefix.length);
      const store = this.g.home.stores.find((q) => q.id === localId);
      if (store && store.stock !== m.stock) this.setLocalStock(store, m.stock);
    }

    takeFrom(id) {
      this.net.send({ t: 'take', id, n: 10 });
    }

    giveTaken(res, n) {
      const g = this.g;
      if (res === 'bread') g.play.player.addItem('bread', n);
      else g.castle.add(res, n);
      g.changed();
      g.sound.play('gather');
      g.play.float(g.play.me, `+${n} ${K.CastleData.resName(res).toLowerCase()}`, 'loot');
    }

    onRaided(m) {
      const what = K.CastleData.resName(m.res).toLowerCase();
      this.g.cui.toast(`${m.by} raided your supplies (${m.n} ${what}).`);
    }
  }

  K.StoreSync = StoreSync;
})(typeof window !== 'undefined' ? window : globalThis);
