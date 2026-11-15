/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · buildings: VoxKit (merged box/quad geometry per material, world-scaled pixel UVs)
   and BuildingMaterials (the pixel-painted material set shared by every building and furniture item). */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const V3 = THREE.Vector3;
  const GB = K.GeometryBuilderW;

  /* box faces: [normal, u axis, v axis] in box-local space; dims picked from (w,h,d) */
  const FACES = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];

  class VoxKit {
    constructor() { this.b = {}; this.xf = new THREE.Matrix4(); this.stack = []; this._m = new THREE.Matrix4(); this._n = new THREE.Matrix3(); this.uvJ = 0; }
    gb(key) { return this.b[key] || (this.b[key] = new GB()); }
    push(m) { this.stack.push(this.xf.clone()); this.xf = this.xf.clone().multiply(m); return this; }
    pop() { this.xf = this.stack.pop() || new THREE.Matrix4(); return this; }
    /* box resting on y (bottom), centred on x,z; uv: 'world' (texel density by size) or 'face' (0..1 per face) */
    box(key, x, y, z, w, h, d, ry = 0, rx = 0, rz = 0, uv = 'world') {
      if (w <= 0 || h <= 0 || d <= 0) return this;
      const m = this._m.compose(new V3(x, y + h / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(1, 1, 1)).premultiply(this.xf);
      this._n.getNormalMatrix(m);
      const g = this.gb(key), half = [w / 2, h / 2, d / 2], dims = [w, h, d];
      const j = K.hash2((x * 97) | 0, (z * 89 + y * 13) | 0, this.uvJ++ & 255), ou = (j * 8) % 1 * 4, ov = ((j * 53) % 1) * 4;
      for (const [nrm, ua, va] of FACES) {
        const ax = (v) => Math.abs(v[0]) ? 0 : Math.abs(v[1]) ? 1 : 2;
        const su = dims[ax(ua)], sv = dims[ax(va)];
        const c = nrm.map((n, k) => n * half[k]);
        const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new V3(c[0] + ua[0] * a * su / 2 + va[0] * b * sv / 2, c[1] + ua[1] * a * su / 2 + va[1] * b * sv / 2, c[2] + ua[2] * a * su / 2 + va[2] * b * sv / 2).applyMatrix4(m));
        const N = new V3(...nrm).applyMatrix3(this._n).normalize();
        const U = uv === 'face' ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[ou, ov], [ou + su, ov], [ou + su, ov + sv], [ou, ov + sv]];
        g.quad(P[0], P[1], P[2], P[3], N, U);
      }
      return this;
    }
    /* raw quad in kit-local space (a,b,c,d as [x,y,z]); normal computed from winding a->b->c; uvs [[u,v]x4] */
    quad(key, a, b, c, d, uvs, flip = false) {
      const P = [a, b, c, d].map((p) => new V3(p[0], p[1], p[2]).applyMatrix4(this.xf));
      const N = new V3().subVectors(P[1], P[0]).cross(new V3().subVectors(P[2], P[0]));
      if (N.lengthSq() < 1e-12) N.subVectors(P[2], P[0]).cross(new V3().subVectors(P[3], P[0]));
      N.normalize(); if (flip) N.negate();
      this.gb(key).quad(P[0], P[1], P[2], P[3], N, uvs || [[0, 0], [1, 0], [1, 1], [0, 1]]);
      return this;
    }
    /* any THREE geometry (cylinders etc.) at x,y,z with rotation; uv scaled by [su,sv] */
    geo(key, geometry, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, su = 1, sv = 1) {
      const m = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz)).premultiply(this.xf);
      this.gb(key).add(geometry, m, (u, v) => [u * su, v * sv]);
      return this;
    }
    keys() { return Object.keys(this.b).filter((k) => this.b[k].count); }
    meshes(mats, { cast = true, receive = true, clone = false } = {}) {
      const out = [];
      for (const k of this.keys()) {
        let mat = mats.get(k); if (!mat) { console.warn('VoxKit: no material for ' + k); continue; }
        if (clone) mat = mat.clone();
        const m = new THREE.Mesh(this.b[k].build(), mat);
        m.castShadow = cast && !mats.noShadow.has(k); m.receiveShadow = receive; m.userData.matKey = k; out.push(m);
      }
      return out;
    }
  }
  VoxKit.CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
  VoxKit.CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);

  /* textures + materials; uses the world renderer's TextureBank so filtering/anisotropy match the diorama */
  class BuildingMaterials {
    constructor(bank, opts = {}) {
      const P = new K.BuildingPainter(opts.seed || 7), TPn = new K.TexturePainter(7), BP = K.BP, TP = K.TP;
      this.painter = P; this.bank = bank; this.map = new Map(); this.noShadow = new Set(['rug', 'window', 'coals', 'flame', 'roofSnow', 'water', 'hanging']);
      const tex = (buf, units, o = {}) => { const t = bank.pixel(buf, Object.assign({ repeat: true }, o)); if (units) t.repeat.set(1 / units[0], 1 / units[1]); return t; };
      const lam = (key, t, o = {}) => this.map.set(key, new THREE.MeshLambertMaterial(Object.assign({ map: t }, o)));
      lam('plaster', tex(P.plaster(), [2, 2])); lam('timber', tex(P.timber(), [1, 1])); lam('ashlar', tex(P.ashlar(), [2, 2]));
      lam('thatch', tex(P.thatch(), [1, 2])); lam('slate', tex(P.slateRoof(), [1, 1])); lam('shingle', tex(P.shingleRoof(), [1, 1]));
      lam('roofSnow', tex(P.roofSnow(), null), { alphaTest: 0.5, side: THREE.DoubleSide });
      lam('snow', tex(TPn.snowCap(), [0.5, 0.5]));
      lam('planks', tex(P.floorBoards(), [1, 1])); lam('flagstone', tex(P.flagstones(), [2, 2])); lam('straw', tex(P.strawFloor(), [1, 1]));
      lam('wood', tex(TPn.planks(32, 32), [1, 1])); lam('crate', tex(TPn.planks(16, 16, true), null));
      lam('iron', tex(TPn.iron(), [0.5, 0.5])); lam('steel', tex(P.metal(BP.steel), [0.5, 0.5])); lam('brass', tex(P.metal(BP.brass), [0.5, 0.5]));
      lam('leather', tex(P.coat(BP.leather), [0.5, 0.5])); lam('cloth', tex(P.blanket(TP.cloth), [1, 1])); lam('clothBlue', tex(P.blanket(BP.blue), [1, 1]));
      lam('linen', tex(P.linen(), [1, 1])); lam('rug', tex(P.rug(), null)); lam('rugBlue', tex(P.rug(BP.blue, TP.cloth), null));
      lam('books', tex(P.books(), [1, 1])); lam('hay', tex(P.hay(), [1, 1])); lam('horse', tex(P.coat(BP.horse), [0.5, 0.5]));
      lam('horseGrey', tex(P.coat(K.ramp('#2c2f38', '#4a4e5a', '#6c717e', '#9095a0', '#b4b8c0', '#d3d6dc')), [0.5, 0.5]));
      lam('mane', tex(P.coat(BP.mane), [0.5, 0.5])); lam('wax', tex(P.coat(BP.wax), [0.5, 0.5])); lam('bread', tex(P.coat(BP.bread), [0.5, 0.5]));
      lam('food', tex(P.coat(BP.food), [0.5, 0.5])); lam('cheese', tex(P.coat(K.ramp('#4a3510', '#8a6620', '#c09a34', '#e2c25a', '#f4dc86')), [0.5, 0.5]));
      lam('green', tex(P.coat(BP.green), [0.5, 0.5])); lam('soot', tex(P.coat(BP.soot), [0.5, 0.5])); lam('bark', tex(TPn.bark(), [0.5, 1]));
      lam('ice', tex(P.coat(TP.ice), [0.5, 0.5]), { emissive: new THREE.Color(0.05, 0.09, 0.13) });
      lam('water', tex(P.coat(BP.water), [0.5, 0.5]), { emissive: new THREE.Color(0.02, 0.05, 0.09) });
      lam('hanging', tex(P.hanging(BP.blue), null, { mips: false, flipY: true }), { alphaTest: 0.5, side: THREE.DoubleSide });
      lam('hangingRed', tex(P.hanging(TP.cloth), null, { mips: false, flipY: true }), { alphaTest: 0.5, side: THREE.DoubleSide });
      // the bright palette: clean colours that read at a glance (signs, painted trim, roofs, goods). Each gets a faint grain so it is not plastic.
      const gc = document.createElement('canvas'); gc.width = gc.height = 16; const gx = gc.getContext('2d'), gd = gx.createImageData(16, 16);
      for (let i = 0; i < 256; i++) { const v = 196 + Math.floor(Math.random() * 59); gd.data.set([v, v, v, 255], i * 4); } gx.putImageData(gd, 0, 0);   // a faint, near-white grain: it keeps the colour clean
      const grain = new THREE.CanvasTexture(gc); grain.magFilter = THREE.NearestFilter; grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(2, 2); grain.colorSpace = THREE.SRGBColorSpace;
      // the castle palette: weathered heraldic colours (oxblood, woad blue, moss, ochre, aged limewash) over stone and dark timber.
      // Every roof uses one slate (roofRed/Blue/Green are aliases of it, below), so the town reads as one castle.
      const PAINT = { paintRed: '#7c2f27', paintBlue: '#35496b', paintGreen: '#4b5a37', paintYellow: '#b08d3e', paintWhite: '#cbc2ae', paintOrange: '#94552c', paintPurple: '#4f3c63',
        whitewash: '#c4bba7', woodLight: '#9c7448', woodMid: '#74502c', woodDark: '#4a3220', roofRed: '#565c66', roofBlue: '#565c66', roofGreen: '#565c66', roofBrown: '#6a4a2e',
        stoneLight: '#aaa597', stoneMid: '#87827a', stoneDark: '#5c5952', gold: '#c4a04a', ironDark: '#36383e', rope: '#a88a5a', canvas: '#c9bea4', wheatGold: '#d2b052',
        leafGreen: '#4a7a3a', waterBlue: '#4a7aa0', meatRed: '#a8443c', eggWhite: '#ece4d2', signBoard: '#7e5a36', potionPink: '#c45a90', potionTeal: '#2ea898', bookRed: '#7a2e2a', bookBlue: '#2c4370' };
      for (const [k, c] of Object.entries(PAINT)) this.map.set(k, new THREE.MeshLambertMaterial({ map: grain, color: new THREE.Color(c) }));
      this.paint = PAINT;
      // one roof for the whole castle: the slate texture, shared by every roof key
      const roof = this.map.get('slate'); if (roof) for (const k of ['roofRed', 'roofBlue', 'roofGreen']) this.map.set(k, roof);
      // emissive parts: colour > 1 feeds the bloom pass
      const basic = (key, t, col) => this.map.set(key, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(col, col * 0.92, col * 0.8) }));
      basic('coals', tex(P.coals(), [0.5, 0.5]), 2.2);
      basic('glowbar', tex(P.coat(K.ramp('#ff6a1a', '#ff9a3a', '#ffd070')), [0.5, 0.5]), 2.6);
      basic('flame', tex(P.coat(K.ramp('#ff9a3a', '#ffc35c', '#ffe9a8')), [0.5, 0.5]), 3.0);
      this.windowTex = tex(P.windowPane(), null);
      basic('window', this.windowTex, 1);
      this.setNight(0);
    }
    get(k) { return this.map.get(k); }
    /* 0 = day (panes read as dim amber glass), 1 = night (panes glow and bloom) */
    setNight(k) {
      this.night = k; const w = this.map.get('window'), a = 0.28 + k * 2.9;
      w.color.setRGB(a, a * 0.85, a * 0.62);
    }
  }

  Object.assign(K, { VoxKit, BuildingMaterials });
})(typeof window !== 'undefined' ? window : globalThis);
