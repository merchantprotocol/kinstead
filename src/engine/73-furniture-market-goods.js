/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Market Goods furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class MarketGoodsFurnitureBuilder {
    build() {
      return {
    wheat_sheaf: {
      name: 'Wheat sheaf', group: 'Market', size: [1, 1],
      build(k) { for (const [x, z, a] of [[-0.06, 0, -0.1], [0.06, 0.02, 0.12], [0, -0.06, 0]]) { k.box('wheatGold', x, 0, z, 0.12, 0.62, 0.12, 0, 0, a); k.box('wheatGold', x + a * 0.6, 0.6, z, 0.18, 0.16, 0.18, 0.3, 0, a); } k.box('paintRed', 0, 0.26, 0, 0.26, 0.06, 0.24); },
    },
    egg_basket: {
      name: 'Egg basket', group: 'Market', size: [1, 1],
      build(k) { k.box('rope', 0, 0, 0, 0.36, 0.16, 0.34); k.box('wheatGold', 0, 0.15, 0, 0.32, 0.02, 0.3); for (let i = 0; i < 7; i++) k.box('eggWhite', -0.1 + (i % 3) * 0.1, 0.16, -0.08 + Math.floor(i / 3) * 0.08, 0.07, 0.09, 0.065); k.box('woodLight', 0, 0.16, 0, 0.03, 0.16, 0.36, 0, 0, 0); },
    },
    material_pile: {
      name: 'Material pile', group: 'Market', size: [2, 1],
      build(k, o) {
        const kind = (o.state && o.state.kind) || 'wood';
        if (kind === 'wood') { for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) { K.FurniturePrimitives.logPiece(k, -0.3 + i * 0.2 + r * 0.1, r * 0.15, 0, 0.42, 0.08, K.FurniturePrimitives.HALF_TURN); k.geo('woodLight', K.FurniturePrimitives.CYL8(), -0.3 + i * 0.2 + r * 0.1, r * 0.15 + 0.08, 0.215, K.FurniturePrimitives.HALF_TURN, 0, 0, 0.07, 0.01, 0.07); } }
        else if (kind === 'stone') { for (let i = 0; i < 6; i++) k.box(i % 3 ? 'stoneLight' : 'stoneMid', -0.3 + (i % 3) * 0.3, Math.floor(i / 3) * 0.2, (i % 2) * 0.04, 0.26, 0.2, 0.32); }
        else { for (let i = 0; i < 6; i++) { const x = -0.32 + (i % 4) * 0.2, y = Math.floor(i / 4) * 0.14; k.box('stoneDark', x, y, 0, 0.2, 0.16, 0.22, i * 0.7); k.box(i % 2 ? 'paintOrange' : 'gold', x + 0.05, y + 0.12, 0.08, 0.05, 0.04, 0.05); } for (let i = 0; i < 3; i++) k.box('ironDark', 0.18 + i * 0.03, 0.2 + i * 0.05, -0.05, 0.22, 0.05, 0.1, 0.2); }
      },
    },
    woodpile: {
      name: 'Woodpile', group: 'Decor', size: [2, 1],
      build(k) {
        for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) { K.FurniturePrimitives.logPiece(k, -0.36 + i * 0.18 + (r % 2) * 0.05, r * 0.13, -0.02, 0.36, 0.065, K.FurniturePrimitives.HALF_TURN); k.geo('woodLight', K.FurniturePrimitives.CYL8(), -0.36 + i * 0.18 + (r % 2) * 0.05, r * 0.13 + 0.065, 0.165, K.FurniturePrimitives.HALF_TURN, 0, 0, 0.055, 0.01, 0.055); }
        k.box('snow', 0, 0.58, -0.02, 0.92, 0.05, 0.36); k.box('ironDark', 0.3, 0.6, 0.05, 0.03, 0.03, 0.26, 0, 0, 0.3); k.box('steel', 0.36, 0.62, 0.17, 0.09, 0.07, 0.02);
      },
    },
    shield_rack: {
      name: 'Shield rack', group: 'Armory', size: [2, 1],
      build(k) {
        k.box('woodDark', 0, 0, -0.2, 0.96, 1.4, 0.05); for (const sx of [-1, 1]) k.box('woodDark', sx * 0.45, 0, -0.15, 0.06, 1.4, 0.12);
        for (const [x, y, c, t] of [[-0.24, 0.95, 'paintRed', 'gold'], [0.24, 0.95, 'paintBlue', 'paintWhite'], [0, 0.45, 'paintGreen', 'paintYellow']]) {
          k.geo(c, K.VoxKit.CYL, x, y, -0.13, K.FurniturePrimitives.HALF_TURN, 0, 0, 0.2, 0.05, 0.2); k.box(t, x, y - 0.2, -0.1, 0.06, 0.4, 0.02); k.box(t, x, y - 0.025, -0.1, 0.4, 0.05, 0.02); k.geo('ironDark', K.VoxKit.CYL, x, y, -0.09, K.FurniturePrimitives.HALF_TURN, 0, 0, 0.06, 0.04, 0.06);
        }
      },
    },
    quench_tub: {
      name: 'Quench tub', group: 'Smithy', size: [1, 1],
      build(k) { k.geo('woodMid', K.FurniturePrimitives.CYL8(), 0, 0.17, 0, 0, 0.2, 0, 0.21, 0.34, 0.21); k.geo('ironDark', K.FurniturePrimitives.CYL8(), 0, 0.28, 0, 0, 0.2, 0, 0.22, 0.04, 0.22); k.geo('waterBlue', K.FurniturePrimitives.CYL8(), 0, 0.33, 0, 0, 0.2, 0, 0.18, 0.01, 0.18); k.box('ironDark', 0.08, 0.2, 0.02, 0.025, 0.4, 0.025, 0, 0.2, 0.3); k.box('ironDark', 0.12, 0.2, -0.02, 0.025, 0.4, 0.025, 0, -0.2, 0.3); },
    }
      };
    }
  }
  K.MarketGoodsFurnitureBuilder = MarketGoodsFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
