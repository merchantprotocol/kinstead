/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · art overrides for some castle pieces (see the asset library, /assets.html). Each entry draws one piece type
   into a VoxKit; anything not listed here falls back to 82-castle-mesh.js.
   This file: the farming pieces — farm (red barn farmstead), field (one square of wheat), silo, coop, barn (cattle). */
(function (G) {
  const K = G.K, THREE = G.THREE, CYL = K.VoxKit.CYL, CYL8 = K.VoxKit.CYL8, CONE6 = new THREE.ConeGeometry(1, 1, 6);
  const CONE4 = new THREE.ConeGeometry(1, 1, 4);

  /* ---------- little drawing helpers ---------- */
  // move the kit's origin to (x,y,z), turned ry about y (then rz about z); draw; pop
  const at = (k, x, y, z, ry = 0, f, rz = 0) => { const m = new THREE.Matrix4().makeRotationY(ry); if (rz) m.multiply(new THREE.Matrix4().makeRotationZ(rz)); m.setPosition(x, y, z); k.push(m); f(); k.pop(); };
  // a flat slab whose cross-section runs from (x1,y1) to (x2,y2) in the x-y plane, sitting on that line, extruded along z
  const slabX = (k, mat, x1, y1, x2, y2, z, len, t) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    k.box(mat, (x1 + x2) / 2 + nx * t / 2, (y1 + y2) / 2 + ny * t / 2 - t / 2, z, L, t, len, 0, 0, Math.atan2(dy, dx));
  };
  // the same in the z-y plane (left = -z to right = +z), extruded along x
  const slabZ = (k, mat, z1, y1, z2, y2, x, len, t) => {
    const dz = z2 - z1, dy = y2 - y1, L = Math.hypot(dz, dy), nz = -dy / L, ny = dz / L;
    k.box(mat, x, (y1 + y2) / 2 + ny * t / 2 - t / 2, (z1 + z2) / 2 + nz * t / 2, len, t, L, 0, -Math.atan2(dy, dz));
  };
  // the half-width of a symmetric roof profile at height y; pts run from the eave [hw, y] up to the ridge [0, y]
  const halfAt = (pts, y) => { for (let i = 0; i < pts.length - 1; i++) { const [a, ya] = pts[i], [b, yb] = pts[i + 1]; if (y >= ya && y <= yb) return a + (b - a) * (y - ya) / (yb - ya); } return 0; };
  // fill the gable under a roof profile with stepped strips (profile across x, extruded along z, or the other way)
  const gable = (k, mat, pts, cx, cz, len, alongZ, step = 0.05) => {
    const y0 = pts[0][1], y1 = pts[pts.length - 1][1];
    for (let y = y0; y < y1 - 0.01; y += step) { const hw = halfAt(pts, Math.min(y1, y + step * 0.5)); if (hw < 0.02) break; if (alongZ) k.box(mat, cx, y, cz, 2 * hw, step, len); else k.box(mat, cx, y, cz, len, step, 2 * hw); }
  };
  // a door leaf on a +z wall: coloured panel, white frame and a white X brace
  const leaf = (k, cx, y0, z, w, h, base = 'paintRed', trim = 'paintWhite', t = 0.06) => {
    k.box(base, cx, y0, z, w, h, 0.03);
    k.box(trim, cx, y0, z + 0.02, w, t, 0.03); k.box(trim, cx, y0 + h - t, z + 0.02, w, t, 0.03);
    k.box(trim, cx - w / 2 + t / 2, y0, z + 0.02, t, h, 0.03); k.box(trim, cx + w / 2 - t / 2, y0, z + 0.02, t, h, 0.03);
    const iw = w - 2 * t, ih = h - 2 * t, a = Math.atan2(ih, iw), dl = Math.hypot(iw, ih);
    for (const s of [1, -1]) k.box(trim, cx, y0 + h / 2 - t * 0.4, z + 0.025, dl, t * 0.8, 0.03, 0, 0, s * a);
  };
  // a square hay bale with two twine bands
  const bale = (k, x, y, z, ry = 0, w = 0.44, h = 0.28, d = 0.3) => at(k, x, y, z, ry, () => {
    k.box('hay', 0, 0, 0, w, h, d); for (const bx of [-w * 0.25, w * 0.25]) k.box('rope', bx, -0.005, 0, 0.03, h + 0.01, d + 0.01);
  });
  // a tied grain sack
  const sack = (k, x, z, ry = 0, open = false) => at(k, x, 0, z, ry, () => {
    k.box('canvas', 0, 0, 0, 0.24, 0.26, 0.2); k.box('canvas', 0, 0.26, 0, 0.2, 0.05, 0.16);
    if (open) { k.box('wheatGold', 0, 0.3, 0, 0.17, 0.04, 0.13); k.box('wheatGold', 0.03, 0.33, 0.01, 0.08, 0.03, 0.07); }
    else { k.box('canvas', 0, 0.31, 0, 0.09, 0.06, 0.08); k.box('rope', 0, 0.3, 0, 0.11, 0.025, 0.1); }
    k.box('paintRed', 0, 0.09, 0.1, 0.1, 0.08, 0.01);   // a red mark on the sack
  });
  // a little voxel hen, facing +z
  const hen = (k, x, y, z, ry = 0, body = 'eggWhite') => at(k, x, y, z, ry, () => {
    k.box('paintOrange', -0.03, 0, 0, 0.018, 0.05, 0.018); k.box('paintOrange', 0.03, 0, 0, 0.018, 0.05, 0.018);
    k.box(body, 0, 0.05, 0, 0.13, 0.11, 0.17); k.box(body, 0, 0.1, -0.09, 0.09, 0.1, 0.05);   // body, tail
    k.box(body, 0, 0.14, 0.06, 0.08, 0.08, 0.08); k.box('paintRed', 0, 0.22, 0.065, 0.025, 0.035, 0.06);   // head, comb
    k.box('paintRed', 0, 0.11, 0.105, 0.02, 0.03, 0.02); k.box('paintYellow', 0, 0.16, 0.11, 0.03, 0.025, 0.03);   // wattle, beak
    k.box('ironDark', -0.041, 0.175, 0.08, 0.005, 0.015, 0.015); k.box('ironDark', 0.041, 0.175, 0.08, 0.005, 0.015, 0.015);
  });
  // a gold rooster weathervane on a rod, base at y
  const vane = (k, x, y, z, sc = 1) => at(k, x, y, z, 0, () => { k.push(new THREE.Matrix4().makeScale(sc, sc, sc)); vane1(k); k.pop(); });
  const vane1 = (k, x = 0, y = 0, z = 0) => {
    k.box('ironDark', x, y, z, 0.025, 0.42, 0.025); k.box('ironDark', x, y + 0.2, z, 0.3, 0.02, 0.02); k.box('ironDark', x, y + 0.2, z, 0.02, 0.02, 0.3);
    k.box('gold', x, y + 0.42, z, 0.04, 0.1, 0.16); k.box('gold', x, y + 0.5, z + 0.06, 0.04, 0.08, 0.06); k.box('paintRed', x, y + 0.58, z + 0.06, 0.02, 0.04, 0.05); k.box('gold', x, y + 0.48, z - 0.09, 0.04, 0.12, 0.05);
  };
  // a white-framed four-pane window on a +z wall (dark glass so it reads as a hole)
  const win = (k, cx, y0, z, w, h) => {
    k.box('woodDark', cx, y0, z, w, h, 0.02); const t = 0.04;
    k.box('paintWhite', cx, y0 - t, z + 0.01, w + 2 * t, t, 0.03); k.box('paintWhite', cx, y0 + h, z + 0.01, w + 2 * t, t, 0.03);
    k.box('paintWhite', cx - w / 2 - t / 2, y0, z + 0.01, t, h, 0.03); k.box('paintWhite', cx + w / 2 + t / 2, y0, z + 0.01, t, h, 0.03);
    k.box('paintWhite', cx, y0, z + 0.015, 0.025, h, 0.02); k.box('paintWhite', cx, y0 + h / 2 - 0.0125, z + 0.015, w, 0.025, 0.02);
  };

  const ART = {
    /* ---------- the farmstead: a red gambrel barn with white trim, hay loft, cupola and a yard full of farm things ---------- */
    farm: function (k) {
      const bx = -0.3, bz = -0.28, W = 1.05, D = 1.74, wallH = 1.3, front = bz + D / 2;
      const prof = [[W, wallH], [0.7, 1.95], [0, 2.35]];
      // walls on a stone footing, battens, white corner boards
      k.box('stoneMid', bx, 0, bz, 2 * W + 0.06, 0.14, D + 0.06);
      k.box('paintRed', bx, 0.14, bz, 2 * W, wallH - 0.14, D);
      gable(k, 'paintRed', prof, bx, bz, D, true);
      for (let z = bz - D / 2 + 0.15; z < bz + D / 2 - 0.1; z += 0.2) k.box('bookRed', bx + W + 0.01, 0.14, z, 0.02, wallH - 0.14, 0.035);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('paintWhite', bx + sx * (W - 0.03), 0.14, bz + sz * (D / 2 - 0.03), 0.1, wallH - 0.14, 0.1);
      k.box('paintWhite', bx + W + 0.01, wallH - 0.08, bz, 0.04, 0.08, D);   // white band under the eave
      // gambrel roof (grey shingles), white fascia on the front and back edges, ridge cap
      const eave = [W + 0.06, wallH - 0.11], RL = D + 0.22, roof = 'slate';
      const segs = [[-eave[0], eave[1], -0.7, 1.95], [-0.7, 1.95, 0, 2.35], [0, 2.35, 0.7, 1.95], [0.7, 1.95, eave[0], eave[1]]];
      for (const [x1, y1, x2, y2] of segs) {
        slabX(k, roof, bx + x1, y1, bx + x2, y2, bz, RL, 0.08);
        for (const s of [1, -1]) slabX(k, 'paintWhite', bx + x1, y1 - 0.01, bx + x2, y2 - 0.01, bz + s * (RL / 2 + 0.015), 0.04, 0.11);
      }
      k.box('woodDark', bx, 2.37, bz, 0.12, 0.05, RL + 0.02);
      // big double doors with white X braces, header, loft door with hay spilling out, hay hood beam with a hook
      k.box('woodDark', bx, 0.14, front + 0.005, 1.12, 1.0, 0.02);
      leaf(k, bx - 0.27, 0.14, front + 0.01, 0.52, 0.96); leaf(k, bx + 0.27, 0.14, front + 0.01, 0.52, 0.96);
      k.box('paintWhite', bx, 1.1, front + 0.01, 1.22, 0.07, 0.05);
      k.box('woodDark', bx, 1.42, front + 0.005, 0.5, 0.48, 0.02);
      for (const [y, h] of [[1.36, 0.06], [1.9, 0.06]]) k.box('paintWhite', bx, y, front + 0.02, 0.62, h, 0.04);
      for (const s of [-1, 1]) k.box('paintWhite', bx + s * 0.28, 1.36, front + 0.02, 0.06, 0.6, 0.04);
      k.box('hay', bx, 1.42, front + 0.04, 0.46, 0.2, 0.14); k.box('hay', bx + 0.05, 1.62, front + 0.02, 0.32, 0.1, 0.08); k.box('wheatGold', bx - 0.12, 1.42, front + 0.12, 0.1, 0.08, 0.06);
      k.box('woodDark', bx, 2.13, front + 0.12, 0.08, 0.08, 0.42); k.box('rope', bx, 1.75, front + 0.29, 0.02, 0.38, 0.02); k.box('ironDark', bx, 1.7, front + 0.28, 0.06, 0.06, 0.04);
      // a side window and a small side door on the right wall
      at(k, bx + W, 0, bz - 0.35, Math.PI / 2, () => win(k, 0, 0.6, 0.01, 0.34, 0.34));
      at(k, bx + W, 0, bz + 0.35, Math.PI / 2, () => leaf(k, 0, 0.14, 0.01, 0.34, 0.8));
      // cupola with louvres, a little roof and a rooster weathervane
      k.box('paintWhite', bx, 2.3, bz, 0.34, 0.34, 0.34);
      for (const y of [2.4, 2.48, 2.56]) { k.box('woodMid', bx, y, bz + 0.175, 0.24, 0.035, 0.02); k.box('woodMid', bx + 0.175, y, bz, 0.02, 0.035, 0.24); }
      k.geo(roof, CONE4, bx, 2.76, bz, 0, Math.PI / 4, 0, 0.3, 0.2, 0.3); vane(k, bx, 2.85, bz);
      // straw on the ground before the doors
      k.box('straw', bx, 0, front + 0.3, 1.2, 0.02, 0.5);
      // hay bales, front left
      bale(k, -1.2, 0, 0.92, 0.1); bale(k, -0.75, 0, 1.0, -0.15); bale(k, -1.05, 0.28, 0.95, 0.05);
      // grain sacks by the door
      sack(k, 0.48, 0.9, 0.2, true); sack(k, 0.72, 0.84, -0.3); sack(k, 0.58, 1.1, 0.5);
      // a pitchfork leaning on the wall right of the door
      at(k, bx + 0.78, 0, front + 0.06, 0, () => {
        k.box('woodLight', 0, 0, 0, 0.035, 1.2, 0.035); k.box('ironDark', 0, 1.18, 0, 0.18, 0.03, 0.03);
        for (const tx of [-0.075, 0, 0.075]) k.box('steel', tx, 1.2, 0, 0.022, 0.3, 0.022);
      }, 0.14);
      // a plough on the right: beam, handles, iron share and mouldboard, front wheel
      at(k, 1.2, 0, -0.4, 0, () => {
        k.box('woodMid', 0, 0.3, 0.1, 0.09, 0.09, 1.0, 0, -0.12);
        for (const s of [-1, 1]) { k.box('woodMid', s * 0.1, 0.4, -0.52, 0.05, 0.05, 0.6, s * 0.12, 0.7, 0); k.box('woodLight', s * 0.135, 0.6, -0.74, 0.05, 0.05, 0.1, s * 0.12); }
        k.box('woodMid', 0, 0, -0.32, 0.07, 0.34, 0.07);   // the standard down to the share
        k.box('steel', 0, 0, -0.18, 0.12, 0.05, 0.36); k.box('steel', 0.08, 0.03, -0.3, 0.04, 0.2, 0.3, 0.45);   // share and mouldboard
        k.box('steel', 0, 0.06, 0.18, 0.025, 0.28, 0.06, 0, -0.3);   // coulter knife
        k.geo('woodDark', CYL, 0, 0.17, 0.56, 0, 0, Math.PI / 2, 0.17, 0.05, 0.17); k.geo('ironDark', CYL, 0, 0.17, 0.56, 0, 0, Math.PI / 2, 0.18, 0.03, 0.18);
      });
      // a scarecrow: post, blue shirt with a patch, straw hands, sack head with a face, straw hat, and a crow on his arm
      at(k, 1.13, 0, 0.82, -0.35, () => {
        k.box('woodMid', 0, 0, 0, 0.06, 1.35, 0.06); k.box('woodMid', 0, 1.0, 0, 0.62, 0.05, 0.05);
        k.box('paintBlue', 0, 0.66, 0, 0.3, 0.38, 0.18); k.box('paintBlue', 0, 0.98, 0, 0.56, 0.1, 0.12);
        k.box('paintOrange', 0.07, 0.78, 0.091, 0.08, 0.08, 0.01); k.box('rope', 0, 0.66, 0, 0.31, 0.04, 0.19);
        k.box('woodMid', 0, 0.38, 0, 0.26, 0.3, 0.14);   // breeches
        for (const s of [-1, 1]) { k.box('wheatGold', s * 0.31, 0.95, 0, 0.07, 0.07, 0.07); k.box('wheatGold', s * 0.33, 0.92, 0.02, 0.05, 0.04, 0.03); }
        k.box('wheatGold', 0, 0.6, 0, 0.12, 0.08, 0.2);
        k.box('canvas', 0, 1.08, 0, 0.22, 0.22, 0.2); k.box('wheatGold', 0, 1.06, 0, 0.26, 0.04, 0.24);
        k.box('ironDark', -0.05, 1.19, 0.101, 0.04, 0.04, 0.01); k.box('ironDark', 0.05, 1.19, 0.101, 0.04, 0.04, 0.01); k.box('paintOrange', 0, 1.15, 0.105, 0.03, 0.03, 0.02);
        k.box('ironDark', 0, 1.12, 0.101, 0.12, 0.015, 0.01);
        k.box('straw', 0, 1.3, 0, 0.36, 0.03, 0.34); k.box('straw', 0, 1.33, 0, 0.2, 0.12, 0.2); k.box('paintRed', 0, 1.34, 0, 0.21, 0.035, 0.21);
        k.box('ironDark', -0.24, 1.05, 0, 0.06, 0.07, 0.11); k.box('ironDark', -0.24, 1.1, 0.06, 0.05, 0.05, 0.05); k.box('paintYellow', -0.24, 1.11, 0.095, 0.02, 0.02, 0.03);
      });
      new K.WorkShedArt(k).draw('farm');   // an open hay shed in front of the barn, where the farmer forks the hay
    },

    /* ---------- one 0.5 m square of wheat: tilled furrows, green leaves, golden ears ---------- */
    field: function (k) {
      k.box('woodDark', 0, 0, 0, 0.5, 0.04, 0.5);
      let q = 0;
      for (const x of [-0.18, -0.06, 0.06, 0.18]) {
        k.box('woodMid', x, 0.04, 0, 0.08, 0.03, 0.48);
        for (let i = 0; i < 7; i++, q++) {
          const r = (q * 37 % 11) / 11, z = -0.21 + i * 0.07 + (r - 0.5) * 0.02, h = 0.2 + r * 0.08, lean = (r - 0.5) * 0.35, lx = x + (q % 2 ? 0.018 : -0.018);
          if (i % 2 === 0) { k.box('leafGreen', lx, 0.07, z, 0.08, 0.04, 0.016, 0.6); k.box('leafGreen', lx, 0.07, z, 0.016, 0.06, 0.07, 0.3); }
          at(k, lx, 0.07, z, 0, () => {
            k.box('wheatGold', 0, 0, 0, 0.012, h, 0.012);
            k.box('gold', 0, h - 0.01, 0, 0.02, 0.085, 0.02);   // the ear: a spine with kernels down both sides and a few awns
            for (let e = 0; e < 3; e++) for (const s of [-1, 1]) k.box('gold', s * 0.013, h + e * 0.022 + (s > 0 ? 0.011 : 0), 0, 0.012, 0.02, 0.016);
            k.box('wheatGold', 0, h + 0.075, 0, 0.004, 0.05, 0.004); k.box('wheatGold', 0.01, h + 0.07, 0, 0.004, 0.045, 0.004, 0, 0, -0.25);
          }, lean);
        }
      }
    },

    /* ---------- a tall wooden-stave grain silo: iron hoops, red cone roof, ladder, top hatch, grain chute ---------- */
    silo: function (k) {
      const R = 0.7, N = 16, H0 = 0.16, H1 = 3.3, seg = (r) => 2 * r * Math.tan(Math.PI / N) + 0.012;
      k.geo('stoneMid', CYL, 0, H0 / 2, 0, 0, 0, 0, 0.82, H0, 0.82);
      k.geo('woodMid', CYL, 0, (H0 + H1) / 2, 0, 0, 0, 0, R - 0.03, H1 - H0, R - 0.03);
      for (let i = 0; i < N; i++) {
        const a = i / N * Math.PI * 2, sa = Math.sin(a), ca = Math.cos(a);
        k.box('paintRed', sa * R, H0, ca * R, seg(R + 0.05), H1 - H0, 0.1, a);
        k.box('bookRed', sa * (R + 0.05), H0, ca * (R + 0.05), 0.015, H1 - H0, 0.01, a);   // stave seams
        for (const y of [0.45, 1.15, 1.85, 2.55, 3.12]) k.box('paintWhite', sa * (R + 0.06), y, ca * (R + 0.06), seg(R + 0.075), 0.07, 0.03, a);   // white hoops
      }
      // roof: a silver-grey dome cap with a vent
      k.geo('paintWhite', CYL, 0, H1 + 0.03, 0, 0, 0, 0, 0.8, 0.06, 0.8);
      k.geo('slate', CONE6, 0, H1 + 0.06 + 0.3, 0, 0, Math.PI / 6, 0, 0.86, 0.6, 0.86);
      k.geo('paintRed', CYL8, 0, H1 + 0.7, 0, 0, 0, 0, 0.1, 0.12, 0.1); k.geo('stoneLight', CONE6, 0, H1 + 0.82, 0, 0, 0, 0, 0.16, 0.14, 0.16);
      vane1(k, 0, H1 + 0.88, 0);
      // a hatch near the top (front-right) with wheat showing
      at(k, 0, 0, 0, 0.95, () => {
        k.box('woodDark', 0, 2.68, R + 0.055, 0.34, 0.34, 0.03); k.box('wheatGold', 0, 2.68, R + 0.07, 0.28, 0.14, 0.03);
        k.box('paintWhite', 0, 2.64, R + 0.08, 0.42, 0.04, 0.03); k.box('paintWhite', 0, 3.02, R + 0.08, 0.42, 0.04, 0.03);
      });
      // a ladder up the right side, a little landing at the hatch
      at(k, 0, 0, 0, 1.32, () => {
        for (const s of [-1, 1]) k.box('woodMid', s * 0.13, 0, R + 0.12, 0.04, H1 + 0.1, 0.04);
        for (let y = 0.25; y < H1; y += 0.25) k.box('woodLight', 0, y, R + 0.12, 0.26, 0.03, 0.03);
      });
      // a big gold wheat-sheaf sign, front-right, at eye height
      at(k, 0, 0, 0, 0.56, () => {
        k.box('paintWhite', 0, 1.0, R + 0.06, 0.48, 0.56, 0.03); k.box('signBoard', 0, 1.03, R + 0.075, 0.42, 0.5, 0.03);
        for (const s of [-2, -1, 0, 1, 2]) { k.box('wheatGold', s * 0.03, 1.08, R + 0.1, 0.022, 0.26, 0.02, 0, 0, s * 0.14); k.box('gold', s * 0.055, 1.32, R + 0.105, 0.045, 0.12, 0.02, 0, 0, s * 0.14); }
        k.box('paintRed', 0, 1.2, R + 0.11, 0.16, 0.04, 0.02);
      });
      // a grain chute at the bottom on the left, pouring into an open sack
      at(k, 0, 0, 0, -0.785, () => {
        k.box('woodDark', 0, 0.5, R + 0.06, 0.22, 0.22, 0.04); k.box('woodLight', 0, 0.46, R + 0.15, 0.16, 0.06, 0.24, 0, 0.5);
        k.box('wheatGold', 0, 0.3, R + 0.28, 0.05, 0.14, 0.05);
      });
      sack(k, Math.sin(-0.785) * (R + 0.22), Math.cos(-0.785) * (R + 0.22), -0.785, true);
    },

    /* ---------- a painted chicken coop: raised hen house, open nest box with eggs, ramp, white picket run ---------- */
    coop: function (k) {
      const hx = -0.2, hz = -0.28, hw = 0.7, hd = 0.68, fy = 0.32, wallH = 0.55, front = hz + hd / 2;
      // the run: straw floor, white picket fence on the open sides
      k.box('straw', 0, 0, 0.2, 1.56, 0.02, 0.96); k.box('straw', 0.48, 0, -0.35, 0.6, 0.02, 0.6);
      const picket = (x, z) => k.box('paintWhite', x, 0, z, 0.045, 0.36, 0.045);
      for (let x = -0.76; x <= 0.77; x += 0.1) picket(x, 0.66);
      for (let z = -0.66; z < 0.66; z += 0.1) picket(0.76, z);
      for (let x = 0.2; x < 0.76; x += 0.1) picket(x, -0.66);
      for (let z = 0.12; z < 0.66; z += 0.1) picket(-0.76, z);
      for (const y of [0.1, 0.26]) { k.box('woodLight', 0, y, 0.64, 1.56, 0.04, 0.02); k.box('woodLight', 0.74, y, 0, 0.02, 0.04, 1.32); k.box('woodLight', 0.48, y, -0.64, 0.56, 0.04, 0.02); k.box('woodLight', -0.74, y, 0.39, 0.02, 0.04, 0.54); }
      for (const [x, z] of [[-0.76, 0.66], [0.76, 0.66], [0.76, -0.66], [0.2, -0.66], [-0.76, 0.12]]) k.box('woodMid', x, 0, z, 0.07, 0.42, 0.07);
      // the hen house on legs
      for (const [x, z] of [[-0.31, -0.3], [0.31, -0.3], [-0.31, 0.3], [0.31, 0.3]]) k.box('woodMid', hx + x, 0, hz + z, 0.07, fy, 0.07);
      k.box('woodMid', hx, fy - 0.05, hz, hw + 0.04, 0.05, hd + 0.04);
      k.box('paintYellow', hx, fy, hz, hw, wallH, hd);
      const prof = [[hd / 2, fy + wallH], [0, fy + wallH + 0.3]];
      gable(k, 'paintYellow', prof, hx, hz, hw, false, 0.04);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('paintWhite', hx + sx * (hw / 2 - 0.02), fy, hz + sz * (hd / 2 - 0.02), 0.06, wallH, 0.06);
      const ey = fy + wallH - 0.05, ez = hd / 2 + 0.08, RL = hw + 0.14;
      slabZ(k, 'roofRed', hz - ez, ey, hz, fy + wallH + 0.3, hx, RL, 0.06); slabZ(k, 'roofRed', hz, fy + wallH + 0.3, hz + ez, ey, hx, RL, 0.06);
      for (const s of [-1, 1]) { slabZ(k, 'paintWhite', hz - ez, ey - 0.01, hz, fy + wallH + 0.29, hx + s * (RL / 2 + 0.01), 0.03, 0.08); slabZ(k, 'paintWhite', hz, fy + wallH + 0.29, hz + ez, ey - 0.01, hx + s * (RL / 2 + 0.01), 0.03, 0.08); }
      k.box('woodDark', hx, fy + wallH + 0.3, hz, RL + 0.02, 0.04, 0.07);
      vane(k, hx + 0.2, fy + wallH + 0.32, hz, 0.6);
      // front: a pop hole with a green frame, a window, an egg sign
      k.box('woodDark', hx + 0.15, fy, front + 0.005, 0.18, 0.24, 0.02);
      for (const [x, y, w, h] of [[0.15, fy + 0.24, 0.26, 0.04], [0.05, fy, 0.04, 0.26], [0.25, fy, 0.04, 0.26]]) k.box('paintGreen', hx + x, y, front + 0.015, w, h, 0.03);
      win(k, hx - 0.17, fy + 0.2, front + 0.005, 0.18, 0.18);
      k.box('signBoard', hx + 0.15, fy + 0.31, front + 0.02, 0.2, 0.17, 0.03); k.box('eggWhite', hx + 0.15, fy + 0.335, front + 0.04, 0.06, 0.11, 0.02); k.box('eggWhite', hx + 0.15, fy + 0.355, front + 0.04, 0.09, 0.06, 0.02);
      // the ramp down to the run, with cleats
      slabZ(k, 'woodLight', front, fy - 0.02, front + 0.42, 0, hx + 0.15, 0.16, 0.03);
      for (let i = 1; i < 5; i++) { const t = i / 5; k.box('woodMid', hx + 0.15, fy - 0.02 - (fy - 0.02) * t + 0.03, front + 0.42 * t, 0.16, 0.02, 0.02); }
      // the nest box on the left side, lid propped open: straw nests with eggs
      const nx = hx - hw / 2 - 0.11;
      k.box('paintYellow', nx, fy + 0.06, hz, 0.22, 0.26, 0.56); k.box('paintWhite', nx - 0.11, fy + 0.06, hz, 0.02, 0.26, 0.58);
      k.box('straw', nx, fy + 0.3, hz, 0.18, 0.03, 0.52);
      for (const z of [-0.18, 0, 0.18]) { if (z) k.box('woodMid', nx, fy + 0.3, hz + z - 0.09 * Math.sign(z), 0.2, 0.05, 0.02); }
      for (const [dz, n] of [[-0.18, 2], [0, 1], [0.18, 3]]) for (let e = 0; e < n; e++) k.box('eggWhite', nx - 0.03 + e * 0.04, fy + 0.33, hz + dz + (e % 2 ? 0.03 : -0.02), 0.04, 0.05, 0.035);
      at(k, hx - hw / 2, fy + 0.34, hz, 0, () => k.box('roofRed', -0.06, 0, 0, 0.03, 0.32, 0.6, 0, 0, 0.4));
      // feeder with grain, water dish, and a couple of hens
      k.box('woodMid', 0.48, 0.02, -0.32, 0.36, 0.1, 0.12); k.box('wheatGold', 0.48, 0.12, -0.32, 0.32, 0.015, 0.08);
      k.geo('stoneLight', CYL, 0.5, 0.05, 0.3, 0, 0, 0, 0.09, 0.06, 0.09); k.geo('waterBlue', CYL, 0.5, 0.075, 0.3, 0, 0, 0, 0.075, 0.01, 0.075);
      hen(k, 0.3, 0.02, 0.38, 0.9); hen(k, 0.5, 0.02, -0.08, -2.2, 'paintOrange'); hen(k, hx + 0.15, 0.13, front + 0.24, 2.9);
    },

    /* ---------- a cattle barn: green roof, red X doors (one slid open, a cow looking out), cow-head sign, paddock with trough ---------- */
    barn: function (k) {
      const cx = -0.5, cz = -0.4, w = 2.3, d = 1.7, wallH = 1.7, front = cz + d / 2, right = cx + w / 2, ridge = 2.45, P = 0.3;
      const prof = [[d / 2, wallH], [0, ridge]];
      k.box('stoneLight', cx, 0, cz, w + 0.04, P, d + 0.04);
      k.box('whitewash', cx, P, cz, w, wallH - P, d);
      gable(k, 'whitewash', prof, cx, cz, w, false);
      // dark timber framing: sill, mid rail and wall plate, posts and braces (front and right gable)
      for (const y of [P, 1.0, wallH - 0.08]) { k.box('woodDark', cx, y, front + 0.005, w + 0.02, 0.08, 0.02); k.box('woodDark', right + 0.005, y, cz, 0.02, 0.08, d + 0.02); }
      for (const x of [cx - w / 2 + 0.04, cx - 0.82, cx + 0.82, right - 0.04]) k.box('woodDark', x, P, front + 0.006, 0.08, wallH - P, 0.02);
      for (const z of [cz - d / 2 + 0.04, cz, cz + d / 2 - 0.04]) k.box('woodDark', right + 0.006, P, z, 0.02, z === cz ? 2.1 - P : wallH - P, 0.08);
      for (const s of [-1, 1]) k.box('woodDark', right + 0.007, 1.04 + 0.3, cz + s * 0.42, 0.02, 0.06, 0.95, 0, s * 0.7);   // gable braces
      // roof: green, white bargeboards on the gable ends, ridge cap, two little vents
      const ez = d / 2 + 0.05, ey = wallH - 0.05 * (ridge - wallH) / (d / 2), RL = w + 0.1;
      slabZ(k, 'roofGreen', cz - ez, ey, cz, ridge, cx, RL, 0.08); slabZ(k, 'roofGreen', cz, ridge, cz + ez, ey, cx, RL, 0.08);
      for (const s of [-1, 1]) { slabZ(k, 'paintWhite', cz - ez, ey - 0.01, cz, ridge - 0.01, cx + s * (RL / 2 + 0.01), 0.04, 0.11); slabZ(k, 'paintWhite', cz, ridge - 0.01, cz + ez, ey - 0.01, cx + s * (RL / 2 + 0.01), 0.04, 0.11); }
      k.box('woodDark', cx, ridge + 0.01, cz, RL + 0.02, 0.05, 0.12);
      for (const x of [cx - 0.6, cx + 0.6]) { k.box('paintWhite', x, ridge - 0.1, cz, 0.18, 0.28, 0.18); k.box('roofGreen', x, ridge + 0.18, cz, 0.26, 0.04, 0.26); }
      // the doors: a dark opening, the left leaf closed, the right one slid open along its iron track
      const DH = 1.0;
      k.box('soot', cx, P, front - 0.08, 1.16, DH, 0.1); k.box('hay', cx + 0.3, P, front - 0.2, 0.5, 0.2, 0.2);
      leaf(k, cx - 0.29, P, front + 0.02, 0.58, DH); leaf(k, cx + 0.88, P, front + 0.05, 0.58, DH);
      k.box('ironDark', cx + 0.3, P + DH, front + 0.04, 2.0, 0.05, 0.05);
      // a cow looking out of the open half
      at(k, cx + 0.28, P, front - 0.05, 0, () => {
        k.box('paintWhite', 0, 0.42, 0, 0.3, 0.3, 0.3); k.box('ironDark', 0.07, 0.54, 0.03, 0.17, 0.19, 0.28);
        k.box('potionPink', 0, 0.42, 0.15, 0.22, 0.13, 0.08); k.box('ironDark', -0.05, 0.48, 0.195, 0.03, 0.025, 0.01); k.box('ironDark', 0.05, 0.48, 0.195, 0.03, 0.025, 0.01);
        k.box('ironDark', -0.1, 0.62, 0.151, 0.04, 0.04, 0.01); k.box('paintWhite', 0.1, 0.62, 0.152, 0.04, 0.04, 0.01); k.box('ironDark', 0.1, 0.63, 0.155, 0.025, 0.025, 0.01);
        for (const s of [-1, 1]) { k.box('canvas', s * 0.2, 0.7, 0, 0.12, 0.04, 0.04); k.box('canvas', s * 0.25, 0.72, 0, 0.04, 0.08, 0.04); k.box(s < 0 ? 'paintWhite' : 'ironDark', s * 0.2, 0.6, -0.04, 0.1, 0.06, 0.08); }
        k.box('paintYellow', 0, 0.3, 0.06, 0.08, 0.1, 0.06);   // a bell
      });
      // the cow-head sign above the doors
      at(k, cx, P + DH + 0.06, front + 0.02, 0, () => {
        k.box('woodDark', 0, 0, 0.0, 0.66, 0.32, 0.02); k.box('signBoard', 0, 0.02, 0.01, 0.62, 0.28, 0.03);
        k.box('paintWhite', 0, 0.03, 0.03, 0.2, 0.22, 0.03); k.box('ironDark', 0.04, 0.13, 0.04, 0.1, 0.1, 0.03);
        k.box('potionPink', 0, 0.03, 0.055, 0.16, 0.07, 0.02);
        k.box('ironDark', -0.05, 0.16, 0.045, 0.03, 0.03, 0.02); k.box('paintWhite', 0.05, 0.15, 0.06, 0.03, 0.03, 0.01);
        for (const s of [-1, 1]) { k.box('canvas', s * 0.14, 0.21, 0.03, 0.1, 0.035, 0.03); k.box('canvas', s * 0.19, 0.22, 0.03, 0.035, 0.06, 0.03); k.box('paintWhite', s * 0.15, 0.13, 0.03, 0.08, 0.05, 0.03); }
      });
      // the hayloft on the right gable, hay spilling out, and two windows
      at(k, right, 0, cz, Math.PI / 2, () => {
        k.box('woodDark', 0, 1.74, 0.01, 0.42, 0.42, 0.02);
        for (const [x, y, ww, h] of [[0, 1.7, 0.52, 0.05], [0, 2.16, 0.52, 0.05], [-0.235, 1.7, 0.05, 0.5], [0.235, 1.7, 0.05, 0.5]]) k.box('paintWhite', x, y, 0.025, ww, h, 0.03);
        k.box('hay', 0, 1.74, 0.04, 0.38, 0.2, 0.14); k.box('hay', 0.04, 1.94, 0.02, 0.26, 0.08, 0.08);
        win(k, -0.45, 0.55, 0.012, 0.26, 0.26); win(k, 0.45, 0.55, 0.012, 0.26, 0.26);
      });
      // hay bales and milk churns, front left
      bale(k, -1.42, 0, 0.82, 0.08); bale(k, -1.4, 0, 1.15, -0.06); bale(k, -1.41, 0.28, 0.98, 0.0);
      for (const [x, z] of [[-1.0, 0.72], [-0.84, 0.8]]) { k.geo('stoneLight', CYL, x, 0.13, z, 0, 0, 0, 0.07, 0.26, 0.07); k.geo('stoneLight', CYL, x, 0.29, z, 0, 0, 0, 0.045, 0.06, 0.045); k.geo('stoneMid', CYL, x, 0.33, z, 0, 0, 0, 0.055, 0.025, 0.055); k.box('paintBlue', x, 0.1, z + 0.065, 0.06, 0.04, 0.01); }
      // the paddock: posts and rails with an open gap, water trough, hay rack, a muddy patch
      k.box('woodDark', 0.95, 0, 0.75, 0.6, 0.015, 0.5);
      const post = (x, z) => k.box('woodMid', x, 0, z, 0.08, 0.62, 0.08);
      for (const x of [0.0, 0.55, 1.1, 1.64]) post(x, 1.24); for (const z of [-1.24, -0.62, 0, 0.62]) post(1.64, z); post(0.0, 0.62);
      for (const y of [0.24, 0.48]) { k.box('woodLight', 0.82, y, 1.24, 1.64, 0.06, 0.04); k.box('woodLight', 1.64, y, 0, 0.04, 0.06, 2.48); k.box('woodLight', 0.0, y, 0.93, 0.04, 0.06, 0.62); }
      at(k, 1.15, 0, 0.08, 0, () => {   // trough: a hollow box of water
        k.box('woodMid', 0, 0, 0, 0.3, 0.06, 0.74); for (const s of [-1, 1]) { k.box('woodMid', s * 0.13, 0.06, 0, 0.04, 0.2, 0.74); k.box('woodMid', 0, 0.06, s * 0.35, 0.3, 0.2, 0.04); }
        k.box('waterBlue', 0, 0.06, 0, 0.22, 0.15, 0.66); for (const z of [-0.26, 0.26]) k.box('ironDark', 0, 0.1, z, 0.32, 0.04, 0.76 - 0.74 + 0.03);
      });
      at(k, 1.2, 0, -0.85, 0, () => {   // hay rack: a V of slats heaped with hay
        for (const s of [-1, 1]) k.box('woodMid', 0, 0, s * 0.25, 0.36, 0.62, 0.06);
        for (const s of [-1, 1]) for (let i = -2; i <= 2; i++) k.box('woodMid', s * 0.1, 0.2, i * 0.1, 0.03, 0.42, 0.03, 0, 0, -s * 0.35);
        k.box('hay', 0, 0.3, 0, 0.3, 0.26, 0.44); k.box('hay', 0, 0.56, 0, 0.22, 0.08, 0.34);
      });
      new K.WorkShedArt(k).draw('barn');   // a little roof on posts over the hay rack
    },
  };
  const proto = K.CastleArt.prototype, base = proto.draw;
  proto.draw = function (k, type, opts = {}) { const f = ART[type]; if (f && !opts.ruin) return f.call(this, k, opts) || k; return base.call(this, k, type, opts); };
  void CYL; void CYL8; void CONE6;
})(typeof window !== 'undefined' ? window : globalThis);
