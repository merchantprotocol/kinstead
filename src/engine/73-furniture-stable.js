/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Stable furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class StableFurnitureBuilder {
    build() {
      return {
    stall: {
      name: 'Stable stall', group: 'Stable', size: [3, 4], solid: false,
      build(k) {
        for (const sx of [-1, 1]) {
          k.box('timber', sx * 0.72, 0, 0.94, 0.08, 1.15, 0.08); k.box('timber', sx * 0.72, 0, -0.94, 0.08, 1.15, 0.08);
          k.box('wood', sx * 0.72, 0, 0, 0.05, 0.72, 1.82); k.box('timber', sx * 0.72, 0.95, 0, 0.06, 0.06, 1.9);
        }
        k.box('wood', 0, 0.84, -0.86, 1.2, 0.08, 0.24); for (let x = -0.5; x <= 0.5; x += 0.125) k.box('timber', x, 0.92, -0.9, 0.025, 0.35, 0.025, 0, 0.25);
        k.box('hay', 0, 0.92, -0.9, 1.1, 0.18, 0.16); k.box('straw', 0, 0, 0, 1.36, 0.03, 1.8);
        k.box('wood', -0.45, 0, 0.94, 0.5, 0.75, 0.04, 0.0); k.box('timber', -0.45, 0.6, 0.94, 0.5, 0.06, 0.06);
        k.box('iron', -0.66, 0.35, 0.96, 0.05, 0.1, 0.05); k.box('hay', 0.4, 0, -0.5, 0.36, 0.18, 0.3);
      },
      interact: { type: 'stable', label: 'Stable stall', actions: [{ id: 'stable_horse', label: 'Stable horse' }, { id: 'feed', label: 'Feed horse' }] },
    },
    horse: {
      name: 'Horse', group: 'Stable', size: [1, 3],
      build(k, o) {
        const coat = o.state && o.state.coat === 'grey' ? 'horseGrey' : 'horse';
        for (const [x, z] of [[-0.1, 0.32], [0.1, 0.32], [-0.1, -0.36], [0.1, -0.36]]) { k.box(coat, x, 0.06, z, 0.1, 0.54, 0.11); k.box('soot', x, 0, z, 0.11, 0.07, 0.12); }
        k.box(coat, 0, 0.56, -0.02, 0.36, 0.4, 0.9); k.box(coat, 0, 0.6, -0.44, 0.28, 0.3, 0.12);
        k.box(coat, 0, 0.76, 0.44, 0.18, 0.42, 0.22, 0, -0.55); k.box('mane', 0, 0.92, 0.38, 0.06, 0.36, 0.12, 0, -0.55);
        k.box(coat, 0, 0.98, 0.62, 0.16, 0.18, 0.34, 0, 0.25); k.box('mane', 0, 0.96, 0.8, 0.14, 0.12, 0.08, 0, 0.25);
        for (const sx of [-1, 1]) { k.box(coat, sx * 0.05, 1.16, 0.54, 0.04, 0.09, 0.04); k.box('soot', sx * 0.085, 1.04, 0.66, 0.01, 0.03, 0.03); }
        k.box('mane', 0, 0.6, -0.54, 0.08, 0.38, 0.08, 0, 0.35);
        k.box('clothBlue', 0, 0.9, -0.02, 0.36, 0.05, 0.34); k.box('leather', 0, 0.94, -0.02, 0.24, 0.06, 0.26); k.box('leather', 0, 1.0, -0.12, 0.2, 0.06, 0.05);
        for (const sx of [-1, 1]) { k.box('leather', sx * 0.17, 0.62, -0.02, 0.02, 0.3, 0.03); k.box('iron', sx * 0.17, 0.58, -0.02, 0.04, 0.04, 0.06); }
      },
      interact: { type: 'mount', label: 'Horse', actions: [{ id: 'saddle', label: 'Saddle horse', requires: { items: { saddle: 1 } } }, { id: 'mount', label: 'Mount horse', requires: { state: 'saddled' } }] },
    },
    tack_rack: {
      name: 'Tack rack', group: 'Stable', size: [2, 1],
      build(k) {
        k.box('timber', 0, 0.2, -0.22, 0.96, 1.0, 0.05);
        for (const x of [-0.25, 0.25]) { k.box('timber', x, 0.62, -0.08, 0.06, 0.06, 0.26); k.box('leather', x, 0.62, -0.06, 0.34, 0.12, 0.3); k.box('leather', x, 0.7, -0.14, 0.24, 0.1, 0.08); k.box('clothBlue', x, 0.5, -0.06, 0.38, 0.12, 0.26); k.box('iron', x - 0.17, 0.32, -0.06, 0.02, 0.22, 0.03); }
        for (const x of [-0.36, 0, 0.36]) { k.box('iron', x, 1.06, -0.18, 0.03, 0.03, 0.08); k.box('leather', x, 0.86, -0.15, 0.04, 0.2, 0.02); k.box('brass', x, 0.84, -0.14, 0.06, 0.04, 0.02); }
        k.geo('hay', K.VoxKit.CYL, 0.0, 0.08, -0.05, 0, 0, 0, 0.16, 0.08, 0.16, 0.6, 0.2);
      },
      interact: { type: 'tack', label: 'Tack rack', station: 'tack', actions: [{ id: 'take_tack', label: 'Take tack' }, { id: 'craft', label: 'Make tack' }] },
    },
    trough: {
      name: 'Water trough', group: 'Stable', size: [2, 1],
      build(k) { k.box('wood', 0, 0, 0, 0.92, 0.32, 0.4); k.box('water', 0, 0.3, 0, 0.82, 0.01, 0.3); k.box('iron', -0.3, -0.01, 0, 0.04, 0.34, 0.42); k.box('iron', 0.3, -0.01, 0, 0.04, 0.34, 0.42); },
      interact: { type: 'water', label: 'Water trough', actions: [{ id: 'water_horse', label: 'Water horse' }, { id: 'drink', label: 'Drink' }] },
    },
    hay_bale: {
      name: 'Hay bale', group: 'Stable', size: [1, 1],
      build(k) { k.box('hay', 0, 0, 0, 0.44, 0.32, 0.4); k.box('leather', -0.1, -0.005, 0, 0.025, 0.33, 0.41); k.box('leather', 0.1, -0.005, 0, 0.025, 0.33, 0.41); k.box('hay', 0.05, 0.32, 0.03, 0.2, 0.05, 0.14, 0.4); },
    }
      };
    }
  }
  K.StableFurnitureBuilder = StableFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
