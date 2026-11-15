/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Asset Lab model · hero_knight (ref: public/lab/hero_knight.png, the HD voxel knight from the hero lineup).
   Reconstructed, not hand sculpted: tools/lab/recon.mjs lifts the reference onto a TripoSR prior at the calibrated ref
   camera, and tools/lab/rig-split.mjs cuts it into the hero bones -> hero_knight.data.js (64 voxels tall, 1.56 m, the
   ref's stance baked in as the rest pose). Re-run the pipeline instead of editing the data (ASSET-LAB.md).
   The previous hand sculpt is in git history (ad2a3d0 round 5, 92fee37 round 6). */
(function (G) {
  const K = G.K, D = K.ModelData && K.ModelData.hero_knight;
  K.Models.register('hero_knight', (ctx) => ctx.KV.ReconModel.rig('hero_knight', ctx),
    { kind: 'rig', role: 'knight', title: 'Knight', view: D ? D.view : { yaw: 0.65, pitch: 0.14, fov: 34, fit: 'height' } });
})(typeof window !== 'undefined' ? window : globalThis);
