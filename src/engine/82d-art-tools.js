/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Reusable geometry helpers for the farming-art catalog. */
(function (G) {
  const THREE = G.THREE;
  class FarmingArtHelpers {
  // move the kit's origin to (x,y,z), turned ry about y (then rz about z); draw; pop
    static at = (k,
      x,
      y,
      z,
      ry = 0,
      f,
      rz = 0) => { const m = new THREE.Matrix4().makeRotationY(ry);
      if (rz) m.multiply(new THREE.Matrix4().makeRotationZ(rz));
      m.setPosition(x,
      y,
      z);
      k.push(m);
      f();
      k.pop();
      };
  // a flat slab whose cross-section runs from (x1,y1) to (x2,y2) in the x-y plane, sitting on that line, extruded along z
    static slabX = (k, mat, x1, y1, x2, y2, z, len, t) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    k.box(mat, (x1 + x2) / 2 + nx * t / 2, (y1 + y2) / 2 + ny * t / 2 - t / 2, z, L, t, len, 0, 0, Math.atan2(dy, dx));
  };
  // the same in the z-y plane (left = -z to right = +z), extruded along x
    static slabZ = (k, mat, z1, y1, z2, y2, x, len, t) => {
    const dz = z2 - z1, dy = y2 - y1, L = Math.hypot(dz, dy), nz = -dy / L, ny = dz / L;
    k.box(mat, x, (y1 + y2) / 2 + ny * t / 2 - t / 2, (z1 + z2) / 2 + nz * t / 2, len, t, L, 0, -Math.atan2(dy, dz));
  };
  // the half-width of a symmetric roof profile at height y; pts run from the eave [hw, y] up to the ridge [0, y]
    static halfAt = (pts,
      y) => { for (let i = 0; i < pts.length - 1; i++) { const [a,
      ya] = pts[i],
      [b,
      yb] = pts[i + 1];
      if (y >= ya && y <= yb) return a + (b - a) * (y - ya) / (yb - ya);
      } return 0;
      };
  // fill the gable under a roof profile with stepped strips (profile across x, extruded along z, or the other way)
    static gable = (k, mat, pts, cx, cz, len, alongZ, step = 0.05) => {
    const y0 = pts[0][1], y1 = pts[pts.length - 1][1];
    for (let y = y0; y < y1 - 0.01; y += step) { const hw = FarmingArtHelpers.halfAt(pts,
      Math.min(y1,
      y + step * 0.5));
      if (hw < 0.02) break;
      if (alongZ) k.box(mat,
      cx,
      y,
      cz,
      2 * hw,
      step,
      len);
      else k.box(mat,
      cx,
      y,
      cz,
      len,
      step,
      2 * hw);
      }
  };
  // a door leaf on a +z wall: coloured panel, white frame and a white X brace
    static leaf = (k, cx, y0, z, w, h, base = 'paintRed', trim = 'paintWhite', t = 0.06) => {
    k.box(base, cx, y0, z, w, h, 0.03);
    k.box(trim, cx, y0, z + 0.02, w, t, 0.03); k.box(trim, cx, y0 + h - t, z + 0.02, w, t, 0.03);
    k.box(trim, cx - w / 2 + t / 2, y0, z + 0.02, t, h, 0.03); k.box(trim, cx + w / 2 - t / 2, y0, z + 0.02, t, h, 0.03);
    const iw = w - 2 * t, ih = h - 2 * t, a = Math.atan2(ih, iw), dl = Math.hypot(iw, ih);
    for (const s of [1, -1]) k.box(trim, cx, y0 + h / 2 - t * 0.4, z + 0.025, dl, t * 0.8, 0.03, 0, 0, s * a);
  };
  // a square hay bale with two twine bands
    static bale = (k, x, y, z, ry = 0, w = 0.44, h = 0.28, d = 0.3) => FarmingArtHelpers.at(k, x, y, z, ry, () => {
    k.box('hay', 0, 0, 0, w, h, d); for (const bx of [-w * 0.25, w * 0.25]) k.box('rope', bx, -0.005, 0, 0.03, h + 0.01, d + 0.01);
  });
  // a tied grain sack
    static sack = (k, x, z, ry = 0, open = false) => FarmingArtHelpers.at(k, x, 0, z, ry, () => {
    k.box('canvas', 0, 0, 0, 0.24, 0.26, 0.2); k.box('canvas', 0, 0.26, 0, 0.2, 0.05, 0.16);
    if (open) { k.box('wheatGold', 0, 0.3, 0, 0.17, 0.04, 0.13); k.box('wheatGold', 0.03, 0.33, 0.01, 0.08, 0.03, 0.07); }
    else { k.box('canvas', 0, 0.31, 0, 0.09, 0.06, 0.08); k.box('rope', 0, 0.3, 0, 0.11, 0.025, 0.1); }
    k.box('paintRed', 0, 0.09, 0.1, 0.1, 0.08, 0.01);   // a red mark on the sack
  });
  // a little voxel hen, facing +z
    static hen = (k, x, y, z, ry = 0, body = 'eggWhite') => FarmingArtHelpers.at(k, x, y, z, ry, () => {
    k.box('paintOrange', -0.03, 0, 0, 0.018, 0.05, 0.018); k.box('paintOrange', 0.03, 0, 0, 0.018, 0.05, 0.018);
    k.box(body, 0, 0.05, 0, 0.13, 0.11, 0.17); k.box(body, 0, 0.1, -0.09, 0.09, 0.1, 0.05);   // body, tail
    k.box(body, 0, 0.14, 0.06, 0.08, 0.08, 0.08); k.box('paintRed', 0, 0.22, 0.065, 0.025, 0.035, 0.06);   // head, comb
    k.box('paintRed', 0, 0.11, 0.105, 0.02, 0.03, 0.02); k.box('paintYellow', 0, 0.16, 0.11, 0.03, 0.025, 0.03);   // wattle, beak
    k.box('ironDark', -0.041, 0.175, 0.08, 0.005, 0.015, 0.015); k.box('ironDark', 0.041, 0.175, 0.08, 0.005, 0.015, 0.015);
  });
  // a gold rooster weathervane on a rod, base at y
    static vane = (k,
      x,
      y,
      z,
      sc = 1) => FarmingArtHelpers.at(k,
      x,
      y,
      z,
      0,
      () => { k.push(new THREE.Matrix4().makeScale(sc,
      sc,
      sc)); FarmingArtHelpers.vane1(k); k.pop(); });
    static vane1 = (k, x = 0, y = 0, z = 0) => {
    k.box('ironDark', x, y, z, 0.025, 0.42, 0.025); k.box('ironDark', x, y + 0.2, z, 0.3, 0.02, 0.02); k.box('ironDark', x, y + 0.2, z, 0.02, 0.02, 0.3);
    k.box('gold',
      x,
      y + 0.42,
      z,
      0.04,
      0.1,
      0.16);
      k.box('gold',
      x,
      y + 0.5,
      z + 0.06,
      0.04,
      0.08,
      0.06);
      k.box('paintRed',
      x,
      y + 0.58,
      z + 0.06,
      0.02,
      0.04,
      0.05);
      k.box('gold',
      x,
      y + 0.48,
      z - 0.09,
      0.04,
      0.12,
      0.05);
  };
  // a white-framed four-pane window on a +z wall (dark glass so it reads as a hole)
    static win = (k, cx, y0, z, w, h) => {
    k.box('woodDark', cx, y0, z, w, h, 0.02); const t = 0.04;
    k.box('paintWhite', cx, y0 - t, z + 0.01, w + 2 * t, t, 0.03); k.box('paintWhite', cx, y0 + h, z + 0.01, w + 2 * t, t, 0.03);
    k.box('paintWhite', cx - w / 2 - t / 2, y0, z + 0.01, t, h, 0.03); k.box('paintWhite', cx + w / 2 + t / 2, y0, z + 0.01, t, h, 0.03);
    k.box('paintWhite', cx, y0, z + 0.015, 0.025, h, 0.02); k.box('paintWhite', cx, y0 + h / 2 - 0.0125, z + 0.015, w, 0.025, 0.02);
  };
  }
  G.K.FarmingArtHelpers = FarmingArtHelpers;
})(typeof window !== 'undefined' ? window : globalThis);
