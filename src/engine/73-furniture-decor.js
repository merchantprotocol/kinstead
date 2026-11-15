/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Decor furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class DecorFurnitureBuilder {
    build() {
      return {
    rug: { name: 'Rug', group: 'Decor', size: [3, 2], solid: false, layer: 'floor', build(k, o) { k.box(o.state && o.state.color === 'blue' ? 'rugBlue' : 'rug', 0, 0, 0, 1.4, 0.015, 0.92, 0, 0, 0, 'face'); } },
    candle: {
      name: 'Candle stand', group: 'Decor', size: [1, 1],
      build(k) {
        k.box('iron', 0, 0, 0, 0.22, 0.04, 0.22); k.box('iron', 0, 0.04, 0, 0.04, 0.96, 0.04); k.box('iron', 0, 1.0, 0, 0.3, 0.03, 0.06); k.box('iron', 0, 1.0, 0, 0.06, 0.03, 0.3);
        K.FurniturePrimitives.candleAt(k, 0, 1.03, 0, 0.16); K.FurniturePrimitives.candleAt(k, 0.12, 1.03, 0, 0.1); K.FurniturePrimitives.candleAt(k, -0.12, 1.03, 0, 0.12); K.FurniturePrimitives.candleAt(k, 0, 1.03, 0.12, 0.09);
      },
      dyn: { candles: [[0, 1.22, 0]] },
    },
    barrel: {
      name: 'Barrel', group: 'Decor', size: [1, 1],
      build(k) { k.geo('wood', K.FurniturePrimitives.CYL8(), 0, 0.26, 0, 0, 0.2, 0, 0.19, 0.52, 0.19, 1.2, 0.5); for (const y of [0.08, 0.44]) k.geo('iron', K.FurniturePrimitives.CYL8(), 0, y, 0, 0, 0.2, 0, 0.2, 0.04, 0.2); k.geo('timber', K.FurniturePrimitives.CYL8(), 0, 0.52, 0, 0, 0.2, 0, 0.17, 0.02, 0.17); },
    },
    sack: {
      name: 'Sack', group: 'Decor', size: [1, 1],
      build(k) { k.box('linen', 0, 0, 0, 0.3, 0.26, 0.26, 0.3); k.box('linen', 0, 0.22, 0, 0.24, 0.1, 0.2, 0.3, 0.1); k.box('leather', 0, 0.31, 0, 0.1, 0.04, 0.1, 0.3); k.box('linen', 0.03, 0.34, 0, 0.12, 0.06, 0.1, 0.3); k.box('linen', 0.18, 0, 0.12, 0.2, 0.18, 0.18, -0.5, 0, 0.3); },
    },
    crate: { name: 'Crate', group: 'Decor', size: [1, 1], build(k) { k.box('crate', 0, 0, 0, 0.42, 0.42, 0.42, 0.1, 0, 0, 'face'); } },
    banner: {
      name: 'Wall banner', group: 'Decor', size: [1, 1], solid: false, layer: 'wall',
      build(k, o) { k.box('timber', 0, 1.85, -0.2, 0.42, 0.04, 0.04); k.box('brass', -0.22, 1.84, -0.2, 0.04, 0.06, 0.06); k.box('brass', 0.22, 1.84, -0.2, 0.04, 0.06, 0.06); k.quad(o.state && o.state.color === 'red' ? 'hangingRed' : 'hanging', [-0.18, 1.08, -0.17], [0.18, 1.08, -0.17], [0.18, 1.86, -0.17], [-0.18, 1.86, -0.17], [[0, 0], [1, 0], [1, 1], [0, 1]]); },
    },
    chair: {
      name: 'Chair', group: 'Decor', size: [1, 1],
      build(k) { K.FurniturePrimitives.legs(k, 0.32, 0.32, 0.26, 'timber', 0.045); k.box('wood', 0, 0.26, 0, 0.36, 0.05, 0.36); for (const sx of [-1, 1]) k.box('timber', sx * 0.14, 0.31, -0.155, 0.05, 0.42, 0.05); k.box('wood', 0, 0.48, -0.16, 0.32, 0.2, 0.03); },
      interact: { type: 'sit', label: 'Chair', actions: [{ id: 'sit', label: 'Sit' }] },
    },
    bench: {
      name: 'Bench', group: 'Decor', size: [2, 1],
      build(k) { for (const sx of [-0.36, 0.36]) k.box('timber', sx, 0, 0, 0.06, 0.24, 0.28); k.box('timber', 0, 0.1, 0, 0.72, 0.05, 0.05); k.box('wood', 0, 0.24, 0, 0.94, 0.06, 0.32); },
      interact: { type: 'sit', label: 'Bench', actions: [{ id: 'sit', label: 'Sit' }] },
    },
    shelf: {
      name: 'Wall shelf', group: 'Decor', size: [2, 1], solid: false, layer: 'wall',
      build(k) {
        for (const y of [0.95, 1.35]) { k.box('wood', 0, y, -0.12, 0.9, 0.04, 0.24); for (const sx of [-0.36, 0.36]) k.box('iron', sx, y - 0.1, -0.2, 0.03, 0.1, 0.06); }
        K.FurniturePrimitives.jar(k, -0.3, 0.99, -0.12, 'wax'); K.FurniturePrimitives.jar(k, -0.15, 0.99, -0.1, 'food', 0.8); k.box('wood', 0.15, 0.99, -0.12, 0.2, 0.12, 0.14); K.FurniturePrimitives.jar(k, 0.32, 0.99, -0.12, 'green', 1.1);
        k.box('books', -0.12, 1.39, -0.12, 0.4, 0.22, 0.18); K.FurniturePrimitives.jar(k, 0.2, 1.39, -0.12, 'brass', 0.8);
      },
    }
      };
    }
  }
  K.DecorFurnitureBuilder = DecorFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
