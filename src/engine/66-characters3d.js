/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the four HD voxel heroes, sculpted as real 3D voxel models.
   Each character is built from primitives in model space (y up, facing +z, the character's own right
   hand on -x), coloured with palettes sampled from Jonathon's chosen HD voxel lineup, then split into
   rigid body parts that hang off a small skeleton (hips > torso > head / arms > weapon, shield; hips > legs;
   torso > cape). Proportions follow the front art; depth follows the side and back turnaround views. */
(function (G) {
  const KV = G.KV, { Hash, Colour, VoxelModel } = KV;

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

  Object.assign(KV, { CharacterSculptor });
})(typeof window !== 'undefined' ? window : globalThis);
