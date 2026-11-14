/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Asset Lab model · hero_knight (ref: public/lab/hero_knight.png, the HD voxel knight from the hero lineup).
   A rigged hero, 93 voxels tall (size 0.0168 m -> 1.56 m, the same height as the older sculpt so play's
   hit boxes and camera framing still fit). Model space: y up, front +z, the knight's own right hand on -x.
   Bones match KV.VoxelAnimator: hips > torso > head / armR > weapon / armL > shield / cape; hips > legR / legL.
   Proportions were measured off the reference (belt at 53% of the height, helm 22%, pauldrons ~44% wide). */
(function (G) {
  const K = G.K;

  /* the gold flame sigil (O bright, o gold, d dark gold), as on the tabard and the shield */
  const FLAME = [
    '......O......',
    '......O......',
    '.....OOo.....',
    '..o..OOo..o..',
    '..o.oOOOo.o..',
    '.oo.oOOOo.oo.',
    '.ooo.oOo.ooo.',
    '..ooo.o.ooo..',
    'o..ooooooo..o',
    'oo..ooooo..oo',
    '.ooo.ooo.ooo.',
    '..ooooooooo..',
    '....ddddd....',
  ];
  /* nearest-neighbour upscale of a bitmap */
  const scale = (rows, sx, sy) => {
    const W = Math.round(rows[0].length * sx), H = Math.round(rows.length * sy), out = [];
    for (let r = 0; r < H; r++) { let s = ''; for (let i = 0; i < W; i++) s += rows[Math.min(rows.length - 1, Math.floor(r / sy))][Math.min(rows[0].length - 1, Math.floor(i / sx))]; out.push(s); }
    return out;
  };

  K.Models.register('hero_knight', ({ Shapes: S, VoxelModel, GreedyMesher, Hash }) => {
    const P = S.palette({
      steel: '#8b8c8f', steelL: '#b3b4b6', steelLL: '#cfd0d1', steelD: '#5d5e62', steelDD: '#393a3e',
      red: '#9a281e', redL: '#b5372a', redD: '#6c1912', redDD: '#4a0f0b',
      gold: '#e3a43a', goldL: '#ffd263', goldD: '#a8681c', leather: '#6a4029', leatherD: '#43271a', black: '#121214',
    });
    const mo = S.mottle;
    const steel = mo([[P.steel, 6], [P.steelL, 2.5], [P.steelD, 1.6]], 3);
    const steelDk = mo([[P.steelD, 5], [P.steelDD, 2], [P.steel, 1.5]], 4);
    const red = mo([[P.red, 6], [P.redD, 2.2], [P.redL, 1.3]], 5);
    const leather = mo([[P.leather, 5], [P.leatherD, 2.5]], 6);
    /* plate armour: banded every `band` voxels with a dark seam (the lames in the ref), and light rivets */
    const plate = (band = 4, seed = 9) => (x, y, z) => {
      if ((y + 400) % band === 0) return Hash.h3(x, y, z, seed) < 0.75 ? P.steelD : P.steelDD;
      if ((y + 400) % band === 1 && (x + z + 400) % 5 === 0) return P.steelLL;   // rivet row under each seam
      return steel(x, y, z);
    };
    const flameInk = { o: P.gold, O: P.goldL, d: P.goldD };
    /* one voxel layer on the front-most surface of the part over an x/y window (tabards, faceplates) */
    const skin = (part, x0, x1, y0, y1, paint, depth = 1) => {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        let best = null; for (let z = 40; z >= -40; z--) if (part.has(x, y, z)) { best = z; break; }
        if (best != null) for (let k = 1; k <= depth; k++) part.set(x, y, best + k, S.ink ? S.ink(paint, x, y, best + k) : (typeof paint === 'function' ? paint(x, y, best + k) : paint));
      }
    };

    const M = new VoxelModel('hd_knight', {
      size: 0.0168, height: 1.56, style: 'swing', mesher: new GreedyMesher(),
      rest: { armL: [-0.12, 0, 0.04], shield: [0, 0.32, 0], legR: [0, 0, -0.05], legL: [0, 0, 0.06] },
    });
    const part = (name, pivot, parent) => M.part(name, pivot, parent || null, { jitter: 0 });

    /* ---- hips: fauld, belt with buckle, tassets, the hanging tabard ---- */
    const hips = part('hips', [0, 44, 0]);
    S.bevelBox(hips, -11, 11, 39, 49, -7, 7, 2, plate(3, 11));
    hips.box(-12, 12, 46, 49, -8, 8, leather);
    hips.box(-3, 3, 45, 50, 9, 9, P.steelL).box(-2, 2, 46, 49, 9, 9, P.steelDD).box(-1, 1, 47, 48, 10, 10, P.steelLL);
    for (const s of [-1, 1]) S.bevelBox(hips, s < 0 ? -14 : 9, s < 0 ? -9 : 14, 32, 46, -6, 6, 1, plate(4, 12));
    const tabLow = (x, y, z) => (Math.abs(x) === 7 ? P.redD : (x + 40) % 4 === 0 ? P.redD : red(x, y, z));
    hips.box(-7, 7, 16, 45, 8, 9, tabLow);
    for (let x = -7; x <= 7; x++) { const cut = 16 + Math.floor(Hash.h3(x, 0, 0, 41) * 5); hips.carve((xx, yy, zz) => xx === x && zz >= 8 && yy < cut); }

    /* ---- legs: thigh plate, knee cop, greave, sabaton ---- */
    for (const [name, s] of [['legR', -1], ['legL', 1]]) {
      const xc = s * 7.5, x0 = Math.round(xc - 4.5), x1 = Math.round(xc + 4.5), L = part(name, [Math.round(xc), 40, 0], 'hips');
      S.bevelBox(L, x0, x1, 27, 40, -5, 5, 2, plate(4, 13));
      L.ellipsoid(xc, 25.5, 2, 5, 3.5, 4.5, mo([[P.steelL, 4], [P.steel, 2], [P.steelLL, 1]], 14));
      S.bevelBox(L, x0, x1, 9, 24, -5, 4, 2, plate(5, 15));
      S.bevelBox(L, x0 - 1, x1 + 1, 0, 8, -6, 9, 2, (x, y, z) => (z > 1 && (z + 40) % 3 === 0 ? P.steelDD : steelDk(x, y, z)));
      L.box(x0 - 1, x1 + 1, 0, 0, -6, 9, P.steelDD);
    }

    /* ---- torso: breastplate, the red tabard with the flame, gorget, layered pauldrons ---- */
    const T = part('torso', [0, 49, 0], 'hips');
    S.bevelBox(T, -12, 12, 49, 70, -7, 7, 3, plate(5, 16));
    T.ellipsoid(0, 60, 3, 11, 9, 5, plate(5, 16));
    skin(T, -9, 9, 50, 69, (x, y, z) => (Math.abs(x) === 9 || y === 69 ? P.redD : red(x, y, z)));
    T.stamp(FLAME, flameInk, -6, 66, 1);
    T.ellipsoid(0, 70.5, 0, 8, 2.5, 7, mo([[P.steelD, 3], [P.steel, 2]], 17));
    for (const s of [-1, 1]) {
      T.ellipsoid(s * 16, 69, 0, 9.5, 7, 9.5, plate(3, 18 + s));
      T.ellipsoid(s * 18, 63.5, 0, 8.5, 3.2, 9, (x, y, z) => (y < 62 ? P.steelDD : steel(x, y, z)));
      T.ellipsoid(s * 19.5, 59.5, 0, 7.5, 2.8, 8.5, (x, y, z) => (y < 58 ? P.steelDD : steelDk(x, y, z)));
      for (const [y, z] of [[72, 5], [72, -5], [66, 7], [66, -7]]) T.set(s * 16, y, z, P.steelLL);
    }

    /* ---- head: great helm with a crest, eye slits either side of a nose bar ---- */
    const H = part('head', [0, 71, 0], 'torso');
    S.bevelBox(H, -8, 8, 71, 86, -8, 8, 3, steel);
    H.ellipsoid(0, 86, 0, 8, 6, 8, steel);
    H.ellipsoid(0, 87, -0.5, 1.2, 6.5, 8.6, mo([[P.steelL, 3], [P.steelLL, 1]], 19));
    H.box(-6, 6, 73, 85, 9, 9, steel);
    H.box(-5, -1, 77, 83, 9, 9, P.black).box(1, 5, 77, 83, 9, 9, P.black).box(-5, 5, 82, 83, 9, 9, P.black);
    H.box(0, 0, 74, 84, 10, 10, P.steelL).box(-6, 6, 85, 85, 9, 10, P.steelL);
    for (const x of [-4, -2, 2, 4]) H.set(x, 75, 9, P.steelDD);
    H.box(-8, 8, 71, 71, -8, 8, P.steelDD);

    /* ---- arms: upper plate, elbow cop, vambrace, flared gauntlet ---- */
    for (const [name, s] of [['armR', -1], ['armL', 1]]) {
      const xa = s * 17, A = part(name, [xa, 66, 0], 'torso'), x0 = Math.min(s * 14, s * 21), x1 = Math.max(s * 14, s * 21);
      S.bevelBox(A, x0, x1, 54, 64, -4, 4, 1, plate(3, 20));
      A.ellipsoid(s * 17.5, 52.5, -1, 4, 3, 4, mo([[P.steelL, 3], [P.steel, 2]], 21));
      S.bevelBox(A, x0, x1, 43, 51, -4, 4, 1, plate(4, 22));
      S.bevelBox(A, x0 - 1, x1 + 1, 35, 43, -4, 5, 2, (x, y, z) => (y === 43 ? P.steelL : steelDk(x, y, z)));
    }

    /* ---- sword in the right hand, held low and angled out (as in the ref) ---- */
    const hand = [-18, 39, 3], dir = [-19, -34, 7], dl = Math.hypot(...dir), u = dir.map((v) => v / dl), perp = [0.873, -0.488, 0];
    const at = (k) => [hand[0] + u[0] * k, hand[1] + u[1] * k, hand[2] + u[2] * k];
    const W = part('weapon', hand.map(Math.round), 'armR');
    S.slab(W, { a: at(-6), b: at(3), wdir: perp, half: 0.9, thick: 0.9 }, leather);
    W.ellipsoid(...at(-7).map(Math.round), 1.4, 1.4, 1.4, P.goldD);
    S.slab(W, { a: at(4).map((v, i) => v - perp[i] * 6), b: at(4).map((v, i) => v + perp[i] * 6), wdir: u, half: 1, thick: 1 }, mo([[P.goldD, 3], [P.leather, 2], [P.gold, 1]], 23));
    S.slab(W, { a: at(5), b: at(45), wdir: perp, half: (t) => (t > 0.86 ? 2.4 * (1 - t) / 0.14 : 2.4), thick: 0.6 },
      (x, y, z, t, w) => (Math.abs(w) < 0.25 ? P.steelD : Math.abs(w) > 0.75 ? P.steelLL : Hash.h3(x, y, z, 24) < 0.3 ? P.steel : P.steelL));

    /* ---- round shield on the left forearm: steel rim with studs, red field, big flame ---- */
    const Sh = part('shield', [19, 44, 5], 'armL');
    const scx = 21, scy = 34;
    S.disc(Sh, { cx: scx, cy: scy, z: 6, rx: 12, ry: 17, thick: 2, dome: 2 }, (x, y, z, d, top) => {
      if (d > 0.86) return top ? (Hash.h3(x, y, z, 25) < 0.25 ? P.steelLL : steel(x, y, z)) : P.steelD;
      return top ? (d > 0.8 ? P.redDD : red(x, y, z)) : P.leatherD;
    });
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) { const x = Math.round(scx + 11.3 * Math.cos(a)), y = Math.round(scy + 16 * Math.sin(a)); let z = 12; while (z > 0 && !Sh.has(x, y, z)) z--; Sh.set(x, y, z + 1, P.steelLL); }
    Sh.stamp(scale(FLAME, 1.4, 1.6), flameInk, scx - 9, scy + 10, 1);

    /* ---- cape behind ---- */
    const C = part('cape', [0, 69, -7], 'torso');
    C.fill(-13, 13, 12, 69, -12, -8, (x, y, z) => { const h = 69 - y, hw = 10 + h * 0.06, zc = -8 - h * 0.05; return Math.abs(x) <= hw && z <= zc + 0.5 && z >= zc - 1.5; },
      (x, y, z) => ((x + 40) % 4 === 0 ? P.redD : red(x, y, z)));
    for (let x = -13; x <= 13; x++) { const cut = 12 + Math.floor(Hash.h3(x, 1, 0, 42) * 7); C.carve((xx, yy) => xx === x && yy < cut); }
    return M;
  }, { kind: 'rig', role: 'knight', title: 'Knight', view: { yaw: 0.36, pitch: 0.16, fov: 18, fit: 'height' } });
})(typeof window !== 'undefined' ? window : globalThis);
