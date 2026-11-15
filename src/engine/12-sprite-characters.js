/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Original sprite character art, isolated from the reusable rasterizer. */
(function (G) {
  const K = G.K;
  class CharacterArt {
    constructor({ SpriteCanvas = K.SpriteCanvas, shapes = new K.SpriteShapeFactory(), palette = K.PAL } = {}) {
      this.SpriteCanvas = SpriteCanvas; this.shapes = shapes; this.palette = palette;
    }
    color(hex) { return K.hex(hex); }
    furTexture(strength = 0.3, seed = 1) {
      return (x, y, value) => value + (K.hash2(x, (y + (x % 2)) >> 1, seed) - 0.5) * strength;
    }
    jaggedEdge(base, amplitude, seed) {
      return (x, y) => y < base + Math.floor(K.hash2(x, 0, seed) * amplitude);
    }
      warden(f) {
      const b = [0, 0, 1, 1][f];            // breath: upper body drop
      const s = [0, 1, 1, 0][f];            // cape / fur sway
      const c = new this.SpriteCanvas(32, 48);
      c.add(this.shapes.poly([[10, 17 + b], [22, 17 + b], [25, 40], [22 + s, 44], [16, 43], [10 + s, 44], [7.5, 40]], 1.5, [0.1, 0]), this.palette.redDark, { bias: -0.05 });
      c.add(this.shapes.cap(13.6, 33, 12.8, 43, 2.3, 2.1), this.palette.steel, { bias: -0.05, spec: 0.9 });
      c.add(this.shapes.cap(18.4, 33, 19.4, 43, 2.3, 2.1), this.palette.steel, { bias: -0.12 });
      c.add(this.shapes.ell(12.2, 44.6, 3.2, 1.9), this.palette.leather);
      c.add(this.shapes.ell(19.8, 44.6, 3.2, 1.9), this.palette.leather, { bias: -0.08 });
      c.add(this.shapes.ell(16, 27 + b, 6.2, 8), this.palette.mail, { tex: (x, y, v) => v - ((x + y) % 2) * 0.07 - (y % 2) * 0.05 });
      c.add(this.shapes.poly([[12, 21 + b], [20, 21 + b], [20.6, 38], [18.2, 36.6], [16, 39.4], [13.8, 36.6], [11.4, 38]], 1.6, [0, 0.05]), this.palette.red,
        { tex: (x, y, v) => v + (x === 14 || x === 18 ? -0.08 : 0) });
      c.add(this.shapes.poly([[11.4, 30 + b], [20.6, 30 + b], [20.6, 32 + b], [11.4, 32 + b]], 0.8), this.palette.leather);
      // mace arm (character's right = viewer's left)
      c.add(this.shapes.cap(10.4, 19 + b, 8.6, 25 + b, 2.5, 2.2), this.palette.steel, { spec: 0.92 });
      c.add(this.shapes.cap(9.8, 33, 4.6, 14.5, 0.9), this.palette.wood);
      c.add(this.shapes.ell(4.4, 13.2, 3.3, 3.1), this.palette.steel, { spec: 0.85 });
      c.add(this.shapes.cap(8.6, 25 + b, 9.6, 29 + b, 2.2, 2.0), this.palette.steel);
      c.add(this.shapes.ell(9.4, 29.6 + b, 2.3, 2.1), this.palette.steel, { spec: 0.9 });
      // fur mantle
      c.add(this.shapes.ell(16, 18.8 + b, 8.8, 4.3), this.palette.fur, { tex: this.furTexture(0.34, 5 + s), clip: this.jaggedEdge(20.5 + b, 3, 9 + s), dither: 0.2 });
      // great helm
      c.add(this.shapes.ell(16, 6 + b, 4.3, 2.6), this.palette.steel, { spec: 0.9 });
      c.add(this.shapes.poly([[11.8, 5.6 + b], [20.2, 5.6 + b], [20.6, 14.4 + b], [11.4, 14.4 + b]], 2.2, [-0.05, 0], 0), this.palette.steel, { spec: 0.93 });
      c.add(this.shapes.cap(17, 4.2 + b, 21.8, 1.8 + b + s * 0.5, 1.5, 0.6), this.palette.red, { bias: 0.05 });
      // kite shield
      c.add(this.shapes.poly([[18.2, 19.6 + b], [28.2, 20 + b], [28.2, 29 + b], [23.2, 41 + b], [18.2, 29.5 + b]], 1.4, [0.12, -0.05]), this.palette.steel, { spec: 0.9 });
      c.add(this.shapes.poly([[19.6, 21 + b], [26.8, 21.3 + b], [26.8, 28.7 + b], [23.2, 37.8 + b], [19.6, 29.2 + b]], 1.2, [0.12, -0.05]), this.palette.red, { sep: false, outline: false });
      return c.rasterizeAnd((d) => {
        const st = this.palette.steel, sv = this.palette.whiteFur;
        // visor slit + breaths + eye glint
        d.line(12, 10 + b, 19, 10 + b, st[0]); d.line(12, 9 + b, 19, 9 + b, st[1]);
        d.px(16, 11 + b, st[0]); d.px(16, 12 + b, st[0]); d.px(14, 12 + b, st[1]); d.px(18, 12 + b, st[1]);
        d.px(14, 10 + b, this.color('#8fe7ff'), true); d.px(17, 10 + b, this.color('#5fc3e6'), true);
        d.line(12, 7 + b, 19, 7 + b, st[4]); [12, 15, 19].forEach((x) => d.px(x, 7 + b, st[6]));
        // shield emblem: pale four-point frost star + rivets
        const cx = 23, cy = 27 + b, pale = [sv[4], sv[3], sv[2]];
        for (let k = 0; k <= 4; k++) { d.px(cx, cy - k, pale[k > 2 ? 1 : 0]); d.px(cx, cy + k, pale[k > 2 ? 2 : 1]); }
        for (let k = 1; k <= 3; k++) { d.px(cx - k, cy, pale[k > 1 ? 1 : 0]); d.px(cx + k, cy, pale[k > 1 ? 2 : 1]); }
        d.px(cx - 1, cy - 1, pale[1]); d.px(cx + 1, cy + 1, pale[2]); d.px(cx + 1, cy - 1, pale[1]); d.px(cx - 1, cy + 1, pale[2]);
        [[20, 22], [26, 22], [26, 28], [20, 28]].forEach(([x, y]) => d.px(x, y + b, st[5]));
        // tabard emblem stripe + hem
        d.px(16, 24 + b, this.palette.gold[3]); d.px(15, 25 + b, this.palette.gold[2]); d.px(17, 25 + b, this.palette.gold[2]); d.px(16, 26 + b, this.palette.gold[2]); d.px(16, 25 + b, this.palette.gold[4]);
        // belt buckle
        d.px(16, 31 + b, this.palette.gold[3]); d.px(17, 31 + b, this.palette.gold[2]);
        // mace flanges + spike
        d.line(2, 13, 6, 13, st[2]); d.px(4, 10, st[1]); d.px(4, 9, st[3]); d.px(1, 13, st[2]); d.px(7, 13, st[1]);
        d.px(3, 12, st[6]); d.px(3, 11, st[5]);
        // snow on helm top & mantle
        [[14, 4], [15, 4], [16, 4], [17, 3 + 1]].forEach(([x, y]) => d.has(x, y + b) && d.px(x, y + b, this.palette.snow[3]));
        for (let x = 8; x < 24; x++) if (hash2(x, 3, 77) < 0.45) { const y = 15 + b + (x < 12 || x > 20 ? 1 : 0); if (d.has(x, y)) d.px(x, y, this.palette.snow[x % 3 ? 2 : 3]); }
        // knee + gauntlet highlights
        d.px(12, 37, st[6]); d.px(18, 37, st[5]); d.px(8, 28 + b, st[6]);
      });
    }

      witch(f) {
      const b = [0, 0, 1, 1][f], s = [0, 1, 1, 0][f], pulse = [0, 1, 2, 1][f];
      const c = new this.SpriteCanvas(32, 48);
      const fold = (x, y, v) => v + Math.sin(x * 1.35 + y * 0.08) * 0.09;
      c.add(this.shapes.cap(8.2, 46.5, 8.8, 9, 0.9, 1.0), this.palette.wood, { tex: (x, y, v) => v + (y % 7 === 0 ? -0.15 : 0) });
      c.add(this.shapes.poly([[10.6, 18 + b], [21.4, 18 + b], [24.6 + s * 0.5, 43], [21, 46], [16, 45], [11, 46], [7.8 + s * 0.5, 43]], 1.6), this.palette.robe, { tex: fold });
      c.add(this.shapes.poly([[8, 41.5], [24.2 + s * 0.5, 41.5], [24.8 + s * 0.5, 43.5], [21, 46.2], [16, 45.4], [11, 46.2], [7.4, 43.5]], 1.2, [0, -0.2]), this.palette.whiteFur, { tex: this.furTexture(0.3, 3 + s), dither: 0.2 });
      c.add(this.shapes.poly([[12, 27 + b], [20, 27 + b], [20.2, 29 + b], [11.8, 29 + b]], 0.7), this.palette.robeLight, { bias: 0.15 });
      c.add(this.shapes.cap(18.5, 29 + b, 19 + s * 0.4, 36, 0.8), this.palette.robeLight, { bias: 0.05 });
      // far arm raised with frost mote
      c.add(this.shapes.cap(21, 19.5 + b, 23.6, 25.5 + b, 2.2, 2.8), this.palette.robe, { bias: -0.05 });
      c.add(this.shapes.ell(24, 27.2 + b, 1.6, 1.5), this.palette.skinPale);
      // capelet
      c.add(this.shapes.ell(16, 19.6 + b, 7.4, 4.6), this.palette.robeLight, { tex: (x, y, v) => v + Math.sin(x * 1.6) * 0.07, clip: this.jaggedEdge(21 + b, 2, 4) });
      // staff arm
      c.add(this.shapes.cap(11, 19.5 + b, 9.4, 24 + b, 2.3, 2.8), this.palette.robe);
      c.add(this.shapes.ell(8.8, 25 + b, 1.7, 1.6), this.palette.skinPale);
      // hood
      c.add(this.shapes.cap(19, 6 + b, 23.5, 9.5 + b + s * 0.5, 2.4, 0.8), this.palette.robe, { bias: -0.08 });
      c.add(this.shapes.ell(16, 11.4 + b, 6.2, 6.8), this.palette.robe, { tex: (x, y, v) => v + Math.sin(x * 1.1) * 0.05 });
      c.add(this.shapes.ell(15.6, 13 + b, 3.7, 3.9), this.palette.hoodIn, { fixed: 1, sep: false, outline: false });
      c.add(this.shapes.ell(15.5, 15 + b, 2.6, 1.9), this.palette.skinPale, { sep: false, outline: false, bias: -0.12 });
      // crystal head of staff (emissive)
      const cy = 6 - (pulse > 1 ? 1 : 0);
      c.add(this.shapes.poly([[8.6, cy - 5], [11, cy], [8.6, cy + 4.5], [6.2, cy]], 1.1, [-0.2, -0.1]), this.palette.crystal, { emis: true, spec: 0.7, bias: 0.1 });
      c.add(this.shapes.poly([[11.4, cy - 3], [12.8, cy - 0.5], [11.6, cy + 2], [10.4, cy - 0.5]], 0.8), this.palette.crystal, { emis: true, bias: 0.15 });
      c.add(this.shapes.poly([[5.4, cy - 1.5], [6.4, cy + 0.5], [5.4, cy + 2.6], [4.4, cy + 0.5]], 0.8), this.palette.crystal, { emis: true, bias: 0.05 });
      return c.rasterizeAnd((d) => {
        // face: glowing eyes under hood, mouth shadow, silver hair strands
        d.px(14, 13 + b, this.color('#a8f4ff'), true); d.px(17, 13 + b, this.color('#a8f4ff'), true);
        d.px(14, 12 + b, this.palette.hoodIn[2]); d.px(17, 12 + b, this.palette.hoodIn[2]);
        d.px(15, 16 + b, this.palette.skinPale[2]);
        [[12, 13], [12, 14], [12, 15], [13, 16], [19, 13], [19, 14], [19, 15], [18, 16]].forEach(([x, y], i) => d.px(x, y + b, this.palette.hair[i % 4 === 0 ? 3 : 2]));
        d.px(12, 16 + b, this.palette.hair[1]); d.px(19, 16 + b, this.palette.hair[1]);
        // hood rim highlight + frost brooch
        [[11, 8], [12, 6], [13, 5], [14, 5]].forEach(([x, y]) => d.px(x, y + b, this.palette.robe[5]));
        d.px(16, 22 + b, this.palette.crystal[5], true); d.px(15, 22 + b, this.palette.crystal[3]); d.px(17, 22 + b, this.palette.crystal[3]); d.px(16, 23 + b, this.palette.crystal[2]);
        // staff claw prongs
        d.px(7, 10, this.palette.wood[3]); d.px(10, 10, this.palette.wood[2]); d.px(7, 9, this.palette.wood[2]); d.px(10, 9, this.palette.wood[1]);
        // core glints + floating motes
        d.px(8, cy - 1, this.palette.crystal[6], true); d.px(8, cy, this.palette.crystal[6], true); d.px(9, cy - 2, this.palette.crystal[5], true);
        const m = [[13, 2], [4, 3], [12, 9], [3, 7]][f];
        d.px(m[0], m[1], this.color('#d8fbff'), true);
        d.px(24 + (f % 2), 24 + b - (f >> 1), this.color('#bff6ff'), true); d.px(25 - (f % 2), 22 + b, this.color('#7fdcff'), true);
        // rune stitches on robe
        for (let y = 31; y < 41; y += 3) d.px(16, y, this.palette.robe[4]);
      });
    }

      ghoul(f, variant = 0) {
      const b = [0, 1, 1, 0][f], a = [0, 0, 1, 1][f];
      const sk = variant ? this.palette.ghoul2 : this.palette.ghoul, rg = variant ? this.palette.rag2 : this.palette.rag;
      const c = new this.SpriteCanvas(36, 40);
      // far limbs (darker)
      c.add(this.shapes.cap(24.5, 25, 27, 31, 2.2, 1.8), sk, { bias: -0.16 });
      c.add(this.shapes.cap(27, 31, 25.4, 37.6, 1.7, 1.3), sk, { bias: -0.16 });
      c.add(this.shapes.ell(24.6, 38.2, 2.6, 1.1), sk, { bias: -0.2 });
      c.add(this.shapes.cap(17.5, 14.5 + b, 14.6 + a * 0.4, 23.5 + b, 1.9, 1.5), sk, { bias: -0.2 });
      c.add(this.shapes.cap(14.6 + a * 0.4, 23.5 + b, 13.2 + a, 33.5, 1.5, 1.2), sk, { bias: -0.2 });
      // hunched torso: capsule from hips to shoulders, plus hump
      c.add(this.shapes.cap(23, 24, 15.5, 15 + b, 4.6, 5.4), sk, { noise: 0.08,
        tex: (x, y, v) => v - (((x + y * 0.6) | 0) % 3 === 0 && y > 16 + b && y < 24 && x > 15 && x < 23 ? 0.2 : 0) });
      c.add(this.shapes.ell(19.6, 13.4 + b, 4.6, 3.6), sk, { noise: 0.08 });
      // ragged loincloth
      c.add(this.shapes.poly([[19.6, 21.5], [27, 21.5], [28.2, 28.6], [26, 27.4], [24.6, 30.4], [22.6, 27.8], [20.4, 29.6]], 1.1), rg, { noise: 0.14 });
      // near leg (crouched)
      c.add(this.shapes.cap(21.6, 25.2, 17.4, 30.6, 2.6, 2.1), sk, { bias: 0.02, noise: 0.06 });
      c.add(this.shapes.cap(17.4, 30.6, 19.2, 37.4, 1.9, 1.4), sk);
      c.add(this.shapes.ell(17.8, 38.2, 3.2, 1.2), sk, { bias: -0.06 });
      // skull head jutting forward, jaw hanging
      c.add(this.shapes.ell(9.2, 15.6 + b, 4.0, 3.4), sk, { noise: 0.05, spec: 0.94 });
      c.add(this.shapes.ell(8.2, 19.2 + b, 2.6, 1.7), sk, { bias: -0.1, line: true });
      // near arm, long, reaching to the ground
      c.add(this.shapes.cap(15, 15.8 + b, 10.8 - a * 0.5, 24.6 + b, 2.2, 1.7), sk, { bias: 0.06 });
      c.add(this.shapes.cap(10.8 - a * 0.5, 24.6 + b, 7.4 - a * 0.5, 33.6 + b * 0.5, 1.7, 1.3), sk, { bias: 0.06 });
      c.add(this.shapes.ell(7.0 - a * 0.5, 34.4 + b * 0.5, 1.9, 1.5), sk, { bias: 0.02 });
      return c.rasterizeAnd((d) => {
        const e = this.color('#7ff3ff'), e2 = this.color('#e6feff');
        // deep sockets with cyan eyes
        d.px(7, 15 + b, sk[0]); d.px(10, 15 + b, sk[0]);
        d.px(7, 16 + b, e2, true); d.px(10, 16 + b, e, true); d.px(6, 16 + b, this.color('#2b9cc0'), true);
        d.px(8, 17 + b, sk[1]);
        // gaping mouth + teeth
        d.line(6, 19 + b, 10, 19 + b, sk[0]); d.line(6, 20 + b, 9, 20 + b, sk[0]);
        [6, 8, 10].forEach((x) => d.px(x, 18 + b, this.palette.bone[3])); [7, 9].forEach((x) => d.px(x, 21 + b, this.palette.bone[2]));
        // claws on both hands
        const hx = Math.round(7 - a * 0.5), hy = Math.round(34.4 + b * 0.5);
        d.px(hx - 2, hy + 1, this.palette.bone[3]); d.px(hx - 3, hy + 2, this.palette.bone[2]); d.px(hx - 1, hy + 2, this.palette.bone[3]); d.px(hx - 1, hy + 3, this.palette.bone[1]); d.px(hx + 1, hy + 2, this.palette.bone[2]);
        d.px(12 + a, 34, this.palette.bone[1]); d.px(13 + a, 35, this.palette.bone[1]); d.px(11 + a, 35, this.palette.bone[1]);
        // vertebrae along the hump + frost crust
        [[16, 10], [19, 9], [22, 10], [24, 13], [25, 16]].forEach(([x, y]) => { d.px(x, y + b, sk[6]); d.px(x + 1, y + b, sk[3]); });
        [[17, 10], [18, 9], [20, 9], [21, 9], [23, 11], [14, 12]].forEach(([x, y]) => d.px(x, y + b, this.palette.snow[3]));
        // stringy hair and hollow cheek
        d.line(10, 12 + b, 13, 19 + b, variant ? this.palette.hair[1] : this.color('#2a2f33'));
        d.line(11, 12 + b, 14, 17 + b, variant ? this.palette.hair[2] : this.color('#3b4247'));
        d.px(9, 12 + b, sk[6]); d.px(8, 13 + b, sk[5]); d.px(11, 17 + b, sk[2]);
      });
    }

      troll(f) {
      const b = [0, 1, 2, 1][f], s = [0, 0, 1, 1][f];
      const c = new this.SpriteCanvas(64, 72);
      const sk = this.palette.troll;
      const mott = (x, y, v) => v + (K.hash2(x >> 1, y >> 1, 41) - 0.5) * 0.14;
      // back arm & leg
      c.add(this.shapes.cap(44, 28 + b, 50, 40 + b, 5.2, 5.4), sk, { bias: -0.16, tex: mott });
      c.add(this.shapes.cap(50, 40 + b, 49.4, 52 + b, 5.4, 5.8), sk, { bias: -0.16, tex: mott });
      c.add(this.shapes.ell(49.4, 55 + b, 5.4, 5), sk, { bias: -0.14 });
      c.add(this.shapes.cap(40, 52, 43, 65, 6.2, 5.4), sk, { bias: -0.15, tex: mott });
      c.add(this.shapes.ell(44.5, 67.8, 7.2, 3.4), sk, { bias: -0.18 });
      // ice crags (behind body silhouette, poke above)
      const crag = (x0, y0, x1, y1, w) => {
        const dx = x1 - x0, dy = y1 - y0, m = Math.hypot(dx, dy), px = (-dy / m) * w, py = (dx / m) * w;
        c.add(this.shapes.poly([[x0 - px, y0 - py], [x0 + dx * 0.55 - px * 0.8, y0 + dy * 0.55 - py * 0.8], [x1, y1], [x0 + dx * 0.6 + px * 0.9, y0 + dy * 0.6 + py * 0.9], [x0 + px, y0 + py]], 1.4, [-0.1, -0.1]), this.palette.crystal, { spec: 0.75, outlineCol: this.color('#0a2238') });
      };
      crag(28, 26 + b, 25, 7 + b, 3.2); crag(37, 24 + b, 40.5, 4 + b, 3.6); crag(45, 28 + b, 54, 13 + b, 3.0);
      crag(32, 25 + b, 32.5, 12 + b, 2.4); crag(50, 34 + b, 58, 27 + b, 2.2); crag(22, 28 + b, 18, 17 + b, 2.0);
      // body
      c.add(this.shapes.ell(33, 38 + b, 17.5, 16.4), sk, { tex: mott, spec: 0.97 });
      c.add(this.shapes.ell(29, 46 + b, 12, 9.6), this.palette.trollBelly, { tex: mott, bias: 0.04 });
      c.add(this.shapes.poly([[19.6, 50 + b], [42.6, 50 + b], [44.6, 58.5], [38.6, 57.4], [33, 60.6], [27.6, 57.4], [21.6, 58.6]], 1.4), this.palette.fur, { tex: this.furTexture(0.32, 8 + s), dither: 0.2, bias: -0.12, clip: (x, y) => y < 56 + Math.floor(K.hash2(x, 0, 12 + s) * 4) });
      c.add(this.shapes.poly([[19.6, 49.2 + b], [42.6, 49.2 + b], [42.6, 51.2 + b], [19.6, 51.2 + b]], 0.7), this.palette.leather);
      c.add(this.shapes.cap(25, 54, 22.6, 65.5, 6.6, 6), sk, { tex: mott });
      c.add(this.shapes.ell(21, 67.8, 8, 3.5), sk, { bias: -0.04 });
      // club behind the fist
      c.add(this.shapes.cap(13.4, 44 + b, 7.5, 67, 3.0, 4.6), this.palette.bark, { tex: (x, y, v) => v + (y % 6 === 0 ? -0.18 : 0) + (K.hash2(x, y >> 2, 3) - 0.5) * 0.12 });
      // head
      c.add(this.shapes.ell(17, 26.4 + b, 7.8, 7.2), sk, { tex: mott, spec: 0.95 });
      c.add(this.shapes.ell(15.4, 22.8 + b, 6.6, 2.6), sk, { bias: 0.1, line: true });
      c.add(this.shapes.ell(16.4, 31.4 + b, 6.8, 3.6), sk, { bias: -0.06, line: true });
      c.add(this.shapes.ell(11.2, 27 + b, 2.4, 2.1), sk, { bias: 0.05, line: true });
      // front arm
      c.add(this.shapes.cap(25, 31 + b, 16.6, 40 + b, 6.6, 6.0), sk, { tex: mott, spec: 0.96 });
      c.add(this.shapes.cap(16.6, 40 + b, 14.4, 45.5 + b, 6.0, 5.6), sk, { tex: mott });
      c.add(this.shapes.ell(13.8, 47.4 + b, 5.4, 5.0), sk, { bias: 0.04, line: true });
      return c.rasterizeAnd((d) => {
        const e = this.color('#ffe9a0'), e2 = this.color('#ffb84a');
        d.px(13, 25 + b, e, true); d.px(14, 25 + b, e2, true); d.px(19, 25 + b, e2, true); d.px(18, 25 + b, e, true);
        d.line(12, 24 + b, 15, 24 + b, sk[1]); d.line(17, 24 + b, 20, 24 + b, sk[1]);
        // tusks
        [[12, 30], [12, 29], [13, 28]].forEach(([x, y], i) => d.px(x, y + b, this.palette.bone[3 + (i === 2 ? 1 : 0)]));
        [[20, 30], [20, 29], [19, 28]].forEach(([x, y], i) => d.px(x, y + b, this.palette.bone[2 + (i === 2 ? 1 : 0)]));
        d.line(13, 32 + b, 19, 32 + b, sk[0]);
        // knuckles over club
        [[11, 45], [13, 44], [15, 44]].forEach(([x, y]) => d.px(x, y + b, sk[6]));
        // club bands + knots
        d.line(10, 54 + b, 12, 55 + b, this.palette.leather[3]); d.line(9, 58, 12, 59, this.palette.leather[2]);
        d.px(9, 62, this.palette.bark[1]); d.px(11, 50 + b, this.palette.bark[1]);
        // snow on head/shoulders
        for (let x = 10; x < 52; x++) {
          for (let y = 5; y < 40; y++) {
            if (d.has(x, y) && !d.has(x, y - 1)) { const p = d.partAt(x, y); if (p >= 0 && c.parts[p].pal === sk && K.hash2(x, y, 9) < 0.6) { d.px(x, y, this.palette.snow[2]); if (K.hash2(x, y, 4) < 0.5) d.px(x, y + 1, this.palette.snow[1]); } break; }
          }
        }
        // crag glints
        [[25, 9], [40, 6], [53, 15], [32, 14]].forEach(([x, y]) => d.px(x, y + b, this.palette.crystal[6]));
        // warts / scars
        d.px(30, 34 + b, sk[1]); d.px(31, 34 + b, sk[2]); d.px(38, 40 + b, sk[1]); d.line(26, 38 + b, 29, 41 + b, sk[2]);
      });
    }

  }

  class CharacterLibrary {
    constructor(art = new CharacterArt()) {
      this.art = art;
      this.defs = [
        { id: 'warden', name: 'The Warden', role: 'hero · armored knight', frames: 4, build: (frame) => this.art.warden(frame), ppu: 32 },
        { id: 'witch', name: 'Rime Witch', role: 'hero · ice caster', frames: 4, build: (frame) => this.art.witch(frame), ppu: 32 },
        { id: 'ghoulA', name: 'Frost Ghoul', role: 'undead', frames: 4, build: (frame) => this.art.ghoul(frame, 0), ppu: 32 },
        { id: 'ghoulB', name: 'Frost Ghoul (pale)', role: 'undead', frames: 4, build: (frame) => this.art.ghoul(frame, 1), ppu: 32 },
        { id: 'troll', name: 'Rime Troll', role: 'brute', frames: 4, build: (frame) => this.art.troll(frame), ppu: 32 },
      ];
      this.cache = {};
    }
    get(id) {
      if (this.cache[id]) return this.cache[id];
      // ids with no flat sprite (the 3D-only ranger and town workers) fall back to a hero sheet instead of crashing
      const def = this.defs.find((d) => d.id === id) || this.defs.find((d) => d.id === (CharacterLibrary.FALLBACK[id] || 'warden'));
      const frames = [], glows = [];
      for (let f = 0; f < def.frames; f++) { const c = def.build(f); frames.push(c.out); glows.push(c.glow); }
      return (this.cache[id] = Object.assign({}, def, { frames, glows, w: frames[0].w, h: frames[0].h }));
    }
    all() { return this.defs.map((d) => this.get(d.id)); }
  }

  CharacterLibrary.FALLBACK = { ranger: 'warden', cook: 'witch', henwife: 'witch', alchemist: 'witch' };

  Object.assign(K, { CharacterArt, CharacterLibrary });
})(typeof window !== 'undefined' ? window : globalThis);
