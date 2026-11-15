/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Reusable producer-building geometry, shared by the producer art catalog. */
(function (G) {
  const K = G.K, THREE = G.THREE, CYL = K.VoxKit.CYL, CYL8 = K.VoxKit.CYL8;
  const P2 = Math.PI / 2;
  class ProducerArtHelpers {
  /** a local frame: translate to x,y,z and turn ry; call k.pop() after */
    static frame = (k, x, y, z, ry = 0) => k.push(new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z));
  /** a flat triangle, visible from both sides */
    static tri = (k, mat, a, b, c) => { k.quad(mat, a, b, c, c); k.quad(mat, b, a, c, c); };
  /** a gable roof. axis 'x': the ridge runs along x (slopes face ±z); 'z': the ridge runs along z (slopes face ±x).
      w = length along the ridge, d = span across it, y0 = wall top, a = pitch. Fills the two gable triangles with `gableMat`. */
    static gable(k, ax, mat, cx, cz, w, d, y0, a, { over = 0.18, ends = 0.15, th = 0.09, gableMat = null, snow = true } = {}) {
    const half = d / 2 + over, L = half / Math.cos(a), yb = y0 + (d / 2 - half / 2) * Math.tan(a), top = y0 + (d / 2) * Math.tan(a);
    for (const s of [-1, 1]) {
      if (ax === 'x') k.box(mat, cx, yb, cz + s * half / 2, w + ends * 2, th, L, 0, s * a);
      else k.box(mat, cx + s * half / 2, yb, cz, L, th, w + ends * 2, 0, 0, -s * a);
    }
    if (ax === 'x') {
      k.box('woodDark', cx, top - 0.02, cz, w + ends * 2 + 0.04, 0.12, 0.12);
      if (snow) k.box('snow', cx, top + 0.08, cz, w + ends * 2, 0.04, 0.18);
      if (gableMat) for (const s of [-1,
        1]) { const X = cx + s * (w / 2 - 0.005);
        ProducerArtHelpers.tri(k,
        gableMat,
        [X,
        y0,
        cz - d / 2],
        [X,
        y0,
        cz + d / 2],
        [X,
        top,
        cz]);
        }
    } else {
      k.box('woodDark', cx, top - 0.02, cz, 0.12, 0.12, w + ends * 2 + 0.04);
      if (snow) k.box('snow', cx, top + 0.08, cz, 0.18, 0.04, w + ends * 2);
      if (gableMat) for (const s of [-1,
        1]) { const Z = cz + s * (w / 2 - 0.005);
        ProducerArtHelpers.tri(k,
        gableMat,
        [cx - d / 2,
        y0,
        Z],
        [cx + d / 2,
        y0,
        Z],
        [cx,
        top,
        Z]);
        }
    }
    return top;
  }
    static roofX = (k, ...a) => ProducerArtHelpers.gable(k, 'x', ...a);
    static roofZ = (k, ...a) => ProducerArtHelpers.gable(k, 'z', ...a);
  /** a log with pale cut ends; axis 'x' | 'y' | 'z'; y is the centre */
    static log(k, x, y, z, len, r, ax = 'x', bark = 'bark') {
    const [rx, rz] = ax === 'x' ? [0, P2] : ax === 'z' ? [P2, 0] : [0, 0];
    k.geo(bark, CYL8, x, y, z, rx, 0, rz, r, len, r); k.geo('woodLight', CYL8, x, y, z, rx, 0, rz, r * 0.78, len + 0.02, r * 0.78);
  }
  /** a barrel standing on y */
    static barrel(k, x, y, z, r = 0.14, h = 0.36, body = 'woodMid') {
    k.geo(body, CYL, x, y + h / 2, z, 0, 0, 0, r, h, r); k.geo(body, CYL, x, y + h / 2, z, 0, 0, 0, r * 1.08, h * 0.55, r * 1.08);
    for (const t of [0.12, 0.88]) k.geo('ironDark', CYL, x, y + h * t, z, 0, 0, 0, r * 1.05, 0.03, r * 1.05);
    k.geo('woodLight', CYL, x, y + h + 0.005, z, 0, 0, 0, r * 0.92, 0.012, r * 0.92);
  }
  /** a banded crate standing on y */
    static crate(k, x, y, z, s = 0.3, ry = 0, wood = 'woodLight') {
    k.box(wood, x, y, z, s, s, s, ry);
    for (const t of [0.02, s - 0.07]) k.box('woodDark', x, y + t, z, s + 0.02, 0.05, s + 0.02, ry);
    k.box('woodDark', x, y + s * 0.2, z, s * 0.12, s * 0.6, s + 0.02, ry); k.box('woodDark', x, y + s * 0.2, z, s + 0.02, s * 0.6, s * 0.12, ry);
  }
  /** a tied sack sitting on y */
    static sack(k, x, y, z, ry = 0, mat = 'canvas', s = 1) {
    k.box(mat, x, y, z, 0.26 * s, 0.24 * s, 0.2 * s, ry); k.box(mat, x, y + 0.24 * s, z, 0.18 * s, 0.07 * s, 0.14 * s, ry);
    k.box('rope', x, y + 0.29 * s, z, 0.12 * s, 0.04 * s, 0.1 * s, ry); k.box(mat, x, y + 0.33 * s, z, 0.08 * s, 0.05 * s, 0.07 * s, ry);
  }
  /** a pick-axe lying in the x-y plane of the current frame: handle from (x,y) up at angle t (from vertical) */
    static pick(k, x, y, z, t = 0.25, len = 0.6) {
    const hx = x - Math.sin(t) * len / 2, hy = y + Math.cos(t) * len / 2;
    k.box('woodLight', hx, hy - len / 2, z, 0.04, len, 0.04, 0, 0, t);
    const tx = x - Math.sin(t) * len * 0.95, ty = y + Math.cos(t) * len * 0.95;
    k.box('ironDark',
      tx,
      ty - 0.03,
      z,
      0.34,
      0.06,
      0.05,
      0,
      0,
      t + 0.12);
      k.box('steel',
      tx - Math.cos(t) * 0.17,
      ty - 0.06 - Math.sin(t) * 0.17,
      z,
      0.05,
      0.08,
      0.05,
      0,
      0,
      t + 0.5);
  }
  /** a felling axe in the x-y plane: handle base at (x,y), leaning t */
    static axe(k, x, y, z, t = 0.3, len = 0.55) {
    k.box('woodLight', x - Math.sin(t) * len / 2, y + Math.cos(t) * len / 2 - len / 2, z, 0.045, len, 0.045, 0, 0, t);
    const hx = x - Math.sin(t) * len * 0.9, hy = y + Math.cos(t) * len * 0.9;
    k.box('ironDark',
      hx + Math.cos(t) * 0.06,
      hy - 0.05,
      z,
      0.13,
      0.1,
      0.05,
      0,
      0,
      t);
      k.box('steel',
      hx + Math.cos(t) * 0.14,
      hy - 0.08,
      z,
      0.05,
      0.16,
      0.055,
      0,
      0,
      t);
  }
  /** a sign board facing +z in the current frame, centred at x,y (centre),z with a picture: pix = [[mat, u, v, w, h, rz], ...] */
    static board(k, x, y, z, w, h, bg, pix, sc = 1, frameMat = 'woodDark') {
    k.box(frameMat, x, y - h / 2 - 0.03, z, w + 0.06, h + 0.06, 0.05); k.box(bg, x, y - h / 2, z + 0.012, w, h, 0.05);
    pix.forEach(([m, u, v, pw, ph, rz = 0], i) => k.box(m, x + u * sc, y + (v - ph / 2) * sc, z + 0.045 + i * 0.004, pw * sc, ph * sc, 0.03, 0, 0, rz));
  }
  /** a board hanging on two cords from a bar at yBar */
    static hangBoard(k, x, yBar, z, w, h, bg, pix, drop = 0.1, sc = 1) {
    for (const s of [-1, 1]) k.box('ironDark', x + s * (w / 2 - 0.05), yBar - drop - 0.02, z, 0.02, drop + 0.02, 0.02);
    ProducerArtHelpers.board(k, x, yBar - drop - h / 2 - 0.03, z, w, h, bg, pix, sc);
  }
  }
  K.ProducerArtHelpers = ProducerArtHelpers;
})(typeof window !== 'undefined' ? window : globalThis);
