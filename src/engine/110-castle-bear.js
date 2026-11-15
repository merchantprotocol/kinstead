/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the bear. Same skeleton and animator as the wolf (hips = rump, torso = chest, head, armR/armL =
   front legs, legR/legL = hind legs, weapon = the stub of a tail), but big: a hump of shoulders, a broad head
   with round ears, thick legs with claws. */
(function (G) {
  const KV = G.KV, K = G.K;
  const { Colour, VoxelModel } = KV, S = KV.CharacterSculptor;

  S.make_bear = function () {
    const P = Colour.palette({ fur: '#6b4a32', furD: '#43301f', furL: '#8e6a48', muzzle: '#b59272', nose: '#16120e', eye: '#ffd24a', tooth: '#f4f1e6', claw: '#e8e2d2', inner: '#9c6a58' });
    const mo = S.mottle, coat = mo([[P.fur, 5], [P.furD, 3], [P.furL, 2]], 81), dark = mo([[P.furD, 5], [P.fur, 2]], 82);
    const M = new VoxelModel('bear', { size: 0.04, height: 1.0, style: 'beast' });

    const hips = M.part('hips', [0, 18, -9]);
    hips.ellipsoid(0, 18, -9, 8.4, 8.6, 10, coat);
    const torso = M.part('torso', [0, 19, 3], 'hips');
    torso.ellipsoid(0, 19.5, 4, 9, 9, 12, coat);
    torso.ellipsoid(0, 25, 8, 7.4, 6.4, 7.5, mo([[P.furL, 3], [P.fur, 3]], 83));   // the shoulder hump
    torso.ellipsoid(0, 14, 5, 7.4, 3.8, 9.5, mo([[P.furD, 3], [P.fur, 2]], 84));

    const head = M.part('head', [0, 22, 14], 'torso');
    head.ellipsoid(0, 23, 18, 6.4, 6, 6.2, coat);
    head.rbox(-3.2, 3.2, 20.2, 24.8, 20.5, 29, 1.2, mo([[P.muzzle, 4], [P.fur, 1]], 85));   // muzzle
    head.rbox(-1.8, 1.8, 23.8, 26.6, 28, 30.8, 0.8, P.nose);                                 // nose
    for (const s of [-1, 1]) {
      head.box(s * 3.6 - 0.7, s * 3.6 + 0.7, 25.2, 26.6, 22.4, 23.8, P.eye);                // eyes
      head.ellipsoid(s * 4.4, 29, 15, 2.6, 2.6, 1.6, dark); head.ellipsoid(s * 4.4, 29, 15.8, 1.4, 1.4, 0.8, P.inner);   // round ears
      head.box(s * 1.9 - 0.4, s * 1.9 + 0.4, 20, 21.6, 27, 28.2, P.tooth);                    // fangs
    }
    for (const [name, xc] of [['legR', -5], ['legL', 5]]) {                                    // hind legs
      const L = M.part(name, [xc, 17, -10], 'hips');
      L.seg([xc, 17, -10], [xc * 1.05, 9, -8], 4.2, 3.2, dark); L.seg([xc * 1.05, 9, -8], [xc, 2.6, -10.5], 3.1, 2.6, dark);
      L.rbox(xc - 2.8, xc + 2.8, 0, 2.6, -13.5, -7.2, 0.8, P.furD); for (const c of [-1.4, 0, 1.4]) L.box(xc + c - 0.3, xc + c + 0.3, 0.2, 1.2, -7.2, -5.8, P.claw);
    }
    for (const [name, xc] of [['armR', -5.4], ['armL', 5.4]]) {                                // front legs
      const A = M.part(name, [xc, 17, 8], 'torso');
      A.seg([xc, 18, 8], [xc, 8.5, 9.5], 3.8, 3.1, dark); A.seg([xc, 8.5, 9.5], [xc, 2.6, 10.2], 3, 2.6, dark);
      A.rbox(xc - 2.8, xc + 2.8, 0, 2.6, 8, 14, 0.8, P.furD); for (const c of [-1.4, 0, 1.4]) A.box(xc + c - 0.3, xc + c + 0.3, 0.2, 1.2, 14, 15.6, P.claw);
    }
    const tail = M.part('weapon', [0, 20, -17], 'hips'); tail.ellipsoid(0, 20.5, -18, 2.2, 2.2, 2.4, coat);
    return M;
  };
  S.REST.bear = { weapon: [0.2, 0, 0], armR: [0, 0, -0.05], armL: [0, 0, 0.05] };

  K.VoxelRoles.ROLE_OF.bear = 'bear';
})(typeof window !== 'undefined' ? window : globalThis);
