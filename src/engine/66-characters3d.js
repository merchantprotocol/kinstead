/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the four HD voxel heroes, sculpted as real 3D voxel models.
   Each character is built from primitives in model space (y up, facing +z, the character's own right
   hand on -x), coloured with palettes sampled from Jonathon's chosen HD voxel lineup, then split into
   rigid body parts that hang off a small skeleton (hips > torso > head / arms > weapon, shield; hips > legs;
   torso > cape). Proportions follow the front art; depth follows the side and back turnaround views. */
(function (G) {
  const KV = G.KV, { Hash, Colour, VoxelModel, VoxelPart } = KV;

  /* flame emblem from the tabard, shield and cape (o = gold, O = bright gold, d = dark gold) */
  const FLAME = [
    '.....O.....',
    '.....O.....',
    '....OOo....',
    '.o..OOo..o.',
    '.o.oOOOo.o.',
    '.oo.oOo.oo.',
    '.ooo.o.ooo.',
    '..oo.o.oo..',
    'o..ooooo..o',
    'oo..ooo..oo',
    '.ooooooooo.',
    '...ddddd...',
  ];
  const FLAME_BIG = [
    '.......O.......',
    '.......O.......',
    '......OOo......',
    '......OOo......',
    '..o..OOOoo..o..',
    '..o..OOOoo..o..',
    '.oo.oOOOOoo.oo.',
    '.oo.ooOOOoo.oo.',
    '.ooo.ooOoo.ooo.',
    '.oooo.oOo.oooo.',
    '..ooo..o..ooo..',
    'o..ooo.o.ooo..o',
    'oo..ooooooo..oo',
    'ooo..ooooo..ooo',
    '.ooooooooooooo.',
    '..ooooooooooo..',
    '....ddddddd....',
  ];

  class CharacterSculptor {
    /* weighted pick among colours, stable per voxel (gives the speckled cube look of the art) */
    static mottle(pairs, seed = 1) {
      const tot = pairs.reduce((s, p) => s + p[1], 0);
      return (x, y, z) => { let r = Hash.h3(x, y, z, seed) * tot; for (const [c, w] of pairs) { if ((r -= w) <= 0) return c; } return pairs[0][0]; };
    }
    static ragged(part, x0, x1, base, depth, seed) { const cut = {}; for (let x = x0; x <= x1; x++) cut[x] = base + Math.floor(Hash.h3(x, 0, 0, seed) * depth); part.carve((x, y) => cut[x] != null && y < cut[x]); }

    static build(role) {
      const m = CharacterSculptor['make_' + role];
      if (!m) throw new Error('no voxel model for ' + role);
      const model = m.call(CharacterSculptor); if (CharacterSculptor.RESAMPLE[role]) model.resample(CharacterSculptor.RESAMPLE[role]); model.build(); return model;
    }

    /* ---------------- knight: steel plate, red tabard with the gold flame, round shield, red cape ---------------- */
    static make_knight() {
      const P = Colour.palette({ steel: '#8e9199', steelL: '#b7bac1', steelD: '#62656d', steelDD: '#42444b', red: '#a8281f', redD: '#7a1a14', redDD: '#55110d', gold: '#f2b23a', goldL: '#ffdc6a', goldD: '#c47c1e', leather: '#7d4d2b', leatherD: '#52321c', fur: '#8a5c31', black: '#121216' });
      const mo = CharacterSculptor.mottle, steel = mo([[P.steel, 5], [P.steelL, 2.2], [P.steelD, 2]], 3), steelDk = mo([[P.steelD, 5], [P.steelDD, 3], [P.steel, 1]], 4);
      const red = mo([[P.red, 6], [P.redD, 2.5], [P.redDD, 0.6]], 5), leather = mo([[P.leather, 5], [P.leatherD, 3]], 6);
      const plate = (x, y, z) => (y % 3 === 0 ? (Hash.h3(x, y, z, 9) < 0.7 ? P.steelD : P.steel) : steel(x, y, z));
      const flameInk = { o: P.gold, O: P.goldL, d: P.goldD };
      const M = new VoxelModel('knight', { size: 0.03, height: 1.56, style: 'swing' });

      const hips = M.part('hips', [0, 20, 0]);
      hips.rbox(-8, 8, 16, 21, -4, 4, 2, steelDk);
      hips.rbox(-9, 9, 19, 21, -5, 5, 2, leather);
      hips.box(-2, 2, 19, 21, 6, 6, P.gold).box(-1, 1, 20, 20, 6, 6, P.leatherD);
      hips.box(-4, 4, 7, 19, 5, 6, (x, y, z) => (Math.abs(x) === 4 ? P.steelL : x % 3 === 0 ? P.redD : red(x, y, z)));
      CharacterSculptor.ragged(hips, -4, 4, 7, 4, 11);
      for (const s of [-1, 1]) hips.box(s * 7, s * 9, 12, 18, -3, 3, (x, y, z) => (y % 3 === 0 ? P.steelD : steel(x, y, z))); // tassets

      for (const [name, xc] of [['legR', -4], ['legL', 4]]) {
        const L = M.part(name, [xc, 18, 0], 'hips');
        L.rbox(xc - 3, xc + 3, 11, 17, -3, 3, 1, plate);
        L.box(xc - 3, xc + 3, 15, 15, -3, 3, leather);
        L.rbox(xc - 3, xc + 3, 4, 10, -3, 3, 1, plate);
        L.ellipsoid(xc, 10.5, 2, 3, 2, 2, mo([[P.steelL, 3], [P.steel, 2]], 8));
        L.rbox(xc - 3, xc + 3, 0, 4, -3, 5, 1, (x, y, z) => (z > 3 && y === 2 ? P.steelD : steelDk(x, y, z)));
      }

      const torso = M.part('torso', [0, 21, 0], 'hips');
      torso.rbox(-9, 9, 21, 35, -5, 5, 3, plate);
      torso.box(-7, 7, 21, 35, 6, 6, (x, y, z) => (Math.abs(x) === 7 || y === 35 ? P.steelL : red(x, y, z)));
      torso.stamp(FLAME, flameInk, -5, 33, 1);
      torso.ellipsoid(0, 36, -0.5, 7, 1.6, 6, mo([[P.fur, 4], [P.leatherD, 2], [P.leather, 2]], 12)); // fur collar
      for (const s of [-1, 1]) {
        torso.ellipsoid(s * 11.5, 34, 0, 6, 4.5, 6.5, (x, y, z) => (y % 2 === 0 ? P.steelD : steel(x, y, z)));
        torso.ellipsoid(s * 13.5, 30.5, 0, 4, 2.5, 5.5, (x, y, z) => (y % 2 === 0 ? P.steelDD : P.steel));
      }

      const head = M.part('head', [0, 36, 0], 'torso');
      head.rbox(-5, 5, 37, 45, -5, 6, 3, steel);
      head.ellipsoid(0, 45, 0.5, 5, 3.5, 5.5, steel);
      head.box(0, 0, 45, 49, -4, 5, P.steelL);
      head.stamp([
        '.lllllllll.',
        '.kkkkkkkkk.',
        '.kkkkkkkkk.',
        '....lkl....',
        '....lkl....',
        '....lkl....',
        '.....l.....',
      ], { k: P.black, l: P.steelL }, -5, 45, 1);

      for (const [name, s] of [['armR', -1], ['armL', 1]]) {
        const xc = s * 12, A = M.part(name, [xc, 33, 0], 'torso');
        A.rbox(xc - 2, xc + 2, 25, 32, -3, 3, 1, plate);
        A.ellipsoid(xc, 24.5, -1, 3, 2, 3, mo([[P.steelL, 3], [P.steel, 2]], 13));
        A.rbox(xc - 2, xc + 2, 17, 23, -3, 3, 1, plate);
        A.box(xc - 2, xc + 2, 20, 21, -3, 3, leather);
        A.rbox(xc - 2, xc + 2, 13, 16, -2, 3, 1, steelDk);
      }

      // sword in the right hand, built pointing forward (+z); the rest pose tips it down
      const W = M.part('weapon', [-12, 14, 1], 'armR');
      W.box(-12, -12, 13, 15, -3, 3, mo([[P.leather, 3], [P.leatherD, 2]], 14));
      W.box(-12, -12, 14, 14, -4, -4, P.goldD).box(-13, -11, 13, 15, -5, -5, P.gold);
      W.box(-15, -9, 14, 14, 4, 4, P.gold).box(-12, -12, 13, 15, 4, 4, P.goldL);
      W.fill(-12, -12, 12, 16, 5, 30, (x, y, z) => { const half = z > 27 ? (30 - z) * 0.7 : 2; return Math.abs(y - 14) <= half; },
        (x, y, z) => (y === 14 ? P.steel : Hash.h3(x, y, z, 15) < 0.3 ? P.steelD : P.steelL));

      // round heater shield on the left forearm, facing forward; the rest pose angles it outward
      const S = M.part('shield', [12, 19, 3], 'armL');
      const cx = 12.5, cy = 19;
      S.fill(3, 22, 7, 31, 4, 5, (x, y) => { const sy = y < cy ? 10.5 : 11.5, sx = 9.5 * (y < cy ? 1 - ((cy - y) / sy) * 0.28 : 1); const a = (x - cx) / sx, b = (y - cy) / sy; return a * a + b * b <= 1; },
        (x, y, z) => { const sy = y < cy ? 10.5 : 11.5, sx = 9.5 * (y < cy ? 1 - ((cy - y) / sy) * 0.28 : 1); const a = (x - cx) / sx, b = (y - cy) / sy, d = Math.sqrt(a * a + b * b); return d > 0.84 ? (z === 5 ? steel(x, y, z) : P.steelD) : z === 5 ? red(x, y, z) : P.leatherD; });
      S.fill(3, 22, 7, 31, 6, 6, (x, y) => { const sy = y < cy ? 10.5 : 11.5, sx = 9.5 * (y < cy ? 1 - ((cy - y) / sy) * 0.28 : 1); const a = (x - cx) / sx, b = (y - cy) / sy, d = Math.sqrt(a * a + b * b); return d > 0.84 && d <= 1; }, P.steelL);
      S.stamp(FLAME_BIG, flameInk, 5, 27, 1);

      const C = M.part('cape', [0, 35, -5], 'torso');
      C.fill(-12, 12, 4, 35, -11, -5, (x, y, z) => { const h = 35 - y, hw = 7.5 + h * 0.13, zc = -6 - h * 0.11; return Math.abs(x) <= hw && z <= zc + 0.5 && z >= zc - 1.5; },
        (x, y, z) => (x % 3 === 0 ? P.redD : red(x, y, z)));
      CharacterSculptor.ragged(C, -12, 12, 4, 6, 21);
      C.stamp(FLAME_BIG, flameInk, -7, 31, -1, true);
      return M;
    }

    /* ---------------- ranger: green hooded cloak, leather armour, bow and quiver ---------------- */
    static make_ranger() {
      const P = Colour.palette({ green: '#5e8c42', greenL: '#7dab58', greenD: '#41652f', greenDD: '#283f1f', brown: '#86532e', brownL: '#a87449', brownD: '#5f381d', brownDD: '#3b2212', skin: '#c99574', skinD: '#93654a', steel: '#a0a3aa', white: '#ece8dc', black: '#16120f', red: '#9a2b20' });
      const mo = CharacterSculptor.mottle, green = mo([[P.green, 5], [P.greenL, 2], [P.greenD, 2.5]], 31), brown = mo([[P.brown, 5], [P.brownL, 1.6], [P.brownD, 2.4]], 32), brownDk = mo([[P.brownD, 5], [P.brownDD, 2.5], [P.brown, 1.2]], 33);
      const M = new VoxelModel('ranger', { size: 0.03, height: 1.5, style: 'bow' });

      const hips = M.part('hips', [0, 19, 0]);
      hips.rbox(-7, 7, 15, 20, -4, 4, 2, brownDk);
      hips.rbox(-8, 8, 19, 20, -5, 5, 2, P.brownDD); hips.box(-1, 1, 19, 20, 6, 6, P.steel);
      hips.box(5, 8, 13, 18, 2, 5, brown); hips.box(5, 8, 18, 18, 2, 5, P.brownD); // pouch
      hips.fill(-7, 7, 9, 18, -5, 5, (x, y, z) => Math.abs(z) >= 4 || Math.abs(x) >= 7, (x, y, z) => (x % 3 === 0 ? P.brownD : brown(x, y, z)));
      hips.carve((x, y, z) => y < 18 && Math.abs(z) < 4 && Math.abs(x) < 7);
      CharacterSculptor.ragged(hips, -7, 7, 9, 4, 34);

      for (const [name, xc] of [['legR', -4], ['legL', 4]]) {
        const L = M.part(name, [xc, 17, 0], 'hips');
        L.rbox(xc - 3, xc + 3, 9, 16, -3, 3, 1, mo([[P.brownD, 4], [P.brown, 2], [P.greenDD, 1]], 35));
        L.ellipsoid(xc, 10, 2.2, 2, 2, 1.5, P.brownL);
        L.rbox(xc - 3, xc + 3, 0, 9, -3, 4, 1, (x, y, z) => (y >= 8 ? P.brownL : y % 3 === 0 ? P.brownDD : brownDk(x, y, z)));
      }

      const torso = M.part('torso', [0, 20, 0], 'hips');
      torso.rbox(-8, 8, 20, 33, -5, 4, 3, brown);
      torso.recolor((x, y, z) => z >= 3 && Math.abs(x - (y - 27) * 0.75) < 1.3, P.brownDD);
      torso.recolor((x, y, z) => z >= 3 && Math.abs(x + (y - 29) * 0.75) < 1.0 && y > 24, P.brownD);
      torso.box(-2, -1, 26, 27, 5, 5, P.steel);
      torso.ellipsoid(0, 32.5, -1, 10.5, 2.5, 6.5, green);
      torso.carve((x, y, z) => z > 2 && Math.abs(x) < 5 && y < 33);

      const head = M.part('head', [0, 33, 0], 'torso');
      head.ellipsoid(0, 39.5, -1, 7, 7.5, 7, green);
      head.carve((x, y, z) => z >= 1 && Math.abs(x) <= 4 && y >= 33 && y <= 42 && !(y >= 42 && Math.abs(x) <= 1));
      head.recolor((x, y, z) => z >= 2 && Math.abs(x) >= 5 && y < 44, P.greenD);
      head.rbox(-4, 4, 34, 42, -4, 3, 2, P.skin);
      head.stamp([
        '.sssssss.',
        '.sssssss.',
        '.kks.skk.',
        '.ssssSss.',
        '..ssSss..',
        '..sssss..',
        '..skkks..',
        '...sss...',
      ], { s: P.skinD, S: P.skin, k: P.black }, -4, 42, 1);
      head.box(-4, 4, 41, 42, 3, 3, P.greenDD);
      head.seg([0, 44, -5], [0, 40, -11], 2.5, 0.5, green);

      for (const [name, s] of [['armR', -1], ['armL', 1]]) {
        const xc = s * 10, A = M.part(name, [xc, 31, 0], 'torso');
        A.ellipsoid(xc, 30, 0, 3.4, 3, 4, green);
        A.rbox(xc - 2, xc + 2, 22, 29, -2, 2, 1, brown);
        A.rbox(xc - 2, xc + 2, 15, 21, -2, 2, 1, (x, y, z) => (y % 2 === 0 && z >= 2 ? P.brownL : brownDk(x, y, z)));
        A.ellipsoid(xc, 13.5, 0.5, 2, 2, 2, P.skin);
      }

      // longbow in the left hand, recurved, limbs curving back toward the archer
      const B = M.part('weapon', [10, 14, 1], 'armL');
      // drawn in the frontal plane: limbs bow out toward +x (away from the body), the string runs straight on the inside
      for (let t = -1; t <= 1.0001; t += 0.015) {
        const y = 14 + t * 19, x = 10 + 5.5 * (1 - t * t) - (Math.abs(t) > 0.82 ? (Math.abs(t) - 0.82) * 12 : 0);
        const c = Math.abs(t) < 0.12 ? P.brownDD : Hash.h3(0, Math.round(y), 0, 36) < 0.3 ? P.brownL : P.brown;
        B.set(Math.round(x), Math.round(y), 1, c); if (Math.abs(t) < 0.7) B.set(Math.round(x), Math.round(y), 2, c);
        if (Math.abs(t) < 0.15) B.set(Math.round(x) + 1, Math.round(y), 1, P.brownDD);
      }
      for (let y = -4; y <= 32; y++) B.set(10, y, 1, P.white);
      B.set(10, -5, 1, null); B.set(10, 33, 1, null);

      const C = M.part('cape', [0, 32, -4], 'torso');
      C.fill(-13, 13, 5, 32, -10, -4, (x, y, z) => { const h = 32 - y, hw = 8 + h * 0.17, zc = -5.5 - h * 0.1; return Math.abs(x) <= hw && z <= zc + 0.5 && z >= zc - 1.5; },
        (x, y, z) => (x % 4 === 0 ? P.greenD : green(x, y, z)));
      CharacterSculptor.ragged(C, -13, 13, 5, 7, 37);
      // quiver over the cloak with a fan of arrows
      C.seg([-4, 21, -10], [3, 32, -10], 2.2, 2.2, brownDk);
      C.seg([-4, 21, -10], [3, 32, -10], 2.4, 2.4, (x, y, z) => ((y - 21) % 4 === 0 ? P.brownL : null));
      for (const [dx, dy] of [[0, 0], [1.6, -0.6], [-1.4, 0.4], [0.8, 1.2]]) {
        const a = [3 + dx, 33 + dy, -10], b = [6 + dx * 1.4, 40 + dy, -11];
        C.seg(a, b, 0.4, 0.4, P.brownL);
        C.seg([b[0] - 0.6, b[1] - 1.4, b[2]], [b[0] + 0.3, b[1] + 0.6, b[2]], 0.9, 0.5, P.white);
      }
      return M;
    }

    /* ---------------- mage: deep-blue hooded robe with silver trim, gnarled staff and ice crystal ---------------- */
    static make_mage() {
      const P = Colour.palette({ blue: '#3253ad', blueL: '#4e70cc', blueD: '#223d86', blueDD: '#16275c', trim: '#cdd3e0', trimD: '#929bb0', brown: '#704527', brownD: '#4b2b16', brownL: '#916139', skin: '#4f3c35', black: '#0b0d16', ice: '#8fd8ff', iceL: '#e2f8ff', iceD: '#3f9ae8' });
      const mo = CharacterSculptor.mottle, blue = mo([[P.blue, 5], [P.blueL, 1.8], [P.blueD, 2.6]], 41), wood = mo([[P.brown, 4], [P.brownD, 2], [P.brownL, 1.5]], 42);
      const M = new VoxelModel('mage', { size: 0.03, height: 1.56, style: 'cast', glowColor: '#7fd4ff' });

      const hips = M.part('hips', [0, 20, 0]);
      hips.fill(-12, 12, 2, 21, -10, 10, (x, y, z) => { const h = 21 - y, rx = 5.6 + h * 0.17, rz = 4.4 + h * 0.12; return (x * x) / (rx * rx) + (z * z) / (rz * rz) <= 1; },
        (x, y, z) => (y <= 3 ? P.trim : y === 4 ? P.trimD : Math.abs(x) <= 1 && z > 0 ? P.trim : x % 3 === 0 ? P.blueD : blue(x, y, z)));
      hips.stamp([
        '....t....',
        '...ttt...',
        '..tt.tt..',
        '.tt.t.tt.',
        'tt.ttt.tt',
        '.tt.t.tt.',
        '..tt.tt..',
        '...ttt...',
        '....t....',
      ], { t: P.trim }, -4, 15, 1);

      for (const [name, xc] of [['legR', -3], ['legL', 3]]) {
        const L = M.part(name, [xc, 18, 0], 'hips');
        L.rbox(xc - 2, xc + 2, 4, 14, -2, 2, 1, P.blueDD);
        L.rbox(xc - 2, xc + 2, 0, 3, -2, 4, 1, mo([[P.blueDD, 3], [P.black, 1]], 43));
      }

      const torso = M.part('torso', [0, 21, 0], 'hips');
      torso.rbox(-6, 6, 21, 33, -4, 4, 3, blue);
      torso.recolor((x, y, z) => z >= 3 && y > 23 && Math.abs(Math.abs(x) - (y - 23) * 0.42) < 0.8, P.trim);
      torso.rbox(-8, 8, 21, 22, -5, 5, 2, mo([[P.brown, 3], [P.brownD, 2]], 44)); torso.box(-1, 1, 21, 22, 6, 6, P.trim);
      torso.ellipsoid(0, 32, 0, 9, 2.4, 5.5, (x, y, z) => (y <= 30 ? P.trim : blue(x, y, z)));

      const head = M.part('head', [0, 33, 0], 'torso');
      head.ellipsoid(0, 39.5, -1, 6.4, 7.5, 6.2, blue);
      head.seg([0, 44, -3], [0, 50, -8], 3.2, 0.3, blue);
      head.carve((x, y, z) => z >= 0 && Math.abs(x) <= 3 && y >= 33 && y <= 42);
      head.recolor((x, y, z) => z >= 2 && y <= 45, (x, y, z) => (Math.abs(x) >= 4 || y >= 43 ? P.trim : null));
      head.rbox(-3, 3, 34, 41, -3, 1, 1, P.skin);
      head.stamp(['.sssss.', '.sssss.', '.kk.kk.', '.sssss.', '..sss..', '..sks..', '...s...'], { s: P.skin, k: P.black }, -3, 41, 1);
      head.box(-3, 3, 41, 42, 1, 1, P.blueDD);

      for (const [name, s] of [['armR', -1], ['armL', 1]]) {
        const xc = s * 8, A = M.part(name, [xc, 31, 0], 'torso');
        A.seg([xc, 30, 0], [xc + s * 1.5, 18, 1], 2.6, 4, (x, y, z) => (y <= 16 ? P.trim : blue(x, y, z)));
        A.carve((x, y, z) => y < 15);
        A.ellipsoid(xc + s * 1.5, 14, 1.5, 1.8, 1.8, 1.8, P.skin);
      }

      // gnarled staff in the left hand, ground to crown, with claws around the crystal
      const S = M.part('weapon', [10, 14, 2], 'armL');
      let px = 10.5, pz = 2;
      for (let y = 0; y < 55; y += 5) { const nx = 10.5 + Math.sin(y * 0.37) * 0.8, nz = 2 + Math.cos(y * 0.29) * 0.7; S.seg([px, y, pz], [nx, y + 5, nz], 1.1, 1.1, wood); px = nx; pz = nz; }
      for (const a of [0, 2.1, 4.2]) S.seg([px, 55, pz], [px + Math.cos(a) * 3.5, 61, pz + Math.sin(a) * 3.5], 0.9, 0.5, wood);
      for (const y of [30, 31, 38]) S.box(9, 12, y, y, 1, 3, P.brownD);
      const gem = M.part('gem', [10, 58, 2], 'weapon', { glow: true, jitter: 0.12 });
      const ice = mo([[P.ice, 4], [P.iceL, 2.5], [P.iceD, 2]], 45);
      gem.seg([10.5, 56, 2], [10.5, 68, 2], 2.8, 0, ice);
      gem.seg([10.5, 57, 2], [13.5, 64, 3], 1.4, 0, ice);
      gem.seg([10.5, 57, 2], [7.5, 63, 1], 1.4, 0, ice);
      gem.seg([10.5, 57, 2], [10.5, 62, -1.5], 1.2, 0, ice);
      return M;
    }

    /* ---------------- frost troll: craggy ice hide, crystal spikes, loincloth, stone-headed club ---------------- */
    static make_troll() {
      const P = Colour.palette({ ice: '#9fb9d4', iceL: '#c8dbee', iceW: '#e6f1fb', iceD: '#7894b5', iceDD: '#536d8f', brown: '#6f4a2b', brownD: '#4a2f1a', tan: '#c2a57c', tanD: '#957a50', wood: '#6c4527', woodD: '#472a12', stone: '#7c7f86', stoneD: '#55585f', eye: '#1d1f26', tooth: '#efe9da' });
      const mo = CharacterSculptor.mottle, hide = mo([[P.ice, 5], [P.iceL, 2.2], [P.iceD, 3.2], [P.iceW, 0.4], [P.iceDD, 1.2]], 51);
      const spike = mo([[P.iceL, 4], [P.iceW, 2], [P.ice, 2], [P.iceD, 0.8]], 52);
      const M = new VoxelModel('troll', { size: 0.03, height: 2.9, style: 'slam' });
      const spikes = (part, list) => { for (const [a, b, r] of list) part.seg(a, b, r, 0.2, spike); };

      const hips = M.part('hips', [0, 34, 0]);
      hips.rbox(-14, 14, 27, 39, -9, 8, 5, hide);
      hips.rbox(-16, 16, 35, 38, -11, 10, 6, (x, y, z) => (Hash.h3(x, y, z, 53) < 0.18 ? P.tan : Hash.h3(x, y, z, 54) < 0.5 ? P.brown : P.brownD));
      hips.fill(-15, 15, 13, 35, -12, 11, (x, y, z) => (z >= 9 || z <= -10) && Math.abs(x) <= 11,
        (x, y, z) => { const band = Math.floor((x + 15) / 2) % 4, r = Hash.h3(x, y, z, 55); return band === 0 ? (r < 0.6 ? P.tanD : P.tan) : r < 0.55 ? P.brown : P.brownD; });
      hips.carve((x, y, z) => y < 35 && (z >= 9 || z <= -10) && y < 14 + Math.floor(Hash.h3(x, Math.sign(z), 0, 56) * 9));

      for (const [name, xc] of [['legR', -9], ['legL', 9]]) {
        const L = M.part(name, [xc, 32, 0], 'hips');
        L.seg([xc, 30, 0], [xc, 15, 1], 7, 6, hide);
        L.seg([xc, 15, 1], [xc, 5, 1], 6, 7, hide);
        L.rbox(xc - 7, xc + 7, 0, 5, -6, 9, 3, mo([[P.iceD, 3], [P.ice, 3], [P.iceDD, 1.5]], 57));
        for (const tx of [-5, -1.5, 2, 5.5]) L.ellipsoid(xc + tx, 1.5, 9.5, 1.4, 1.5, 1.6, P.iceL);
        spikes(L, [[[xc + Math.sign(xc) * 5, 18, 2], [xc + Math.sign(xc) * 11, 23, 3], 2.2], [[xc + Math.sign(xc) * 4, 9, 3], [xc + Math.sign(xc) * 9, 13, 5], 1.6]]);
      }

      const torso = M.part('torso', [0, 37, 0], 'hips');
      torso.ellipsoid(0, 56, -1, 21, 19, 13, hide);
      torso.ellipsoid(0, 44, 2, 15, 9, 10, hide);
      torso.ellipsoid(0, 63, -7, 16, 11, 9, hide);
      for (const s of [-1, 1]) torso.ellipsoid(s * 20, 64, -2, 10, 9, 10, hide);
      torso.recolor((x, y, z) => z > 8 && Math.abs(Math.abs(x) - 7) < 1 && y > 50 && y < 62, P.iceDD); // pec line
      spikes(torso, [
        [[-20, 70, -4], [-27, 92, -8], 4.5], [[-14, 70, -8], [-16, 96, -14], 4.5], [[-24, 68, 2], [-34, 84, 0], 3.5],
        [[20, 70, -4], [27, 92, -8], 4.5], [[14, 70, -8], [16, 96, -14], 4.5], [[24, 68, 2], [34, 84, 0], 3.5],
        [[-6, 68, -12], [-7, 88, -20], 4], [[6, 68, -12], [7, 88, -20], 4], [[0, 62, -15], [0, 80, -26], 4],
        [[-11, 58, -14], [-15, 72, -25], 3.2], [[11, 58, -14], [15, 72, -25], 3.2], [[0, 50, -13], [0, 60, -24], 3],
        [[-18, 52, -9], [-26, 62, -18], 3], [[18, 52, -9], [26, 62, -18], 3],
      ]);

      const head = M.part('head', [0, 70, 5], 'torso');
      head.rbox(-8, 8, 68, 82, 0, 15, 4, hide);
      head.box(-8, 8, 78, 80, 13, 16, mo([[P.iceDD, 2], [P.iceD, 2]], 58));
      head.stamp(['ww.....ww', 'wk.....kw'], { w: P.iceW, k: P.eye }, -4, 77, 1);
      head.ellipsoid(0, 75, 16, 2, 2, 1.5, P.iceD);
      head.box(-5, 5, 71, 72, 15, 15, P.eye);
      head.seg([-4, 71, 15.5], [-4.5, 76, 17], 1, 0.2, P.tooth); head.seg([4, 71, 15.5], [4.5, 76, 17], 1, 0.2, P.tooth);
      for (let x = -6; x <= 6; x += 2.4) head.seg([x, 69, 13], [x * 1.1, 61, 12], 1.3, 0.2, spike);
      spikes(head, [[[0, 81, 7], [0, 98, 0], 4], [[-6, 80, 5], [-13, 95, -1], 3.2], [[6, 80, 5], [13, 95, -1], 3.2], [[-8, 76, 4], [-17, 86, 1], 2.4], [[8, 76, 4], [17, 86, 1], 2.4]]);

      for (const [name, s] of [['armR', -1], ['armL', 1]]) {
        const xc = s * 25, A = M.part(name, [xc, 64, 0], 'torso');
        A.seg([xc, 63, 0], [xc + s * 4, 46, 3], 8, 7, hide);
        A.seg([xc + s * 4, 46, 3], [xc + s * 5, 30, 6], 7, 8, hide);
        A.ellipsoid(xc + s * 5, 25, 7, 6.5, 6, 6.5, mo([[P.iceD, 3], [P.ice, 3], [P.iceDD, 1]], 59));
        spikes(A, [[[xc + s * 8, 50, 0], [xc + s * 17, 58, -4], 2.8], [[xc + s * 9, 40, 2], [xc + s * 18, 44, -1], 2.6], [[xc + s * 7, 56, -4], [xc + s * 13, 68, -10], 2.4], [[xc + s * 10, 33, 4], [xc + s * 17, 34, 2], 2]]);
      }

      // stone-headed club in the right fist, built pointing forward; the rest pose drops it toward the ground
      const W = M.part('weapon', [-30, 25, 7], 'armR');
      W.seg([-30, 25, -2], [-30, 25, 13], 2.3, 2.6, mo([[P.wood, 4], [P.woodD, 2]], 60));
      W.seg([-30, 25, 13], [-30, 25, 25], 4.5, 6.5, mo([[P.stone, 4], [P.stoneD, 3], [P.iceD, 1]], 61));
      W.recolor((x, y, z) => z >= 13 && z <= 15, P.brownD);
      return M;
    }
  }
  // the troll is sculpted at hero resolution, then meshed with 1.4x bigger cubes to keep its triangle count down
  CharacterSculptor.RESAMPLE = { troll: 1.4 };
  CharacterSculptor.REST = {
    knight: { weapon: [0.5, -0.55, 0], shield: [0, 0.5, 0], armR: [-0.15, 0, -0.06], armL: [-0.25, 0, 0.08] },
    ranger: { weapon: [0.15, 0, -0.55], armL: [-0.35, 0, 0.1], armR: [-0.15, 0, -0.08] },
    mage: { armL: [-0.25, 0, 0.06], weapon: [0.25, 0, -0.05], armR: [-0.1, 0, -0.05] },
    troll: { weapon: [1.15, 0, 0], armR: [-0.1, 0, -0.08], armL: [-0.05, 0, 0.08], torso: [0.12, 0, 0], head: [-0.1, 0, 0] },
  };

  /* ---------------- town workers: one dressable human body, outfitted per job ----------------
     Same skeleton and proportions as the ranger (hips > torso > head / arms; hips > legs), so the shared
     animator walks, works and swings them. Each job is a spec: skin, hair, hat, shirt, apron / coat /
     robe / skirt / shawl, grime, and what sits in each hand ('weapon' on the right hand, 'prop' on the left). */
  class WorkerSculptor {
    static make(id, o) {
      const C = (h) => Colour.hex(h), mul = Colour.mul, mo = CharacterSculptor.mottle;
      const tex = (h, seed, f = 1) => { const c = mul(C(h), f); return mo([[c, 5], [mul(c, 1.16), 1.5], [mul(c, 0.8), 2]], seed); };
      const skin = C(o.skin), skinD = mul(skin, 0.74), black = C('#15110e'), mouth = C('#7a2a22'), gold = C('#f2c14e');
      const M = new VoxelModel(id, { size: 0.03, height: o.height || 1.52, style: o.style || 'swing', glowColor: o.glow || null });
      const dome = (part, cx, cy, cz, rx, ry, rz, ymin, paint, extra) => part.fill(cx - rx - 1, cx + rx + 1, ymin, cy + ry + 1, cz - rz - 1, cz + rz + 1, (x, y, z) => {
        const a = (x - cx) / (rx + 0.35), b = (y - cy) / (ry + 0.35), c = (z - cz) / (rz + 0.35); return y >= ymin && a * a + b * b + c * c <= 1 && (!extra || extra(x, y, z));
      }, paint);
      // lay a sheet one voxel in front of whatever the part already shows at the front (aprons over skirts and bellies)
      const cover = (part, x0, x1, y0, y1, paint, zDef = 5) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { let z = null; for (let q = 14; q >= -14; q--) if (part.has(x, y, q)) { z = q; break; } part.set(x, y, z == null ? zDef : z + 1, VoxelPart.ink(paint, x, y, 0)); } };

      /* cloth */
      const base = tex(o.shirt, 101);
      const shirt = o.pattern === 'plaid' ? ((d) => (x, y, z) => { const a = (x + 40) % 4 === 0, b = (y + 40) % 4 === 0; return a && b ? mul(d, 0.7) : a || b ? d : base(x, y, z); })(C(o.shirt2))
        : o.pattern === 'stripe' ? ((d) => (x, y, z) => ((x + 40) % 3 === 0 ? d : base(x, y, z)))(C(o.shirt2)) : base;
      const trou = o.pattern2 === 'check' ? ((d) => (x, y, z) => (((x + 40) >> 1) + ((y + 40) >> 1)) % 2 === 0 ? d : C(o.trousers))(C(o.trousers2)) : tex(o.trousers || '#4a4038', 102);
      const boot = tex(o.boots || '#3d2616', 103), bootL = mul(C(o.boots || '#3d2616'), 1.3);
      const coat = o.coat ? tex(o.coat.color, 104) : null, coatTrim = o.coat ? C(o.coat.trim || o.coat.color) : null;
      const robe = o.robe ? tex(o.robe.color, 105) : null, robeTrim = o.robe ? C(o.robe.trim) : null;
      const sleeve = robe || coat || shirt;

      /* hips, belt and the lower garment */
      const hips = M.part('hips', [0, 19, 0]);
      hips.rbox(-7, 7, 15, 20, -4, 4, 2, trou);
      const gown = o.skirt || o.robe;
      if (gown) {
        const g = tex(gown.color, 106), hem = C(gown.hem || gown.trim || gown.color), y0 = o.robe ? 1 : 4;
        hips.fill(-12, 12, y0, 20, -10, 10, (x, y, z) => { const h = 20 - y, rx = 6.6 + h * 0.16, rz = 5 + h * 0.11; return (x * x) / (rx * rx) + (z * z) / (rz * rz) <= 1; },
          (x, y, z) => (y <= y0 + 1 ? hem : o.robe && Math.abs(x) <= 1 && z > 0 ? hem : (x + 40) % 4 === 0 ? mul(C(gown.color), 0.82) : g(x, y, z)));
      }
      if (o.coat) { // long coat tails, open at the front
        hips.fill(-8, 8, o.coat.tail || 8, 19, -5, 5, (x, y, z) => (Math.abs(x) >= 7 || Math.abs(z) >= 4) && !(z >= 4 && Math.abs(x) <= 1),
          (x, y, z) => (y <= (o.coat.tail || 8) ? coatTrim : coat(x, y, z)));
      }
      if (o.belt && !o.apron) { hips.rbox(-8, 8, 19, 20, -5, 5, 2, C(o.belt)); hips.box(-1, 1, 19, 20, 6, 6, gold); }

      for (const [name, xc] of [['legR', -4], ['legL', 4]]) {
        const L = M.part(name, [xc, 16, 0], 'hips');
        if (o.skirt) L.rbox(xc - 2, xc + 2, 5, 8, -2, 2, 1, tex(o.skirt.color, 113, 0.85));   // under a skirt only the shins show; no thighs to poke through mid-stride
        else if (!o.robe) L.rbox(xc - 3, xc + 3, 5, 16, -3, 3, 1, trou);
        L.rbox(xc - 3, xc + 3, 0, 5, -3, 4, 1, (x, y, z) => (y === 5 ? bootL : boot(x, y, z)));
      }

      /* torso */
      const torso = M.part('torso', [0, 20, 0], 'hips');
      torso.rbox(-7, 7, 20, 32, -4, 4, 2, shirt);
      torso.box(-2, 2, 33, 33, -2, 1, skin);
      if (o.coat) {
        const open = (x, y) => Math.abs(x) <= 1 + Math.max(0, y - 26) * 0.5;
        torso.recolor((x, y, z) => !(z >= 3 && open(x, y)), coat);
        torso.recolor((x, y, z) => z >= 3 && Math.abs(x) === Math.floor(2 + Math.max(0, y - 26) * 0.5), coatTrim);
        for (const y of [21, 23, 25]) for (const s of [-1, 1]) torso.set(s * 2, y, 5, gold);
        torso.ellipsoid(0, 32.5, -1, 8, 1.6, 5.5, (x, y, z) => (z >= 3 && Math.abs(x) <= 2 ? null : coatTrim));
      }
      if (o.robe) {
        torso.recolor(() => true, robe);
        torso.recolor((x, y, z) => z >= 3 && Math.abs(x) <= 1, robeTrim);
        torso.rbox(-8, 8, 20, 21, -5, 5, 2, C(o.robe.sash || '#e8c35a'));
        torso.ellipsoid(0, 32, 0, 8.5, 2, 5.5, (x, y, z) => (y <= 31 ? robeTrim : robe(x, y, z)));
      }
      if (o.apron) {
        const a = o.apron, ac = tex(a.color, 107), at = C(a.trim || a.color), st = a.stain ? C(a.stain) : null;
        const paint = (x, y) => (st && Hash.h3(x >> 1, y >> 1, 3, 71) < 0.2 ? st : ac(x, y, 0));
        hips.rbox(-8, 8, 19, 19, -5, 5, 2, at);                                              // apron strings
        cover(hips, -6, 6, a.short ? 10 : 6, 18, (x, y) => (Math.abs(x) === 6 || y === (a.short ? 10 : 6) ? at : paint(x, y)));
        if (a.back) { // a tabard: the same panel hangs at the back too
          for (let x = -6; x <= 6; x++) for (let y = a.short ? 10 : 6; y <= 18; y++) { let z = null; for (let q = -14; q <= 14; q++) if (hips.has(x, y, q)) { z = q; break; } hips.set(x, y, z == null ? -5 : z - 1, Math.abs(x) === 6 || y === (a.short ? 10 : 6) ? at : paint(x, y)); }
          for (let x = -5; x <= 5; x++) for (let y = 20; y <= 31; y++) { let z = null; for (let q = -14; q <= 14; q++) if (torso.has(x, y, q)) { z = q; break; } torso.set(x, y, z == null ? -5 : z - 1, Math.abs(x) === 5 ? at : paint(x, y)); }
        }
        if (a.bib) {
          cover(torso, -5, 5, 20, 30, (x, y) => (Math.abs(x) === 5 || y === 30 ? at : paint(x, y)));
          for (const s of [-1, 1]) torso.box(s * 4, s * 4, 31, 32, 2, 5, at);
          if (a.pocket) cover(torso, -2, 2, 23, 26, (x, y) => (y === 26 ? at : mul(C(a.color), 0.85)));
        }
      }
      if (o.shawl) {
        const sh = tex(o.shawl.color, 108), fr = C(o.shawl.fringe || o.shawl.color);
        torso.ellipsoid(0, 31, -0.5, 9.5, 2.4, 6, sh);
        torso.fill(-9, 9, 21, 31, -7, -5, (x, y) => Math.abs(x) <= (y - 21) * 0.9, (x, y) => (Math.abs(x) >= Math.floor((y - 21) * 0.9) - 0.5 ? fr : sh(x, y, 0)));
        for (const s of [-1, 1]) torso.seg([s * 4, 30, 4.5], [s * 1, 24, 5.5], 1.2, 0.8, sh);       // ends crossed at the front
        torso.box(0, 0, 23, 24, 6, 6, fr);
      }

      /* head, face, hair, beard, hat */
      const head = M.part('head', [0, 33, 0], 'torso');
      head.rbox(-4, 4, 34, 42, -4, 3, 2, skin);
      head.stamp([
        '.bb...bb.',
        '..k...k..',
        '.........',
        '.r.....r.',
        '...mmm...',
      ], { b: C(o.brows || o.hair || '#3a2a1a'), k: black, r: o.rosy ? C('#e0807a') : null, m: mouth }, -4, 40, 1);
      head.set(0, 38, 4, skinD).set(0, 37, 4, skin);                                           // nose
      for (const s of [-1, 1]) head.box(s * 5, s * 5, 36, 38, -1, 0, skinD);                // ears
      if (o.hair && o.hairStyle !== 'none') {
        const hair = tex(o.hair, 109);
        const bald = o.hairStyle === 'bald';
        if (bald) head.fill(-5, 5, 37, 40, -5, 0, (x, y, z) => (z === -5 && Math.abs(x) <= 4) || (Math.abs(x) === 5 && z >= -4), hair);
        else {
          dome(head, 0, 41.2, -0.5, 5.4, 3.6, 5.4, 42, hair);                                                   // crown
          head.fill(-5, 5, 35, 42, -5, 1, (x, y, z) => (z <= -2 && !(Math.abs(x) === 5 && z === -5)) || (Math.abs(x) === 5 && y >= 38), hair);   // back and sides
        }
        if (o.hairStyle === 'bun') head.ellipsoid(0, 44, -5.5, 2.4, 2.4, 2.2, hair);
        if (o.hairStyle === 'long') head.fill(-5, 5, 27, 38, -6, -3, (x, y, z) => z <= -4 + (y > 34 ? 1 : 0) && Math.abs(x) <= 5 - (y < 30 ? 1 : 0), hair);
      }
      if (o.beard) {
        const bd = tex(o.beard, 110), st = o.beardStyle || 'full';
        if (st === 'full' || st === 'long') {
          head.fill(-5, 5, 32, 39, -1, 4, (x, y, z) => (y <= 35 && Math.abs(x) <= 4 && z >= 0) || (Math.abs(x) >= 4 && y >= 35 && y <= 39 && z <= 2), bd);
          if (st === 'long') head.fill(-4, 4, 25, 33, 0, 4, (x, y, z) => Math.abs(x) <= 4 - (33 - y) * 0.35 && z >= 1, bd);
        }
        head.box(-2, 2, 37, 37, 4, 4, bd); head.box(-2, -2, 36, 36, 4, 4, bd); head.box(2, 2, 36, 36, 4, 4, bd);   // moustache
      }
      const hat = o.hat, hc = hat ? tex(hat.color, 111) : null, h2 = hat && hat.color2 ? C(hat.color2) : null;
      if (hat) switch (hat.type) {
        case 'chef':
          head.rbox(-5, 5, 42, 44, -6, 5, 2, hc);
          dome(head, 0, 48.5, -0.5, 6, 4.2, 6, 44, (x, y, z) => ((x + 40) % 3 === 0 ? mul(C(hat.color), 0.9) : hc(x, y, z)));
          break;
        case 'mob':
          dome(head, 0, 42.4, -0.8, 5.8, 3.6, 5.8, 42, hc);
          head.fill(-7, 7, 42, 42, -7, 6, (x, y, z) => { const r = Math.hypot(x, z + 0.8); return r >= 5.2 && r <= 6.8; }, h2 || hc);
          break;
        case 'straw':
          head.fill(-10, 10, 43, 43, -10, 9, (x, y, z) => Math.hypot(x, z + 0.5) <= 9.2, (x, y, z) => ((x + z + 40) % 2 === 0 ? mul(C(hat.color), 0.82) : hc(x, y, z)));
          head.rbox(-4, 4, 43, 47, -5, 4, 2, hc); head.rbox(-4, 4, 44, 44, -5, 4, 2, h2 || hc);
          break;
        case 'cap':
          dome(head, 0, 42.4, -0.5, 5.5, 2.6, 5.5, 42, hc); head.box(-4, 4, 42, 42, 4, 7, h2 || hc);
          break;
        case 'beanie':
          dome(head, 0, 42, -0.5, 5.6, 4, 5.6, 41, hc);
          head.fill(-6, 6, 41, 42, -7, 6, (x, y, z) => { const r = Math.hypot(x, z + 0.5); return r >= 4.6 && r <= 6.3; }, h2 || hc);
          head.ellipsoid(0, 46.5, -0.5, 1.6, 1.4, 1.6, h2 || hc);
          break;
        case 'kerchief':
          dome(head, 0, 41.5, -0.8, 5.7, 4.5, 5.7, 39, (x, y, z) => (Hash.h3(x, y, z, 72) < 0.14 ? C('#fbf7ee') : hc(x, y, z)), (x, y, z) => z <= 1 || y >= 42);
          head.seg([0, 40, -5.5], [0, 36, -7], 1.5, 0.8, hc);
          break;
        case 'kettle':
          head.fill(-9, 9, 43, 43, -9, 8, (x, y, z) => Math.hypot(x, z + 0.5) <= 7.6, (x, y, z) => (Math.hypot(x, z + 0.5) > 6.6 ? mul(C(hat.color), 1.2) : hc(x, y, z)));
          dome(head, 0, 43.5, -0.5, 5.2, 3.6, 5.2, 43, hc);
          break;
        case 'beret':
          dome(head, 0.8, 43, -0.5, 6.3, 2.4, 6, 42, hc);
          head.seg([-4, 44.5, -3], [-8, 51, -7], 1.1, 0.3, h2 || hc); head.set(-4, 44, 3, gold);
          break;
        case 'wizard':
          head.fill(-9, 9, 43, 43, -9, 8, (x, y, z) => Math.hypot(x, z + 0.5) <= 7.6, hc);
          head.seg([0, 43, -0.5], [1.5, 57, -4], 5, 0.3, hc, false);
          if (h2) head.recolor((x, y) => y === 44 || y === 45, h2);
          break;
        case 'slouch':
          head.fill(-9, 9, 42, 43, -9, 8, (x, y, z) => { const r = Math.hypot(x, z + 0.5); return r <= 8.2 && y === (r > 6.2 ? 42 : 43); }, hc);
          dome(head, 0, 43.5, -0.5, 4.6, 3, 4.6, 43, hc); head.fill(-5, 5, 44, 44, -6, 5, (x, y, z) => { const r = Math.hypot(x, z + 0.5); return r >= 4 && r <= 5.2; }, h2 || hc);
          break;
        case 'skullcap':
          dome(head, 0, 42.4, -0.8, 5.4, 2.4, 5.4, 42, hc);
          break;
        case 'bandana':
          dome(head, 0, 41.5, -0.6, 5.5, 3.6, 5.5, 41, hc, (x, y, z) => z <= 2 || y >= 41);
          head.seg([1, 41.5, -5.5], [3, 37, -7], 0.9, 0.5, hc);
          break;
      }

      /* arms */
      for (const [name, s] of [['armR', -1], ['armL', 1]]) {
        const xc = s * 10, A = M.part(name, [xc, 31, 0], 'torso');
        if (o.robe) {
          A.seg([xc, 30, 0], [xc + s * 1.2, 18, 1], 2.6, 3.8, (x, y, z) => (y <= 16 ? robeTrim : robe(x, y, z)));
          A.carve((x, y) => y < 15);
        } else {
          A.ellipsoid(xc, 29.5, 0, 3, 2.6, 3.2, sleeve);
          A.rbox(xc - 2, xc + 2, 22, 29, -2, 2, 1, sleeve);
          A.rbox(xc - 2, xc + 2, 15, 21, -2, 2, 1, o.rolled ? skin : sleeve);
          if (o.rolled) A.rbox(xc - 2, xc + 2, 21, 22, -3, 3, 1, mul(C(o.coat ? o.coat.color : o.shirt), 0.85));
          else if (o.coat) A.rbox(xc - 2, xc + 2, 15, 16, -3, 3, 1, coatTrim);
        }
        A.ellipsoid(xc + (o.robe ? s * 1.2 : 0), 13.5, 0.5, 2, 2, 2, skin);
      }

      // grime from the job (soot, stone dust, flour): sprinkled over clothes and skin, never over the tools
      if (o.dirt) { const d = tex(o.dirt.color, 112); for (const n of ['hips', 'legR', 'legL', 'torso', 'head', 'armR', 'armL']) M.parts.get(n).recolor((x, y, z) => Hash.h3(x, y, z, 73) < o.dirt.amount, d); }

      if (o.right) WorkerSculptor.PROPS[o.right](M, 'weapon', 'armR', -10, C);
      if (o.left) WorkerSculptor.PROPS[o.left](M, o.left === 'bow' ? 'weapon' : 'prop', 'armL', 10, C);
      if (o.extra) for (const e of o.extra) WorkerSculptor.PROPS[e](M, e, 'hips', -10, C);
      return M;
    }
  }

  /* hand-held tools: (model, part name, parent arm, hand x, colour fn). The hand is at (hx, 13.5, 0.5). */
  {
    const mo = CharacterSculptor.mottle;
    const wood = (C, h = '#8a5a30') => mo([[C(h), 4], [Colour.mul(C(h), 0.75), 2], [Colour.mul(C(h), 1.2), 1.2]], 81);
    const iron = (C, h = '#8e939b') => mo([[C(h), 4], [Colour.mul(C(h), 1.25), 1.5], [Colour.mul(C(h), 0.75), 1.5]], 82);
    const pole = (P, hx, C, top, h) => P.seg([hx, 0, 1.5], [hx, top, 1.5], 0.6, 0.6, wood(C, h));
    WorkerSculptor.PROPS = {
      ladle(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        P.seg([hx, 12, 1], [hx, 25, 4], 0.6, 0.6, wood(C, '#c89a5a'));
        P.ellipsoid(hx, 26, 5.4, 2.2, 1.4, 2.2, iron(C, '#c9ccd2')); P.carve((x, y, z) => y >= 27 && z >= 3.5 && Math.hypot(x - hx, z - 5.4) < 1.8);
      },
      hammer(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        P.seg([hx, 11, 0.5], [hx, 24, 0.5], 0.7, 0.7, wood(C));
        P.box(hx - 1.5, hx + 1.5, 23, 26, -3, 4, (x, y, z) => (z === 4 || z === -3 ? C('#b9bec6') : iron(C, '#5d6168')(x, y, z)));
      },
      axe(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        P.seg([hx, 9, 0.5], [hx, 29, 0.5], 0.7, 0.7, wood(C, '#9a6a38'));
        P.fill(hx - 0.5, hx + 0.5, 22, 31, 1, 7, (x, y, z) => Math.abs(y - 26.5) <= 1.2 + (z - 1) * 0.5, (x, y, z) => (z >= 6 ? C('#e4e8ee') : iron(C)(x, y, z)));
        P.box(hx - 1, hx + 1, 25, 28, -1, 0, iron(C, '#5d6168'));
      },
      pick(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        P.seg([hx, 9, 0.5], [hx, 28, 0.5], 0.7, 0.7, wood(C, '#9a6a38'));
        P.seg([hx, 26.5, -7], [hx, 28.6, 0.5], 0.4, 1.3, iron(C, '#6a6e75')); P.seg([hx, 28.6, 0.5], [hx, 26.5, 8.5], 1.3, 0.3, iron(C, '#6a6e75'));
      },
      cleaver(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        P.seg([hx, 11, 0.5], [hx, 17, 0.5], 0.7, 0.7, wood(C, '#4a2a16'));
        P.box(hx, hx, 17, 24, -1, 5, (x, y, z) => (y === 24 ? C('#6a6e75') : z === 5 ? C('#eef1f5') : C('#b9bec6')));
        P.set(hx, 23, 4, null);
      },
      pitchfork(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        pole(P, hx, C, 46, '#b07a42');
        P.seg([hx - 3, 46, 1.5], [hx + 3, 46, 1.5], 0.5, 0.5, iron(C));
        for (const dx of [-3, 0, 3]) P.seg([hx + dx, 46, 1.5], [hx + dx, 54, 1.5], 0.45, 0.15, iron(C, '#a9aeb6'));
      },
      crook(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par), w = wood(C, '#7a4a24');
        pole(P, hx, C, 47, '#7a4a24');
        let prev = [hx, 47, 1.5];
        for (let a = 0.25; a <= Math.PI * 1.3; a += 0.25) { const p = [hx - 3 + 3 * Math.cos(a), 47 + 3 * Math.sin(a), 1.5]; P.seg(prev, p, 0.6, 0.6, w); prev = p; }
      },
      bow(M, n, par, hx, C) {
        const P = M.part(n, [hx, 14, 1], par), br = C('#86532e'), brL = C('#a87449'), brD = C('#3b2212');
        for (let t = -1; t <= 1.0001; t += 0.015) {
          const y = 14 + t * 19, x = hx + 5.5 * (1 - t * t) - (Math.abs(t) > 0.82 ? (Math.abs(t) - 0.82) * 12 : 0);
          const c = Math.abs(t) < 0.12 ? brD : Hash.h3(0, Math.round(y), 0, 36) < 0.3 ? brL : br;
          P.set(Math.round(x), Math.round(y), 1, c); if (Math.abs(t) < 0.7) P.set(Math.round(x), Math.round(y), 2, c);
          if (Math.abs(t) < 0.15) P.set(Math.round(x) + 1, Math.round(y), 1, brD);
        }
        for (let y = -4; y <= 32; y++) P.set(hx, y, 1, C('#ece8dc'));
        P.set(hx, -5, 1, null); P.set(hx, 33, 1, null);
      },
      quiver(M, n, par, hx, C) { // on the back, rides the torso as the 'cape' bone
        const P = M.part('cape', [0, 32, -4], 'torso'), lw = wood(C, '#6a3e1e');
        P.seg([-4, 20, -6.5], [3, 31, -6.5], 2.2, 2.2, lw);
        P.seg([-4, 20, -6.5], [3, 31, -6.5], 2.4, 2.4, (x, y) => ((y - 20) % 4 === 0 ? C('#c0904a') : null));
        for (const [dx, dy] of [[0, 0], [1.6, -0.6], [-1.4, 0.4], [0.8, 1.2]]) {
          const a = [3 + dx, 32 + dy, -6.5], b = [5.5 + dx * 1.4, 38 + dy, -7.5];
          P.seg(a, b, 0.4, 0.4, C('#c0904a')); P.seg([b[0] - 0.6, b[1] - 1.4, b[2]], [b[0] + 0.3, b[1] + 0.6, b[2]], 0.9, 0.5, C('#e23a2e'));
        }
      },
      brush(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        P.box(hx - 1.5, hx + 1.5, 12, 14, 1, 7, wood(C, '#a0663a')); P.box(hx - 1.5, hx + 1.5, 10, 11, 1, 7, mo([[C('#e0b878'), 3], [C('#b88a4a'), 2]], 83));
        P.box(hx - 0.5, hx + 0.5, 15, 15, 2, 6, C('#5a3418'));
      },
      bucket(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par), bx = hx + 0.5, bz = 0.5;
        P.fill(bx - 4, bx + 4, 2, 9, bz - 4, bz + 4, (x, y, z) => Math.hypot(x - bx, z - bz) <= 2.6 + (y - 2) * 0.08, (x, y) => (y === 3 || y === 8 ? C('#6a6e75') : wood(C, '#a06a38')(x, y, 0)));
        P.carve((x, y, z) => y >= 8 && Math.hypot(x - bx, z - bz) <= 2.2); P.fill(bx - 3, bx + 3, 7, 7, bz - 3, bz + 3, (x, y, z) => Math.hypot(x - bx, z - bz) <= 2.2, C('#4aa8e8'));
        let prev = [bx - 3, 9, bz];
        for (let a = Math.PI - 0.3; a >= 0; a -= 0.3) { const p = [bx + 3 * Math.cos(a), 9 + 4.5 * Math.sin(a), bz]; P.seg(prev, p, 0.3, 0.3, C('#6a6e75')); prev = p; }
      },
      clipboard(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        P.box(hx + 2, hx + 2, 8, 20, -3, 5, wood(C, '#b07a42'));
        P.box(hx + 3, hx + 3, 9, 18, -2, 4, (x, y, z) => (y % 2 === 0 && z > -2 && z < 4 ? C('#8a96a8') : C('#fbfaf4')));
        P.box(hx + 3, hx + 3, 19, 20, 0, 2, C('#b9bec6'));
      },
      keys(M, n, par, hx, C) {
        const P = M.parts.get('hips'), g = C('#f2c14e');
        for (let a = 0; a < Math.PI * 2; a += 0.5) P.set(-8, Math.round(17 + 1.4 * Math.sin(a)), Math.round(1 + 1.4 * Math.cos(a)), g);
        P.seg([-8, 15.5, 0.5], [-8, 11.5, 0], 0.35, 0.35, g); P.seg([-8, 15.5, 1.5], [-8, 12, 2.5], 0.35, 0.35, g);
        P.box(-8, -8, 11, 12, -1, -1, g); P.box(-8, -8, 12, 13, 3, 3, g);
      },
      ledger(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par), cov = C('#b0322a'), pg = C('#f4ecd6'), g = C('#f2c14e');
        P.box(hx + 1, hx + 3, 9, 18, -3, 4, (x, y, z) => (z === -3 ? (y === 11 || y === 16 ? g : C('#7a1f1a')) : x === hx + 1 || x === hx + 3 ? ((y === 9 || y === 18) && (z === 4) ? g : cov) : pg));
      },
      purse(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par), g = C('#f2c14e');
        P.ellipsoid(hx, 9.5, 1, 2.4, 2.6, 2.4, mo([[C('#8a4a8a'), 4], [C('#6a326a'), 2]], 84));
        P.seg([hx, 11.5, 1], [hx, 13, 1], 1.2, 1.4, C('#6a326a')); P.box(hx - 1, hx + 1, 12, 12, 0, 2, g);
        for (const [y, x] of [[10, 0], [8, 1], [9, -1]]) P.set(hx + x, y, 4, g);
        P.ellipsoid(hx + 0.5, 14.5, 2.5, 1.2, 0.4, 1.2, g);
      },
      basket(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par), bx = hx + 1, by = 8.5, bz = 1.5;
        P.ellipsoid(bx, by, bz, 3.6, 2.8, 3.3, (x, y, z) => ((x + y + z + 60) % 2 === 0 ? C('#9a6a2a') : C('#d09a48')));
        P.carve((x, y, z) => y > by + 0.5);
        for (const [dx, dy, dz, c] of [[-1.5, 1, -1, '#fbf6ea'], [1.2, 1, 1.2, '#e2b98a'], [1.4, 1, -1.4, '#fbf6ea'], [-1.2, 1, 1.6, '#f3e6cf'], [0, 2, 0, '#e2b98a']]) P.ellipsoid(bx + dx, by + dy, bz + dz, 1, 1.3, 1, C(c));
        let prev = [bx - 3.3, by + 0.5, bz];
        for (let a = Math.PI - 0.3; a >= 0; a -= 0.3) { const p = [bx + 3.3 * Math.cos(a), by + 0.5 + 5 * Math.sin(a), bz]; P.seg(prev, p, 0.45, 0.45, C('#9a6a2a')); prev = p; }
      },
      loaf(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        P.ellipsoid(hx + 0.5, 12, 3, 2.4, 2.2, 4.4, (x, y, z) => (y >= 13 && (z + 40) % 3 === 0 ? C('#f0cf86') : y >= 12 ? C('#b8702e') : C('#d08a3c')));
      },
      peel(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        pole(P, hx, C, 34, '#d0a060');
        P.fill(hx - 3.5, hx + 3.5, 34, 45, 1, 2, (x, y) => Math.abs(x - hx) <= 3.2 - (y > 42 ? (y - 42) * 0.8 : 0), wood(C, '#d8a868'));
      },
      potion(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par);
        P.seg([hx, 19.5, 2.5], [hx, 21.5, 2.5], 0.8, 0.7, C('#cfeeff')); P.ellipsoid(hx, 22.5, 2.5, 0.9, 0.8, 0.9, C('#8a5a30'));
        const L = M.part('potion', [hx, 17, 2.5], n, { glow: true, jitter: 0.1 });
        L.ellipsoid(hx, 17, 2.5, 2.2, 2.2, 2.2, mo([[C('#56e07a'), 4], [C('#a8ffbe'), 2], [C('#2fae5a'), 1.5]], 85));
      },
      tome(M, n, par, hx, C) {
        const P = M.part(n, [hx, 13.5, 0.5], par), g = C('#f2c14e');
        P.box(hx + 1, hx + 3, 9, 16, -2, 4, (x, y, z) => (z === -2 ? C('#2a4a3a') : x === hx + 1 || x === hx + 3 ? ((y === 12 || y === 13) && (z === 1 || z === 2) ? g : C('#2f6a4f')) : C('#efe4c6')));
      },
    };
  }

  /* the jobs. Colours are bright on purpose: you should know who someone is from across the yard. */
  WorkerSculptor.LOOKS = {
    cook: { skin: '#eab592', hair: '#7a3b1e', hairStyle: 'bun', rosy: true, hat: { type: 'mob', color: '#fbf8f0', color2: '#ffffff' },
      shirt: '#3f7fd0', skirt: { color: '#3f7fd0', hem: '#2c5ea6' }, apron: { color: '#fbf8f0', trim: '#e6dcc8', bib: true, pocket: true }, rolled: true, boots: '#5a3420', right: 'ladle' },
    smith: { skin: '#c98d68', hair: '#24180f', hairStyle: 'bald', beard: '#24180f', shirt: '#5a6270', rolled: true, trousers: '#33323a', boots: '#1e1a18',
      apron: { color: '#7a4626', trim: '#4e2a14', bib: true }, dirt: { color: '#1e1c1c', amount: 0.1 }, right: 'hammer' },
    clerk: { skin: '#f0c4a0', hair: '#c9a25a', beard: '#a07d3a', beardStyle: 'moustache', shirt: '#f6f2e8', trousers: '#2b2b44', boots: '#2a1a10',
      coat: { color: '#6a2a8a', trim: '#f2c14e', tail: 9 }, hat: { type: 'beret', color: '#6a2a8a', color2: '#e23a2e' }, right: 'purse', left: 'ledger' },
    farmer: { skin: '#dba27c', hair: '#a8692e', hat: { type: 'straw', color: '#f0cc62', color2: '#d63a2c' }, shirt: '#f2e6c4', rolled: true,
      trousers: '#3b6fc8', apron: { color: '#3b6fc8', trim: '#2a54a0', bib: true, pocket: true }, boots: '#4a2c16', right: 'pitchfork' },
    woodcutter: { skin: '#d79b74', hair: '#5a3a1e', beard: '#7a4a24', hat: { type: 'beanie', color: '#3f9a46', color2: '#2c7032' },
      shirt: '#d0362a', pattern: 'plaid', shirt2: '#221816', trousers: '#3d6b35', belt: '#4a2c16', boots: '#4a2c16', right: 'axe' },
    quarryman: { skin: '#c88a62', hair: '#b5651d', hairStyle: 'bald', beard: '#b5651d', hat: { type: 'bandana', color: '#e0582c' },
      shirt: '#c99a3a', rolled: true, trousers: '#6b6560', belt: '#3a2a1a', boots: '#3a3030', dirt: { color: '#b8b2a6', amount: 0.07 }, right: 'pick' },
    archer: { skin: '#e0a982', hair: '#3a2616', hat: { type: 'kettle', color: '#9aa0a8' }, shirt: '#2f8a4e', trousers: '#5a3a22', apron: { color: '#c8302a', trim: '#f2c14e', bib: true, back: true, short: true },
      boots: '#3a2414', style: 'bow', left: 'bow', extra: ['quiver'] },
    stablehand: { skin: '#f0c09a', hair: '#e0b050', hat: { type: 'cap', color: '#8a5a30', color2: '#6a4220' }, shirt: '#3f95e0', rolled: true,
      trousers: '#8a6a44', belt: '#4a2c16', boots: '#3a2414', rosy: true, right: 'brush', left: 'bucket' },
    storekeeper: { skin: '#e3ae8a', hair: '#a0a0a0', beard: '#c8c8c8', beardStyle: 'moustache', shirt: '#f2eedf', trousers: '#5a4a3a', boots: '#3a2414',
      apron: { color: '#2f9a5e', trim: '#20744a', bib: true, pocket: true }, left: 'clipboard', extra: ['keys'] },
    henwife: { skin: '#eab090', hair: '#cfc6b8', hairStyle: 'bun', rosy: true, hat: { type: 'kerchief', color: '#e03a34' },
      shirt: '#9a6cc8', skirt: { color: '#7a4fb0', hem: '#5a3488' }, shawl: { color: '#f09a32', fringe: '#ffd27a' }, boots: '#4a2c16', left: 'basket' },
    cowherd: { skin: '#c99068', hair: '#4a3420', beard: '#4a3420', hat: { type: 'slouch', color: '#7a5230', color2: '#4a2c16' }, shirt: '#e6dcc0',
      coat: { color: '#a8743c', trim: '#7a4e22', tail: 7 }, trousers: '#5a5a3a', boots: '#3a2414', right: 'crook' },
    baker: { skin: '#f0c2a0', hair: '#6a4a2a', beard: '#6a4a2a', beardStyle: 'moustache', rosy: true, hat: { type: 'chef', color: '#ffffff' },
      shirt: '#fbfaf6', rolled: true, trousers: '#3a5aa0', trousers2: '#e8e4dc', pattern2: 'check', apron: { color: '#fbf3e0', trim: '#d8b878', bib: false },
      boots: '#4a2c16', dirt: { color: '#ffffff', amount: 0.06 }, right: 'peel', left: 'loaf' },
    butcher: { skin: '#e8a084', hair: '#2a1a12', beard: '#2a1a12', beardStyle: 'moustache', hat: { type: 'skullcap', color: '#fbfaf6' },
      shirt: '#fbfaf6', pattern: 'stripe', shirt2: '#d0302a', rolled: true, trousers: '#3a3a44', boots: '#1e1a18',
      apron: { color: '#fbfaf6', trim: '#d8d4cc', bib: true, stain: '#b0201c' }, right: 'cleaver' },
    alchemist: { skin: '#e8b898', hair: '#e2e2e2', beard: '#e8e8e8', beardStyle: 'long', hat: { type: 'wizard', color: '#6a3ab0', color2: '#f2c14e' },
      shirt: '#6a3ab0', robe: { color: '#6a3ab0', trim: '#f2c14e', hem: '#f2c14e', sash: '#3fc07a' }, boots: '#2a1a2a', style: 'cast', glow: '#7dffa0',
      right: 'potion', left: 'tome' },
  };
  for (const id of Object.keys(WorkerSculptor.LOOKS)) {
    CharacterSculptor['make_' + id] = () => WorkerSculptor.make(id, WorkerSculptor.LOOKS[id]);
    const look = WorkerSculptor.LOOKS[id], short = { hammer: 0.95, axe: 0.85, pick: 0.85, cleaver: 0.9, ladle: 0.35, brush: 0, purse: 0, potion: 0 }[look.right];
    CharacterSculptor.REST[id] = id === 'archer' ? CharacterSculptor.REST.ranger
      : Object.assign({ armR: [-0.12, 0, -0.05], armL: [-0.12, 0, 0.05] }, short ? { weapon: [short, 0, 0] } : null);   // short tools tip forward out of the fist
  }

  Object.assign(KV, { CharacterSculptor, WorkerSculptor });
})(typeof window !== 'undefined' ? window : globalThis);
