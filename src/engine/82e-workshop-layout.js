/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · WorkshopLayout: the floor plan of the workshops people work in. For each type: the parts of its footprint you
   cannot walk through (local rects [cx, cz, w, d], same frame as the art), so its yard, open shed or mill floor is walkable;
   and the work spots where its worker plies the trade (where to stand, what to face, the pose, a load to carry on).
   A type not listed is solid all over and has no work spots. */
(function (G) {
  const K = G.K;

  class WorkshopLayout {
    static SOLID = {
      storehouse: [[-1.15, -0.38, 2.55, 1.5], [1.3, -1.08, 2.3, 0.45], [2.25, -0.55, 0.3, 1.2], [1.45, -0.45, 0.8, 0.8], [2.0, 0.15, 0.6, 0.9]],
      woodcutter: [[-0.45, -0.45, 1.85, 1.35], [0.84, -0.32, 0.9, 1.1], [-0.92, 0.65, 0.75, 0.5]],
      quarry: [[-0.35, -0.65, 2.05, 0.9], [0.82, -0.3, 0.5, 0.8], [-0.82, 0.62, 1.1, 0.45], [0.52, 0.62, 0.65, 0.8]],
      farm: [[-0.3, -0.28, 2.25, 1.85], [1.2, -0.4, 0.4, 1.1]],
      barn: [[-0.5, -0.4, 2.4, 1.8], [-1.41, 0.98, 0.55, 0.6]],
    };
    static WORK = {
      storehouse: [
        { x: 1.45, z: 0.15, pose: 'stir', face: [1.45, -0.45], spin: true }, { x: 0.75, z: -0.55, pose: 'lift', face: [0.7, -0.85], carry: 'sack' },
        { x: 1.85, z: 0.55, pose: 'pitch', face: [2.0, 0.15] }, { x: -0.4, z: 0.95, pose: 'lift', face: [-0.4, 0.5], carry: 'crate' },
      ],
      woodcutter: [
        { x: 0.62, z: 0.98, pose: 'chop', face: [0.62, 0.68] }, { x: -0.12, z: 1.0, pose: 'saw', face: [-0.12, 0.72] },
        { x: 1.2, z: 0.55, pose: 'lift', face: [0.84, 0.1], carry: 'log' }, { x: -0.6, z: 0.95, pose: 'lift', face: [-0.92, 0.65], carry: 'plank' },
      ],
      quarry: [
        { x: -0.5, z: 0.12, pose: 'chop', face: [-0.5, -0.24] }, { x: 0.1, z: 0.1, pose: 'chop', face: [0.1, -0.3] },
        { x: -0.3, z: 0.75, pose: 'lift', face: [-0.82, 0.62], carry: 'stone' }, { x: 0.52, z: 0.15, pose: 'lift', face: [0.52, 0.62], carry: 'stone' },
      ],
      farm: [{ x: -1.0, z: 0.75, pose: 'pitch', face: [-1.0, 1.0] }, { x: 0.6, z: 0.85, pose: 'lift', face: [0.6, 0.5], carry: 'sack' }, { x: -0.3, z: 0.95, pose: 'sweep', face: [-0.3, 0.7] }],
      barn: [{ x: 0.85, z: -0.85, pose: 'pitch', face: [1.2, -0.85] }, { x: 0.85, z: 0.1, pose: 'lift', face: [1.15, 0.08], carry: 'bucket' }, { x: 0.6, z: 0.75, pose: 'sweep', face: [0.95, 0.75] }],
    };
    /** the solid rects of a type, or null if the whole footprint is solid */
    static solids(type) { return WorkshopLayout.SOLID[type] || null; }
    /** is local point (lx, lz) of a piece of this type solid? */
    static solidAt(type, lx, lz) {
      const s = WorkshopLayout.SOLID[type]; if (!s) return true;
      return s.some(([cx, cz, w, d]) => Math.abs(lx - cx) <= w / 2 && Math.abs(lz - cz) <= d / 2);
    }
    /** the work spots of a type, in its local frame, or null */
    static workSpots(type) { return WorkshopLayout.WORK[type] || null; }
  }

  K.WorkshopLayout = WorkshopLayout;
})(typeof window !== 'undefined' ? window : globalThis);
