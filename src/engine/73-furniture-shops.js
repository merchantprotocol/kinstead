/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Shops furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class ShopsFurnitureBuilder {
    build() {
      return {
    counter: {
      name: 'Shop counter', group: 'Shop', size: [3, 1],
      build(k, o) {
        const goods = (o.state && o.state.goods) || 'bread';
        const paint = { bread: 'paintOrange', wheat: 'paintYellow', meat: 'paintRed', eggs: 'paintGreen', weapons: 'paintBlue', ore: 'paintPurple' }[goods] || 'paintRed';
        k.box('woodMid', 0, 0, -0.02, 1.4, 0.56, 0.4); k.box(paint, 0, 0.06, 0.18, 1.32, 0.44, 0.02); k.box('paintWhite', 0, 0.42, 0.19, 1.32, 0.05, 0.02);
        k.box('woodLight', 0, 0.56, 0, 1.48, 0.06, 0.48);
        // a little balance at the end, and the goods
        k.box('gold', 0.6, 0.62, -0.1, 0.03, 0.22, 0.03); k.box('gold', 0.6, 0.84, -0.1, 0.24, 0.02, 0.02); for (const sx of [-1, 1]) k.box('gold', 0.6 + sx * 0.1, 0.7, -0.1, 0.09, 0.015, 0.09);
        const y = 0.62;
        if (goods === 'bread') { for (let i = 0; i < 5; i++) K.FurniturePrimitives.loaf(k, -0.55 + i * 0.2, y, -0.04 + (i % 2) * 0.1, (i % 3 - 1) * 0.4); k.geo('rope', K.FurniturePrimitives.CYL8(), 0.3, y + 0.05, 0.05, 0, 0, 0, 0.12, 0.1, 0.12); for (let i = 0; i < 3; i++) k.box('wheatGold', 0.28 + i * 0.03, y + 0.1, 0.05, 0.07, 0.05, 0.07); }
        else if (goods === 'wheat') { for (let i = 0; i < 3; i++) { k.box('wheatGold', -0.5 + i * 0.22, y, -0.05, 0.12, 0.34, 0.12, 0, 0, (i - 1) * 0.12); k.box('paintRed', -0.5 + i * 0.22, y + 0.1, -0.05, 0.14, 0.04, 0.14); } k.box('canvas', 0.2, y, 0, 0.26, 0.24, 0.22, 0.3); k.box('wheatGold', 0.2, y + 0.24, 0, 0.18, 0.03, 0.15, 0.3); }
        else if (goods === 'meat') { for (let i = 0; i < 3; i++) { k.box('meatRed', -0.5 + i * 0.25, y, 0.0, 0.2, 0.1, 0.14, i * 0.4); k.box('eggWhite', -0.5 + i * 0.25 - 0.1, y + 0.03, 0.0, 0.06, 0.04, 0.04, i * 0.4); } for (let i = 0; i < 6; i++) k.box('paintRed', 0.12 + (i % 3) * 0.08, y, -0.08 + (i >> 1 & 1) * 0.12, 0.07, 0.05, 0.06); }
        else if (goods === 'eggs') { for (const x of [-0.45, -0.1, 0.25]) { k.box('rope', x, y, 0, 0.26, 0.1, 0.24); for (let i = 0; i < 6; i++) k.box('eggWhite', x - 0.08 + (i % 3) * 0.08, y + 0.08, -0.05 + (i > 2 ? 0.1 : 0), 0.06, 0.08, 0.06); } }
        else if (goods === 'weapons') { for (let i = 0; i < 3; i++) { k.box('steel', -0.42 + i * 0.2, y, -0.02, 0.06, 0.02, 0.4, 0.15); k.box('gold', -0.42 + i * 0.2, y, 0.12, 0.16, 0.03, 0.03, 0.15); } k.geo('paintBlue', K.VoxKit.CYL, 0.25, y + 0.02, 0, 0, 0, 0, 0.18, 0.04, 0.18); k.geo('gold', K.VoxKit.CYL, 0.25, y + 0.05, 0, 0, 0, 0, 0.05, 0.04, 0.05); }
        else { for (let i = 0; i < 4; i++) k.box(i % 2 ? 'stoneLight' : 'stoneMid', -0.5 + i * 0.16, y, -0.06 + (i % 2) * 0.1, 0.13, 0.1, 0.13, i); for (let i = 0; i < 3; i++) k.box('ironDark', 0.1 + i * 0.13, y + (i === 2 ? 0.06 : 0), 0, 0.12, 0.06, 0.2); k.box('gold', 0.1, y + 0.06, 0, 0.1, 0.05, 0.16); }
      },
    },
    hanging_sign: {
      name: 'Hanging sign', group: 'Shop', size: [1, 1], solid: false, layer: 'wall',
      build(k, o) {
        const icon = (o.state && o.state.icon) || 'coins';
        for (const sx of [-1, 1]) k.box('ironDark', sx * 0.22, 1.82, 0, 0.015, 0.5, 0.015);
        k.push(new THREE.Matrix4().makeTranslation(0, 1.84, 0).multiply(new THREE.Matrix4().makeRotationX(-0.3)));
        K.FurnitureSigns.plaque(k, icon, 'paintWhite', 0.9);
        k.pop();
      },
    }
      };
    }
  }
  K.ShopsFurnitureBuilder = ShopsFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
