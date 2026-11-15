/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Bedroom furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class BedroomFurnitureBuilder {
    build() {
      return {
    bed: {
      name: 'Bed', group: 'Bedroom', size: [2, 3],
      build(k) {
        const W = 1.0, D = 1.5;
        for (const sx of [-1, 1]) { k.box('timber', sx * 0.46, 0, -0.71, 0.08, 0.72, 0.08); k.box('timber', sx * 0.46, 0, 0.71, 0.08, 0.42, 0.08); }
        k.box('wood', 0, 0.62, -0.72, W, 0.08, 0.06); k.box('wood', 0, 0.2, -0.72, 0.86, 0.42, 0.04); k.box('wood', 0, 0.3, 0.72, 0.86, 0.1, 0.04);
        k.box('wood', 0, 0.12, 0, 0.94, 0.1, 1.4);
        k.box('linen', 0, 0.22, 0, 0.86, 0.14, 1.34);
        k.box('cloth', 0, 0.34, 0.18, 0.9, 0.06, 0.96); for (const sx of [-1, 1]) k.box('cloth', sx * 0.45, 0.17, 0.18, 0.03, 0.2, 0.96);
        k.box('cloth', 0, 0.37, -0.28, 0.9, 0.05, 0.12, 0, 0.25);
        k.box('linen', -0.2, 0.36, -0.52, 0.34, 0.1, 0.24); k.box('linen', 0.2, 0.36, -0.52, 0.34, 0.1, 0.24, 0.08);
      },
      interact: { type: 'bed', label: 'Bed', actions: [{ id: 'sleep', label: 'Sleep (8 h · full health)' }, { id: 'rest', label: 'Rest 1 hour' }] },
    },
    /** a two-high bunk bed for the bunkhouse: workers sleep here at night (no interaction: it is theirs, not yours) */
    bunk: {
      name: 'Bunk bed', group: 'Bedroom', size: [2, 3],
      build(k) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('timber', sx * 0.44, 0, sz * 0.68, 0.08, 1.62, 0.08);
        for (const y of [0.18, 0.96]) {
          k.box('wood', 0, y, 0, 0.9, 0.08, 1.42); k.box('linen', 0, y + 0.08, 0, 0.82, 0.1, 1.34);
          k.box('cloth', 0, y + 0.18, 0.16, 0.86, 0.05, 0.92); k.box('linen', 0, y + 0.18, -0.5, 0.5, 0.09, 0.24);
          for (const sz of [-1, 1]) k.box('wood', 0, y + 0.2, sz * 0.7, 0.86, 0.14, 0.04);
        }
        for (let i = 0; i < 4; i++) k.box('timber', 0.46, 0.35 + i * 0.22, 0.6, 0.05, 0.04, 0.22);   // ladder rungs
      },
    },
    wardrobe: {
      name: 'Wardrobe', group: 'Bedroom', size: [2, 1],
      build(k) {
        k.box('timber', 0, 0, 0, 0.98, 0.08, 0.46); k.box('wood', 0, 0.08, -0.01, 0.92, 1.42, 0.42);
        k.box('timber', 0, 1.5, 0, 1.0, 0.09, 0.5); k.box('timber', 0, 1.59, -0.02, 0.84, 0.05, 0.4);
        for (const sx of [-1, 1]) { k.box('timber', sx * 0.225, 0.18, 0.205, 0.4, 1.22, 0.025); k.box('wood', sx * 0.225, 0.26, 0.215, 0.32, 0.5, 0.02); k.box('wood', sx * 0.225, 0.84, 0.215, 0.32, 0.48, 0.02); k.box('brass', sx * 0.05, 0.78, 0.225, 0.03, 0.1, 0.03); }
      },
      interact: { type: 'wardrobe', label: 'Wardrobe', actions: [{ id: 'change_outfit', label: 'Change outfit' }] },
    }
      };
    }
  }
  K.BedroomFurnitureBuilder = BedroomFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
