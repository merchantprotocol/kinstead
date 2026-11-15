/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Bakery furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class BakeryFurnitureBuilder {
    build() {
      return {
    oven: {
      name: 'Bread oven', group: 'Bakery', size: [3, 2], chimney: true,
      build(k) {
        k.box('stoneLight', 0, 0, -0.05, 1.42, 0.42, 0.86); k.box('stoneMid', 0, 0.42, -0.05, 1.46, 0.05, 0.9);
        k.box('roofRed', 0, 0.47, -0.08, 1.3, 0.34, 0.8); k.box('roofRed', 0, 0.81, -0.1, 1.08, 0.2, 0.66); k.box('roofRed', 0, 1.01, -0.12, 0.8, 0.14, 0.5); k.box('roofRed', 0, 1.15, -0.14, 0.44, 0.08, 0.32);
        k.box('roofRed', 0, 1.0, -0.36, 0.34, 0.9, 0.2);   // flue
        k.box('soot', 0, 0.47, 0.3, 0.5, 0.32, 0.04); k.box('stoneLight', 0, 0.79, 0.31, 0.58, 0.06, 0.08); for (const sx of [-1, 1]) k.box('stoneLight', sx * 0.28, 0.47, 0.31, 0.06, 0.32, 0.08);
        k.box('coals', 0, 0.47, 0.18, 0.4, 0.04, 0.2);
        k.box('woodLight', 0, 0.42, 0.42, 1.2, 0.04, 0.12); K.FurniturePrimitives.loaf(k, -0.42, 0.46, 0.42, 0.1); K.FurniturePrimitives.loaf(k, 0.42, 0.46, 0.42, -0.2); K.FurniturePrimitives.loaf(k, 0.2, 0.46, 0.42, 0.05, 0.9);
        k.box('woodLight', 0.6, 0.0, 0.38, 0.05, 1.05, 0.03, 0, -0.18); k.box('woodLight', 0.6, 0.0, 0.36, 0.22, 0.03, 0.18, 0, -0.18);   // baker's peel
        for (let i = 0; i < 4; i++) k.box('woodMid', -0.55 + i * 0.05, 0, 0.42, 0.04, 0.3, 0.05, 0, 0, 0.2);
      },
      dyn: { fire: [0, 0.5, 0.22, 0.34], light: [0, 0.7, 0.55, 0.9], embers: [0, 0.6, 0.2] },
    },
    bread_rack: {
      name: 'Bread rack', group: 'Bakery', size: [2, 1],
      build(k) {
        for (const sx of [-1, 1]) k.box('woodLight', sx * 0.44, 0, -0.04, 0.05, 1.3, 0.36);
        k.box('woodMid', 0, 0, -0.2, 0.92, 1.3, 0.03);
        [0.06, 0.4, 0.74, 1.08].forEach((y, i) => {
          k.box('woodLight', 0, y, -0.04, 0.86, 0.04, 0.34);
          for (let j = 0; j < 4; j++) K.FurniturePrimitives.loaf(k, -0.3 + j * 0.2, y + 0.04, -0.03 + ((i + j) % 2) * 0.06, ((i + j) % 3 - 1) * 0.3, i === 3 ? 0.8 : 1);
        });
        k.box('woodLight', 0, 1.3, -0.04, 0.96, 0.05, 0.38);
        for (const x of [-0.25, 0.05, 0.3]) k.box('wheatGold', x, 1.35, -0.06, 0.06, 0.06, 0.32, 0.2);
      },
    },
    flour_sack: {
      name: 'Flour sack', group: 'Bakery', size: [1, 1],
      build(k) {
        k.box('canvas', 0, 0, 0, 0.32, 0.36, 0.28, 0.2); k.box('canvas', 0, 0.34, 0, 0.24, 0.07, 0.2, 0.2); k.box('rope', 0, 0.38, 0, 0.12, 0.04, 0.12, 0.2);
        k.box('paintBlue', 0, 0.12, 0, 0.33, 0.05, 0.29, 0.2); k.box('paintWhite', 0, 0.41, 0, 0.1, 0.04, 0.1, 0.2); k.box('paintWhite', 0.12, 0, 0.16, 0.22, 0.012, 0.14, 0.4);
      },
    },
    kneading_table: {
      name: 'Kneading table', group: 'Bakery', size: [2, 1],
      build(k) {
        K.FurniturePrimitives.legs(k, 0.88, 0.4, 0.46, 'woodMid'); k.box('woodLight', 0, 0.46, 0, 0.96, 0.06, 0.46); k.box('paintWhite', 0, 0.52, 0, 0.7, 0.006, 0.34);
        k.box('eggWhite', -0.2, 0.52, 0.02, 0.22, 0.07, 0.16, 0.3); k.box('eggWhite', 0.08, 0.52, -0.06, 0.14, 0.05, 0.12); k.geo('woodLight', K.FurniturePrimitives.CYL8(), 0.28, 0.56, 0.08, 0, 0.2, K.FurniturePrimitives.HALF_TURN, 0.03, 0.34, 0.03);
        k.box('woodMid', 0, 0.14, 0, 0.8, 0.03, 0.36); k.box('canvas', -0.2, 0.17, 0, 0.26, 0.2, 0.22, 0.3); k.geo('woodLight', K.FurniturePrimitives.CYL8(), 0.22, 0.25, 0, 0, 0, 0, 0.12, 0.2, 0.12);
      },
    }
      };
    }
  }
  K.BakeryFurnitureBuilder = BakeryFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
