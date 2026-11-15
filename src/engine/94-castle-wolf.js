/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the wolf. A rigged voxel model that plays by the same rules as the heroes: it is sculpted from
   boxes and ellipsoids, split into rigid parts on a small skeleton, and driven by the shared VoxelAnimator.
   The skeleton is the humanoid one re-read for four legs, so the existing walk cycle becomes a trot:
     hips = rump, torso = chest, head, armR/armL = front legs, legR/legL = hind legs, weapon = the tail.
   Registers itself with the sculptor and the 3D actor views; nothing else needs to know a wolf exists. */
(function (G) {
  const KV = G.KV, K = G.K;
  const { Colour, VoxelModel } = KV, S = KV.CharacterSculptor;

  S.make_wolf = function () {
    const P = Colour.palette({ fur: '#8a8f99', furD: '#585d68', furL: '#c3c8d2', belly: '#dfe3ea', nose: '#1b1d22', eye: '#ffd24a', tooth: '#f4f1e6', ear: '#6a6f7a', inner: '#c98d8d' });
    const mo = S.mottle, coat = mo([[P.fur, 5], [P.furD, 3], [P.furL, 1.6], [P.belly, 0.3]], 71), dark = mo([[P.furD, 5], [P.fur, 2]], 72);
    const M = new VoxelModel('wolf', { size: 0.03, height: 0.82, style: 'beast' });

    const hips = M.part('hips', [0, 16, -8]);
    hips.ellipsoid(0, 17, -8, 6.2, 6.4, 8.5, coat);
    hips.ellipsoid(0, 14.5, -9, 5, 3, 7, mo([[P.belly, 3], [P.furL, 1]], 73));

    const torso = M.part('torso', [0, 17, 3], 'hips');
    torso.ellipsoid(0, 18, 4, 6.8, 7.6, 10, coat);
    torso.ellipsoid(0, 21, 9, 5.6, 5.4, 5.5, mo([[P.furL, 3], [P.fur, 2], [P.belly, 1]], 74));   // the ruff over the shoulders
    torso.ellipsoid(0, 14.5, 5, 5, 3.4, 8, mo([[P.belly, 3], [P.furL, 1]], 75));

    const head = M.part('head', [0, 21, 12], 'torso');
    head.ellipsoid(0, 22, 15.5, 4.8, 4.6, 5.2, coat);
    head.rbox(-2.3, 2.3, 19.4, 23.6, 18, 26, 1, mo([[P.fur, 3], [P.furL, 2]], 76));              // snout
    head.rbox(-1.5, 1.5, 22, 24.4, 25, 27.6, 0.8, P.nose);                                        // nose
    head.box(-2, 2, 19, 19.6, 19, 24, P.belly);                                                  // jaw line
    for (const s of [-1, 1]) {
      head.box(s * 2.7 - 0.6, s * 2.7 + 0.6, 23.4, 24.6, 19.2, 20.4, P.eye);                    // eyes
      head.box(s * 1.5 - 0.3, s * 1.5 + 0.3, 18.6, 19.8, 23.2, 24.4, P.tooth);                  // fangs
      head.seg([s * 3.2, 25, 13.5], [s * 3.7, 31, 12.5], 2.2, 0.5, P.ear); head.seg([s * 3.2, 25.6, 14], [s * 3.5, 29.6, 13.2], 1.1, 0.3, P.inner);
    }

    for (const [name, xc] of [['legR', -3.6], ['legL', 3.6]]) {                                  // hind legs
      const L = M.part(name, [xc, 16, -9], 'hips');
      L.seg([xc, 16, -9], [xc * 1.05, 9, -7.5], 2.8, 1.8, dark); L.seg([xc * 1.05, 9, -7.5], [xc, 2.6, -10], 1.7, 1.25, dark);
      L.rbox(xc - 1.9, xc + 1.9, 0, 2.2, -12.5, -7.6, 0.6, P.furD);
    }
    for (const [name, xc] of [['armR', -3.9], ['armL', 3.9]]) {                                  // front legs
      const A = M.part(name, [xc, 15, 8], 'torso');
      A.seg([xc, 16, 8], [xc, 7.5, 9], 2.1, 1.6, dark); A.seg([xc, 7.5, 9], [xc, 2.4, 9.4], 1.5, 1.2, dark);
      A.rbox(xc - 1.9, xc + 1.9, 0, 2.2, 8, 12.4, 0.6, P.furD);
    }
    const tail = M.part('weapon', [0, 18.6, -15], 'hips');                                       // the tail
    tail.seg([0, 18.6, -15], [0, 22, -21.5], 2.4, 1.6, coat); tail.seg([0, 22, -21.5], [0, 20.6, -26], 1.6, 0.9, mo([[P.furL, 3], [P.fur, 1]], 77));
    return M;
  };
  S.REST.wolf = { weapon: [0.35, 0, 0], armR: [0, 0, -0.04], armL: [0, 0, 0.04] };

  K.VoxelRoles.ROLE_OF.wolf = 'wolf';
})(typeof window !== 'undefined' ? window : globalThis);
