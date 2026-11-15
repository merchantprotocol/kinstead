/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Asset Lab model · woodcutter (the Woodcutter's lodge; ref: public/art/woodcutter.webp).
   A rigid castle piece, 1 voxel = 2.8 cm, about 2.8 x 2.5 m on its rocky base (the game footprint is 2.6 x 2.2 m).
   Model space: y up, front (door, gable) +z, the long side wall with the window and the log pile on +x.
   Built back to front: base patch, stone plinth, log walls, gables, slate roof, snow + icicles, chimney,
   then the yard (stone steps, lanterns, stump with the axe, log pile, ember bucket, split firewood). */
(function (G) {
  const K = G.K;

  K.Models.register('woodcutter', ({ Shapes: S, StaticVoxelModel, Hash, K: KK }) => {
    const P = S.palette({
      log: '#6b4a2e', logL: '#8a6440', logD: '#47301e', logDD: '#2e1f14', chink: '#3a2a1c', cut: '#b88a58', cutL: '#d4a874', cutD: '#8c6238',
      stone: '#7b7f84', stoneL: '#9a9ea3', stoneD: '#575b60', stoneDD: '#3c4044', mortar: '#4a4d51',
      slate: '#3d4752', slateL: '#55606b', snow: '#eef3f7', snowS: '#cfdbe5', snowB: '#ffffff', ice: '#bcd6ea',
      moss: '#5d6b3a', dirt: '#5a4632', iron: '#3a3a3c', ironL: '#5c5c60', rust: '#6e3b22',
      'glass*': '#ffb54a', 'lamp*': '#ffcc66', 'ember*': '#ff8a2a', 'emberL*': '#ffd27a',
    });
    const mo = S.mottle, noise = KK.SculptNoise ? KK.SculptNoise.n2 : S.noise2;
    const log = mo([[P.log, 6], [P.logL, 2], [P.logD, 2.5]], 61), logDk = mo([[P.logD, 5], [P.logDD, 2], [P.log, 1.5]], 62);
    const stone = [mo([[P.stone, 5], [P.stoneL, 2], [P.stoneD, 1]], 63), mo([[P.stoneD, 5], [P.stone, 2], [P.stoneDD, 1]], 64), mo([[P.stoneL, 4], [P.stone, 3]], 65)];
    const stoneMix = mo([[P.stone, 5], [P.stoneD, 3], [P.stoneL, 2], [P.stoneDD, 1]], 66);
    const snow = mo([[P.snow, 6], [P.snowS, 2], [P.snowB, 2]], 67);
    const ring = [P.cutD, P.cut, P.cutL, P.cut];

    const M = new StaticVoxelModel('woodcutter', {
      size: 0.028, footprint: [2.6, 2.2],
      lights: [[4, 69, 27, 1], [30, 42, -6, 0.9], [-7, 41, 30, 0.7], [15, 41, 30, 0.7], [16, 107, -20, 0.6], [18, 16, 36, 0.6]],
    });
    const p = M.part();

    /* ---- the rocky base: stone sides, gravel + snow + moss top, a little higher under the house ---- */
    const top = (x, y, z) => { const n = noise(x, z, 5, 71); return n > 0.58 ? snow(x, y, z) : n < 0.16 && Hash.h3(x, y, z, 72) < 0.5 ? P.moss : n < 0.3 ? P.dirt : stoneMix(x, y, z); };
    S.basePatch(p, { cx: 0, cz: 2, rx: 50, rz: 44, y0: 0, h: 6, square: true, wobble: 0.14, seed: 73 }, stoneMix, top);
    S.basePatch(p, { cx: 4, cz: -6, rx: 34, rz: 33, y0: 6, h: 3, square: true, wobble: 0.1, seed: 74 }, stoneMix, top);

    /* ---- house: x -22..30, z -34..24; stone plinth, then log walls ---- */
    const X0 = -22, X1 = 30, Z0 = -34, Z1 = 24, CX = (X0 + X1) / 2, PL = 26, WT = 58;
    S.stoneWall(p, { x0: X0 - 1, x1: X1 + 1, y0: 9, y1: PL, z0: Z0 - 1, z1: Z1 + 1, course: 4, stone: 6, seed: 75 }, stone, P.mortar);
    for (const z of [Z0, Z1]) S.logWall(p, { axis: 'x', from: X0, to: X1, at: z, y0: PL + 1, y1: WT, r: 2.5, ends: 3, chink: P.chink }, log, (x, y, z2) => ring[Math.floor(Hash.h3(x, y, z2, 76) * 4)]);
    for (const x of [X0, X1]) S.logWall(p, { axis: 'z', from: Z0, to: Z1, at: x, y0: PL + 1, y1: WT, r: 2.5, ends: 3, chink: P.chink }, log, (x2, y, z) => ring[Math.floor(Hash.h3(x2, y, z, 77) * 4)]);
    p.box(X0 + 2, X1 - 2, PL + 1, WT, Z0 + 2, Z1 - 2, P.logDD);   // the dark inside (stops see-through gaps)

    /* gables: horizontal boards stepping in with the roof pitch, dark bargeboards */
    const RISE = 30, half = (X1 - X0) / 2 + 0.5;
    for (let y = WT + 1; y <= WT + RISE; y++) {
      const w = Math.floor(half * (WT + RISE - y) / RISE);
      for (const z of [Z0, Z1]) p.box(Math.ceil(CX - w), Math.floor(CX + w), y, y, z - 1, z + 1, (x, yy, zz) => ((yy + 300) % 4 === 0 ? P.logDD : (x + 300) % 7 === 0 ? P.logD : log(x, yy, zz)));
    }
    p.box(X0 + 2, X1 - 2, WT, WT + 1, Z1 + 2, Z1 + 3, logDk);   // the beam across the gable foot

    /* ---- roof: steep slate gable, ridge along z, thick snow with icicles ---- */
    const roof = S.gableRoof(p, { x0: X0, x1: X1, z0: Z0, z1: Z1, y: WT - 1, rise: RISE, thick: 3, overhang: 5, gableOverhang: 5, ridge: 'z' }, (x, y, z) => (z >= Z1 + 4 || z <= Z0 - 4 ? P.logDD : P.slate));
    S.shingleRows(p, roof, { rowH: 3, tileW: 4, paints: [P.slate, P.slateL, P.stoneD], lip: P.logDD, seed: 78 });
    /* snow: thick and lumpy on the roof, a lip over the eaves, icicles along them */
    S.snowCap(p, { depth: [2, 5], paint: snow, seed: 79, lumps: 0.3, scale: 2.5, lip: 0.6, test: (x, y, z) => y >= WT - 3 && y < 100 && x >= X0 - 6 && x <= X1 + 6 && z >= Z0 - 6 && z <= Z1 + 6, icicles: { chance: 0.22, len: [2, 6], paint: P.ice } });

    /* ---- chimney: stone stack at the back right of the ridge, embers in its throat ---- */
    const chx0 = 10, chx1 = 19, chz0 = -26, chz1 = -17;
    S.stoneWall(p, { x0: chx0, x1: chx1, y0: WT, y1: 104, z0: chz0, z1: chz1, course: 3, stone: 4, seed: 80 }, stone, P.mortar);
    p.box(chx0 - 1, chx1 + 1, 102, 104, chz0 - 1, chz1 + 1, stone[1]);
    p.carve((x, y, z) => x >= chx0 + 2 && x <= chx1 - 2 && y >= 103 && z >= chz0 + 2 && z <= chz1 - 2);
    p.box(chx0 + 2, chx1 - 2, 101, 102, chz0 + 2, chz1 - 2, (x, y, z) => (Hash.h3(x, y, z, 81) < 0.5 ? P.ember : P.emberL));

    /* ---- front: door with straps, frame, canopy; gable window; side window ---- */
    const DX0 = -3, DX1 = 9, DY0 = PL + 1, DY1 = PL + 22, FZ = Z1 + 2;
    p.box(DX0 - 2, DX1 + 2, DY0, DY1 + 2, FZ, FZ, logDk);
    p.box(DX0, DX1, DY0, DY1, FZ, FZ + 1, (x, y, z) => (z === FZ ? P.logDD : (x + 300) % 3 === 0 ? P.logDD : P.logD));
    for (const y of [DY0 + 4, DY1 - 4]) p.box(DX0, DX1, y, y, FZ + 2, FZ + 2, P.iron);
    p.box(DX1 - 2, DX1 - 1, DY0 + 10, DY0 + 11, FZ + 2, FZ + 2, P.ironL);
    p.box(DX0 - 4, DX1 + 4, DY1 + 3, DY1 + 4, FZ - 1, FZ + 6, logDk);   // canopy (snowed below)
    S.snowCap(p, { depth: [1, 3], paint: snow, seed: 82, lumps: 0.3, test: (x, y, z) => y === DY1 + 4 && z > FZ - 1 });
    const win = (x0, x1, y0, y1, z, axis) => {   // frame, glowing panes, a dark cross bar; axis 'z' = in a front wall, 'x' = side wall
      const at = (a, b, c) => (axis === 'z' ? [a, b, c] : [c, b, a]);
      for (let a = x0 - 1; a <= x1 + 1; a++) for (let y = y0 - 1; y <= y1 + 1; y++) {
        const edge = a === x0 - 1 || a === x1 + 1 || y === y0 - 1 || y === y1 + 1, bar = a === Math.round((x0 + x1) / 2) || y === Math.round((y0 + y1) / 2);
        const [x, yy, zz] = at(a, y, z); p.set(x, yy, zz, edge ? P.logDD : bar ? P.logDD : P.glass);
        if (edge) { const [x2, y2, z2] = at(a, y, z + 1); p.set(x2, y2, z2, P.logD); }
      }
    };
    win(-1, 8, WT + 6, WT + 15, FZ, 'z');
    win(-14, -5, PL + 10, PL + 19, X1 + 2, 'x');
    /* lanterns either side of the door */
    for (const x of [DX0 - 5, DX1 + 5]) { p.box(x - 1, x + 1, PL + 13, PL + 18, FZ + 1, FZ + 2, P.lamp); p.box(x - 1, x + 1, PL + 19, PL + 19, FZ + 1, FZ + 2, P.iron); p.box(x - 1, x + 1, PL + 12, PL + 12, FZ + 1, FZ + 2, P.iron); }

    /* ---- stone steps down to the yard, snow on the treads ---- */
    for (let i = 0; i < 4; i++) {
      const y1 = PL - i * 4, z0 = Z1 + 2 + i * 4;
      S.stoneWall(p, { x0: DX0 - 3, x1: DX1 + 3, y0: 6, y1, z0, z1: z0 + 4, course: 4, stone: 5, seed: 83 + i, inset: false }, stone, P.mortar);
      for (let x = DX0 - 3; x <= DX1 + 3; x++) if (Hash.h3(x, i, 0, 84) < 0.45) p.box(x, x, y1 + 1, y1 + 1, z0, z0 + 2, snow);
    }

    /* ---- yard: tree stump with roots and the axe, woodchips ---- */
    const SX = -32, SZ = 26;
    S.cylinder(p, { axis: 'y', at: [SX, SZ], from: 6, to: 21, r: 10 }, (x, y, z) => ((Math.round(Math.atan2(z - SZ, x - SX) * 6) + 60) % 3 === 0 ? P.logDD : log(x, y, z)));
    S.cylinder(p, { axis: 'y', at: [SX, SZ], from: 22, to: 22, r: 10 }, (x, y, z) => { const d = Math.hypot(x - SX, z - SZ); return d > 9 ? P.logD : ring[Math.floor(d) % 4]; });
    for (let a = 0; a < 6; a++) { const t = a * 1.05 + 0.3; p.seg([SX + Math.cos(t) * 8, 9, SZ + Math.sin(t) * 8], [SX + Math.cos(t) * 15, 6, SZ + Math.sin(t) * 15], 2.2, 1.2, logDk); }
    S.slab(p, { a: [SX - 1, 26, SZ + 1], b: [SX - 13, 52, SZ + 4], wdir: [0, 0, 1], half: 1.1, thick: 1 }, mo([[P.logL, 3], [P.log, 2]], 85));
    S.slab(p, { a: [SX - 5, 19, SZ + 1], b: [SX + 6, 26, SZ + 1], wdir: [0, 0, 1], half: (t) => 3.5 - t * 1.5, thick: 1.2 }, (x, y, z, t) => (t > 0.85 ? P.ironL : Hash.h3(x, y, z, 86) < 0.3 ? P.stoneD : P.iron));
    for (let i = 0; i < 26; i++) { const a = Hash.h3(i, 0, 0, 87) * 6.28, r = 12 + Hash.h3(i, 1, 0, 87) * 8, x = Math.round(SX + Math.cos(a) * r), z = Math.round(SZ + Math.sin(a) * r); p.box(x, x + (i % 2), 6, 6 + (i % 3 === 0 ? 1 : 0), z, z, i % 3 ? P.cut : P.cutL); }

    /* ---- log pile against the right front, end grain toward the yard, snow on top ---- */
    S.logStack(p, { axis: 'z', x: 30, y: 6, z: 2, len: 26, rows: 5, perRow: 6, r: 3.5, jitter: 3, seed: 88 }, log, ring);
    S.snowCap(p, { depth: [1, 3], paint: snow, seed: 89, lumps: 0.3, test: (x, y, z) => x >= 30 && y > 14 && y < WT - 3 && z >= 0 && z <= 32 });

    /* ---- ember bucket and split firewood in the middle of the yard ---- */
    S.cylinder(p, { axis: 'y', at: [17, 37], from: 6, to: 15, r0: 4, r1: 5 }, (x, y, z) => (y === 15 || y === 10 ? P.iron : Hash.h3(x, y, z, 90) < 0.4 ? P.rust : P.ironL));
    S.cylinder(p, { axis: 'y', at: [17, 37], from: 15, to: 15, r: 4 }, (x, y, z) => (Hash.h3(x, y, z, 91) < 0.5 ? P.ember : P.emberL));
    for (const [a, b] of [[[-2, 7, 34], [10, 8, 42]], [[-1, 7, 42], [9, 9, 33]], [[1, 9, 37], [8, 10, 41]]]) S.slab(p, { a, b, wdir: [0, 1, 0], half: 1.2, thick: 1 }, (x, y, z, t) => (t < 0.06 || t > 0.94 ? P.cutL : P.cut));
    return M;
  }, { kind: 'static', title: "Woodcutter's lodge", view: { yaw: 0.78, pitch: 0.52, fov: 18, fit: 'both' } });
})(typeof window !== 'undefined' ? window : globalThis);
