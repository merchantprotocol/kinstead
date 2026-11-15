/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Armory furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class ArmoryFurnitureBuilder {
    build() {
      return {
    weapon_rack: {
      name: 'Weapon rack', group: 'Armory', size: [2, 1],
      build(k) {
        for (const sx of [-1, 1]) { k.box('timber', sx * 0.44, 0, -0.14, 0.07, 1.15, 0.07); k.box('timber', sx * 0.44, 0, 0.0, 0.07, 0.06, 0.34); }
        k.box('timber', 0, 0.16, 0.08, 0.95, 0.06, 0.08); k.box('timber', 0, 0.98, -0.14, 0.95, 0.07, 0.07); k.box('wood', 0, 0.78, -0.14, 0.9, 0.05, 0.05);
        K.FurniturePrimitives.sword(k, -0.3, 0.06); K.FurniturePrimitives.sword(k, -0.14, 0.06, -0.18); K.FurniturePrimitives.spear(k, 0.04, 0.06, -0.13); K.FurniturePrimitives.axe(k, 0.22, 0.06, -0.16); K.FurniturePrimitives.spear(k, 0.36, 0.06, -0.1);
      },
      interact: { type: 'weapon_rack', label: 'Weapon rack', actions: [{ id: 'take_weapon', label: 'Take weapon' }, { id: 'store_weapon', label: 'Store weapon' }] },
    },
    armor_stand: {
      name: 'Armor stand', group: 'Armory', size: [1, 1],
      build(k) {
        k.box('timber', 0, 0, 0, 0.4, 0.06, 0.4); k.box('timber', 0, 0.06, 0, 0.06, 1.0, 0.06); k.box('timber', 0, 0.98, 0, 0.42, 0.05, 0.06);
        k.box('steel', 0, 0.52, 0.0, 0.34, 0.46, 0.2); k.box('steel', 0, 0.44, 0.0, 0.3, 0.1, 0.22); k.box('cloth', 0, 0.36, 0.01, 0.32, 0.1, 0.2);
        for (const sx of [-1, 1]) k.box('steel', sx * 0.21, 0.82, 0, 0.12, 0.14, 0.2, 0, 0, sx * 0.3);
        k.box('steel', 0, 1.06, 0, 0.2, 0.22, 0.2); k.box('soot', 0, 1.13, 0.1, 0.14, 0.03, 0.01); k.box('cloth', 0, 1.28, -0.02, 0.04, 0.08, 0.14);
        k.push(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.25, 0.4, 0)).setPosition(0.14, 0.02, 0.17));
        k.box('cloth', 0, 0, 0, 0.32, 0.4, 0.04); k.box('linen', 0, 0.16, 0.021, 0.05, 0.2, 0.01); k.box('linen', 0, 0.22, 0.021, 0.16, 0.05, 0.01); k.box('brass', 0, 0.19, 0.025, 0.07, 0.07, 0.02);
        k.pop();
      },
      interact: { type: 'armor_stand', label: 'Armor stand', actions: [{ id: 'take_armor', label: 'Take armor' }, { id: 'store_armor', label: 'Store armor' }] },
    },
    chest: {
      name: 'Chest', group: 'Storage', size: [2, 1],
      build(k) {
        k.box('wood', 0, 0, 0, 0.86, 0.36, 0.42); k.box('timber', 0, 0.36, -0.005, 0.9, 0.11, 0.45); k.box('timber', 0, 0.47, -0.01, 0.82, 0.04, 0.38);
        for (const sx of [-0.28, 0.28]) k.box('iron', sx, -0.005, 0, 0.06, 0.52, 0.47);
        k.box('brass', 0, 0.26, 0.215, 0.1, 0.12, 0.03);
      },
      interact: { type: 'storage', label: 'Chest', actions: [{ id: 'open', label: 'Open storage' }] },
    }
      };
    }
  }
  K.ArmoryFurnitureBuilder = ArmoryFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
