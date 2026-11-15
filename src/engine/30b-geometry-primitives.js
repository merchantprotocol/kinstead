/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
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
  Object.assign(K, { M4: GeometryPrimitives.M4, UNIT: GeometryPrimitives.UNIT, tileUV: GeometryPrimitives.tileUV });
})(typeof window !== 'undefined' ? window : globalThis);
