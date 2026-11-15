/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* HerdSync renders client-owned wandering copies of other players' livestock. */
(function (G) {
  const K = G.K;
  class HerdSync {
    constructor(game, multiplayer) {
      this.g = game;
      this.mp = multiplayer;
      this.herds = new Map();
      this.clock = 0;
      this.stock = {
        g: game,
        blocker: () => game.economy.stock.blocker(),
      };
    }

    apply(records) {
      const wanted = new Map();
      for (const herd of Object.values(records || {})) {
        if (!herd || herd.owner === this.mp.me || !herd.count) continue;
        wanted.set(herd.owner + ':' + herd.piece, herd);
      }
      for (const [id, herd] of this.herds) {
        const next = wanted.get(id);
        if (!next || next.count !== herd.count || next.kind !== herd.kind) {
          for (const animal of herd.animals) animal.dispose();
          this.herds.delete(id);
        } else wanted.delete(id);
      }
      for (const [id, herd] of wanted) this.spawn(id, herd);
    }

    spawn(id, herd) {
      const rec = this.mp.world.pieces.get(herd.piece), home = rec && rec.p;
      if (!home || home.type !== (herd.kind === 'cow' ? 'barn' : 'coop')) return;
      const animals = [];
      for (let i = 0; i < herd.count; i++) {
        const angle = i * 2.399963, radius = 1.8 + (i % 3) * 0.3;
        const x = home.x + Math.cos(angle) * radius, z = home.z + Math.sin(angle) * radius;
        const animal = new K.Beast(this.stock, herd.kind, home, x, z);
        animals.push(animal);
      }
      this.herds.set(id, { count: herd.count, kind: herd.kind, animals });
    }

    update(dt) {
      this.clock += dt;
      this.stock.clock = this.clock;
      for (const herd of this.herds.values()) for (const animal of herd.animals) animal.update(dt);
    }

    removePiece(pieceId) {
      for (const [id, herd] of this.herds) {
        if (!id.endsWith(':' + pieceId)) continue;
        for (const animal of herd.animals) animal.dispose();
        this.herds.delete(id);
      }
    }

    dispose() {
      for (const herd of this.herds.values()) for (const animal of herd.animals) animal.dispose();
      this.herds.clear();
    }
  }

  Object.assign(K, { HerdSync });
})(typeof window !== 'undefined' ? window : globalThis);
