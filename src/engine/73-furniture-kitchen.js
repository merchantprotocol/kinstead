/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kitchen furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class KitchenFurnitureBuilder {
    build() {
      return {
    hearth: {
      name: 'Kitchen hearth', group: 'Kitchen', size: [3, 2], chimney: true,
      build(k) {
        k.box('ashlar', 0, 0, -0.36, 1.5, 1.34, 0.28);
        for (const sx of [-1, 1]) k.box('ashlar', sx * 0.6, 0, -0.1, 0.3, 0.92, 0.5);
        k.box('ashlar', 0, 0, 0.08, 1.4, 0.07, 0.42); k.box('soot', 0, 0.07, -0.18, 0.86, 0.6, 0.2);
        k.box('timber', 0, 0.92, -0.06, 1.6, 0.12, 0.6); k.box('ashlar', 0, 1.04, -0.24, 1.2, 0.5, 0.42); k.box('ashlar', 0, 1.54, -0.3, 0.9, 0.4, 0.3);
        k.box('coals', 0, 0.07, -0.06, 0.62, 0.05, 0.34); k.box('timber', -0.08, 0.1, -0.06, 0.5, 0.07, 0.08, 0.5); k.box('timber', 0.1, 0.1, -0.04, 0.46, 0.07, 0.08, -0.6);
        k.box('iron', 0.34, 0.07, -0.3, 0.03, 0.76, 0.03); k.box('iron', 0.2, 0.8, -0.3, 0.3, 0.03, 0.03);
        k.geo('iron', K.FurniturePrimitives.CYL8(), 0.06, 0.52, -0.12, 0, 0, 0, 0.12, 0.16, 0.12); k.box('food', 0.06, 0.6, -0.12, 0.16, 0.02, 0.16);
        k.box('wood', -0.45, 0.98, 0.12, 0.22, 0.12, 0.12); k.box('bread', 0.45, 0.98, 0.1, 0.16, 0.08, 0.1); K.FurniturePrimitives.jar(k, 0.62, 0.98, 0.08, 'wax');
      },
      dyn: { fire: [0, 0.08, -0.06, 0.62], light: [0, 0.55, 0.25, 0.85], embers: [0, 0.3, -0.06] },
      interact: { type: 'cook', label: 'Kitchen hearth', station: 'hearth', actions: [{ id: 'cook', label: 'Cook' }, { id: 'warm', label: 'Warm up' }] },
    },
    pantry: {
      name: 'Pantry shelves', group: 'Kitchen', size: [2, 1],
      build(k) {
        k.box('wood', 0, 0, -0.2, 0.94, 1.3, 0.05); for (const sx of [-1, 1]) k.box('timber', sx * 0.45, 0, -0.04, 0.05, 1.3, 0.36);
        for (const y of [0.04, 0.44, 0.84, 1.24]) k.box('wood', 0, y, -0.04, 0.88, 0.04, 0.34);
        k.geo('cheese', K.FurniturePrimitives.CYL(), -0.26, 0.54, -0.02, 0, 0, 0, 0.12, 0.1, 0.12); k.geo('cheese', K.FurniturePrimitives.CYL(), -0.04, 0.54, -0.04, 0, 0, 0, 0.1, 0.08, 0.1);
        k.box('bread', 0.18, 0.48, 0.0, 0.22, 0.09, 0.12, 0.2); k.box('bread', 0.32, 0.48, -0.08, 0.16, 0.08, 0.1, -0.3);
        K.FurniturePrimitives.jar(k, -0.3, 0.88, -0.05); K.FurniturePrimitives.jar(k, -0.16, 0.88, 0.0, 'food'); K.FurniturePrimitives.jar(k, 0.02, 0.88, -0.06, 'green'); k.box('food', 0.24, 0.88, -0.02, 0.24, 0.12, 0.2); k.box('green', 0.24, 1.0, -0.02, 0.16, 0.04, 0.14);
        k.box('linen', -0.2, 0.08, -0.04, 0.3, 0.3, 0.24, 0.2); k.box('wood', 0.2, 0.08, -0.04, 0.3, 0.28, 0.26);
        for (const sx of [-0.25, 0, 0.25]) { k.box('soot', sx, 1.06, 0.12, 0.01, 0.12, 0.01); k.box('food', sx, 0.9, 0.12, 0.07, 0.16, 0.07); }
      },
      interact: { type: 'eat', label: 'Pantry', actions: [{ id: 'eat', label: 'Eat' }, { id: 'take_food', label: 'Take food' }] },
    },
    table: {
      name: 'Table', group: 'Kitchen', size: [2, 2],
      build(k) {
        K.FurniturePrimitives.legs(k, 0.86, 0.8, 0.46); k.box('wood', 0, 0.46, 0, 0.94, 0.07, 0.88);
        k.box('linen', -0.18, 0.53, 0.12, 0.2, 0.015, 0.2); k.box('food', -0.18, 0.545, 0.12, 0.1, 0.05, 0.08);
        k.box('bread', 0.16, 0.53, -0.12, 0.22, 0.09, 0.12, 0.4); k.geo('wood', K.FurniturePrimitives.CYL8(), 0.24, 0.58, 0.18, 0, 0, 0, 0.04, 0.1, 0.04); K.FurniturePrimitives.candleAt(k, -0.05, 0.53, -0.22);
      },
      dyn: { candles: [[-0.05, 0.7, -0.22]] },
      interact: { type: 'eat', label: 'Table', actions: [{ id: 'eat', label: 'Eat' }] },
    },
    long_table: {
      name: 'Long table', group: 'Hall', size: [4, 2],
      build(k) {
        for (const sx of [-0.8, 0.8]) { k.box('timber', sx, 0, 0, 0.08, 0.46, 0.72); k.box('timber', sx, 0, 0, 0.16, 0.06, 0.8); }
        k.box('timber', 0, 0.2, 0, 1.6, 0.06, 0.06); k.box('wood', 0, 0.46, 0, 1.94, 0.08, 0.9);
        for (const x of [-0.6, -0.1, 0.4]) { k.box('linen', x, 0.54, 0.2, 0.2, 0.015, 0.2); k.box('food', x, 0.555, 0.2, 0.12, 0.05, 0.08); k.geo('brass', K.FurniturePrimitives.CYL8(), x + 0.18, 0.6, 0.22, 0, 0, 0, 0.035, 0.1, 0.035); }
        k.box('bread', 0.15, 0.54, -0.15, 0.24, 0.1, 0.13, 0.3); k.box('food', -0.35, 0.54, -0.12, 0.3, 0.12, 0.2); K.FurniturePrimitives.candleAt(k, -0.75, 0.54, -0.15); K.FurniturePrimitives.candleAt(k, 0.75, 0.54, -0.15, 0.16);
      },
      dyn: { candles: [[-0.75, 0.72, -0.15], [0.75, 0.75, -0.15]] },
      interact: { type: 'eat', label: 'Feast table', actions: [{ id: 'eat', label: 'Eat' }] },
    }
      };
    }
  }
  K.KitchenFurnitureBuilder = KitchenFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
