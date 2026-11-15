/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { CH, PPU, GeometryBuilderW: GeometryBuilder, PropBuilder, TextureBank, M4, UNIT } = K;
  const { TILE, HQ, T, WorldDoc } = K;
  class SpriteActor {
    constructor(sprite, bank, opts = {}) {
      this.sprite = sprite; this.frame = 0; this.phase = opts.phase || 0; this.flip = !!opts.flip;
      const nF = sprite.frames.length, W = sprite.w, H = sprite.h;
      const sheet = new K.PixelBuffer(W * nF, H), gsheet = new K.PixelBuffer(W * nF, H);
      sprite.frames.forEach((f, i) => sheet.blit(f, i * W, 0)); sprite.glows.forEach((f, i) => gsheet.blit(f, i * W, 0));
      this.map = bank.pixel(sheet, { mips: false, flipY: true }); this.map.repeat.set(1 / nF * (this.flip ? -1 : 1), 1);
      this.gmap = bank.pixel(gsheet, { mips: false, flipY: true }); this.gmap.repeat.copy(this.map.repeat);
      if (this.flip) { this.map.wrapS = this.gmap.wrapS = THREE.RepeatWrapping; }
      const w = W / sprite.ppu, h = H / sprite.ppu;
      const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2 - (opts.sink || 1 / sprite.ppu), 0);
      const nrm = geo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 0.42, 0.91);
      this.mat = new THREE.MeshLambertMaterial({ map: this.map, alphaTest: 0.5, emissive: new THREE.Color(0.2, 0.22, 0.27), emissiveMap: this.map });
      this.mesh = new THREE.Mesh(geo, this.mat); this.mesh.castShadow = true;
      this.mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.map, alphaTest: 0.5 });
      this.glowMat = new THREE.MeshBasicMaterial({ map: this.gmap, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(3.2, 3.2, 3.2) });
      this.glow = new THREE.Mesh(geo, this.glowMat); this.glow.position.z = 0.012; this.glow.renderOrder = 5;
      this.group = new THREE.Group(); this.group.add(this.mesh, this.glow);
      // pixelated blob shadow
      this.group.position.set(opts.x, opts.y, opts.z);
      this.shadow = SpriteActor.blob(bank, w * 0.75);
      this.shadow.position.set(opts.x, opts.y + 0.015, opts.z);
      this.setFrame(0);
    }
    static blob(bank, size) {
      const b = new K.PixelBuffer(16, 8);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x + 0.5 - 8) / 8, (y + 0.5 - 4) / 4);
        if (d < 1) b.set(x, y, [8, 10, 18], d < 0.6 ? 150 : 90);
      }
      const t = bank.pixel(b, { mips: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, color: 0xffffff }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 2;
      return m;
    }
    setFrame(f) {
      const nF = this.sprite.frames.length; this.frame = f % nF;
      const off = this.flip ? (this.frame + 1) / nF : this.frame / nF;
      this.map.offset.x = off; this.gmap.offset.x = off;
    }
    update(t, yaw) {
      this.setFrame(Math.floor(t * 6 + this.phase));
      this.group.rotation.y = yaw;
    }
  }


  /* falling snow that wraps around the camera target, so any world size is covered */
  class SnowField {
    constructor(count) {
      const R = new K.RNG(5), p = new Float32Array(count * 3), s = new Float32Array(count);
      for (let i = 0; i < count; i++) { p[i * 3] = R.range(0, 44); p[i * 3 + 1] = R.range(0, 22); p[i * 3 + 2] = R.range(0, 44); s[i] = R.next(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
      this.uni = { uTime: { value: 0 }, uC: { value: new THREE.Vector3() }, uScale: { value: 900 } };
      const m = new THREE.ShaderMaterial({
        uniforms: this.uni, transparent: false, depthWrite: true,
        vertexShader: `attribute float seed; uniform float uTime; uniform vec3 uC; uniform float uScale; varying float vS;
          void main(){ vec3 p=position; float sp=0.55+seed*0.6;
            p.y = uC.y - 10.0 + mod(p.y - uTime*sp - uC.y, 22.0);
            p.x += sin(uTime*0.7+seed*40.0)*0.35 + uTime*0.18; p.z += cos(uTime*0.5+seed*20.0)*0.25;
            p.x = uC.x - 22.0 + mod(p.x - uC.x + 22.0, 44.0); p.z = uC.z - 22.0 + mod(p.z - uC.z + 22.0, 44.0);
            vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; vS=seed;
            gl_PointSize = max(1.0, (0.035+seed*0.03)*uScale/-mv.z); }`,
        fragmentShader: `varying float vS; void main(){ vec2 c=abs(gl_PointCoord-0.5); if(max(c.x,c.y)>0.5) discard; gl_FragColor=vec4(vec3(0.85,0.9,1.0)*(0.9+vS*0.4),1.0);}`,
      });
      this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
    }
    update(t, h, c) { this.uni.uTime.value = t; this.uni.uScale.value = h * 1.05; this.uni.uC.value.copy(c); }
  }
  class EmberField {
    constructor(sources) {
      const n = 60 * sources.length, p = new Float32Array(n * 3), s = new Float32Array(n);
      const R = new K.RNG(8);
      for (let i = 0; i < n; i++) { const o = sources[i % sources.length]; p[i * 3] = o[0]; p[i * 3 + 1] = o[1]; p[i * 3 + 2] = o[2]; s[i] = R.next(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
      this.uni = { uTime: { value: 0 }, uScale: { value: 900 } };
      this.points = new THREE.Points(g, new THREE.ShaderMaterial({
        uniforms: this.uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute float seed; uniform float uTime; uniform float uScale; varying float vA;
          void main(){ float life=fract(uTime*0.35+seed*7.13); vec3 p=position; p.y+=life*2.2+0.2; p.x+=sin(life*6.0+seed*30.0)*0.25*life; p.z+=cos(life*5.0+seed*17.0)*0.2*life;
            vA=1.0-life; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0,0.05*uScale/-mv.z); }`,
        fragmentShader: `varying float vA; void main(){ vec2 c=abs(gl_PointCoord-0.5); if(max(c.x,c.y)>0.5) discard; gl_FragColor=vec4(vec3(5.0,1.9,0.5)*vA,1.0);}`,
      }));
      this.points.frustumCulled = false;
    }
    update(t, h) { this.uni.uTime.value = t; this.uni.uScale.value = h; }
  }

  /* paints ground bands on worker threads (same painter code, run from this file's own source) */
  class PaintPool {
    constructor() {
      this.jobs = new Map(); this.seq = 1; this.workers = []; this.busy = 0;
      if (G.KINSTEAD_NO_WORKERS) return;
      try {
        const src = '(' + G.KPaintModules.toString() + ')();\n' +
          'const P = new K.GroundPainter(7);\n' +
          'onmessage = (e) => { const m = e.data, d = new K.WorldDoc(m.w, m.h); d.terrain = m.terrain; d.height = m.height;\n' +
          '  const [i0, j0, i1, j1] = m.rect, tp = K.TILE * m.ppu, W = (i1 - i0) * tp, H = (j1 - j0) * tp;\n' +
          '  const out = new K.PixelBuffer(W, H), spark = new K.PixelBuffer(W, H);\n' +
          '  P.paint(d, out, spark, i0, j0, i0, j0, i1, j1, m.ppu);\n' +
          '  postMessage({ id: m.id, data: out.data, sdata: spark.data }, [out.data.buffer, spark.data.buffer]); };';
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        const n = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
        for (let i = 0; i < n; i++) {
          const w = new Worker(url); w.onmessage = (e) => this.done(e.data); w.onerror = (e) => { console.warn('paint worker failed; painting on the main thread', e.message); this.workers = []; };
          w.free = true; this.workers.push(w);
        }
      } catch (e) { console.warn('paint workers unavailable; painting on the main thread', e); this.workers = []; }
    }
    get ok() { return this.workers.length > 0; }
    get idle() { return this.workers.some((w) => w.free); }
    send(job, doc) {
      const w = this.workers.find((x) => x.free); if (!w) return false;
      job.id = this.seq++; job.worker = w; w.free = false; this.jobs.set(job.id, job);
      w.postMessage({ id: job.id, w: doc.w, h: doc.h, terrain: doc.terrain.slice(), height: doc.height.slice(), rect: job.rect, ppu: PPU });
      return true;
    }
    done(m) { const job = this.jobs.get(m.id); if (!job) return; this.jobs.delete(m.id); job.worker.free = true; job.cb(m); }
    cancelAll() { for (const j of this.jobs.values()) j.cb = () => {}; }
  }

  /* one 32x32-tile block of the world: ground texture + terrain mesh + merged prop meshes */
  class Chunk {
    constructor(R, ci, cj) {
      const doc = R.doc;
      this.R = R; this.ci = ci; this.cj = cj; this.i0 = ci * CH; this.j0 = cj * CH;
      this.i1 = Math.min(doc.w, this.i0 + CH); this.j1 = Math.min(doc.h, this.j0 + CH);
      const tw = (this.i1 - this.i0) * TILE * PPU, th = (this.j1 - this.j0) * TILE * PPU;
      const buf = new K.PixelBuffer(tw, th), spark = new K.PixelBuffer(tw, th);
      buf.fill(K.TP.snow[3]); spark.fill([0, 0, 0]);
      this.canvas = R.bank.canvasOf(buf); this.scanvas = R.bank.canvasOf(spark);
      this.ctx = this.canvas.getContext('2d'); this.sctx = this.scanvas.getContext('2d');
      this.tex = R.bank.texOf(this.canvas); this.stex = R.bank.texOf(this.scanvas, { srgb: false, mips: false });
      this.mat = R.makeTopMaterial(this.tex, this.stex);
      this.group = new THREE.Group(); R.scene.add(this.group);
      this.terrain = []; this.props = [];
      this.dirtyT = new Uint8Array((this.i1 - this.i0) * (this.j1 - this.j0)); this.ver = new Uint32Array(this.dirtyT.length); this.nDirty = 0; this.inflight = 0; this.flying = new Set();
      this.geoDirty = true; this.propsDirty = true; this.painted = false; this.sig = '';
    }
    queuePaint(i0, j0, i1, j1) {
      i0 = Math.max(this.i0, i0); j0 = Math.max(this.j0, j0); i1 = Math.min(this.i1, i1); j1 = Math.min(this.j1, j1);
      if (i0 >= i1 || j0 >= j1) return;
      const cw = this.i1 - this.i0;
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const q = (j - this.j0) * cw + (i - this.i0); this.dirtyT[q] = 1; this.ver[q]++; }
      this.nDirty = 1;
    }
    get paintQueue() { return this.nDirty ? [1] : []; }
    /* take the next band of dirty tiles (up to 4 rows, only the dirty x-range) */
    nextBand(rows) {
      if (!this.nDirty) return null;
      const cw = this.i1 - this.i0, chh = this.j1 - this.j0, D = this.dirtyT;
      let r = -1;
      for (let jj = 0; jj < chh && r < 0; jj++) for (let ii = 0; ii < cw; ii++) if (D[jj * cw + ii]) { r = jj; break; }
      if (r < 0) { this.nDirty = 0; return null; }
      let a = cw, b = -1; const r1 = Math.min(chh, r + rows);
      for (let jj = r; jj < r1; jj++) for (let ii = 0; ii < cw; ii++) if (D[jj * cw + ii]) { a = Math.min(a, ii); b = Math.max(b, ii); D[jj * cw + ii] = 0; }
      const rect = [this.i0 + a, this.j0 + r, this.i0 + b + 1, this.j0 + r1], vers = [];
      for (let j = rect[1]; j < rect[3]; j++) for (let i = rect[0]; i < rect[2]; i++) vers.push(this.ver[(j - this.j0) * cw + (i - this.i0)]);
      return { rect, vers };
    }
    /* copy a painted band into the chunk canvases, skipping tiles that were edited again since it was sent */
    blit(band, data, sdata) {
      const [i0, j0, i1, j1] = band.rect, tp = TILE * PPU, W = (i1 - i0) * tp, H = (j1 - j0) * tp, cw = this.i1 - this.i0;
      const img = new ImageData(new Uint8ClampedArray(data.buffer || data), W, H), simg = new ImageData(new Uint8ClampedArray(sdata.buffer || sdata), W, H);
      const ox = (i0 - this.i0) * tp, oy = (j0 - this.j0) * tp;
      let q = 0, stale = 0;
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++, q++) if (this.ver[(j - this.j0) * cw + (i - this.i0)] !== band.vers[q]) stale++;
      if (!stale) { this.ctx.putImageData(img, ox, oy); this.sctx.putImageData(simg, ox, oy); }
      else {
        q = 0;
        for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++, q++) {
          if (this.ver[(j - this.j0) * cw + (i - this.i0)] !== band.vers[q]) continue;
          const dx = (i - i0) * tp, dy = (j - j0) * tp;
          this.ctx.putImageData(img, ox, oy, dx, dy, tp, tp); this.sctx.putImageData(simg, ox, oy, dx, dy, tp, tp);
        }
      }
      this.texDirty = true; this.R.lastBlitAt = performance.now();
    }
    paintStep(pool) {
      const R = this.R;
      if (pool && pool.ok) {
        if (!pool.idle) return false;
        const band = this.nextBand(4); if (!band) return false;
        band.cb = (m) => { if (!this.flying.delete(band)) return; this.inflight--; if (!this.disposed) { this.blit(band, m.data, m.sdata); R.pumpPaint(); } };
        this.inflight++; this.flying.add(band); pool.send(band, R.doc); return true;
      }
      const band = this.nextBand(2); if (!band) return false;
      const [i0, j0, i1, j1] = band.rect, tp = TILE * PPU, W = (i1 - i0) * tp, H = (j1 - j0) * tp;
      const out = new K.PixelBuffer(W, H), spark = new K.PixelBuffer(W, H);
      R.painter.paint(R.doc, out, spark, i0, j0, i0, j0, i1, j1, PPU);
      this.blit(band, out.data, spark.data);
      return true;
    }
    flushTex() { if (this.texDirty) { this.tex.needsUpdate = true; this.stex.needsUpdate = true; this.texDirty = false; } }
    clear(list) { list.forEach((m) => { this.group.remove(m); m.geometry.dispose(); }); list.length = 0; }
    buildTerrain() {
      const doc = this.R.doc, R = this.R; this.clear(this.terrain);
      const top = new GeometryBuilder(), cliff = new GeometryBuilder(), rock = new GeometryBuilder();
      const up = new V3(0, 1, 0), cw = (this.i1 - this.i0) * TILE, cd = (this.j1 - this.j0) * TILE, X0 = this.i0 * TILE, Z0 = this.j0 * TILE;
      const uv = (x, z) => [(x - X0) / cw, (z - Z0) / cd];
      const sides = [[1, 0, new V3(1, 0, 0)], [-1, 0, new V3(-1, 0, 0)], [0, 1, new V3(0, 0, 1)], [0, -1, new V3(0, 0, -1)]];
      for (let j = this.j0; j < this.j1; j++) {
        // merge horizontal runs of equal height into one top quad (keeps vertex counts low on big plateaus)
        let i = this.i0;
        while (i < this.i1) {
          const y = doc.hy(i, j); let e = i + 1; while (e < this.i1 && doc.hy(e, j) === y) e++;
          const x0 = i * TILE, x1 = e * TILE, z0 = j * TILE, z1 = z0 + TILE;
          top.quad(new V3(x0, y, z0), new V3(x0, y, z1), new V3(x1, y, z1), new V3(x1, y, z0), up, [uv(x0, z0), uv(x0, z1), uv(x1, z1), uv(x1, z0)]);
          i = e;
        }
        for (let i2 = this.i0; i2 < this.i1; i2++) {
          const y = doc.hy(i2, j), x0 = i2 * TILE, z0 = j * TILE, x1 = x0 + TILE, z1 = z0 + TILE;
          for (const [di, dj, nrm] of sides) {
            const yn = doc.hy(i2 + di, j + dj); if (yn >= y) continue;
            let ax, az, bx, bz;
            if (di === 1) { ax = x1; az = z0; bx = x1; bz = z1; } else if (di === -1) { ax = x0; az = z1; bx = x0; bz = z0; }
            else if (dj === 1) { ax = x1; az = z1; bx = x0; bz = z1; } else { ax = x0; az = z0; bx = x1; bz = z0; }
            const b = y >= 1.5 ? rock : cliff;
            const ua = (di !== 0 ? az : ax) / 8, ub = (di !== 0 ? bz : bx) / 8;
            b.quad(new V3(ax, y, az), new V3(bx, y, bz), new V3(bx, yn, bz), new V3(ax, yn, az), nrm, [[ua, 0], [ub, 0], [ub, (y - yn) / 10], [ua, (y - yn) / 10]]);
          }
        }
      }
      const add = (gb, mat, cast) => { if (!gb.count) return; const m = new THREE.Mesh(gb.build(), mat); m.castShadow = cast; m.receiveShadow = true; m.userData.terrain = true; this.group.add(m); this.terrain.push(m); };
      add(top, this.mat, false); add(cliff, R.mats.cliff, true); add(rock, R.mats.rock, true);
      this.geoDirty = false;
    }
    buildProps(objs) {
      const R = this.R; this.clear(this.props);
      const pb = new PropBuilder(R.doc);
      for (const o of objs) {
        try {
          if (o.kind === 'building') continue;   // buildings are meshes of the renderer's BuildingSet, not chunk geometry
          if (o.kind === 'wall') pb.buildWall(o); else if (o.kind === 'bridge') pb.buildBridge(o); else if (o.kind === 'prop') pb.buildProp(o, R.propState.get(o.id));
        } catch (e) { console.warn('object ' + o.id + ' failed to build', e); }
      }
      for (const k of PropBuilder.KEYS) {
        const gb = pb[k]; if (!gb.count) continue;
        const m = new THREE.Mesh(gb.build(), R.mats[k]); m.castShadow = k !== 'fern'; m.receiveShadow = true; this.group.add(m); this.props.push(m);
      }
      this.propsDirty = false;
    }
    dispose() {
      this.disposed = true; this.clear(this.terrain); this.clear(this.props); this.R.scene.remove(this.group);
      this.tex.dispose(); this.stex.dispose(); this.mat.dispose();
    }
  }

  /* the scene: lights, atmosphere, chunks, dynamic parts (fires, banners, sprites) */
  Object.assign(K, { SpriteActor, SnowField, EmberField, PaintPool, Chunk });
})(typeof window !== 'undefined' ? window : globalThis);
