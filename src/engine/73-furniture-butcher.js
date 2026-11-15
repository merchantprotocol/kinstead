/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Butcher furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class ButcherFurnitureBuilder {
    build() {
      return {
    meat_hooks: {
      name: 'Meat hooks', group: 'Butcher', size: [2, 1],
      build(k) {
        for (const sx of [-1, 1]) k.box('woodDark', sx * 0.44, 0, -0.12, 0.07, 1.62, 0.07);
        k.box('woodDark', 0, 1.56, -0.12, 0.96, 0.07, 0.08); k.box('woodMid', 0, 0, -0.2, 0.9, 0.2, 0.03);
        const items = [[-0.3, 'ham'], [-0.1, 'sausage'], [0.1, 'ham'], [0.3, 'bird']];
        for (const [x, kind] of items) {
          k.box('ironDark', x, 1.4, -0.12, 0.02, 0.16, 0.02);
          if (kind === 'ham') { k.box('meatRed', x, 0.98, -0.12, 0.17, 0.3, 0.14); k.box('meatRed', x, 0.9, -0.12, 0.13, 0.1, 0.12); k.box('paintRed', x, 1.04, -0.05, 0.14, 0.12, 0.01); k.box('eggWhite', x, 1.28, -0.12, 0.05, 0.12, 0.05); k.box('eggWhite', x, 1.38, -0.12, 0.07, 0.04, 0.07); }
          else if (kind === 'sausage') { for (let i = 0; i < 5; i++) k.box('paintRed', x + (i % 2) * 0.03 - 0.015, 1.36 - i * 0.1, -0.12, 0.06, 0.09, 0.06); }
          else { k.box('eggWhite', x, 1.0, -0.12, 0.16, 0.22, 0.14); k.box('eggWhite', x, 1.22, -0.12, 0.05, 0.16, 0.05); k.box('paintYellow', x, 0.94, -0.12, 0.04, 0.06, 0.04); }
        }
      },
    },
    chopping_block: {
      name: 'Chopping block', group: 'Butcher', size: [1, 1],
      build(k) {
        k.geo('bark', K.FurniturePrimitives.CYL8(), 0, 0.22, 0, 0, 0.3, 0, 0.2, 0.44, 0.2, 1, 0.6); k.geo('woodLight', K.FurniturePrimitives.CYL8(), 0, 0.445, 0, 0, 0.3, 0, 0.18, 0.012, 0.18);
        k.box('meatRed', -0.06, 0.45, 0.04, 0.12, 0.012, 0.1, 0.5); k.box('meatRed', 0.06, 0.45, -0.06, 0.1, 0.06, 0.08, 0.3);
        k.push(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0.6, -0.25)).setPosition(-0.02, 0.45, -0.02));
        k.box('steel', 0, -0.06, 0, 0.18, 0.14, 0.015); k.box('woodDark', -0.15, 0.04, 0, 0.14, 0.04, 0.035); k.pop();
      },
    }
      };
    }
  }
  K.ButcherFurnitureBuilder = ButcherFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
