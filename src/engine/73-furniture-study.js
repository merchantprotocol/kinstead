/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Study furniture catalogue entries. */
(function (G) {
  const K = G.K;
  class StudyFurnitureBuilder {
    build() {
      return {
    bookshelf: {
      name: 'Bookshelf', group: 'Study', size: [2, 1],
      build(k) {
        k.box('woodDark', 0, 0, -0.18, 0.96, 1.62, 0.04);
        for (const sx of [-1, 1]) k.box('woodMid', sx * 0.46, 0, -0.03, 0.05, 1.62, 0.34);
        k.box('woodMid', 0, 1.62, -0.02, 1.0, 0.06, 0.38);
        [0.02, 0.42, 0.82, 1.22].forEach((y, i) => {
          k.box('woodMid', 0, y, -0.03, 0.88, 0.04, 0.32);
          K.FurniturePrimitives.bookRow(k, y + 0.04, i === 3 ? 0.56 : 0.84, -0.04, i * 5);
        });
        K.FurniturePrimitives.jar(k, 0.32, 1.26, -0.02, 'brass', 0.7);
      },
      interact: { type: 'read', label: 'Bookshelf', actions: [{ id: 'read', label: 'Read' }] },
    }
      };
    }
  }
  K.StudyFurnitureBuilder = StudyFurnitureBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
