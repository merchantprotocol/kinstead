/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · buildings: the mesh builder (walls with openings, timber framing, roofs with snow, chimneys
   with smoke, floors, furniture, interior lights, glowing windows) and the roof cut-away.
   A building is split into layers so the interior can be revealed:
     base       foundation, floors, wall courses up to CUT_H, door leaves, furniture, chimney foot
     up_n/s/e/w exterior wall courses above CUT_H, grouped by the wall's outward side (hidden when that side faces the camera)
     upIn       interior partition walls above CUT_H (hidden in interior view)
     roof       roof slopes, gable ends, roof snow, icicles (hidden in interior view) */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const V3 = THREE.Vector3;
  const { Footprint, FurnitureFootprint, BuildingLayout } = K;
  const T = K.TILE || 0.5;
  const CUT_H = 0.55;            // wall height left standing in interior view (knee height for 1.5-unit sprites)
  const DOOR_H = 1.5, SILL = 0.8, WIN_TOP = 1.45, PLINTH = 0.3, FLOOR_Y = 0.05;
  const SIDE_OF = (n) => (n[0] < 0 ? 'w' : n[0] > 0 ? 'e' : n[1] < 0 ? 'n' : 's');
  const SIDE_N = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
  const FLOOR_KEY = { planks: 'planks', flagstone: 'flagstone', straw: 'straw' };
  const ROOF_KEY = { thatch: 'thatch', slate: 'slate', shingle: 'shingle' };

  /* ---------- particles: chimney smoke + forge/hearth embers ---------- */
  class SmokeField {
    constructor(sources) {
      const per = 70, n = per * sources.length, p = new Float32Array(n * 3), s = new Float32Array(n), R = new K.RNG(19);
      for (let i = 0; i < n; i++) { const o = sources[(i / per) | 0]; p.set(o, i * 3); s[i] = R.next(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
      this.uni = { uTime: { value: 0 }, uScale: { value: 900 }, uWind: { value: new THREE.Vector2(0.7, -0.25) } };
      this.points = new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: this.uni, transparent: true, depthWrite: false,
        vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; uniform vec2 uWind; varying float vA; varying float vS;
          void main(){ float life=fract(uTime*0.11+seed*7.13); vec3 p=position;
            p.y+=life*3.2; p.x+=uWind.x*life*life*2.2+sin(life*5.0+seed*40.0)*0.18*life; p.z+=uWind.y*life*life*2.2+cos(life*4.0+seed*23.0)*0.15*life;
            vA=smoothstep(0.0,0.08,life)*(1.0-life); vS=seed; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
            gl_PointSize=max(1.0,(0.09+life*0.32)*uScale/-mv.z); }`,
        fragmentShader: `varying float vA; varying float vS; void main(){ vec2 c=abs(gl_PointCoord-0.5); if(max(c.x,c.y)>0.5) discard;
            gl_FragColor=vec4(vec3(0.55,0.58,0.64)*(0.8+vS*0.3), vA*0.42);} `,
      }));
      this.points.frustumCulled = false; this.points.renderOrder = 7;
    }
    update(t, h) { this.uni.uTime.value = t; this.uni.uScale.value = h; }
    dispose() { this.points.geometry.dispose(); this.points.material.dispose(); }
  }
  class EmberField {
    constructor(sources) {
      const n = 40 * sources.length, p = new Float32Array(n * 3), s = new Float32Array(n), R = new K.RNG(8);
      for (let i = 0; i < n; i++) { p.set(sources[i % sources.length], i * 3); s[i] = R.next(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
      this.uni = { uTime: { value: 0 }, uScale: { value: 900 } };
      this.points = new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: this.uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
          void main(){ float life=fract(uTime*0.45+seed*7.13); vec3 p=position; p.y+=life*0.9+0.05; p.x+=sin(life*6.0+seed*30.0)*0.12*life; p.z+=cos(life*5.0+seed*17.0)*0.1*life;
            vA=1.0-life; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0,0.04*uScale/-mv.z); }`,
        fragmentShader: `varying float vA; void main(){ vec2 c=abs(gl_PointCoord-0.5); if(max(c.x,c.y)>0.5) discard; gl_FragColor=vec4(vec3(5.0,1.9,0.5)*vA,1.0);}`,
      }));
      this.points.frustumCulled = false;
    }
    update(t, h) { this.uni.uTime.value = t; this.uni.uScale.value = h; }
    dispose() { this.points.geometry.dispose(); this.points.material.dispose(); }
  }

  /* one fadeable layer of a building */
  class Layer {
    constructor(name, meshes, fadeable) {
      this.name = name; this.group = new THREE.Group(); this.group.name = name; this.meshes = meshes; this.alpha = 1; this.target = 1; this.fadeable = fadeable; this.mode = 'opaque';
      meshes.forEach((m) => { m.userData.cast = m.castShadow; this.group.add(m); });
    }
    step(dt) {
      if (this.alpha === this.target) return;
      const d = dt / 0.35; this.alpha = this.target > this.alpha ? Math.min(this.target, this.alpha + d) : Math.max(this.target, this.alpha - d);
      this.apply();
    }
    snap(a) { this.alpha = this.target = a; this.apply(); }
    apply() {
      const a = this.alpha, mode = a >= 0.999 ? 'opaque' : a <= 0.001 ? 'hidden' : 'fade';
      this.group.visible = mode !== 'hidden';
      for (const m of this.meshes) {
        const mat = m.material;
        if (mode !== this.mode) { mat.transparent = mode === 'fade'; mat.depthWrite = mode !== 'fade'; mat.needsUpdate = true; m.castShadow = mode === 'opaque' && m.userData.cast; }
        mat.opacity = mode === 'fade' ? a : 1;
      }
      this.mode = mode;
    }
    dispose() { this.meshes.forEach((m) => { m.geometry.dispose(); if (this.fadeable) m.material.dispose(); }); }
  }

  class BuildingMesh {
    /* spec: normalized building; ctx: { mats: BuildingMaterials, doc?: WorldDoc, fireTex?: THREE.Texture, catalog? } */
    constructor(spec, ctx) {
      this.spec = spec; this.ctx = ctx; this.catalog = ctx.catalog || K.FURNITURE;
      this.layout = new BuildingLayout(spec, this.catalog);
      this.group = new THREE.Group(); this.group.name = 'building:' + spec.id;
      this.ox = spec.x * T; this.oz = spec.z * T; this.y0 = this.baseHeight();
      this.W = spec.footprint.w * T; this.D = spec.footprint.h * T;
      this.th = spec.walls === 'stone' ? 0.22 : 0.16;
      this.interior = false; this.lights = []; this.fires = []; this.smoke = []; this.embers = []; this.labels = [];
      this.rng = new K.RNG(spec.seed || 1);
      this.kits = {}; this.build();
    }
    baseHeight() {
      const doc = this.ctx.doc; if (!doc) return 0;
      let y = -1e9; for (const [i, j] of Footprint.tiles(this.spec.footprint)) y = Math.max(y, doc.hy(this.spec.x + i, this.spec.z + j));
      return y === -1e9 ? 0 : y;
    }
    kit(name) {
      if (!this.kits[name]) { const k = new K.VoxKit(); k.xf = new THREE.Matrix4().makeTranslation(this.ox, this.y0, this.oz); this.kits[name] = k; }
      return this.kits[name];
    }
    /* local (building) point -> world */
    world(x, y, z) { return [this.ox + x, this.y0 + y, this.oz + z]; }

    /* ---------- build ---------- */
    build() {
      const s = this.spec, L = this.layout;
      this.wallKey = s.walls === 'stone' ? 'ashlar' : 'plaster';
      this.foundation(); this.floors();
      this.segs = L.segments();
      for (const seg of this.segs) this.wall(seg);
      this.corners(); this.roof(); this.furniture(); this.chimneys(); this.snowDrifts();
      const fade = (n) => n !== 'base';
      this.layers = {};
      for (const [name, k] of Object.entries(this.kits)) {
        const layer = new Layer(name, k.meshes(this.ctx.mats, { clone: fade(name) }), fade(name));
        this.layers[name] = layer; this.group.add(layer.group);
      }
      this.kits = null;
      // fires (animated billboards from the world renderer's fire sheet)
      if (this.ctx.fireTex) for (const f of this.fires) {
        const t = this.ctx.fireTex.clone(); t.needsUpdate = true; t.repeat.set(0.25, 1); f.tex = t;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62 * f.s, 0.93 * f.s), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.6, 2.2, 1.9) }));
        m.geometry.translate(0, 0.93 * f.s / 2 - 0.05, 0); m.renderOrder = 6; m.position.set(f.p[0], f.p[1], f.p[2]); this.group.add(m); f.mesh = m;
      }
    }
    /* split a vertical run [y0,y1] at CUT_H between the base layer and `upper` */
    boxSplit(upper, key, x, y0, z, w, h, d, ry = 0) {
      const y1 = y0 + h;
      if (y0 < CUT_H) this.kit('base').box(key, x, y0, z, w, Math.min(y1, CUT_H) - y0, d, ry);
      if (y1 > CUT_H) this.kit(upper).box(key, x, Math.max(y0, CUT_H), z, w, y1 - Math.max(y0, CUT_H), d, ry);
    }
    /* box along a wall segment: a..b along it, offset `off` along the outward normal, thickness th */
    segBox(seg, upper, key, a, b, y0, y1, off, th) {
      if (b - a < 0.005 || y1 - y0 < 0.005) return;
      const n = seg.normal, line = seg.line * T, mid = (a + b) / 2;
      if (seg.axis === 'v') this.boxSplit(upper, key, line + n[0] * off, y0, mid, th, y1 - y0, b - a);
      else this.boxSplit(upper, key, mid, y0, line + n[1] * off, b - a, y1 - y0, th);
    }
    foundation() {
      for (const r of Footprint.rects(this.spec.footprint)) {
        this.kit('base').box('ashlar', (r.x + r.w / 2) * T, -0.6, (r.z + r.h / 2) * T, r.w * T + 0.06, 0.6 + 0.02, r.h * T + 0.06);
      }
    }
    floors() {
      const L = this.layout, s = this.spec;
      for (let j = 0; j < L.H; j++) {
        let i = 0;
        while (i < L.W) {
          const r = L.room(i, j); if (r < 0) { i++; continue; }
          let e = i + 1; while (e < L.W && L.room(e, j) === r) e++;
          const rm = L.rooms[r], fk = FLOOR_KEY[rm.floor || (rm.implicit ? s.interiorFloor : (K.ROOM_TYPES[rm.type] || {}).floor) || s.interiorFloor] || 'planks';
          this.kit('base').box(fk, ((i + e) / 2) * T, -0.04, (j + 0.5) * T, (e - i) * T, FLOOR_Y + 0.04, T);
          i = e;
        }
      }
    }
    wall(seg) {
      const ext = seg.kind === 1, side = ext ? SIDE_OF(seg.normal) : null, upper = ext ? 'up_' + side : 'upIn';
      const th = ext ? this.th : 0.12, off = ext ? -th / 2 : 0, H = this.spec.wallH, walls = this.spec.walls;
      const a0 = seg.s0 * T, a1 = seg.s1 * T;
      // solid pieces between openings
      const ops = seg.openings.map((o) => ({ a: o.s0 * T, b: o.s1 * T, type: o.type }));
      let cur = a0;
      const fill = (a, b) => {
        if (b - a < 0.005) return;
        if (walls !== 'stone' && ext) { this.segBox(seg, 'base', 'ashlar', a, b, 0, PLINTH, off, th + 0.04); this.segBox(seg, upper, this.wallKey, a, b, PLINTH, H, off, th); }
        else this.segBox(seg, upper, ext ? this.wallKey : 'plaster', a, b, 0, H, off, th);
      };
      for (const o of ops) {
        fill(cur, o.a);
        if (o.type === 'door') this.segBox(seg, upper, ext ? this.wallKey : 'plaster', o.a, o.b, DOOR_H, H, off, th);
        else {
          if (walls !== 'stone') { this.segBox(seg, 'base', 'ashlar', o.a, o.b, 0, PLINTH, off, th + 0.04); this.segBox(seg, upper, this.wallKey, o.a, o.b, PLINTH, SILL, off, th); }
          else this.segBox(seg, upper, this.wallKey, o.a, o.b, 0, SILL, off, th);
          this.segBox(seg, upper, this.wallKey, o.a, o.b, WIN_TOP, H, off, th);
        }
        cur = o.b;
      }
      fill(cur, a1);
      // interior partitions: timber top plate + posts at doorways
      if (!ext) {
        this.segBox(seg, upper, 'timber', a0, a1, H - 0.12, H, 0, th + 0.03);
        for (const o of ops) { for (const p of [o.a - 0.04, o.b + 0.04]) this.segBox(seg, upper, 'timber', p - 0.04, p + 0.04, 0, DOOR_H + 0.1, 0, th + 0.04); this.segBox(seg, upper, 'timber', o.a - 0.08, o.b + 0.08, DOOR_H, DOOR_H + 0.1, 0, th + 0.04); }
        return;
      }
      // openings: frames, doors, windows
      for (const o of ops) o.type === 'door' ? this.door(seg, upper, o, th, off) : this.window(seg, upper, o, th, off);
      if (walls === 'timber') this.framing(seg, upper, ops, a0, a1);
      else if (walls === 'plaster') { this.segBox(seg, upper, 'timber', a0, a1, H - 0.12, H, 0.005, 0.06); }
    }
    door(seg, upper, o, th, off) {
      const fr = this.spec.walls === 'stone' ? 'ashlar' : 'timber';
      for (const p of [o.a - 0.05, o.b + 0.05]) this.segBox(seg, upper, fr, p - 0.05, p + 0.05, 0, DOOR_H, off, th + 0.06);
      this.segBox(seg, upper, 'timber', o.a - 0.1, o.b + 0.1, DOOR_H, DOOR_H + 0.12, off, th + 0.07);
      this.segBox(seg, 'base', 'ashlar', o.a, o.b, -0.02, 0.06, 0.12, 0.26);   // stone step outside
      if (this.spec.noDoorLeaves) return;   // the game draws (and animates) its own door leaf for this building
      // door leaf, hinged at o.a, swung open into the building
      const n = seg.normal, w = o.b - o.a - 0.04, ang = 1.25;
      const k = this.kit('base');
      const hx = seg.axis === 'v' ? seg.line * T - n[0] * th : o.a + 0.02, hz = seg.axis === 'v' ? o.a + 0.02 : seg.line * T - n[1] * th;
      const along = seg.axis === 'v' ? [0, 1] : [1, 0], inward = [-n[0], -n[1]];
      const dirx = along[0] * Math.cos(ang) + inward[0] * Math.sin(ang), dirz = along[1] * Math.cos(ang) + inward[1] * Math.sin(ang);
      const ry = Math.atan2(-dirz, dirx);
      k.box('wood', hx + dirx * w / 2, FLOOR_Y, hz + dirz * w / 2, w, DOOR_H - 0.08, 0.06, ry);
      k.box('iron', hx + dirx * w * 0.2, FLOOR_Y + 0.3, hz + dirz * w * 0.2, w * 0.35, 0.05, 0.075, ry); k.box('iron', hx + dirx * w * 0.2, FLOOR_Y + 1.1, hz + dirz * w * 0.2, w * 0.35, 0.05, 0.075, ry);
      k.box('brass', hx + dirx * w * 0.85, FLOOR_Y + 0.7, hz + dirz * w * 0.85, 0.05, 0.08, 0.09, ry);
    }
    window(seg, upper, o, th, off) {
      const k = this.kit(upper), n = seg.normal;
      this.segBox(seg, upper, 'timber', o.a - 0.06, o.b + 0.06, SILL - 0.05, SILL, off + 0.03, th + 0.1);
      this.segBox(seg, upper, 'snow', o.a - 0.04, o.b + 0.04, SILL, SILL + 0.04, 0.06, 0.08);
      this.segBox(seg, upper, 'timber', o.a - 0.06, o.b + 0.06, WIN_TOP, WIN_TOP + 0.08, off, th + 0.05);
      for (const p of [o.a - 0.03, o.b + 0.03]) this.segBox(seg, upper, 'timber', p - 0.03, p + 0.03, SILL, WIN_TOP, off, th + 0.05);
      // glowing pane in the middle of the wall, visible from both sides
      const line = seg.line * T + n[0] * off + n[1] * off, y0 = SILL, y1 = WIN_TOP, a = o.a, b = o.b, uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
      if (seg.axis === 'v') { k.quad('window', [line, y0, a], [line, y0, b], [line, y1, b], [line, y1, a], uv); k.quad('window', [line, y0, b], [line, y0, a], [line, y1, a], [line, y1, b], uv); }
      else { k.quad('window', [a, y0, line], [b, y0, line], [b, y1, line], [a, y1, line], uv); k.quad('window', [b, y0, line], [a, y0, line], [a, y1, line], [b, y1, line], uv); }
      // open shutters on timber/plaster houses
      if (this.spec.walls !== 'stone') { const w = (o.b - o.a) / 2; this.segBox(seg, upper, 'wood', o.a - 0.06 - w, o.a - 0.06, SILL + 0.02, WIN_TOP - 0.02, 0.03, 0.04); this.segBox(seg, upper, 'wood', o.b + 0.06, o.b + 0.06 + w, SILL + 0.02, WIN_TOP - 0.02, 0.03, 0.04); }
    }
    framing(seg, upper, ops, a0, a1) {
      const H = this.spec.wallH, off = 0.02, d = 0.05;
      const posts = [];
      for (const o of ops) { posts.push(o.a - 0.05 - (o.type === 'window' ? 0.03 : 0)); posts.push(o.b + 0.05 + (o.type === 'window' ? 0.03 : 0)); }
      const all = [a0, ...posts, a1].sort((p, q) => p - q), fill = [];
      for (let i = 0; i + 1 < all.length; i++) { const gap = all[i + 1] - all[i], n = Math.floor(gap / 1.0); for (let k = 1; k <= n; k++) if (gap / (n + 1) > 0.45) fill.push(all[i] + (gap * k) / (n + 1)); }
      const allPosts = posts.concat(fill).filter((p) => p > a0 + 0.1 && p < a1 - 0.1);
      for (const p of allPosts) this.segBox(seg, upper, 'timber', p - 0.05, p + 0.05, PLINTH, H, off, d);
      this.segBox(seg, upper, 'timber', a0, a1, PLINTH, PLINTH + 0.1, off, d + 0.01);
      this.segBox(seg, upper, 'timber', a0, a1, H - 0.12, H, off, d + 0.01);
      const inOp = (p) => ops.some((o) => p > o.a - 0.06 && p < o.b + 0.06), doorAt = (p) => ops.some((o) => o.type === 'door' && p > o.a - 0.06 && p < o.b + 0.06);
      // rails at the sill and lintel lines, broken by doors
      const rail = (y) => { let s = a0; const brk = ops.filter((o) => o.type === 'door').sort((p, q) => p.a - q.a); for (const o of brk) { this.segBox(seg, upper, 'timber', s, o.a - 0.1, y, y + 0.08, off, d); s = o.b + 0.1; } this.segBox(seg, upper, 'timber', s, a1, y, y + 0.08, off, d); };
      rail(SILL - 0.06); rail(WIN_TOP);
      // diagonal braces in plain panels (upper courses only)
      const sorted = [a0, ...allPosts, a1].sort((p, q) => p - q);
      for (let i = 0; i + 1 < sorted.length; i++) {
        const a = sorted[i] + 0.06, b = sorted[i + 1] - 0.06, mid = (a + b) / 2; if (b - a < 0.3 || inOp(mid) || doorAt(a) || doorAt(b)) continue;
        const flip = i % 2 ? 1 : -1, y0 = WIN_TOP + 0.08, y1 = H - 0.12, len = Math.hypot(b - a, y1 - y0), ang = Math.atan2(y1 - y0, b - a) * flip;
        const n = seg.normal, line = seg.line * T, k = this.kit(upper), cy = (y0 + y1) / 2 - len / 2;
        const c = new THREE.Matrix4();
        if (seg.axis === 'v') { c.makeTranslation(line + n[0] * off, (y0 + y1) / 2, mid).multiply(new THREE.Matrix4().makeRotationX(-ang)); k.push(c); k.box('timber', 0, -0.04, 0, d, 0.08, len); k.pop(); }
        else { c.makeTranslation(mid, (y0 + y1) / 2, line + n[1] * off).multiply(new THREE.Matrix4().makeRotationZ(ang)); k.push(c); k.box('timber', 0, -0.04, 0, len, 0.08, d); k.pop(); }
        void cy;
      }
    }
    corners() {
      const map = new Map(), H = this.spec.wallH;
      for (const seg of this.segs) {
        if (seg.kind !== 1) continue;
        const ends = seg.axis === 'v' ? [[seg.line, seg.s0], [seg.line, seg.s1]] : [[seg.s0, seg.line], [seg.s1, seg.line]];
        for (const [x, z] of ends) { const key = x + ',' + z; if (!map.has(key)) map.set(key, []); map.get(key).push(seg); }
      }
      for (const [key, segs] of map) {
        if (segs.length < 2) continue;
        const [x, z] = key.split(',').map(Number), n = [0, 0];
        for (const s of segs) { n[0] += s.normal[0]; n[1] += s.normal[1]; }
        const th = this.th, cx = x * T - n[0] * th / 2, cz = z * T - n[1] * th / 2, sz = th + (this.spec.walls === 'timber' ? 0.1 : 0.08);
        const side = SIDE_OF(Math.abs(segs[0].normal[1]) ? segs[0].normal : segs[1].normal);
        const key2 = this.spec.walls === 'timber' ? 'timber' : 'ashlar';
        if (this.spec.walls !== 'stone') this.boxSplit('base', 'ashlar', cx, 0, cz, sz + 0.04, PLINTH, sz + 0.04);
        this.boxSplit('up_' + side, key2, cx, this.spec.walls !== 'stone' ? PLINTH : 0, cz, sz, H - (this.spec.walls !== 'stone' ? PLINTH : 0) + 0.04, sz);
      }
    }

    /* ---------- roofs ---------- */
    roof() {
      const s = this.spec, rects = Footprint.rects(s.footprint), r = s.roof, H = s.wallH;
      const main = rects[0], alongX0 = main.w >= main.h;
      this.roofInfo = [];
      rects.forEach((rc, idx) => {
        let x0 = rc.x * T, z0 = rc.z * T, x1 = (rc.x + rc.w) * T, z1 = (rc.z + rc.h) * T, alongX = idx === 0 ? alongX0 : !alongX0;
        const ends = { lo: true, hi: true };
        if (idx > 0) {   // wing: run its ridge into the main roof, up to the main ridge line
          const mx = (main.x + main.w / 2) * T, mz = (main.z + main.h / 2) * T;
          if (alongX) { if (x1 <= main.x * T + 1e-6) { x1 = mx; ends.hi = false; } else { x0 = mx; ends.lo = false; } }
          else { if (z1 <= main.z * T + 1e-6) { z1 = mz; ends.hi = false; } else { z0 = mz; ends.lo = false; } }
        }
        this.roofRect(x0, z0, x1, z1, alongX, r, H, ends);
      });
    }
    /* canonical roof: ridge along local X (length L), span along local Z (S) */
    roofRect(x0, z0, x1, z1, alongX, r, H, ends) {
      const k = this.kit('roof'), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const L = alongX ? x1 - x0 : z1 - z0, S = alongX ? z1 - z0 : x1 - x0;
      const ov = 0.26, slope = 0.55 + r.pitch * 0.75, rise = (S / 2) * slope, top = H + rise, eaveY = H - ov * slope;
      const t = r.material === 'thatch' ? 0.2 : 0.07, key = ROOF_KEY[r.material], hip = r.style === 'hip';
      const e0 = ends.lo ? ov : 0, e1 = ends.hi ? ov : 0;
      const xa = -L / 2 - e0, xb = L / 2 + e1, ze = S / 2 + ov;
      const rl = hip ? Math.max(0, L / 2 - S / 2) : L / 2;   // ridge half-length (hip ends pull it in)
      const ra = ends.lo ? -rl : xa, rb = ends.hi ? rl : xb;
      k.push(new THREE.Matrix4().makeTranslation(cx, 0, cz).multiply(new THREE.Matrix4().makeRotationY(alongX ? 0 : Math.PI / 2)));
      const slopeLen = Math.hypot(ze, top - eaveY);
      const P = (x, y, z) => [x, y, z];
      // the two long slopes (trapezoids for hip, rectangles for gable)
      for (const sz of [1, -1]) {
        const eA = P(xa, eaveY, sz * ze), eB = P(xb, eaveY, sz * ze), rB = P(hip ? rb : xb, top, 0), rA = P(hip ? ra : xa, top, 0);
        const uv = [[xa, 0], [xb, 0], [hip ? rb : xb, slopeLen], [hip ? ra : xa, slopeLen]];
        const quad = (pts, key2, uvs, dy) => k.quad(key2, ...pts.map((p) => [p[0], p[1] + dy, p[2]]), uvs, false);
        const ordered = sz > 0 ? [eA, eB, rB, rA] : [eB, eA, rA, rB], uvO = sz > 0 ? uv : [uv[1], uv[0], uv[3], uv[2]];
        quad(ordered, key, uvO, 0);
        quad(ordered.slice().reverse(), 'timber', uvO.slice().reverse(), -t);                     // soffit
        k.quad(key, [eA[0], eaveY - t, eA[2]], [eB[0], eaveY - t, eB[2]], [eB[0], eaveY, eB[2]], [eA[0], eaveY, eA[2]], [[xa, 0], [xb, 0], [xb, t], [xa, t]], sz < 0);   // eave edge
        if (r.snow) {
          const nY = 0.035, ju = this.rng.next(), uvS = [[ju + xa / 4, 0], [ju + xb / 4, 0], [ju + (hip ? rb : xb) / 4, 1], [ju + (hip ? ra : xa) / 4, 1]];
          quad(ordered, 'roofSnow', sz > 0 ? uvS : [uvS[1], uvS[0], uvS[3], uvS[2]], nY);
          // chunky snow lumps and icicles along the eave
          for (let x = xa + 0.15; x < xb - 0.1; x += 0.22 + this.rng.next() * 0.3) {
            if (this.rng.chance(0.55)) k.box('snow', x, eaveY - 0.01, sz * (ze - 0.08), 0.18 + this.rng.next() * 0.25, 0.06 + this.rng.next() * 0.05, 0.16, 0, sz * 0.5);
            if (this.rng.chance(0.4)) k.box('ice', x, eaveY - t - 0.05 - this.rng.next() * 0.14, sz * (ze - 0.01), 0.025, 0.08 + this.rng.next() * 0.16, 0.025);
          }
        }
      }
      // ends: hip triangles or gable walls with a verge
      for (const ex of [-1, 1]) {
        const open = ex < 0 ? ends.lo : ends.hi; if (!open) continue;
        const xe = ex < 0 ? xa : xb, xr = ex < 0 ? ra : rb, xw = ex * L / 2;
        if (hip) {
          const a = P(xe, eaveY, -ze), b = P(xe, eaveY, ze), c = P(xr, top, 0), sl = Math.hypot(Math.abs(xe - xr), top - eaveY);
          const tri = ex > 0 ? [a, c, c, b] : [b, c, c, a], uvT = ex > 0 ? [[-ze, 0], [0, sl], [0, sl], [ze, 0]] : [[ze, 0], [0, sl], [0, sl], [-ze, 0]];
          k.quad(key, ...tri, uvT); k.quad('timber', ...tri.slice().reverse().map((p) => [p[0], p[1] - t, p[2]]), uvT.slice().reverse());
          k.quad(key, [xe, eaveY - t, -ze], [xe, eaveY - t, ze], [xe, eaveY, ze], [xe, eaveY, -ze], [[-ze, 0], [ze, 0], [ze, t], [-ze, t]], ex < 0);
          if (r.snow) k.quad('roofSnow', ...tri.map((p) => [p[0] + ex * 0.03, p[1] + 0.03, p[2]]), [[0, 0], [0.5, 1], [0.5, 1], [1, 0]]);
        } else {
          const wk = this.spec.walls === 'stone' ? 'ashlar' : 'plaster', tri = [[xw, H, -S / 2], [xw, H, S / 2], [xw, H + rise, 0], [xw, H + rise, 0]];
          const uvG = [[-S / 2, H], [S / 2, H], [0, H + rise], [0, H + rise]];
          const pts = (dx) => tri.map((p) => [p[0] + dx, p[1], p[2]]);
          if (ex > 0) { k.quad(wk, ...pts(0).reverse(), uvG.slice().reverse()); k.quad(wk, ...pts(-this.th), uvG); }
          else { k.quad(wk, ...pts(0), uvG); k.quad(wk, ...pts(this.th).reverse(), uvG.slice().reverse()); }
          if (this.spec.walls === 'timber') {
            k.box('timber', xw + ex * 0.025, H, 0, 0.05, rise * 0.8, 0.1);
            k.box('timber', xw + ex * 0.025, H + rise * 0.42, 0, 0.05, 0.08, S * 0.55);
            k.box('timber', xw + ex * 0.025, H - 0.02, 0, 0.05, 0.1, S);
          }
          // verge boards along the rake
          for (const sz of [-1, 1]) {
            const len = Math.hypot(ze, top - eaveY), ang = Math.atan2(top - eaveY, ze);
            k.push(new THREE.Matrix4().makeTranslation(xe, (top + eaveY) / 2 - t / 2, sz * ze / 2).multiply(new THREE.Matrix4().makeRotationX(sz * ang)));
            k.box('timber', 0, -0.05, 0, 0.06, t + 0.08, len); if (r.snow) k.box('snow', 0, t / 2 + 0.03, 0, 0.12, 0.06, len);
            k.pop();
          }
        }
      }
      // ridge cap + snow
      const ra2 = hip ? ra : xa, rb2 = hip ? rb : xb;
      if (rb2 - ra2 > 0.01) { k.box(r.material === 'thatch' ? 'thatch' : 'timber', (ra2 + rb2) / 2, top - 0.04, 0, rb2 - ra2 + 0.04, 0.1, 0.22); if (r.snow) k.box('snow', (ra2 + rb2) / 2, top + 0.04, 0, rb2 - ra2, 0.09, 0.3); }
      else if (r.snow) k.box('snow', ra2, top - 0.02, 0, 0.3, 0.1, 0.3);
      k.pop();
      this.roofInfo.push({ x0, z0, x1, z1, alongX, top, eaveY, rise, H });
    }
    /* roof surface height above a local point (for chimneys) */
    roofY(x, z) {
      let y = this.spec.wallH;
      for (const r of this.roofInfo) {
        if (x < r.x0 - 0.3 || x > r.x1 + 0.3 || z < r.z0 - 0.3 || z > r.z1 + 0.3) continue;
        const d = r.alongX ? Math.abs(z - (r.z0 + r.z1) / 2) : Math.abs(x - (r.x0 + r.x1) / 2), half = r.alongX ? (r.z1 - r.z0) / 2 : (r.x1 - r.x0) / 2;
        y = Math.max(y, r.H + r.rise * (1 - Math.min(1, d / half)));
      }
      return y;
    }

    /* ---------- furniture ---------- */
    fxf(f, def) {
      const [w, d] = FurnitureFootprint.size(def, f.rot);
      return new THREE.Matrix4().makeTranslation((f.x + w / 2) * T, FLOOR_Y, (f.z + d / 2) * T).multiply(new THREE.Matrix4().makeRotationY(f.rot * Math.PI / 2));
    }
    furniture() {
      const base = this.kit('base');
      for (const f of this.spec.furniture) {
        const def = this.catalog[f.type]; if (!def || !def.build) continue;
        if (f.state && f.state.away) continue;          // e.g. a horse that is out being ridden
        const m = this.fxf(f, def);
        base.push(m); try { def.build(base, f, def); } catch (e) { console.warn('furniture ' + f.type + ' failed', e); } base.pop();
        const toW = (p) => { const v = new V3(p[0], p[1], p[2]).applyMatrix4(m); return this.world(v.x, v.y, v.z); };
        const dy = def.dyn || {};
        if (dy.fire) this.fires.push({ p: toW(dy.fire), s: dy.fire[3], ph: this.rng.next() * 9 });
        if (dy.light) { const p = toW(dy.light); this.lights.push({ x: p[0], y: p[1], z: p[2], color: 0xff8a3c, base: 12 * dy.light[3], dist: 6.5 * dy.light[3] + 1.5, ph: this.rng.next() * 9, fire: true, building: this.spec.id }); }
        if (dy.embers) this.embers.push(toW(dy.embers));
        for (const c of dy.candles || []) { const p = toW(c); this.lights.push({ x: p[0], y: p[1], z: p[2], color: 0xffb466, base: 2.6, dist: 3.2, ph: this.rng.next() * 9, fire: true, candle: true, building: this.spec.id }); }
        const [w, d] = FurnitureFootprint.size(def, f.rot), c = this.world((f.x + w / 2) * T, 0, (f.z + d / 2) * T);
        this.labels.push({ id: f.id, type: f.type, name: def.name, interact: def.interact || null, x: c[0], y: c[1] + 1.1, z: c[2], tile: [this.spec.x + f.x, this.spec.z + f.z], building: this.spec.id });
      }
    }
    chimneys() {
      const L = this.layout, H = this.spec.wallH;
      for (const f of this.spec.furniture) {
        const def = this.catalog[f.type]; if (!def || !def.chimney) continue;
        const back = ['n', 'e', 's', 'w'][[0, 3, 2, 1][f.rot]];
        const [w, d] = FurnitureFootprint.size(def, f.rot), n = SIDE_N[back];
        // is the back edge an exterior wall?
        const ti = back === 'e' ? f.x + w - 1 : f.x, tj = back === 's' ? f.z + d - 1 : f.z, e = L.edge(ti, tj, back);
        if (!e || e.kind !== 1) continue;
        const cx = back === 'n' || back === 's' ? (f.x + w / 2) * T : (back === 'e' ? (f.x + w) * T : f.x * T);
        const cz = back === 'n' || back === 's' ? (back === 's' ? (f.z + d) * T : f.z * T) : (f.z + d / 2) * T;
        const px = cx + n[0] * 0.24, pz = cz + n[1] * 0.24, top = this.roofY(px, pz) + 0.55, side = 'up_' + back;
        const sw = back === 'n' || back === 's' ? 0.66 : 0.5, sd = back === 'n' || back === 's' ? 0.5 : 0.66;
        this.boxSplit(side, 'ashlar', px, -0.1, pz, sw, top + 0.1, sd);
        this.kit(side).box('ashlar', px, top, pz, sw + 0.1, 0.1, sd + 0.1); this.kit(side).box('soot', px, top + 0.1, pz, sw - 0.14, 0.02, sd - 0.14);
        this.kit(side).box('snow', px - 0.12, top + 0.1, pz, 0.24, 0.05, sd + 0.04);
        this.smoke.push(this.world(px, top + 0.15, pz));
      }
    }
    snowDrifts() {
      const k = this.kit('base');
      for (const seg of this.segs) {
        if (seg.kind !== 1) continue;
        const n = seg.normal;
        for (let s = seg.s0 * T + 0.1; s < seg.s1 * T - 0.1; s += 0.18 + this.rng.next() * 0.3) {
          if (seg.openings.some((o) => o.type === 'door' && s > o.s0 * T - 0.25 && s < o.s1 * T + 0.25) || !this.rng.chance(0.6)) continue;
          const h = 0.05 + this.rng.next() * 0.12, w = 0.2 + this.rng.next() * 0.3, dd = 0.12 + this.rng.next() * 0.16, off = 0.04 + dd / 2;
          if (seg.axis === 'v') k.box('snow', seg.line * T + n[0] * off, 0, s, dd, h, w); else k.box('snow', s, 0, seg.line * T + n[1] * off, w, h, dd);
        }
      }
    }

    /* ---------- interior view ---------- */
    get center() { return new V3(this.ox + this.W / 2, this.y0, this.oz + this.D / 2); }
    /* on: show the interior (roof + camera-facing upper walls fade out). opts: { roomId?, tile?:[worldI,worldJ], snap? }
       returns a CameraRig goal { tx, ty, tz, dist, pitch } framing the room (or the whole building) */
    setInterior(on, opts = {}) {
      this.interior = !!on;
      if (opts.camera) this.camera = opts.camera;
      this.updateCut(opts.snap);
      return on ? this.cameraHint(opts) : this.cameraHint({ exterior: true });
    }
    cameraHint(opts = {}) {
      let rm = null;
      if (opts.roomId) rm = this.layout.rooms.find((r) => r.id === opts.roomId);
      else if (opts.tile) rm = this.layout.roomAt(opts.tile[0] - this.spec.x, opts.tile[1] - this.spec.z);
      if (opts.exterior || !rm || rm.implicit) {
        const c = this.center, span = Math.max(this.W, this.D);
        return { tx: c.x, ty: this.y0 + 0.4, tz: c.z, dist: Math.max(9, span * 2.1 + 3), pitch: opts.exterior ? 0.72 : 0.98 };
      }
      const c = this.world((rm.x + rm.w / 2) * T, 0, (rm.z + rm.h / 2) * T), span = Math.max(rm.w, rm.h) * T;
      return { tx: c[0], ty: this.y0 + 0.4, tz: c[2], dist: Math.max(7, Math.min(16, span * 2.6 + 3.5)), pitch: 1.0 };
    }
    /* which upper wall sides face the camera (those are cut in interior view) */
    updateCut(snap) {
      const cam = this.camera, c = this.center;
      let vx = 0, vz = 1;
      if (cam) { vx = cam.position.x - c.x; vz = cam.position.z - c.z; const l = Math.hypot(vx, vz) || 1; vx /= l; vz /= l; }
      for (const [name, layer] of Object.entries(this.layers)) {
        let a = 1;
        if (this.interior) {
          if (name === 'roof' || name === 'upIn') a = 0;
          else if (name.startsWith('up_')) { const n = SIDE_N[name.slice(3)]; a = n[0] * vx + n[1] * vz > -0.15 ? 0 : 1; }
        }
        if (snap) layer.snap(a); else layer.target = a;
      }
    }
    update(t, dt, camera, yaw) {
      if (camera) this.camera = camera;
      if (this.interior) this.updateCut(false);
      for (const l of Object.values(this.layers)) l.step(dt);
      for (const f of this.fires) if (f.mesh) { f.tex.offset.x = (Math.floor(t * 9 + f.ph) % 4) * 0.25; f.mesh.rotation.y = yaw || 0; }
    }
    containsTile(i, j) { return Footprint.inside(this.spec.footprint, i - this.spec.x, j - this.spec.z); }
    get roofAlpha() { return this.layers.roof ? this.layers.roof.alpha : 1; }
    dispose() { Object.values(this.layers).forEach((l) => l.dispose()); this.fires.forEach((f) => { if (f.mesh) { f.mesh.geometry.dispose(); f.mesh.material.dispose(); f.tex.dispose(); } }); }
  }

  /* ---------- all buildings of a world: meshes, lights, particles, tile queries ---------- */
  class BuildingSet {
    constructor(ctx) { this.ctx = ctx; this.group = new THREE.Group(); this.group.name = 'buildings'; this.list = []; this.byId = new Map(); this.tileMap = new Map(); this.smoke = null; this.embers = null; this.inside = null; }
    /* rebuild from building specs (normalized or raw); reuses nothing (buildings are cheap: ~10 ms each) */
    setBuildings(specs, doc) {
      this.clear(); if (doc) this.ctx.doc = doc;
      for (const raw of specs) {
        const spec = K.BuildingSpec.normalize(raw), b = new BuildingMesh(spec, this.ctx);
        this.list.push(b); this.byId.set(spec.id, b); this.group.add(b.group);
        for (const [i, j] of Footprint.tiles(spec.footprint)) this.tileMap.set((spec.x + i) + ',' + (spec.z + j), b);
      }
      const smoke = this.list.flatMap((b) => b.smoke), emb = this.list.flatMap((b) => b.embers);
      if (smoke.length) { this.smoke = new SmokeField(smoke); this.group.add(this.smoke.points); }
      if (emb.length) { this.embers = new EmberField(emb); this.group.add(this.embers.points); }
      return this;
    }
    clear() {
      this.list.forEach((b) => { this.group.remove(b.group); b.dispose(); });
      for (const p of [this.smoke, this.embers]) if (p) { this.group.remove(p.points); p.dispose(); }
      this.list = []; this.byId.clear(); this.tileMap.clear(); this.smoke = this.embers = null; this.inside = null;
    }
    get(id) { return this.byId.get(id) || null; }
    at(i, j) { return this.tileMap.get(i + ',' + j) || null; }
    roomAt(i, j) { const b = this.at(i, j); return b ? b.layout.roomAt(i - b.spec.x, j - b.spec.z) : null; }
    /* floor height for actors standing inside (null outside buildings) */
    floorY(i, j) { const b = this.at(i, j); return b ? b.y0 + FLOOR_Y : null; }
    walkable(i, j) { const b = this.at(i, j); return !b || b.layout.walkable(i - b.spec.x, j - b.spec.z); }
    /* 4-neighbour step between world tiles, honouring walls, doors and solid furniture */
    canStep(i0, j0, i1, j1) {
      const a = this.at(i0, j0), b = this.at(i1, j1);
      for (const B of new Set([a, b])) if (B && !B.layout.canStep(i0 - B.spec.x, j0 - B.spec.z, i1 - B.spec.x, j1 - B.spec.z)) return false;
      return true;
    }
    /* exterior door tiles: inside tile, outside tile, side */
    doorTiles() {
      const out = [];
      for (const b of this.list) for (const d of b.layout.doors) {
        if (d.kind !== 'exterior') continue;
        const n = SIDE_N[d.side];
        for (const [i, j] of d.tiles) out.push({ building: b.spec.id, side: d.side, inside: [b.spec.x + i, b.spec.z + j], outside: [b.spec.x + i + n[0], b.spec.z + j + n[1]] });
      }
      return out;
    }
    /* furniture the player at tile (i,j) can use: standing on its front tile or next to its footprint */
    interactablesNear(i, j) {
      const b = this.at(i, j); if (!b) return [];
      const li = i - b.spec.x, lj = j - b.spec.z, out = [];
      for (const f of b.spec.furniture) {
        const def = b.catalog[f.type]; if (!def || !def.interact) continue;
        const [fi, fj] = FurnitureFootprint.front(def, f);
        const near = (fi === li && fj === lj) || FurnitureFootprint.tiles(def, f).some(([x, z]) => Math.abs(x - li) + Math.abs(z - lj) === 1);
        if (near) out.push({ building: b.spec.id, furniture: f, def, interact: def.interact, front: [b.spec.x + fi, b.spec.z + fj] });
      }
      return out;
    }
    /* call when the followed actor changes tile; toggles the roof cut-away. Returns { changed, building, room, hint } */
    actorTile(i, j, camera) {
      const b = this.at(i, j), prev = this.inside;
      if (b === prev) return { changed: false, building: b, room: b ? this.roomAt(i, j) : null, hint: null };
      if (prev) prev.setInterior(false, { camera });
      this.inside = b;
      const hint = b ? b.setInterior(true, { camera, tile: [i, j] }) : prev ? prev.cameraHint({ exterior: true }) : null;
      return { changed: true, building: b, room: b ? this.roomAt(i, j) : null, hint };
    }
    /* light sources in WorldRenderer.lightSrc format; buildings you are not inside glow dimmer (light leaks through walls otherwise) */
    lightSources() {
      const out = [];
      for (const b of this.list) for (const l of b.lights) out.push(Object.assign({}, l, { base: l.base * (b.interior || b.roofAlpha < 0.99 ? 1 : 0.3) }));
      return out;
    }
    setNight(k) { this.ctx.mats.setNight(k); }
    update(t, dt, camera, viewH) {
      const d = new V3(); camera.getWorldDirection(d); const yaw = Math.atan2(-d.x, -d.z);
      for (const b of this.list) b.update(t, dt, camera, yaw);
      if (this.smoke) this.smoke.update(t, viewH); if (this.embers) this.embers.update(t, viewH);
    }
    labels() { return this.list.flatMap((b) => b.labels); }
    /* one-line hookup for K.WorldRenderer: adds the group, feeds building lights into the shared light pool every frame */
    attach(R) {
      R.scene.add(this.group); this.R = R;
      const upd = R.update.bind(R), self = this;
      R.update = function (t, camera, viewH, target, dist, pitch) {
        // dt from the app clock (so stepped/test time also drives the roof fades), clamped for frame hitches
        const dt = self._lastT != null ? Math.max(0, Math.min(0.1, t - self._lastT)) : 0.016; self._lastT = t;
        self.update(t, dt, camera, viewH);
        const base = this.lightSrc.filter((s) => !s.building);
        this.lightSrc = base.concat(self.lightSources());
        return upd(t, camera, viewH, target, dist, pitch);
      };
      return this;
    }
  }

  Object.assign(K, { BuildingMesh, BuildingSet, BuildingLayer: Layer, SmokeField, BuildingEmbers: EmberField, BUILDING_CUT_H: CUT_H, BUILDING_FLOOR_Y: FLOOR_Y });
})(typeof window !== 'undefined' ? window : globalThis);
