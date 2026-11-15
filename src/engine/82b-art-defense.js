/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · art overrides for some castle pieces (see the asset library, /assets.html). Each entry draws one piece type
   into a VoxKit; anything not listed here falls back to 82-castle-mesh.js.
   Defense pieces: palisade, stone wall, wooden gate, stone gate, watchtower, fire pot. Origin = centre of the
   footprint at ground level, +z = the outside face. Walls tile along x every 0.5 m, so their edges are seamless. */
(function (G) {
  const K = G.K, THREE = G.THREE, CYL = K.VoxKit.CYL, CYL8 = K.VoxKit.CYL8, CONE6 = new THREE.ConeGeometry(1, 1, 6);
  const PYR = new THREE.ConeGeometry(1, 1, 4), BOWL = new THREE.CylinderGeometry(1, 0.62, 1, 12), CONE8 = new THREE.ConeGeometry(1, 1, 8);
  const SPHERE = new THREE.SphereGeometry(1, 8, 6), RING = new THREE.TorusGeometry(1, 0.09, 6, 16);
  const D = Math.PI / 4;

  /* a beam from (x0,y0) to (x1,y1) lying in the plane z (rz rotation) */
  const braceXY = (k, mat, x0, y0, x1, y1, z, t = 0.07, d = 0.06) => {
    const len = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0);
    k.box(mat, (x0 + x1) / 2, (y0 + y1) / 2 - t / 2, z, len, t, d, 0, 0, a);
  };
  /* a beam from (z0,y0) to (z1,y1) lying in the plane x (rx rotation) */
  const braceZY = (k, mat, z0, y0, z1, y1, x, t = 0.07, d = 0.06) => {
    const len = Math.hypot(z1 - z0, y1 - y0), a = Math.atan2(y1 - y0, z1 - z0);
    k.box(mat, x, (y0 + y1) / 2 - t / 2, (z0 + z1) / 2, d, t, len, 0, -a, 0);
  };
  /* mortar lines on a stone block: thin bands every `step` up the sides, staggered joints on front and back */
  const courses = (k, x, y0, y1, z, w, d, step = 0.3, joints = true) => {
    let i = 0;
    for (let y = y0 + step; y < y1 - 0.05; y += step, i++) {
      k.box('stoneMid', x, y, z, w + 0.012, 0.022, d + 0.012);
      if (!joints) continue;
      const off = i % 2 ? 0.2 : 0;
      for (let jx = -w / 2 + 0.2 + off; jx < w / 2 - 0.08; jx += 0.4) for (const s of [-1, 1]) k.box('stoneMid', x + jx, y + 0.02, z + s * (d / 2), 0.022, step - 0.02, 0.012);
    }
  };

  const ART = {
    /* a stockade run: three fresh-cut logs per tile, pale sharpened points, rope lashings, rails behind */
    palisade(k) {
      k.box('roofBrown', 0, 0, 0, 0.5, 0.06, 0.42);                                       // packed earth along the foot
      const logs = [[-0.167, 1.46, 'woodMid'], [0, 1.6, 'woodLight'], [0.167, 1.5, 'woodMid']];
      for (const [x, h, mat] of logs) {
        k.geo(mat, CYL8, x, h / 2, 0.02, 0, 0.3, 0, 0.083, h, 0.083, 0.5, 1);
        k.geo('paintWhite', CONE6, x, h + 0.14, 0.02, 0, 0, 0, 0.083, 0.28, 0.083);      // pale fresh-cut point
        k.geo('woodDark', CYL8, x, h - 0.01, 0.02, 0, 0.3, 0, 0.086, 0.03, 0.086);         // bark ring under the point
        for (const y of [0.42, 1.12]) k.geo('rope', CYL8, x, y, 0.02, 0, 0, 0, 0.09, 0.06, 0.09);
      }
      for (const y of [0.36, 1.06]) k.box('woodDark', 0, y, -0.11, 0.5, 0.1, 0.07);          // rails on the inside
      for (const y of [0.36, 1.06]) k.box('ironDark', 0, y + 0.03, -0.152, 0.06, 0.04, 0.02); // a nail plate per tile
    },

    /* a curtain wall run: pale dressed blocks in staggered courses, a walkway slab and one merlon per tile */
    stone_wall(k) {
      const H = 1.5;
      k.box('stoneDark', 0, 0, 0, 0.5, 0.18, 0.5);                                         // footing
      k.box('stoneDark', 0, 0.18, 0, 0.5, H - 0.18, 0.4);                                   // mortar core
      const tone = ['stoneLight', 'whitewash', 'stoneLight', 'stoneLight', 'whitewash', 'stoneLight', 'stoneLight'];
      for (let c = 0; c * 0.19 + 0.18 < H - 0.02; c++) {
        const y = 0.18 + c * 0.19, h = Math.min(0.175, H - y);
        const row = c % 2 ? [[0, 0.235], [0.19125, 0.1175], [-0.19125, 0.1175]] : [[-0.125, 0.235], [0.125, 0.235]];
        row.forEach(([x, w], i) => { const m = tone[(c * 3 + i * 2) % tone.length]; for (const s of [-1, 1]) k.box(m, x, y, s * 0.215, w, h, 0.04); });
      }
      k.box('stoneMid', 0, H, 0, 0.5, 0.08, 0.5);                                           // walkway slab
      k.box('stoneLight', 0, H + 0.08, 0.16, 0.32, 0.34, 0.18);                              // merlon (crenel gaps between tiles)
      k.box('stoneLight', 0, H + 0.08, -0.2, 0.5, 0.14, 0.1);                                // low inner lip
    },

    /* the wooden gate frame: tall square posts on stone feet, braced lintel with a red painted header, a little
       red-shingled roof and two lanterns. The swinging leaves are separate parts (113-castle-drawbridge.js: WoodGate),
       hinged at x = ±0.9 and about 1 m tall; nothing here crosses their swing. */
    gate(k) {
      for (const s of [-1, 1]) {
        const x = s * 0.93;
        k.box('stoneMid', x, 0, 0, 0.18, 0.22, 0.3);
        k.box('woodMid', x, 0.22, 0, 0.14, 1.66, 0.2);
        k.geo('paintWhite', CONE6, x, 2.0, 0, 0, 0, 0, 0.1, 0.24, 0.1);                     // spiked post tops
        k.box('ironDark', x - s * 0.075, 0.25, 0.06, 0.012, 0.08, 0.06); k.box('ironDark', x - s * 0.075, 0.72, 0.06, 0.012, 0.08, 0.06);   // hinge straps
        braceXY(k, 'woodLight', x - s * 0.05, 1.02, x - s * 0.4, 1.32, 0.0, 0.07, 0.1);    // knee braces under the lintel
      }
      k.box('woodDark', 0, 1.3, 0, 2.0, 0.16, 0.24);                                         // lintel
      k.box('paintRed', 0, 1.32, 0.125, 1.5, 0.12, 0.02);                                    // painted header board
      for (const x of [-0.6, -0.2, 0.2, 0.6]) k.box('gold', x, 1.36, 0.137, 0.04, 0.04, 0.01);
      // the little gable roof, ridge along x
      k.box('woodDark', 0, 1.46, 0, 0.08, 0.3, 0.08); for (const s of [-1, 1]) k.box('woodDark', s * 0.93, 1.46, 0, 0.08, 0.3, 0.08);
      k.box('woodDark', 0, 1.74, 0, 2.0, 0.07, 0.07);
      for (const s of [-1, 1]) k.box('roofRed', 0, 1.6, s * 0.13, 2.08, 0.05, 0.32, 0, s * 0.62);
      k.box('roofBrown', 0, 1.77, 0, 2.1, 0.05, 0.08);
      // lanterns hanging from the lintel, outside
      for (const s of [-1, 1]) {
        const x = s * 0.68, z = 0.17;
        k.box('ironDark', x, 1.16, z, 0.015, 0.14, 0.015);
        k.box('ironDark', x, 1.02, z, 0.11, 0.02, 0.11); k.box('glowbar', x, 1.04, z, 0.07, 0.09, 0.07); k.box('ironDark', x, 1.13, z, 0.12, 0.03, 0.12);
      }
      k.box('stoneMid', 0, 0, 0, 1.7, 0.02, 0.36);                                           // threshold stones
    },

    /* the stone gatehouse: two pale crenellated towers, a battlemented span, a raised iron portcullis inside the arch
       and two torches. The drawbridge is its own moving part (113-castle-drawbridge.js): a 3 m wide, 2.6 m tall
       door hinged at the front face (z = 0.75), so the opening stays clear for x in -1.5..1.5, y below 2.7. */
    stone_gate(k) {
      const flames = [];
      k.box('stoneDark', 0, 0, 0, 4, 0.12, 1.5);                                           // footing under everything
      k.box('flagstone', 0, 0.12, -0.05, 3, 0.02, 1.38);
      for (const s of [-1, 1]) {
        const x = s * 1.75;
        k.box('stoneDark', x, 0.12, 0, 0.5, 0.2, 1.5);
        k.box('stoneLight', x, 0.32, 0, 0.5, 3.5, 1.5); courses(k, x, 0.32, 3.82, 0, 0.5, 1.5, 0.3);
        k.box('stoneMid', x, 3.82, 0, 0.6, 0.12, 1.6);                                      // corbel band
        k.box('stoneLight', x, 3.94, 0, 0.58, 0.1, 1.58);
        for (const [dx, dz] of [[-0.17, -0.62], [0.17, -0.62], [-0.17, 0.62], [0.17, 0.62], [s * 0.19, -0.2], [s * 0.19, 0.2]]) k.box('stoneLight', x + dx, 4.04, dz, 0.22, 0.32, 0.3);
        k.geo('roofBlue', PYR, x, 4.3, 0, 0, D, 0, 0.3, 0.5, 0.3);                           // little lookout cap
        k.geo('gold', SPHERE, x, 4.6, 0, 0, 0, 0, 0.05, 0.05, 0.05);
        for (const zf of [-1, 1]) for (const y of [2.1, 3.2]) k.box('ironDark', x, y, zf * 0.752, 0.07, 0.42, 0.01);   // arrow slits, both faces
        // torch on an iron bracket beside the opening
        const tz = 0.82, tx = s * 1.58;
        k.box('ironDark', tx, 1.62, 0.77, 0.04, 0.04, 0.12); k.box('woodDark', tx, 1.55, tz, 0.06, 0.34, 0.06); k.geo('ironDark', BOWL, tx, 1.92, tz, 0, 0, 0, 0.08, 0.08, 0.08); k.box('coals', tx, 1.95, tz, 0.1, 0.03, 0.1);
        flames.push([tx, 1.96, tz, 0.8]);
      }
      // the span over the opening
      k.box('stoneLight', 0, 2.7, 0, 3.0, 0.62, 1.5); courses(k, 0, 2.7, 3.32, 0, 3.0, 1.5, 0.3);
      for (const zf of [-1, 1]) {
        for (let i = -5; i <= 5; i++) {                                                     // voussoirs rounding the corners of the opening
          const x = i * 0.27, u = x / 1.5, top = 2.7, y = 2.18 + 0.52 * Math.sqrt(Math.max(0, 1 - u * u * u * u)) * 1;
          if (y < top - 0.02) k.box(i % 2 ? 'stoneMid' : 'stoneLight', x, y, zf * 0.66, 0.26, top - y + 0.02, 0.18);
        }
        k.box('stoneLight', 0, 2.42, zf * 0.66, 0.3, 0.3, 0.2);                           // keystone
        k.box('gold', 0, 2.5, zf * 0.765, 0.12, 0.12, 0.01);
      }
      k.box('stoneMid', 0, 3.32, 0, 3.04, 0.08, 1.54);
      for (const x of [-1.1, -0.37, 0.37, 1.1]) for (const z of [-0.65, 0.65]) k.box('stoneLight', x, 3.4, z, 0.36, 0.3, 0.2);   // battlements
      // the portcullis, raised, its iron teeth showing inside the arch
      for (let i = -6; i <= 6; i++) { const x = i * 0.22; k.box('ironDark', x, 2.12, 0.3, 0.05, 0.6, 0.05); k.geo('ironDark', CONE6, x, 2.07, 0.3, Math.PI, 0, 0, 0.035, 0.12, 0.035); }
      for (const y of [2.28, 2.52]) k.box('ironDark', 0, y, 0.3, 2.9, 0.05, 0.04);
      // chain holes and winch drums for the drawbridge
      for (const s of [-1, 1]) { k.box('stoneDark', s * 1.25, 2.9, 0.752, 0.14, 0.14, 0.01); k.geo('woodMid', CYL, s * 1.25, 3.0, -0.6, 0, 0, Math.PI / 2, 0.12, 0.3, 0.12); }
      return { flames };
    },

    /* a timber archer's tower on a stone foot: braced legs, a ladder up the front, a planked fighting platform
       (top at y 3.2, where the bowman stands) with a red rail and shields, and a steep red roof with an alarm bell */
    watchtower(k) {
      const flames = [], P = 0.55, FL = 3.06;
      k.box('stoneDark', 0, 0, 0, 1.4, 0.14, 1.4);
      k.box('stoneLight', 0, 0.14, 0, 1.3, 0.46, 1.3); courses(k, 0, 0.14, 0.6, 0, 1.3, 1.3, 0.23, false);
      k.box('stoneMid', 0, 0.6, 0, 1.34, 0.06, 1.34);
      for (const x of [-P, P]) for (const z of [-P, P]) k.box('woodMid', x, 0.66, z, 0.15, FL - 0.66, 0.15);
      for (const y of [1.84, FL - 0.1]) { for (const s of [-1, 1]) { k.box('woodDark', 0, y, s * P, 1.26, 0.1, 0.1); k.box('woodDark', s * P, y, 0, 0.1, 0.1, 1.26); } }
      for (const [y0, y1] of [[0.7, 1.84], [1.94, FL - 0.1]]) for (const s of [-1, 1]) {   // X braces on all four sides
        braceXY(k, 'woodLight', -P, y0, P, y1, s * P); braceXY(k, 'woodLight', P, y0, -P, y1, s * P);
        braceZY(k, 'woodLight', -P, y0, P, y1, s * P); braceZY(k, 'woodLight', P, y0, -P, y1, s * P);
      }
      // the ladder up the front
      for (const x of [-0.17, 0.17]) k.box('woodLight', x, 0, 0.7, 0.05, FL + 0.6, 0.05);
      for (let y = 0.3; y < FL + 0.5; y += 0.28) k.box('woodMid', 0, y, 0.7, 0.34, 0.035, 0.04);
      // the platform
      k.box('woodDark', 0, FL - 0.02, 0, 1.5, 0.08, 1.5);
      k.box('woodLight', 0, FL + 0.06, 0, 1.46, 0.08, 1.46);
      for (let i = -3; i <= 3; i++) k.box('woodMid', i * 0.2, FL + 0.141, 0, 0.012, 0.004, 1.44);
      const TOP = FL + 0.14;   // 3.2: the floor the bowman stands on
      for (const s of [-1, 1]) {                                                           // board parapet, red rail on top
        k.box('woodMid', 0, TOP, s * 0.7, 1.46, 0.5, 0.06); k.box('woodMid', s * 0.7, TOP, 0, 0.06, 0.5, 1.46);
        for (let i = -3; i <= 3; i++) { k.box('woodDark', i * 0.2, TOP, s * 0.734, 0.015, 0.5, 0.01); k.box('woodDark', s * 0.734, TOP, i * 0.2, 0.01, 0.5, 0.015); }
        k.box('paintRed', 0, TOP + 0.5, s * 0.7, 1.52, 0.07, 0.1); k.box('paintRed', s * 0.7, TOP + 0.5, 0, 0.1, 0.07, 1.52);
      }
      for (const [x, z, ry, c] of [[0.36, 0.745, 0, 'paintBlue'], [-0.36, 0.745, 0, 'paintRed'], [0.745, 0.2, Math.PI / 2, 'paintRed'], [-0.745, -0.2, Math.PI / 2, 'paintBlue'], [0, -0.745, 0, 'paintBlue']]) {
        k.geo(c, CYL, x, TOP + 0.25, z, ry ? 0 : Math.PI / 2, 0, ry ? Math.PI / 2 : 0, 0.17, 0.03, 0.17);            // round shields hung on the boards
        k.geo('gold', CYL, x + (ry ? Math.sign(x) * 0.02 : 0), TOP + 0.25, z + (ry ? 0 : Math.sign(z) * 0.02), ry ? 0 : Math.PI / 2, 0, ry ? Math.PI / 2 : 0, 0.05, 0.03, 0.05);
      }
      for (const x of [-0.7, 0.7]) for (const z of [-0.7, 0.7]) k.box('woodMid', x, TOP, z, 0.12, 4.18 - TOP, 0.12);   // roof posts
      // the roof: a steep four-sided cap, eaves band, gold finial
      k.box('woodDark', 0, 4.12, 0, 1.56, 0.08, 1.56);
      k.geo('roofRed', PYR, 0, 4.2 + 0.36, 0, 0, D, 0, 1.12, 0.72, 1.12);
      k.geo('gold', SPHERE, 0, 4.95, 0, 0, 0, 0, 0.06, 0.06, 0.06);
      k.box('woodDark', 0, 4.9, 0, 0.03, 0.06, 0.03);
      // the alarm bell under the roof
      k.box('rope', 0, 3.98, 0, 0.02, 0.14, 0.02);
      k.geo('gold', BOWL, 0, 3.9, 0, Math.PI, 0, 0, 0.09, 0.16, 0.09);
      return { flames };
    },

    /* the fire pot: a black iron bowl with a gold rim on three splayed legs over a ring of pale stones, heaped with
       glowing coals and split logs, burning high */
    fire_pot(k) {
      k.geo('stoneMid', CYL8, 0, 0.06, 0, 0, 0, 0, 0.38, 0.12, 0.38);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; k.box(i % 2 ? 'stoneLight' : 'whitewash', Math.cos(a) * 0.31, 0.12, Math.sin(a) * 0.31, 0.11, 0.08, 0.22, -a); }
      k.geo('soot', CYL8, 0, 0.125, 0, 0, 0, 0, 0.26, 0.01, 0.26);
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + 0.5, cx = Math.cos(a), sz = Math.sin(a);
        const x0 = cx * 0.27, z0 = sz * 0.27, x1 = cx * 0.15, z1 = sz * 0.15, h = 0.62, len = Math.hypot(0.12, h);
        k.geo('ironDark', CYL8, (x0 + x1) / 2, 0.12 + h / 2, (z0 + z1) / 2, 0, -a, Math.atan2(0.12, h), 0.025, len, 0.025);
        k.geo('ironDark', CYL8, x0, 0.14, z0, 0, 0, 0, 0.045, 0.04, 0.045);                     // feet
      }
      k.geo('ironDark', BOWL, 0, 0.84, 0, 0, 0, 0, 0.3, 0.26, 0.3);
      k.geo('gold', RING, 0, 0.97, 0, Math.PI / 2, 0, 0, 0.3, 0.3, 0.3);                    // rim
      k.geo('gold', RING, 0, 0.78, 0, Math.PI / 2, 0, 0, 0.255, 0.255, 0.255);              // band
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; k.geo('gold', SPHERE, Math.cos(a) * 0.26, 0.86, Math.sin(a) * 0.26, 0, 0, 0, 0.03, 0.03, 0.03); }
      k.geo('coals', CYL, 0, 0.96, 0, 0, 0, 0, 0.28, 0.06, 0.28);
      k.geo('coals', CONE8, 0, 1.02, 0, 0, 0, 0, 0.22, 0.08, 0.22);
      for (const a of [0.4, 2.5, 4.6]) k.geo('woodDark', CYL8, Math.cos(a) * 0.12, 1.02, Math.sin(a) * 0.12, 0, -a, Math.PI / 2 - 0.35, 0.03, 0.26, 0.03);   // split logs leaning into the fire
      return { flames: [[0, 1.02, 0, 1.05], [0.12, 0.98, 0.07, 0.7], [-0.11, 0.98, -0.06, 0.75], [0.02, 0.98, -0.14, 0.6]] };
    },
  };
  const proto = K.CastleArt.prototype, base = proto.draw;
  proto.draw = function (k, type, opts = {}) { const f = ART[type]; if (f && !opts.ruin) return f.call(this, k, opts) || k; return base.call(this, k, type, opts); };
})(typeof window !== 'undefined' ? window : globalThis);
