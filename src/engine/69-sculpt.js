/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · sculpting helpers for the Asset Lab models (src/models/<id>.js).
   Shapes          voxel primitives and building parts that draw into a KV.VoxelPart: bevelled boxes,
                   cylinders / cones, gable (wedge) roofs, log walls and log stacks, stone walls with mortar,
                   shingle / slate rows, a snow cap that drapes the top surfaces and hangs icicles off eaves,
                   a rocky snowy base patch, mirroring and seeded mottled paints.
   Palette         reads a reference image: dominant colours (k-means), point samples, nearest swatch.
   ColourProjector paints the voxels a camera sees with the reference image's colours (a first-pass fill),
                   and round-trips that paint as a compact string a model file can keep and refine.
   Coordinates are voxels (y up, front = +z). Every paint argument is a colour [r,g,b(,glow)] or a
   function (x, y, z) -> colour. Shapes never allocate THREE objects, so they also run in node tests. */
(function (G) {
  const K = (G.K = G.K || {}), KV = G.KV, { Hash, VoxelPart } = KV;
  const ink = (paint, x, y, z) => (typeof paint === 'function' ? paint(x, y, z) : paint);
  const AX = { x: 0, y: 1, z: 2 };

  /* smooth 2D/3D value noise in [0, 1) for lumps and edge wobble */
  class Noise {
    static s(t) { return t * t * (3 - 2 * t); }
    static n2(x, y, scale = 4, seed = 0) {
      const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy), tx = Noise.s(fx - ix), ty = Noise.s(fy - iy);
      const h = (a, b) => Hash.h3(a, b, 0, seed);
      const a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * tx, b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * tx;
      return a + (b - a) * ty;
    }
  }

  class Shapes {
    /* weighted pick among colours, stable per voxel: mottle([[c, weight], ...], seed) */
    static mottle(pairs, seed = 1) {
      const tot = pairs.reduce((s, p) => s + p[1], 0);
      return (x, y, z) => { let r = Hash.h3(x, y, z, seed) * tot; for (const [c, w] of pairs) { if ((r -= w) <= 0) return c; } return pairs[0][0]; };
    }
    /* palette shorthand: hexes -> { name: linear colour }; names ending in '*' become emissive (glow 2.2) */
    static palette(o) { const p = {}; for (const k in o) p[k.replace('*', '')] = k.endsWith('*') ? KV.Colour.glow(o[k]) : KV.Colour.hex(o[k]); return p; }
    static noise2(x, y, scale, seed) { return Noise.n2(x, y, scale, seed); }

    static box(p, x0, x1, y0, y1, z0, z1, paint) { return p.box(x0, x1, y0, y1, z0, z1, paint); }
    /* box with every edge chamfered by r voxels (45 degree bevel) */
    static bevelBox(p, x0, x1, y0, y1, z0, z1, r, paint) {
      return p.fill(x0, x1, y0, y1, z0, z1, (x, y, z) => {
        const dx = Math.max(0, x0 + r - x, x - (x1 - r)), dy = Math.max(0, y0 + r - y, y - (y1 - r)), dz = Math.max(0, z0 + r - z, z - (z1 - r));
        return dx + dy <= r && dy + dz <= r && dx + dz <= r;
      }, paint);
    }
    /* cylinder / frustum / cone along an axis: { axis: 'x'|'y'|'z', at: [c1, c2] (the other two coords in x,y,z order),
       from, to (along the axis), r0, r1 (radius at from / to; r for both) } */
    static cylinder(p, o, paint) {
      const a = AX[o.axis || 'y'], b = (a + 1) % 3, c = (a + 2) % 3, r0 = o.r0 != null ? o.r0 : o.r, r1 = o.r1 != null ? o.r1 : o.r;
      const [cb, cc] = a === 1 ? [o.at[1], o.at[0]] : o.at;   // at is given in x,y,z order minus the axis
      const lo = Math.min(o.from, o.to), hi = Math.max(o.from, o.to), R = Math.max(r0, r1), q = [0, 0, 0];
      for (let t = Math.ceil(lo); t <= Math.floor(hi); t++) {
        const k = hi === lo ? 0 : (t - o.from) / (o.to - o.from), r = r0 + (r1 - r0) * k + 0.45;
        for (let i = Math.floor(cb - R - 1); i <= Math.ceil(cb + R + 1); i++) for (let j = Math.floor(cc - R - 1); j <= Math.ceil(cc + R + 1); j++) {
          if ((i - cb) ** 2 + (j - cc) ** 2 > r * r) continue;
          q[a] = t; q[b] = i; q[c] = j; const col = ink(paint, q[0], q[1], q[2]); if (col) p.set(q[0], q[1], q[2], col);
        }
      }
      return p;
    }
    static cone(p, o, paint) { return Shapes.cylinder(p, Object.assign({}, o, { r0: o.r, r1: 0 }), paint); }

    /* gable (wedge) roof. o: { x0, x1, z0, z1 (the walls it covers), y (eave height), rise (ridge above eave),
       thick, overhang, ridge: 'x' | 'z' } -> { top(x, z): roof surface y or null, eaveY } */
    static gableRoof(p, o, paint) {
      const oh = o.overhang == null ? 2 : o.overhang, th = o.thick || 2, alongX = (o.ridge || 'x') === 'x';
      const a0 = (alongX ? o.x0 : o.z0) - (o.gableOverhang != null ? o.gableOverhang : oh), a1 = (alongX ? o.x1 : o.z1) + (o.gableOverhang != null ? o.gableOverhang : oh);
      const s0 = (alongX ? o.z0 : o.x0) - oh, s1 = (alongX ? o.z1 : o.x1) + oh, mid = ((alongX ? o.z0 : o.x0) + (alongX ? o.z1 : o.x1)) / 2;
      const half = ((alongX ? o.z1 : o.x1) - (alongX ? o.z0 : o.x0)) / 2 + 0.5, slope = o.rise / half;
      const surf = (s) => o.y + o.rise - Math.abs(s - mid) * slope;
      for (let a = a0; a <= a1; a++) for (let s = s0; s <= s1; s++) {
        const top = Math.round(surf(s));
        for (let y = top - th + 1; y <= top; y++) { const x = alongX ? a : s, z = alongX ? s : a; const c = ink(paint, x, y, z); if (c) p.set(x, y, z, c); }
      }
      return {
        top: (x, z) => { const a = alongX ? x : z, s = alongX ? z : x; return a < a0 || a > a1 || s < s0 || s > s1 ? null : Math.round(surf(s)); },
        rowOf: (x, z) => Math.floor(Math.abs((alongX ? z : x) - mid)), mid, slope, a0, a1, s0, s1, alongX, eaveY: Math.round(surf(s0)),
      };
    }
    static wedgeRoof(p, o, paint) { return Shapes.gableRoof(p, o, paint); }
    /* shingle / slate rows on a roof's top surface: recolours the top `depth` voxels of each roof column by row
       (counted from the ridge), staggering tiles across the row and darkening each row's lower lip */
    static shingleRows(p, roof, o) {
      const rowH = o.rowH || 2, tileW = o.tileW || 3, paints = o.paints, lip = o.lip, depth = o.depth || 1;
      for (let a = roof.a0; a <= roof.a1; a++) for (let s = roof.s0; s <= roof.s1; s++) {
        const x = roof.alongX ? a : s, z = roof.alongX ? s : a, top = roof.top(x, z); if (top == null) continue;
        const d = Math.abs(s - roof.mid), row = Math.floor(d / rowH), inRow = d - row * rowH;
        const tile = Math.floor((a + (row % 2) * tileW / 2) / tileW);
        const pc = paints[Math.floor(Hash.h3(tile, row, 0, o.seed || 3) * paints.length)];
        for (let k = 0; k < depth; k++) {
          const y = top - k; if (!p.has(x, y, z)) continue;
          const c = lip && inRow >= rowH - 1 ? lip : (((a + (row % 2) * tileW / 2) % tileW + tileW) % tileW) < 1 && o.seam ? o.seam : pc;
          p.set(x, y, z, ink(c, x, y, z));
        }
      }
      return p;
    }

    /* a wall of horizontal logs. o: { axis: 'x'|'z' (log direction), from, to, at (the wall's plane coord),
       y0, y1, r (log radius), ends (extra length past from/to), chink (colour between logs) } */
    static logWall(p, o, bark, endPaint) {
      const r = o.r || 2, step = o.step || 2 * r, ax = o.axis || 'x';
      let i = 0;
      for (let yc = o.y0 + r; yc - r <= o.y1; yc += step, i++) {
        const e0 = o.from - (o.ends || 0) - (i % 2 ? 0 : (o.stagger || 0)), e1 = o.to + (o.ends || 0) + (i % 2 ? 0 : (o.stagger || 0));
        const at = ax === 'x' ? [yc, o.at] : [o.at, yc];
        Shapes.cylinder(p, { axis: ax, at, from: e0, to: e1, r }, (x, y, z) => {
          if (y > o.y1) return null;
          const along = ax === 'x' ? x : z;
          if (endPaint && (along <= e0 || along >= e1)) return ink(endPaint, x, y, z);
          return ink(bark, x, y, z);
        });
        if (o.chink) { const yy = yc + r; if (yy <= o.y1) for (let t = o.from; t <= o.to; t++) { const x = ax === 'x' ? t : o.at, z = ax === 'x' ? o.at : t; p.set(x, yy, z, ink(o.chink, x, yy, z)); } }
      }
      return p;
    }
    /* a pyramid of cut logs lying along `axis`, end grain showing rings. o: { axis, x, y, z (front-bottom-left corner
       of the stack, the logs run from z to z + len for axis 'z'), len, rows, r } ; ring: [heart, ring, sap] colours */
    static logStack(p, o, bark, ring) {
      const r = o.r || 2, ax = o.axis || 'z', d = 2 * r + (o.gap || 0);
      for (let row = 0; row < o.rows; row++) {
        const n = (o.perRow || o.rows) - row;
        for (let k = 0; k < n; k++) {
          const c1 = (ax === 'x' ? o.z : o.x) + r + k * d + row * r, yc = o.y + r + row * (2 * r - 1);
          const jit = Math.round((Hash.h3(row, k, 0, o.seed || 7) - 0.5) * (o.jitter || 0));
          const from = (ax === 'x' ? o.x : o.z) + jit, to = from + o.len - 1;
          const at = ax === 'x' ? [yc, c1] : [c1, yc];
          Shapes.cylinder(p, { axis: ax, at, from, to, r }, (x, y, z) => {
            const along = ax === 'x' ? x : z;
            if (along === from || along === to) {
              const dd = Math.hypot(y - yc, (ax === 'x' ? z : x) - c1) / (r + 0.45);
              return dd > 0.82 ? ink(bark, x, y, z) : ink(ring[Math.min(ring.length - 1, Math.floor(dd / 0.82 * ring.length))], x, y, z);
            }
            return ink(bark, x, y, z);
          });
        }
      }
      return p;
    }

    /* a stone wall block with running-bond courses; mortar joints are recessed one voxel on the outer shell.
       o: { x0..z1, course (stone height), stone (stone length), inset (bool, default true) }; stones: [colour | fn] */
    static stoneWall(p, o, stones, mortar) {
      const ch = o.course || 3, sw = o.stone || 5, seed = o.seed || 11;
      p.box(o.x0, o.x1, o.y0, o.y1, o.z0, o.z1, (x, y, z) => {
        const row = Math.floor((y - o.y0) / ch), h = x + z + (row % 2) * Math.floor(sw / 2) + Math.floor(Hash.h3(row, 0, 0, seed) * sw);
        const jointY = (y - o.y0) % ch === ch - 1, jointH = ((h % sw) + sw) % sw === 0;
        if (jointY || jointH) return mortar;
        const cell = Math.floor(h / sw);
        return ink(stones[Math.floor(Hash.h3(cell, row, 0, seed + 1) * stones.length)], x, y, z);
      });
      if (o.inset !== false) {
        const shell = (x, y, z) => x === o.x0 || x === o.x1 || z === o.z0 || z === o.z1;
        p.carve((x, y, z) => x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1 && z >= o.z0 && z <= o.z1 && shell(x, y, z) && p.get(x, y, z) === mortar && y !== o.y1);
      }
      return p;
    }

    /* drape snow over every top surface. o: { depth: [min, max], paint, seed, test(x, y, z) -> bool (which tops get snow),
       lip (extend 1 voxel down exposed edges), icicles: { chance, len: [min, max], paint } } -> number of icicles */
    static snowCap(p, o) {
      const tops = new Map(), dmin = (o.depth || [1, 2])[0], dmax = (o.depth || [1, 2])[1], seed = o.seed || 21;
      for (const k of p.vox.keys()) { const [x, y, z] = VoxelPart.unkey(k); const c = x * 4096 + z; const t = tops.get(c); if (t == null || y > t) tops.set(c, y); }
      const added = [];
      for (const [c, y] of tops) {
        const x = Math.round(c / 4096), z = c - x * 4096;
        if (o.test && !o.test(x, y, z)) continue;
        const n = Noise.n2(x, z, o.scale || 3.5, seed), th = Math.round(dmin + n * (dmax - dmin) + (Hash.h3(x, y, z, seed + 1) < (o.lumps || 0.08) ? 1 : 0));
        for (let k = 1; k <= th; k++) { p.set(x, y + k, z, ink(o.paint, x, y + k, z)); added.push([x, y + k, z]); }
      }
      if (o.lip) for (const [x, y, z] of added) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!p.has(x + dx, y - 1, z + dz) && !p.has(x + dx, y, z + dz) && p.has(x, y - 1, z) && Hash.h3(x, y, z + dx * 7 + dz, seed + 2) < o.lip) p.set(x + dx, y - 1, z + dz, ink(o.paint, x + dx, y - 1, z + dz));
      }
      let n = 0;
      if (o.icicles) {
        const ic = o.icicles, [l0, l1] = ic.len || [2, 5];
        for (const [c, y] of tops) {
          const x = Math.round(c / 4096), z = c - x * 4096;
          if (o.test && !o.test(x, y, z)) continue;
          // an eave: the voxel under the top is open air and the column below is clear for a few voxels
          if (p.has(x, y - 1, z) || p.has(x, y - 2, z)) continue;
          if (Hash.h3(x, y, z, seed + 3) > (ic.chance || 0.3)) continue;
          const L = l0 + Math.floor(Hash.h3(x, y, z, seed + 4) * (l1 - l0 + 1));
          for (let k = 1; k <= L && !p.has(x, y - k - 1, z); k++) p.set(x, y - k, z, ink(ic.paint, x, y - k, z));
          n++;
        }
      }
      return n;
    }

    /* irregular rocky base patch with a snowy top (the plinth under every Grok item).
       o: { cx, cz, rx, rz, y0, h, wobble, seed }; side / top paints; snow chance per top voxel */
    static basePatch(p, o, side, top) {
      const seed = o.seed || 31, wob = o.wobble == null ? 0.18 : o.wobble;
      for (let x = Math.floor(o.cx - o.rx - 3); x <= Math.ceil(o.cx + o.rx + 3); x++) for (let z = Math.floor(o.cz - o.rz - 3); z <= Math.ceil(o.cz + o.rz + 3); z++) {
        const a = (x - o.cx) / o.rx, b = (z - o.cz) / o.rz, rr = o.square ? Math.max(Math.abs(a), Math.abs(b)) : Math.hypot(a, b);
        const lim = 1 + (Noise.n2(x, z, 3, seed) - 0.5) * wob * 2; if (rr > lim) continue;
        const edge = lim - rr, hh = Math.max(1, Math.round(o.h - (edge < 0.12 ? Math.round(Hash.h3(x, 0, z, seed + 1) * 2) : 0)));
        for (let y = o.y0; y < o.y0 + hh; y++) p.set(x, y, z, ink(y === o.y0 + hh - 1 ? top : side, x, y, z));
      }
      return p;
    }
    /* copy every voxel with x on one side of the plane x = cx to the other side (characters are symmetric) */
    static mirrorX(p, cx = 0, fromNeg = true) {
      for (const [k, c] of [...p.vox]) { const [x, y, z] = VoxelPart.unkey(k); if (fromNeg ? x < cx : x > cx) p.set(Math.round(2 * cx - x), y, z, c); }
      return p;
    }
    /* stamp a bitmap (rows[0] = top) onto whatever surface faces direction dir ('+z','-z','+x','-x') */
    static stamp(p, rows, inks, x0, yTop, dir = '+z', mirror = false) {
      if (dir === '+z' || dir === '-z') return p.stamp(rows, inks, x0, yTop, dir === '+z' ? 1 : -1, mirror);
      return p.stampSide(rows, inks, x0, yTop, dir === '+x' ? 1 : -1);
    }
  }

  /* ---------------- reference palette (browser only) ---------------- */
  class Palette {
    static pixels(img, w = 256) {
      const h = Math.round(w * (img.naturalHeight || img.height) / (img.naturalWidth || img.width));
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h);
    }
    static hex(rgb) { return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
    /* dominant colours of the opaque pixels: [{ hex, share }] largest first (k-means, deterministic seeds) */
    static dominant(data, k = 12, iters = 10) {
      const px = []; for (let i = 0; i < data.data.length; i += 4) if (data.data[i + 3] > 200) px.push([data.data[i], data.data[i + 1], data.data[i + 2]]);
      if (!px.length) return [];
      px.sort((a, b) => (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11) - (b[0] * 0.3 + b[1] * 0.59 + b[2] * 0.11));
      let C = Array.from({ length: k }, (_, i) => px[Math.floor((i + 0.5) / k * px.length)].slice()), as = new Int32Array(px.length);
      for (let it = 0; it < iters; it++) {
        const S = C.map(() => [0, 0, 0, 0]);
        px.forEach((p, i) => { let best = 0, bd = 1e9; C.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = j; } }); as[i] = best; const s = S[best]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
        C = C.map((c, j) => (S[j][3] ? [S[j][0] / S[j][3], S[j][1] / S[j][3], S[j][2] / S[j][3]] : c));
      }
      const n = new Array(k).fill(0); as.forEach((a) => n[a]++);
      return C.map((c, j) => ({ hex: Palette.hex(c), share: n[j] / px.length })).filter((s) => s.share > 0).sort((a, b) => b.share - a.share);
    }
    /* average colour of a (2r+1)^2 window around (x, y) in image pixels */
    static sample(data, x, y, r = 2) {
      const s = [0, 0, 0]; let n = 0;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const xx = Math.round(x + i), yy = Math.round(y + j); if (xx < 0 || yy < 0 || xx >= data.width || yy >= data.height) continue;
        const o = (yy * data.width + xx) * 4; if (data.data[o + 3] < 128) continue; s[0] += data.data[o]; s[1] += data.data[o + 1]; s[2] += data.data[o + 2]; n++;
      }
      return n ? Palette.hex(s.map((v) => v / n)) : null;
    }
    static srgbToLinear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    /* nearest colour (linear [r,g,b]) in a list of linear colours */
    static nearest(list, c) { let best = 0, bd = 1e9; list.forEach((q, i) => { const d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2; if (d < bd) { bd = d; best = i; } }); return best; }
  }

  /* ---------------- reference colour projection ---------------- */
  class ColourProjector {
    /* paint the voxels the camera sees with the image colour under them.
       o: { image: ImageData of the reference as framed in the view, camera (THREE camera matching the reference),
            matrix (THREE.Matrix4: voxel coords -> world, e.g. group.matrixWorld x the model's voxel scale/origin),
            palette (optional list of linear colours to snap to), minAlpha } -> number of voxels painted */
    static project(part, o) {
      const THREE = G.THREE, img = o.image, W = img.width, H = img.height, v = new THREE.Vector3(), cells = 2;
      const GW = Math.ceil(W / cells), GH = Math.ceil(H / cells), depth = new Float32Array(GW * GH).fill(Infinity);
      const surf = [];
      for (const [k] of part.vox) {
        const [x, y, z] = VoxelPart.unkey(k);
        if (part.has(x + 1, y, z) && part.has(x - 1, y, z) && part.has(x, y + 1, z) && part.has(x, y - 1, z) && part.has(x, y, z + 1) && part.has(x, y, z - 1)) continue;
        v.set(x + 0.5, y + 0.5, z + 0.5).applyMatrix4(o.matrix).project(o.camera);
        const px = (v.x + 1) / 2 * W, py = (1 - v.y) / 2 * H; if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const ci = Math.floor(py / cells) * GW + Math.floor(px / cells); if (v.z < depth[ci]) depth[ci] = v.z;
        surf.push([k, px, py, v.z, ci]);
      }
      const eps = o.eps || 0.0015; let n = 0;
      for (const [k, px, py, z, ci] of surf) {
        if (z > depth[ci] + eps) continue;
        const i = (Math.floor(py) * W + Math.floor(px)) * 4; if (img.data[i + 3] < (o.minAlpha || 160)) continue;
        let c = [Palette.srgbToLinear(img.data[i]), Palette.srgbToLinear(img.data[i + 1]), Palette.srgbToLinear(img.data[i + 2])];
        if (o.palette) c = o.palette[Palette.nearest(o.palette, c)];
        part.vox.set(k, c); n++;
      }
      return n;
    }
    /* the part's paint as a compact string over a palette (runs of "<count><letter>", '.' = colour not in the palette, kept as is) */
    static encode(part, palette) {
      const keys = [...part.vox.keys()].sort((a, b) => a - b), CH = ColourProjector.CH;
      let out = '', last = null, run = 0;
      const flush = () => { if (run) out += (run > 1 ? run : '') + last; };
      for (const k of keys) { const c = part.vox.get(k), i = palette.findIndex((q) => q === c || (q[0] === c[0] && q[1] === c[1] && q[2] === c[2])); const ch = i >= 0 && i < CH.length ? CH[i] : '.'; if (ch === last) run++; else { flush(); last = ch; run = 1; } }
      flush(); return out;
    }
    /* apply an encode() string back onto the same voxel shape (voxels are matched in key order) */
    static decode(part, str, palette) {
      const keys = [...part.vox.keys()].sort((a, b) => a - b), CH = ColourProjector.CH;
      let i = 0; const re = /(\d*)([a-zA-Z.])/g; let m;
      while ((m = re.exec(str)) && i < keys.length) {
        let cnt = m[1] ? +m[1] : 1, ch = m[2];
        for (let r = 0; r < cnt && i < keys.length; r++, i++) { const idx = CH.indexOf(ch); if (idx >= 0 && palette[idx]) part.vox.set(keys[i], palette[idx]); }
      }
      return i;
    }
  }

  ColourProjector.CH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';   // up to 52 swatches; counts are digits

  K.Shapes = Shapes; K.Palette = Palette; K.ColourProjector = ColourProjector; K.SculptNoise = Noise;
})(typeof window !== 'undefined' ? window : globalThis);
