/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* FarmVisuals draws remote farm-building stock without importing economic ownership. */
(function (G) {
  const K = G.K;
  class FarmVisuals {
    constructor(game, multiplayer) {
      this.g = game;
      this.mp = multiplayer;
      this.groups = new Map();
    }

    apply(records) {
      for (const group of this.groups.values()) this.g.group.remove(group);
      this.groups.clear();
      for (const stock of Object.values(records || {})) {
        if (!stock || stock.owner === this.mp.me) continue;
        const piece = this.mp.world.pieces.get(stock.piece);
        if (!piece) continue;
        const kit = new K.VoxKit();
        this.buildPile(kit, piece.p.type, stock.goods || {});
        const group = new G.THREE.Group();
        for (const mesh of kit.meshes(this.g.R.bmats)) group.add(mesh);
        group.position.set(piece.p.x, this.g.play.nav.y(piece.p.x, piece.p.z), piece.p.z);
        group.rotation.y = piece.p.rot || 0;
        this.g.group.add(group);
        this.groups.set(stock.owner + ':' + stock.piece, group);
      }
    }

    buildPile(kit, type, goods) {
      const material = {
        wheat: 'hay', bread: 'bread', beef: 'food', egg: 'linen', milk: 'plaster',
        iron: 'iron', stone: 'ashlar', wood: 'bark', dirt: 'soot', gold: 'brass',
      };
      if (type === 'silo') {
        const fill = Math.min(1, (goods.wheat || 0) / 200);
        kit.box('hay', 0, 0.1, 0.78, 0.18, Math.max(0.05, 3 * fill), 0.04);
        return;
      }
      if (type === 'market') {
        const sections = [[-4, ['wheat', 'bread']], [-1, ['beef', 'egg', 'milk', 'food']], [1, ['arrow', 'gold']], [4, ['wood', 'stone', 'iron', 'dirt']]];
        for (const [cx, items] of sections) {
          let slot = 0;
          for (const good of items) {
            const stacks = Math.min(9, Math.ceil((goods[good] || 0) / 12));
            for (let i = 0; i < stacks; i++, slot++) {
              const on = slot < 6, x = cx - 0.55 + (slot % 3) * 0.55;
              const z = on ? -0.2 + Math.floor(slot / 3) * 0.32 : 0.65 + Math.floor((slot - 6) / 3) * 0.3;
              kit.box(material[good] || 'crate', x, on ? 0.78 : 0, z, 0.26, 0.2, 0.24, i * 0.4);
            }
          }
        }
        return;
      }
      let index = 0;
      for (const [good, amount] of Object.entries(goods)) {
        const stacks = Math.min(6, Math.ceil(amount / 12));
        for (let i = 0; i < stacks; i++, index++) {
          kit.box(material[good] || 'crate', -0.55 + (index % 3) * 0.45, 0, 1 + Math.floor(index / 3) * 0.4, 0.3, 0.22, 0.3);
        }
      }
    }
  }

  Object.assign(K, { FarmVisuals });
})(typeof window !== 'undefined' ? window : globalThis);
