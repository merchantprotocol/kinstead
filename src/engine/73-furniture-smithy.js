/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Smithy furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class SmithyFurnitureBuilder {
    build() {
      return {
    anvil: {
      name: 'Anvil', group: 'Smithy', size: [1, 1],
      build(k) {
        k.geo('bark', K.FurniturePrimitives.CYL8(), 0, 0.15, 0, 0, 0, 0, 0.17, 0.3, 0.17, 1, 0.6); k.box('wood', 0, 0.3, 0, 0.3, 0.02, 0.3);
        k.box('iron', 0, 0.32, 0, 0.16, 0.12, 0.14); k.box('iron', 0, 0.44, 0, 0.34, 0.08, 0.16); k.box('iron', 0.21, 0.45, 0, 0.1, 0.06, 0.1); k.box('iron', 0.28, 0.46, 0, 0.06, 0.04, 0.06);
        k.box('steel', -0.03, 0.52, 0, 0.26, 0.005, 0.15); K.FurniturePrimitives.hammer(k, -0.02, 0.56, 0.0, 0.5);
      },
      interact: { type: 'smith', label: 'Anvil', station: 'anvil', actions: [{ id: 'craft', label: 'Smith weapons & armor' }], requires: { nearby: 'forge' } },
    },
    forge: {
      name: 'Forge', group: 'Smithy', size: [2, 2], chimney: true,
      build(k) {
        k.box('ashlar', 0, 0, -0.04, 0.95, 0.5, 0.86); k.box('ashlar', 0, 0.5, -0.34, 0.95, 0.34, 0.26); for (const sx of [-1, 1]) k.box('ashlar', sx * 0.42, 0.5, 0, 0.12, 0.1, 0.8);
        k.box('coals', 0, 0.5, 0.02, 0.66, 0.05, 0.56);
        k.box('ashlar', 0, 1.2, -0.18, 0.86, 0.36, 0.6); k.box('ashlar', 0, 1.56, -0.26, 0.6, 0.5, 0.42);
        for (const sx of [-1, 1]) k.box('timber', sx * 0.4, 0.84, 0.06, 0.06, 0.36, 0.06);
        k.box('leather', 0.4, 0.5, 0.36, 0.2, 0.12, 0.24, 0, 0.15); k.box('wood', 0.4, 0.48, 0.36, 0.22, 0.03, 0.26); k.box('iron', 0.4, 0.55, 0.15, 0.04, 0.04, 0.2);
        k.box('iron', -0.2, 0.55, 0.1, 0.03, 0.03, 0.4, 0.4); k.box('glowbar', 0.05, 0.55, 0.05, 0.18, 0.025, 0.04, 0.3);
      },
      dyn: { fire: [0, 0.5, 0.0, 0.5], light: [0, 0.9, 0.35, 1.0], embers: [0, 0.7, 0.0] },
      interact: { type: 'smith', label: 'Forge', station: 'forge', actions: [{ id: 'craft', label: 'Smelt ore' }] },
    },
    grindstone: {
      name: 'Grindstone', group: 'Smithy', size: [1, 1],
      build(k) {
        for (const sx of [-1, 1]) { k.box('timber', sx * 0.12, 0, 0, 0.05, 0.42, 0.06); k.box('timber', sx * 0.12, 0, 0, 0.06, 0.05, 0.38); }
        k.geo('ashlar', K.VoxKit.CYL, 0, 0.42, 0, 0, 0, K.FurniturePrimitives.HALF_TURN, 0.17, 0.08, 0.17, 0.5, 0.2); k.box('iron', 0, 0.42, 0, 0.32, 0.03, 0.03);
        k.box('iron', 0.17, 0.36, 0, 0.03, 0.12, 0.03); k.box('wood', 0.17, 0.3, 0.04, 0.03, 0.03, 0.1); k.box('wood', 0, 0.2, 0.17, 0.2, 0.05, 0.1);
      },
      interact: { type: 'smith', label: 'Grindstone', station: 'grindstone', actions: [{ id: 'craft', label: 'Sharpen' }] },
    },
    workbench: {
      name: 'Workbench', group: 'Smithy', size: [3, 1],
      build(k) {
        K.FurniturePrimitives.legs(k, 1.4, 0.4, 0.42); k.box('timber', 0, 0.14, 0, 1.3, 0.04, 0.34); k.box('wood', 0, 0.42, 0, 1.46, 0.09, 0.46);
        k.box('wood', 0, 0.51, -0.21, 1.4, 0.7, 0.04); for (const x of [-0.5, -0.3, 0.1, 0.35]) k.box('soot', x, 0.95, -0.185, 0.02, 0.02, 0.02);
        K.FurniturePrimitives.hammer(k, -0.5, 0.82, -0.17, 0, K.FurniturePrimitives.HALF_TURN); k.box('steel', -0.28, 0.72, -0.18, 0.1, 0.22, 0.01); k.box('wood', -0.28, 0.92, -0.18, 0.04, 0.08, 0.02);
        k.box('steel', 0.12, 0.68, -0.18, 0.04, 0.28, 0.01); k.box('iron', 0.35, 0.74, -0.18, 0.16, 0.04, 0.02); k.box('iron', 0.35, 0.66, -0.18, 0.03, 0.12, 0.02);
        k.box('iron', 0.6, 0.51, 0.12, 0.1, 0.08, 0.12); k.box('wood', -0.1, 0.51, 0.05, 0.5, 0.04, 0.12, 0.15); k.box('leather', 0.3, 0.51, 0.08, 0.2, 0.02, 0.16, -0.2);
        k.box('wood', -0.55, 0, 0.05, 0.2, 0.14, 0.26); k.box('hay', 0.45, 0, 0.0, 0.3, 0.06, 0.3);
      },
      interact: { type: 'smith', label: 'Workbench', station: 'workbench', actions: [{ id: 'craft', label: 'Craft tools & gear' }] },
    }
      };
    }
  }
  K.SmithyFurnitureBuilder = SmithyFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
