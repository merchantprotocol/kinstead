/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead World Builder 3D · renderer: builds the diorama scene FROM the World document, chunk by chunk. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const V3 = THREE.Vector3;
  const { TILE, HQ, T, WorldDoc } = K;
  const CH = 32, PPU = 32;   // chunk = 32 x 32 tiles (16 x 16 world units), ground texture 32 texels per unit (diorama density)

  class TextureBank {
    constructor(renderer) { this.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy()); }
    canvasOf(buf) {
      const c = document.createElement('canvas'); c.width = buf.w; c.height = buf.h;
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.w, buf.h), 0, 0);
      return c;
    }
    texOf(canvas, { srgb = true, mips = true } = {}) {
      const t = new THREE.CanvasTexture(canvas); t.magFilter = THREE.NearestFilter;
      t.minFilter = mips ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter; t.generateMipmaps = mips; t.flipY = false; t.anisotropy = this.aniso;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
    }
    pixel(buf, { repeat = false, srgb = true, mips = true, flipY = false } = {}) {
      const t = new THREE.CanvasTexture(this.canvasOf(buf));
      t.magFilter = THREE.NearestFilter;
      t.minFilter = mips ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter;
      t.generateMipmaps = mips; t.flipY = flipY; t.anisotropy = this.aniso;
      if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return t;
    }
  }

  /* Merges many transformed geometries into one indexed BufferGeometry */
  class GeometryBuilder {
    constructor() { this.p = []; this.n = []; this.uv = []; this.idx = []; this.count = 0; this._v = new V3(); this._m3 = new THREE.Matrix3(); }
    add(geo, matrix, uvMap) {
      const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
      this._m3.getNormalMatrix(matrix);
      const base = this.count, v = this._v;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(matrix); this.p.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nor, i).applyMatrix3(this._m3).normalize(); this.n.push(v.x, v.y, v.z);
        let u = uv ? uv.getX(i) : 0, w = uv ? uv.getY(i) : 0;
        if (uvMap) [u, w] = uvMap(u, w); this.uv.push(u, w);
      }
      if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
      else for (let i = 0; i < pos.count; i++) this.idx.push(base + i);
      this.count += pos.count;
      return this;
    }
    quad(a, b, c, d, normal, uvs) {
      // ensure CCW winding w.r.t. normal
      const e1 = new V3().subVectors(b, a), e2 = new V3().subVectors(c, a), cr = new V3().crossVectors(e1, e2);
      let pts = [a, b, c, d], u = uvs;
      if (cr.dot(normal) < 0) { pts = [a, d, c, b]; u = [uvs[0], uvs[3], uvs[2], uvs[1]]; }
      const base = this.count;
      pts.forEach((p, i) => { this.p.push(p.x, p.y, p.z); this.n.push(normal.x, normal.y, normal.z); this.uv.push(u[i][0], u[i][1]); });
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3); this.count += 4;
    }
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
      g.computeBoundingSphere();
      return g;
    }
  }
  class GeometryPrimitives {
    static M4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      const rotation = new THREE.Euler(rx, ry, rz);
      const scale = new V3(sx, sy, sz);
      return new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(rotation), scale);
    }
    static tileUV(tile, n = 4) {
      return (u, v) => [((tile % n) + u) / n, (((tile / n) | 0) + v) / n];
    }
    static UNIT = {
      cone: new THREE.ConeGeometry(1, 1, 8, 1, false),
      trunk: new THREE.CylinderGeometry(0.6, 1, 1, 6),
      log: new THREE.CylinderGeometry(0.15, 0.16, 1.1, 8),
      stick: new THREE.CylinderGeometry(0.05, 0.06, 0.62, 6),
      pole: new THREE.CylinderGeometry(0.04, 0.05, 2.4, 6),
      bowl: new THREE.CylinderGeometry(0.28, 0.15, 0.22, 8),
      ico: new THREE.IcosahedronGeometry(1, 0),
    };
  }

  /* the diorama's PropBuilder, made placeable: every piece goes through put(), which applies an optional local->world transform */
  Object.assign(K, {
    CH, PPU, TextureBank, GeometryBuilderW: GeometryBuilder,
    M4: GeometryPrimitives.M4,
    UNIT: GeometryPrimitives.UNIT,
    tileUV: GeometryPrimitives.tileUV,
  });
})(typeof window !== 'undefined' ? window : globalThis);
