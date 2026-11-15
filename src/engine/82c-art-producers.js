/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · art overrides for some castle pieces (see the asset library, /assets.html). Each entry draws one piece type
   into a VoxKit; anything not listed here falls back to 82-castle-mesh.js.
   Producers and trade: the woodcutter's lodge, the quarry, the storehouse and the market's street stall row. Bright, readable
   colours and props that say what each place is from across the yard. */
(function (G) {
  const K = G.K, THREE = G.THREE, CYL = K.VoxKit.CYL, CYL8 = K.VoxKit.CYL8, SPH = new THREE.SphereGeometry(1, 10, 7);
  const P2 = Math.PI / 2;



  /* sign pictures (board-local units, about 0.5 x 0.36) */
  const PIC = {
    axe: [['woodMid', 0.04, -0.03, 0.06, 0.42, -0.6], ['woodDark', -0.09, 0.1, 0.2, 0.16, -0.6], ['ironDark', -0.09, 0.1, 0.18, 0.14, -0.6], ['steel', -0.17, 0.05, 0.07, 0.22, -0.6], ['bark', 0.14, -0.15, 0.2, 0.06], ['woodLight', 0.25, -0.15, 0.03, 0.06]],
    picks: [['woodLight', 0, 0, 0.04, 0.34, 0.7], ['woodLight', 0, 0, 0.04, 0.34, -0.7], ['ironDark', -0.1, 0.13, 0.22, 0.05, 0.2], ['ironDark', 0.1, 0.13, 0.22, 0.05, -0.2], ['stoneLight', 0, -0.07, 0.12, 0.09]],
    stores: [['woodMid', -0.14, 0.1, 0.13, 0.17], ['ironDark', -0.14, 0.06, 0.15, 0.025], ['ironDark', -0.14, -0.02, 0.15, 0.025], ['woodLight', 0.03, 0.08, 0.15, 0.15], ['woodDark', 0.03, 0.08, 0.15, 0.03], ['woodDark', 0.03, 0.01, 0.025, 0.15],
      ['canvas', 0.17, 0.07, 0.11, 0.13], ['rope', 0.17, 0.08, 0.06, 0.025]],
    bread: [['wheatGold', -0.13, 0.13, 0.035, 0.28], ['wheatGold', -0.19, 0.12, 0.035, 0.26, 0.3], ['wheatGold', -0.07, 0.12, 0.035, 0.26, -0.3], ['paintYellow', -0.13, 0.15, 0.06, 0.08], ['paintYellow', -0.21, 0.14, 0.05, 0.07, 0.3], ['paintYellow', -0.05, 0.14, 0.05, 0.07, -0.3], ['woodMid', -0.13, 0.02, 0.1, 0.04],
      ['woodDark', 0.11, 0.0, 0.24, 0.12], ['paintOrange', 0.11, -0.005, 0.22, 0.1], ['paintOrange', 0.11, 0.035, 0.16, 0.05], ['wheatGold', 0.08, 0.02, 0.02, 0.06, 0.4], ['wheatGold', 0.14, 0.02, 0.02, 0.06, 0.4]],
    meat: [['woodDark', -0.08, 0.06, 0.24, 0.16], ['woodDark', -0.08, 0.06, 0.18, 0.22], ['meatRed', -0.08, 0.06, 0.21, 0.13], ['meatRed', -0.08, 0.06, 0.15, 0.19], ['paintRed', -0.11, 0.09, 0.06, 0.05],
      ['eggWhite', 0.05, -0.06, 0.13, 0.04, 0.7], ['eggWhite', 0.09, -0.12, 0.045, 0.045], ['eggWhite', 0.11, -0.08, 0.045, 0.045],
      ['woodDark', 0.17, 0.07, 0.12, 0.15], ['woodDark', 0.17, 0.07, 0.09, 0.19], ['eggWhite', 0.17, 0.07, 0.1, 0.13], ['eggWhite', 0.17, 0.07, 0.07, 0.17]],
    swords: [['steel', 0, 0, 0.04, 0.34, 0.6], ['steel', 0, 0, 0.04, 0.34, -0.6], ['gold', -0.1, -0.06, 0.12, 0.03, 0.6], ['gold', 0.1, -0.06, 0.12, 0.03, -0.6], ['paintRed', 0, 0.03, 0.12, 0.12]],
    raw: [['woodMid', -0.1, 0.07, 0.3, 0.13], ['woodLight', -0.25, 0.07, 0.04, 0.13], ['woodDark', -0.25, 0.07, 0.015, 0.05], ['woodMid', -0.12, -0.08, 0.26, 0.11], ['woodLight', -0.25, -0.08, 0.04, 0.11], ['stoneDark', 0.15, 0.05, 0.18, 0.17], ['stoneLight', 0.145, 0.055, 0.16, 0.15], ['ironDark', 0.15, -0.11, 0.18, 0.07], ['steel', 0.15, -0.09, 0.12, 0.02]],
  };

  class ProducerArtPieces {
    /* ---------------- the woodcutter's lodge: a log cabin with a log pile, chopping block, saw-horse and plank stack ---------------- */
    static woodcutter(k, o) {
      const L2 = (o.level || 1) >= 2, cx = -0.45, cz = -0.45, w = 1.6, d = 1.2, H = L2 ? 1.55 : 1.1, front = cz + d / 2;
      // the cabin: stone footing, then horizontal logs with crossed corners
      k.box('stoneMid', cx, 0, cz, w + 0.14, 0.12, d + 0.14);
      k.box('woodMid', cx, 0.1, cz, w - 0.1, H - 0.1, d - 0.1);
      const r = 0.075, n = Math.round((H - 0.12) / (r * 1.9));
      for (let i = 0; i < n; i++) {
        const y = 0.12 + r + i * r * 1.9;
        for (const s of [-1, 1]) K.ProducerArtHelpers.log(k, cx, y, cz + s * (d / 2 - r), w + 0.14, r, 'x', 'woodMid');
        for (const s of [-1, 1]) K.ProducerArtHelpers.log(k, cx + s * (w / 2 - r), y + r * 0.95, cz, d + 0.14, r, 'z', 'woodMid');
      }
      const top = 0.12 + n * r * 1.9;
      // door (green, iron strapped) and a shuttered window
      const dx = cx + 0.35; k.box('woodDark', dx, 0.12, front + 0.03, 0.5, 0.86, 0.06); k.box('paintGreen', dx, 0.12, front + 0.05, 0.4, 0.8, 0.05);
      for (const y of [0.3, 0.7]) k.box('ironDark', dx, y, front + 0.08, 0.38, 0.04, 0.02); k.box('brass', dx + 0.13, 0.5, front + 0.09, 0.04, 0.04, 0.03);
      const wx = cx - 0.4; k.box('woodDark', wx, 0.48, front + 0.03, 0.4, 0.34, 0.04); k.box('window', wx, 0.51, front + 0.05, 0.32, 0.28, 0.02);
      for (const s of [-1, 1]) k.box('paintGreen', wx + s * 0.27, 0.48, front + 0.06, 0.13, 0.34, 0.03);
      k.box('woodLight', wx, 0.42, front + 0.07, 0.48, 0.05, 0.1);
      if (L2) { k.box('woodDark', wx, 1.0, front + 0.03, 0.4, 0.32, 0.04); k.box('window', wx, 1.03, front + 0.05, 0.32, 0.26, 0.02); for (const s of [-1, 1]) k.box('paintGreen', wx + s * 0.27, 1.0, front + 0.06, 0.13, 0.32, 0.03); }
      // green shingle roof with board-and-batten gables
      const ridge = K.ProducerArtHelpers.roofX(k, 'roofGreen', cx, cz, w, d, top, 0.62, { over: 0.2, ends: 0.12, gableMat: 'woodLight' });
      k.box('woodDark', cx + w / 2 + 0.01, top, cz, 0.03, 0.04, d);
      if (L2) {   // a stone chimney and a gable loft window
        k.box('stoneLight', cx - 0.45, top - 0.2, cz - 0.3, 0.3, ridge - top + 0.6, 0.3); k.box('stoneDark', cx - 0.45, ridge + 0.4, cz - 0.3, 0.36, 0.08, 0.36);
        k.box('window', cx + w / 2 + 0.01, top + 0.1, cz, 0.02, 0.24, 0.22); k.box('woodDark', cx + w / 2 + 0.005, top + 0.07, cz, 0.02, 0.3, 0.3);
      }
      // the hanging axe sign off the front wall
      k.box('woodDark', -1.24, 0, 0.98, 0.08, 1.6, 0.08); k.box('woodDark', -1.0, 1.52, 0.98, 0.56, 0.07, 0.07); k.box('woodDark', -1.14, 1.3, 0.98, 0.05, 0.3, 0.05, 0, 0, 0.75);
      K.ProducerArtHelpers.hangBoard(k, -0.94, 1.52, 0.98, 0.52, 0.44, 'paintWhite', PIC.axe, 0.05, 1.0);
      // the log pile on the right (cut ends to the front), held by stakes; level 2 gets a bigger pile under a lean-to
      const rows = L2 ? 5 : 4, lr = L2 ? 0.08 : 0.09, px = 0.84, pz = -0.32, ll = 0.95;
      for (let i = 0; i < rows; i++) for (let j = 0; j < rows - i; j++) K.ProducerArtHelpers.log(k, px - (rows - 1 - i) * lr + j * lr * 2, lr + i * lr * 1.72, pz, ll, lr, 'z', 'roofBrown');
      for (const s of [-1, 1]) for (const zz of [pz - ll / 2 + 0.08, pz + ll / 2 - 0.08]) k.box('woodDark', px + s * (rows * lr + 0.03), 0, zz, 0.05, rows * lr * 1.5, 0.05);
      if (L2) {
        for (const zz of [pz - 0.42, pz + 0.48]) k.box('woodMid', px + 0.4, 0, zz, 0.08, 1.15, 0.08);
        k.box('roofGreen', px + 0.03, 1.1, pz + 0.03, 0.9, 0.07, 1.2, 0, 0, -0.32);
      }
      // the chopping block with an axe bitten into it, and split firewood around it
      const bx = 0.62, bz = 0.68;
      k.geo('roofBrown', CYL8, bx, 0.18, bz, 0, 0.3, 0, 0.21, 0.36, 0.21); k.geo('woodLight', CYL8, bx, 0.365, bz, 0, 0.3, 0, 0.19, 0.012, 0.19);
      for (let i = 0; i < 3; i++) k.geo('woodMid', CYL, bx, 0.372, bz, P2, 0, 0, 0.06 + i * 0.05, 0.003, 0.06 + i * 0.05);
      K.ProducerArtHelpers.frame(k, bx + 0.02, 0, bz, 0.3); K.ProducerArtHelpers.axe(k, 0.24, 0.42, 0, -0.95, 0.5); k.pop();
      for (const [x, z, ry, rz] of [[0.95, 0.6, 0.4, 1.4], [0.98, 0.84, 1.3, 1.5], [0.32, 0.92, -0.6, 1.45], [0.75, 0.98, 2.2, 1.5], [0.42, 0.45, 0.9, 0]])
        k.box(rz ? 'woodLight' : 'woodLight', x, 0, z, 0.08, rz ? 0.24 : 0.22, 0.07, ry, 0, rz ? rz : 0);
      // the saw-horse with a log on it and a red bow saw half through
      const sx = -0.12, sz = 0.72;
      for (const e of [-0.3, 0.3]) for (const t of [-0.42, 0.42]) k.box('woodMid', sx + e, -0.02, sz, 0.05, 0.62, 0.05, 0, t);
      k.box('woodMid', sx, 0.46, sz, 0.75, 0.05, 0.06);
      K.ProducerArtHelpers.log(k, sx, 0.6, sz, 0.95, 0.085, 'x', 'roofBrown');
      k.box('steel', sx + 0.1, 0.55, sz, 0.015, 0.14, 0.34); k.box('paintRed', sx + 0.1, 0.68, sz, 0.035, 0.035, 0.4);
      for (const s of [-1, 1]) k.box('paintRed', sx + 0.1, 0.54, sz + s * 0.19, 0.035, 0.2, 0.035); k.box('rope', sx + 0.1, 0.74, sz, 0.02, 0.02, 0.3);
      k.box('woodLight', sx + 0.22, 0, sz - 0.05, 0.05, 0.03, 0.05); k.box('paintYellow', sx + 0.3, 0.005, sz + 0.05, 0.05, 0.015, 0.04);   // sawdust
      // the stack of sawn planks, with stickers between the layers
      const kx = -0.92, kz = 0.65, layers = L2 ? 7 : 5;
      for (let i = 0; i < layers; i++) {
        const y = i * 0.065; for (const t of [-0.14, 0, 0.14]) k.box(i % 2 ? 'woodLight' : 'signBoard', kx, y + 0.02, kz + t, 0.66, 0.035, 0.12);
        for (const e of [-0.24, 0.24]) k.box('woodMid', kx + e, y, kz, 0.05, 0.02, 0.44);
      }
      k.box('woodDark', kx, 0, kz - 0.32, 0.6, 0.03, 0.03);
      new K.WorkShedArt(k).draw('woodcutter');   // an open work shed over the chopping block and the saw-horse
      return k;
    }

    /* ---------------- the quarry: a cut rock face, a timber crane lifting a block, a winch, picks, dressed blocks and a cart ---------------- */
    static quarry(k, o) {
      const L2 = (o.level || 1) >= 2, up = L2 ? 0.55 : 0;
      // the rock face: weathered grey crags behind, pale freshly-cut steps in front, with saw lines between the blocks
      k.box('stoneMid', -0.35, 0, -0.9, 1.9, 1.75 + up, 0.4);
      k.box('stoneDark', -1.1, 0, -0.75, 0.42, 1.45 + up, 0.7, 0.2); k.box('stoneMid', 0.45, 0, -0.85, 0.5, 1.25 + up, 0.5, -0.25);
      k.box('stoneDark', -0.55, 1.75 + up, -0.95, 0.9, 0.3, 0.35, 0.15); k.box('stoneMid', 0.05, 1.72 + up, -0.88, 0.5, 0.2, 0.3, -0.3);
      k.box('snow', -0.55, 2.05 + up, -0.95, 0.85, 0.05, 0.32, 0.15); k.box('snow', -0.35, 1.75 + up, -0.85, 1.6, 0.04, 0.2);
      k.box('leafGreen', -1.18, 1.45 + up, -0.68, 0.2, 0.06, 0.2); k.box('leafGreen', 0.5, 1.25 + up, -0.8, 0.16, 0.05, 0.16);
      // the cut steps: each a block of pale ashlar split into cut blocks
      const step = (y0, z0, depth, h, x0, x1, bw) => {
        k.box('stoneDark', (x0 + x1) / 2, y0, z0, x1 - x0, h, depth);
        for (let x = x0; x < x1 - 0.05; x += bw) { const ww = Math.min(bw, x1 - x) - 0.03; k.box('stoneLight', x + ww / 2 + 0.015, y0, z0 + 0.012, ww, h - 0.03, depth); }
      };
      step(0, -0.55, 0.32, 1.15 + up, -0.95, 0.25, 0.4);
      if (L2) step(1.15 + up, -0.75, 0.28, 0.55, -0.9, 0.2, 0.36);
      step(0, -0.28, 0.28, 0.55, -0.95, 0.25, 0.3);
      k.box('stoneLight', -0.5, 0.55, -0.24, 0.32, 0.28, 0.28, 0.2);   // a block being worked loose
      for (const [x, z] of [[-0.75, -0.08], [0.1, -0.05], [-0.25, 0.1]]) k.box('stoneMid', x, 0, z, 0.12, 0.06, 0.1, x * 3);   // chips
      // picks and a sledge leaning on the low step
      K.ProducerArtHelpers.frame(k, -0.82, 0, -0.1, 0); K.ProducerArtHelpers.pick(k, 0, 0, 0, 0.25, 0.62); k.pop(); K.ProducerArtHelpers.frame(k, -0.6, 0, -0.1, 0); K.ProducerArtHelpers.pick(k, 0, 0, 0, -0.2, 0.6); k.pop();
      k.box('woodLight', 0.08, 0, -0.06, 0.04, 0.6, 0.04, 0, -0.25); k.box('ironDark', 0.08, 0.53, -0.18, 0.18, 0.11, 0.11);
      // the timber crane: a mast with braces, a jib out over the face, a rope and a block in a sling
      const mx = 0.82, mz = -0.45, MH = 2.35 + up, jy = MH - 0.15, tipX = -0.25;
      k.box('woodMid', mx, 0, mz, 0.14, MH, 0.14);
      k.box('woodMid', mx + 0.28, 0, mz, 0.08, 0.9, 0.08, 0, 0, 0.55); k.box('woodMid', mx, 0, mz + 0.3, 0.08, 0.9, 0.08, 0, -0.55);
      k.box('woodMid', (mx + tipX) / 2, jy, mz, mx - tipX + 0.12, 0.1, 0.1);
      const bl = Math.hypot(0.6, 0.65), ba = Math.atan2(0.6, 0.65); k.box('woodMid', mx - 0.3, jy - 0.65 - 0.015, mz, 0.07, bl, 0.07, 0, 0, ba);
      k.geo('ironDark', CYL8, tipX + 0.05, jy - 0.05, mz, P2, 0, 0, 0.07, 0.06, 0.07);
      const by = 0.95 + up * 0.6; k.box('rope', tipX + 0.05, by + 0.45, mz, 0.025, jy - by - 0.45, 0.025);
      for (const s of [-1, 1]) k.box('rope', tipX + 0.05 + s * 0.1, by + 0.3, mz, 0.02, 0.2, 0.02, 0, 0, s * 0.5);
      k.box('stoneLight', tipX + 0.05, by, mz, 0.36, 0.3, 0.3); k.box('rope', tipX + 0.05, by - 0.01, mz, 0.38, 0.32, 0.05);
      k.box('rope', (mx + tipX) / 2, jy + 0.1, mz, mx - tipX, 0.02, 0.02); k.box('rope', mx + 0.09, 0.55, mz, 0.02, jy - 0.45, 0.02);
      // the winch at the mast foot: a drum wound with rope and two cranks
      const wz = -0.05;
      for (const s of [-1, 1]) k.box('woodDark', mx + s * 0.22, 0, wz, 0.08, 0.6, 0.18);
      k.geo('woodLight', CYL8, mx, 0.48, wz, 0, 0, P2, 0.1, 0.38, 0.1); k.geo('rope', CYL8, mx, 0.48, wz, 0, 0, P2, 0.13, 0.24, 0.13);
      for (const s of [-1, 1]) { k.box('ironDark', mx + s * 0.29, 0.38, wz, 0.03, 0.2, 0.03); k.box('ironDark', mx + s * 0.33, 0.33, wz, 0.1, 0.03, 0.03); }
      if (L2) {   // a treadwheel drives the big crane
        const tx = 1.08, tz = -0.05, tr = 0.48;
        for (const s of [-1, 1]) k.geo('woodMid', CYL8, tx + s * 0.1, tr + 0.04, tz, 0, 0, P2, tr, 0.05, tr);
        k.geo('woodLight', CYL8, tx, tr + 0.04, tz, 0, 0, P2, tr - 0.03, 0.22, tr - 0.03);
        for (let i = 0; i < 4; i++) k.box('woodDark', tx, tr + 0.04 - 0.02, tz, 0.26, 0.04, tr * 2 - 0.02, 0, i * Math.PI / 4);
        for (const s of [-1, 1]) k.box('woodDark', tx, 0, tz + s * 0.3, 0.3, 0.12, 0.1);
      }
      // the stack of dressed blocks, ready to go
      const sx = -0.82, sz = 0.62, bs = 0.32;
      for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++)
        k.box(row === 1 ? 'whitewash' : 'stoneLight', sx - (2 - row) * (bs + 0.02) / 2 + i * (bs + 0.02), row * bs, sz, bs, bs - 0.01, bs + (L2 ? 0.3 : 0));
      if (L2) for (let i = 0; i < 2; i++) k.box('stoneLight', sx - 0.2 + i * 0.4, 0, sz + 0.4, 0.3, 0.3, 0.12);
      // the hand-cart with blocks in it
      const ax = 0.52, az = 0.62;
      k.box('woodMid', ax, 0.26, az, 0.5, 0.06, 0.66); for (const s of [-1, 1]) k.box('woodLight', ax + s * 0.23, 0.3, az, 0.04, 0.18, 0.66); k.box('woodLight', ax, 0.3, az - 0.31, 0.5, 0.18, 0.04);
      for (const s of [-1, 1]) { k.geo('ironDark', CYL, ax + s * 0.3, 0.22, az - 0.05, 0, 0, P2, 0.22, 0.05, 0.22); k.geo('woodMid', CYL8, ax + s * 0.3, 0.22, az - 0.05, 0, 0, P2, 0.18, 0.06, 0.18); k.geo('ironDark', CYL8, ax + s * 0.3, 0.22, az - 0.05, 0, 0, P2, 0.04, 0.09, 0.04); }
      k.box('ironDark', ax, 0.2, az - 0.05, 0.62, 0.04, 0.04);
      for (const s of [-1, 1]) k.box('woodLight', ax + s * 0.18, 0.13, az + 0.42, 0.04, 0.04, 0.3, 0, 0.5); k.box('woodDark', ax, 0, az + 0.3, 0.05, 0.25, 0.05);
      k.box('stoneLight', ax - 0.1, 0.32, az - 0.1, 0.22, 0.2, 0.24, 0.2); k.box('whitewash', ax + 0.1, 0.32, az + 0.12, 0.2, 0.18, 0.22, -0.3);
      // a sign by the path: crossed picks on a pale board
      k.box('woodDark', -0.15, 0, 0.98, 0.07, 1.25, 0.07); K.ProducerArtHelpers.board(k, -0.15, 1.12, 1.02, 0.56, 0.42, 'paintWhite', PIC.picks, 1.25);
      new K.WorkShedArt(k).draw('quarry');   // a lean-to against the face, where the masons dress stone
      return k;
    }

    /* ---------------- the storehouse: a whitewashed, half-timbered warehouse; big open doors with goods inside, a loading deck and a hoist ---------------- */
    static storehouse(k, o) {
      K.ProducerArtHelpers.frame(k, -1.15, 0, 0); ProducerArtPieces.storeBody(k, o); k.pop();   // the warehouse on the left,
      new K.MillArt(k, o).draw();                            // and the mill you can walk into on the right
      return k;
    }
    static storeBody(k, o) {
      const L2 = (o.level || 1) >= 2, cx = 0, cz = -0.38, w = 2.4, d = 1.36, H = L2 ? 1.95 : 1.45, front = cz + d / 2, plinth = 0.25;
      k.box('stoneLight', cx, 0, cz, w + 0.08, plinth, d + 0.08); k.box('stoneMid', cx, 0, cz, w + 0.12, 0.06, d + 0.12);
      k.box('whitewash', cx, plinth, cz, w, H, d);
      // timber framing on the front and the sides
      for (const x of [-w / 2, -0.62, 0.62, w / 2]) k.box('woodDark', cx + x, plinth, front + 0.01, 0.1, H, 0.04);
      for (const y of [plinth, plinth + H - 0.1]) k.box('woodDark', cx, y, front + 0.01, w + 0.02, 0.1, 0.04);
      for (const s of [-1, 1]) {
        for (const z of [-d / 2 + 0.05, 0, d / 2 - 0.05]) k.box('woodDark', cx + s * (w / 2 + 0.01), plinth, cz + z, 0.04, H, 0.1);
        k.box('woodDark', cx + s * (w / 2 + 0.01), plinth + H - 0.1, cz, 0.04, 0.1, d); k.box('woodDark', cx + s * (w / 2 + 0.01), plinth + H * 0.5, cz, 0.04, 0.08, d);
        k.box('woodDark', cx + s * 0.95, plinth + 0.1, front + 0.02, 0.06, H * 0.82, 0.03, 0, 0, s * 0.5);
      }
      // a red roof with the gable to the front, and a loft door with a hoist beam under the peak
      const yTop = plinth + H, ridge = K.ProducerArtHelpers.roofZ(k, 'roofRed', cx, cz, d, w, yTop, 0.55, { over: 0.16, ends: 0.18, gableMat: 'whitewash' });
      k.box('woodDark', cx, yTop - 0.02, front + 0.02, w + 0.1, 0.1, 0.05);
      k.box('woodDark', cx, yTop + 0.06, front + 0.03, 0.46, 0.5, 0.04); k.box('paintBlue', cx, yTop + 0.09, front + 0.05, 0.38, 0.44, 0.03);
      k.box('woodDark', cx, ridge - 0.28, front + 0.25, 0.1, 0.1, 0.62); k.geo('ironDark', CYL8, cx, ridge - 0.3, front + 0.48, 0, 0, P2, 0.05, 0.05, 0.05);
      const hy = ridge - 0.33, sackY = yTop + 0.02; k.box('rope', cx, sackY + 0.3, front + 0.48, 0.02, hy - sackY - 0.3, 0.02);
      K.ProducerArtHelpers.sack(k, cx, sackY, front + 0.48, 0.3, 'wheatGold', 0.95);
      // the big double doors, swung open flat to the wall, with the stores showing inside
      const dw = 0.98, dh = Math.min(1.12, H - 0.2);
      k.box('woodDark', cx, plinth, front - 0.02, dw + 0.12, dh + 0.08, 0.08); k.box('woodDark', cx, plinth, front + 0.0, dw, dh, 0.04); k.box('woodMid', cx, plinth, front - 0.15, dw, 0.02, 0.3);
      k.box('woodDark', cx, plinth, front - 0.3, dw, dh, 0.02);
      const iz = front + 0.12;   // stores piled right up to the doorway
      K.ProducerArtHelpers.crate(k, cx - 0.28, plinth, iz, 0.3, 0.15); K.ProducerArtHelpers.crate(k, cx - 0.27, plinth + 0.3, iz - 0.02, 0.26, -0.2); K.ProducerArtHelpers.barrel(k, cx + 0.04, plinth, iz - 0.02, 0.12, 0.34);
      K.ProducerArtHelpers.sack(k, cx + 0.3, plinth, iz + 0.02, 0.2); K.ProducerArtHelpers.sack(k, cx + 0.29, plinth + 0.24, iz, -0.3, 'wheatGold', 0.9); K.ProducerArtHelpers.barrel(k, cx + 0.04, plinth + 0.34, iz - 0.03, 0.11, 0.3, 'woodLight');
      k.box('woodMid', cx, plinth, front - 0.02, dw - 0.04, 0.02, 0.1);
      for (const s of [-1, 1]) {
        const lx = cx + s * (dw / 2 + 0.24);
        k.box('paintBlue', lx, plinth + 0.02, front + 0.03, 0.46, dh - 0.04, 0.05);
        for (const y of [0.15, dh - 0.25]) k.box('whitewash', lx, plinth + y, front + 0.06, 0.42, 0.06, 0.02);
        k.box('whitewash', lx, plinth + 0.18, front + 0.06, 0.05, dh - 0.45, 0.02, 0, 0, s * 0.42);
        k.box('ironDark', lx - s * 0.18, plinth + dh * 0.45, front + 0.07, 0.04, 0.1, 0.02);
      }
      // the sign over the doors: barrel, crate and sack
      K.ProducerArtHelpers.board(k, cx, plinth + dh + 0.18, front + 0.05, 0.92, 0.3, 'paintWhite', PIC.stores.map(([m, u, v, pw, ph]) => [m, u * 1.25, v - 0.08, pw, ph]), 1.25);
      // the loading deck along the front, with steps, and goods piled on it
      const dz0 = front + 0.06, dz1 = 1.02, dzc = (dz0 + dz1) / 2;
      k.box('woodLight', cx, 0.18, dzc, w + 0.1, 0.07, dz1 - dz0); k.box('woodDark', cx, 0, dz1 - 0.04, w + 0.1, 0.2, 0.06);
      for (const x of [-1.2, -0.4, 0.4, 1.2]) k.box('woodDark', cx + x, 0, dz1 - 0.04, 0.08, 0.2, 0.08);
      k.box('woodLight', cx, 0, dz1 + 0.03, 0.6, 0.1, 0.1);
      // left: barrels
      for (const [x, z] of [[-1.08, dzc - 0.08], [-0.8, dzc - 0.1], [-1.0, dzc + 0.18]]) K.ProducerArtHelpers.barrel(k, x, 0.25, z, 0.13, 0.34);
      K.ProducerArtHelpers.barrel(k, -0.94, 0.59, dzc - 0.08, 0.13, 0.34, 'woodLight');
      if (L2) { K.ProducerArtHelpers.barrel(k, -0.68, 0.25, dzc + 0.17, 0.12, 0.32, 'woodLight'); K.ProducerArtHelpers.barrel(k, -1.08, 0.59, dzc + 0.15, 0.12, 0.3); }
      // right: crates two high, and sacks of grain and flour
      K.ProducerArtHelpers.crate(k, 0.82, 0.25, dzc - 0.08, 0.3, 0.1); K.ProducerArtHelpers.crate(k, 1.12, 0.25, dzc - 0.06, 0.3, -0.1); K.ProducerArtHelpers.crate(k, 0.97, 0.55, dzc - 0.07, 0.28, 0.25);
      K.ProducerArtHelpers.sack(k, 0.72, 0.25, dzc + 0.2, 0.4, 'wheatGold'); K.ProducerArtHelpers.sack(k, 0.98, 0.25, dzc + 0.22, -0.2); K.ProducerArtHelpers.sack(k, 1.2, 0.25, dzc + 0.2, 0.7, 'wheatGold');
      if (L2) { K.ProducerArtHelpers.crate(k, 0.95, 0.83, dzc - 0.07, 0.24, -0.3); K.ProducerArtHelpers.sack(k, 0.86, 0.49, dzc + 0.21, 0.1, 'canvas', 0.9); K.ProducerArtHelpers.sack(k, 0.5, 0.25, dzc - 0.05, -0.5, 'canvas'); }
      if (L2) {   // a second-floor window pair either side of the loft
        for (const s of [-1, 1]) { k.box('woodDark', cx + s * 0.95, plinth + 1.35, front + 0.02, 0.36, 0.4, 0.04); k.box('window', cx + s * 0.95, plinth + 1.38, front + 0.04, 0.28, 0.34, 0.02); }
      }
    }

    /* ---------------- the market's street stall row: four stalls, one per section, in front of the hall ---------------- */
    static market(k) {
      // [centre x, half width, awning colour, sign picture]
      const STALLS = [[-4.0, 0.82, 'paintYellow', 'bread'], [-1.0, 0.74, 'paintRed', 'meat'], [1.0, 0.74, 'paintBlue', 'swords'], [4.0, 0.82, 'paintOrange', 'raw']];
      for (const [cx, hw, col, pic] of STALLS) {
        K.ProducerArtHelpers.frame(k, cx, 0, 0);
        // counter: top surface at y 0.78 from z -0.25 to +0.45, a striped front panel, and a two-shelf rack against the hall
        k.box('woodLight', 0, 0.7, 0.1, hw * 2, 0.08, 0.7); k.box('woodMid', 0, 0, 0.42, hw * 2 - 0.04, 0.7, 0.06);
        for (let i = 0; i < 4; i++) k.box(i % 2 ? 'paintWhite' : col, -hw + 0.02 + (i + 0.5) * (hw * 2 - 0.04) / 4, 0.1, 0.455, (hw * 2 - 0.04) / 4 - 0.02, 0.5, 0.02);
        k.box('woodMid', 0, 0, -0.18, hw * 2 - 0.04, 0.7, 0.06);
        k.box('woodMid', 0, 0, -0.6, hw * 2, 0.05, 0.2); k.box('woodLight', 0, 0.55, -0.6, hw * 2 - 0.1, 0.04, 0.2); k.box('woodLight', 0, 1.1, -0.6, hw * 2 - 0.1, 0.04, 0.2);
        // posts and the striped, sloping awning with a scalloped front edge
        for (const s of [-1, 1]) { k.box('woodDark', s * (hw - 0.04), 0, 0.5, 0.08, 1.72, 0.08); k.box('woodDark', s * (hw - 0.04), 0, -0.66, 0.08, 2.2, 0.08); }
        const n = 6, sw = (hw * 2 + 0.1) / n, aRx = Math.atan2(2.18 - 1.72, 1.24), aLen = Math.hypot(1.24, 0.46) + 0.12;
        for (let q = 0; q < n; q++) {
          const x = -hw - 0.05 + (q + 0.5) * sw, m = q % 2 ? 'paintWhite' : col;
          k.box(m, x, 1.92, -0.06, sw, 0.04, aLen, 0, aRx);
          k.box(m, x, 1.56, 0.6, sw, 0.18, 0.03); k.box(m, x, 1.5, 0.6, sw * 0.6, 0.06, 0.03);
        }
        k.box('woodDark', 0, 1.7, 0.56, hw * 2 + 0.1, 0.06, 0.06); k.box('woodDark', 0, 2.16, -0.66, hw * 2 + 0.1, 0.06, 0.06);
        // the picture sign on top of the awning's front edge, where it reads from across the square
        for (const s of [-1, 1]) k.box('woodDark', s * 0.28, 1.74, 0.6, 0.05, 0.36, 0.05);
        K.ProducerArtHelpers.board(k, 0, 2.12, 0.62, 0.72, 0.5, 'paintWhite', PIC[pic], 1.4);
        // the goods that are always on show (the stock itself heaps up on the counter, see 119-castle-economy.js)
        if (pic === 'bread') {
          for (let i = 0; i < 5; i++) { const x = -hw + 0.2 + i * 0.3; k.geo('paintOrange', SPH, x, 0.63, -0.6, 0, 0.2, 0, 0.13, 0.07, 0.08); k.geo('bread', SPH, x, 1.18, -0.6, 0, 0, 0, 0.11, 0.08, 0.11); }
          const sheaf = (x, y, z, hgt) => { for (let i = 0; i < 9; i++) { const a = (i % 3 - 1) * 0.16, b = ((i / 3 | 0) - 1) * 0.16; k.box('wheatGold', x + a * 0.25, y, z + b * 0.25, 0.035, hgt, 0.035, 0, b, -a); k.box('paintYellow', x + a * 0.8, y + hgt - 0.02, z + b * 0.8, 0.05, 0.12, 0.05, 0, b, -a); } k.box('rope', x, y + hgt * 0.45, z, 0.13, 0.05, 0.13); };
          sheaf(-hw - 0.05, 0, 0.75, 0.62); sheaf(hw + 0.02, 0, 0.78, 0.62); sheaf(-hw + 0.12, 0.78, 0.36, 0.34);
          K.ProducerArtHelpers.sack(k, hw - 0.14, 0.78, 0.34, 0.3, 'canvas', 0.7);
        } else if (pic === 'meat') {
          k.box('woodDark', 0, 1.6, -0.05, hw * 2 - 0.1, 0.04, 0.04);
          for (let i = 0; i < 4; i++) { const x = -hw + 0.24 + i * 0.36; k.box('rope', x, 1.42, -0.05, 0.02, 0.18, 0.02); k.geo('eggWhite', CYL8, x, 1.37, -0.05, 0, 0, 0, 0.03, 0.12, 0.03); k.geo('eggWhite', SPH, x, 1.43, -0.05, 0, 0, 0, 0.04, 0.03, 0.04); k.geo('meatRed', SPH, x, 1.18, -0.05, 0, i, 0, 0.11, 0.17, 0.1); k.geo('meatRed', SPH, x, 1.29, -0.05, 0, 0, 0, 0.06, 0.08, 0.06); }
          for (let i = 0; i < 6; i++) k.box('meatRed', -hw + 0.18 + i * 0.25, 0.86, -0.62, 0.06, 0.24, 0.06, 0, 0, 0.1);
          const basket = (x, y, z) => { k.geo('wheatGold', CYL8, x, y + 0.05, z, 0, 0, 0, 0.12, 0.1, 0.12); for (let e = 0; e < 6; e++) k.geo('eggWhite', SPH, x + Math.cos(e * 1.26) * 0.065 * (e ? 1 : 0), y + 0.13 + (e ? 0 : 0.03), z + Math.sin(e * 1.26) * 0.065 * (e ? 1 : 0), 0, 0, 0, 0.04, 0.052, 0.04); k.box('woodMid', x, y + 0.1, z, 0.03, 0.14, 0.24, 0, 0.0); };
          basket(-hw + 0.16, 0.78, 0.36); basket(hw - 0.16, 0.78, 0.36); for (let e = 0; e < 7; e++) k.geo('eggWhite', SPH, -0.5 + e * 0.16, 1.18, -0.6, 0, 0, 0, 0.045, 0.06, 0.045);
          K.ProducerArtHelpers.barrel(k, -hw - 0.04, 0, 0.78, 0.13, 0.36, 'woodLight'); k.box('paintWhite', -hw - 0.04, 0.37, 0.78, 0.18, 0.02, 0.18);
        } else if (pic === 'swords') {
          for (let i = 0; i < 5; i++) { const x = -0.45 + i * 0.22; k.box('steel', x, 0.6, -0.52, 0.06, 0.48, 0.02); k.box('gold', x, 1.06, -0.52, 0.16, 0.035, 0.035); k.box('woodDark', x, 1.09, -0.52, 0.035, 0.1, 0.035); k.box('gold', x, 1.19, -0.52, 0.05, 0.04, 0.04); }
          for (const [x, m, c2] of [[-0.5, 'paintRed', 'gold'], [0.5, 'paintBlue', 'paintWhite']]) { k.geo(m, CYL, x, 1.42, -0.48, P2, 0, 0, 0.2, 0.04, 0.2); k.geo(c2, CYL, x, 1.42, -0.455, P2, 0, 0, 0.07, 0.04, 0.07); k.geo('ironDark', CYL, x, 1.42, -0.47, P2, 0, 0, 0.21, 0.02, 0.21); }
          for (const t of [-0.08, 0.08]) { k.box('woodLight', hw - 0.12 + t, 0, -0.45, 0.03, 1.85, 0.03, 0, 0, t); k.box('steel', hw - 0.12 + t * 2.2, 1.83, -0.45, 0.05, 0.18, 0.02, 0, 0, t); }
          k.box('steel', -0.1, 0.8, 0.37, 0.46, 0.02, 0.05, 0.1); k.box('gold', -0.36, 0.8, 0.39, 0.03, 0.03, 0.14, 0.1); k.box('woodDark', -0.42, 0.8, 0.395, 0.1, 0.035, 0.035, 0.1);
          k.box('ironDark', hw - 0.16, 0.78, 0.36, 0.2, 0.1, 0.14); k.box('steel', hw - 0.16, 0.88, 0.36, 0.16, 0.04, 0.1);
          K.ProducerArtHelpers.barrel(k, hw + 0.04, 0, 0.75, 0.13, 0.36); for (let i = 0; i < 4; i++) { const a = (i % 2 - 0.5) * 0.08, b = ((i >> 1) - 0.5) * 0.08; k.box('woodLight', hw + 0.04 + a, 0.3, 0.75 + b, 0.025, 0.5, 0.025, 0, b * 2, -a * 2); k.box('paintWhite', hw + 0.04 + a * 1.5, 0.78, 0.75 + b * 1.5, 0.04, 0.06, 0.012, 0, b * 2, -a * 2); }
        } else {
          for (let i = 0; i < 4; i++) k.box(i % 2 ? 'stoneLight' : 'whitewash', -hw + 0.2 + i * 0.22, 0.59, -0.6, 0.18, 0.15, 0.16);
          for (let i = 0; i < 4; i++) { k.box('ironDark', -hw + 0.2 + i * 0.22, 1.14, -0.6, 0.16, 0.06, 0.1); k.box('ironDark', -hw + 0.2 + i * 0.22, 1.2, -0.6, 0.12, 0.05, 0.08); }
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2 - i; j++) K.ProducerArtHelpers.log(k, hw - 0.48 + j * 0.15 + i * 0.075, 0.95 + i * 0.13, -0.6, 0.22, 0.07, 'z', 'roofBrown');
          k.box('stoneLight', -hw + 0.14, 0.78, 0.33, 0.2, 0.14, 0.14, 0.3); k.box('ironDark', hw - 0.14, 0.78, 0.33, 0.18, 0.06, 0.1, -0.2);
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) K.ProducerArtHelpers.log(k, hw - 0.06 + (j - (2 - i) / 2) * 0.17, 0.085 + i * 0.15, 0.78, 0.5, 0.085, 'z', 'roofBrown');
          k.box('stoneLight', -hw + 0.0, 0, 0.78, 0.26, 0.24, 0.26, 0.4); k.box('whitewash', -hw + 0.02, 0.24, 0.78, 0.18, 0.14, 0.18, 0.1);
          K.ProducerArtHelpers.frame(k, -hw - 0.02, 0, 0.62, 0); K.ProducerArtHelpers.pick(k, 0, 0, 0, 0.35, 0.55); k.pop();
        }
        k.pop();
      }
      return k;
    }
  }
  class CastleArtPiecePainter {
    constructor(drawer) { this.drawer = drawer; }
    draw(kit, options = {}) { return this.drawer(kit, options) || kit; }
  }
  for (const [type, drawer] of ['woodcutter', 'quarry', 'storehouse', 'market'].map((type) => [type, ProducerArtPieces[type]])) K.CastleArt.register(type, new CastleArtPiecePainter(drawer));
})(typeof window !== 'undefined' ? window : globalThis);
