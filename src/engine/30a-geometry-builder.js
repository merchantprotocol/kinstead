/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const THREE = G.THREE, V3 = THREE.Vector3;
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
  G.K.GeometryBuilderW = GeometryBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
