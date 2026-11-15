/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Alchemist furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class AlchemistFurnitureBuilder {
    build() {
      return {
    cauldron: {
      name: 'Cauldron', group: 'Alchemist', size: [2, 2],
      build(k) {
        for (const a of [0.5, 2.6, 4.7]) k.box('ironDark', Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, 0.06, 0.24, 0.06);
        k.geo('ironDark', K.VoxKit.CYL, 0, 0.42, 0, 0, 0, 0, 0.38, 0.38, 0.38); k.geo('ironDark', K.VoxKit.CYL, 0, 0.24, 0, 0, 0, 0, 0.3, 0.1, 0.3);
        k.geo('ironDark', K.VoxKit.CYL, 0, 0.62, 0, 0, 0, 0, 0.42, 0.06, 0.42); k.geo('glow:#46e8a8', K.VoxKit.CYL, 0, 0.66, 0, 0, 0, 0, 0.36, 0.03, 0.36);
        for (const [x, z, s] of [[0.1, 0.05, 0.06], [-0.12, -0.08, 0.05], [0.02, -0.15, 0.04], [-0.05, 0.14, 0.035]]) k.box('glow:#b8ffe0', x, 0.67, z, s, s, s);
        k.box('coals', 0, 0, 0, 0.4, 0.04, 0.4); K.FurniturePrimitives.logPiece(k, 0, 0.0, 0.05, 0.42, 0.04, 0.6); K.FurniturePrimitives.logPiece(k, 0, 0.0, -0.05, 0.42, 0.04, -0.6);
        k.box('woodLight', 0.15, 0.6, 0.1, 0.03, 0.5, 0.03, 0, 0.3, -0.35);
      },
      dyn: { fire: [0, 0.02, 0, 0.3], light: [0, 0.9, 0.2, 0.9, 0x6dffc0], embers: [0, 0.75, 0] },
    },
    cauldron_small: {
      name: 'Small cauldron', group: 'Alchemist', size: [1, 1],
      build(k) {
        k.geo('ironDark', K.VoxKit.CYL, 0, 0.18, 0, 0, 0, 0, 0.18, 0.28, 0.18); k.geo('ironDark', K.VoxKit.CYL, 0, 0.33, 0, 0, 0, 0, 0.2, 0.04, 0.2);
        k.geo('glow:#ff6ad0', K.VoxKit.CYL, 0, 0.34, 0, 0, 0, 0, 0.16, 0.02, 0.16); k.box('glow:#ffd0f0', 0.04, 0.35, 0.02, 0.04, 0.04, 0.04);
      },
    },
    potion_shelf: {
      name: 'Potion shelf', group: 'Alchemist', size: [2, 1],
      build(k) {
        k.box('woodDark', 0, 0, -0.2, 0.96, 1.62, 0.04); for (const sx of [-1, 1]) k.box('woodDark', sx * 0.46, 0, -0.04, 0.05, 1.62, 0.34);
        k.box('woodDark', 0, 1.62, -0.03, 1.0, 0.06, 0.38);
        const cols = ['potionPink', 'potionTeal', 'paintPurple', 'paintGreen', 'gold', 'paintBlue', 'paintOrange', 'paintRed'];
        [0.04, 0.44, 0.84, 1.24].forEach((y, i) => {
          k.box('woodMid', 0, y, -0.04, 0.88, 0.04, 0.32);
          for (let j = 0; j < 6; j++) K.FurniturePrimitives.bottle(k, cols[(i * 3 + j) % cols.length], -0.35 + j * 0.14, y + 0.04, -0.05 + (j % 2) * 0.07, 0.8 + ((i + j) % 3) * 0.2);
        });
      },
    },
    potion_crate: {
      name: 'Potion crate', group: 'Alchemist', size: [1, 1],
      build(k) { k.box('crate', 0, 0, 0, 0.42, 0.3, 0.42, 0, 0, 0, 'face'); K.FurniturePrimitives.bottle(k, 'potionPink', -0.1, 0.3, -0.08, 0.9); K.FurniturePrimitives.bottle(k, 'potionTeal', 0.08, 0.3, -0.06); K.FurniturePrimitives.bottle(k, 'paintPurple', -0.06, 0.3, 0.1, 1.1); K.FurniturePrimitives.bottle(k, 'gold', 0.1, 0.3, 0.1, 0.8); },
    },
    alchemy_table: {
      name: 'Alchemy table', group: 'Alchemist', size: [2, 1],
      build(k) {
        K.FurniturePrimitives.legs(k, 0.88, 0.4, 0.48, 'woodDark'); k.box('woodMid', 0, 0.48, 0, 0.96, 0.06, 0.46);
        k.box('bookRed', -0.24, 0.54, 0.02, 0.34, 0.03, 0.26, 0.15); k.box('paintWhite', -0.31, 0.57, 0.02, 0.15, 0.015, 0.22, 0.15); k.box('paintWhite', -0.16, 0.57, 0.03, 0.15, 0.015, 0.22, 0.15);
        k.geo('glow:#7fd4ff', K.FurniturePrimitives.sphere(), 0.12, 0.66, -0.05, 0, 0, 0, 0.09, 0.09, 0.09); k.box('canvas', 0.12, 0.72, -0.05, 0.03, 0.12, 0.03); k.box('canvas', 0.18, 0.82, -0.05, 0.16, 0.02, 0.02, 0, 0, -0.4);
        k.box('ironDark', 0.12, 0.54, -0.05, 0.12, 0.04, 0.12); K.FurniturePrimitives.bottle(k, 'potionPink', 0.34, 0.54, 0.1, 0.9); K.FurniturePrimitives.bottle(k, 'paintGreen', 0.38, 0.54, -0.1, 0.7);
        k.geo('stoneLight', K.FurniturePrimitives.CYL8(), -0.02, 0.58, 0.14, 0, 0, 0, 0.06, 0.08, 0.06); K.FurniturePrimitives.candleAt(k, 0.42, 0.54, -0.16, 0.12);
      },
      dyn: { candles: [[0.42, 0.72, -0.16]] },
    },
    book_pile: {
      name: 'Book pile', group: 'Study', size: [1, 1],
      build(k) { const c = ['bookRed', 'bookBlue', 'paintGreen', 'woodLight', 'paintPurple']; for (let i = 0; i < 5; i++) k.box(c[i], (i % 2) * 0.03 - 0.015, i * 0.07, 0, 0.3 - i * 0.02, 0.065, 0.22, (i * 0.37) % 0.8 - 0.4); for (let i = 0; i < 5; i++) k.box('paintWhite', (i % 2) * 0.03 - 0.005, i * 0.07 + 0.01, 0.005, 0.28 - i * 0.02, 0.045, 0.2, (i * 0.37) % 0.8 - 0.4); K.FurniturePrimitives.candleAt(k, 0, 0.35, 0, 0.1); },
    },
    globe: {
      name: 'Globe', group: 'Study', size: [1, 1],
      build(k) {
        k.box('woodDark', 0, 0, 0, 0.3, 0.04, 0.3); k.box('woodDark', 0, 0.04, 0, 0.05, 0.5, 0.05);
        k.geo('waterBlue', K.FurniturePrimitives.sphere(), 0, 0.72, 0, 0, 0, 0.4, 0.2, 0.2, 0.2); k.box('leafGreen', 0.08, 0.72, 0.12, 0.1, 0.12, 0.08, 0.3); k.box('leafGreen', -0.12, 0.66, 0.06, 0.08, 0.1, 0.1); k.box('wheatGold', 0.02, 0.8, -0.14, 0.12, 0.06, 0.06);
        k.geo('brass', K.VoxKit.CYL, 0, 0.72, 0, K.FurniturePrimitives.HALF_TURN, 0, 0.4, 0.24, 0.02, 0.24);
      },
    }
      };
    }
  }
  K.AlchemistFurnitureBuilder = AlchemistFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
