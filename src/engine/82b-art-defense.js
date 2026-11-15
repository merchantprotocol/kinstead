/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · art overrides for some castle pieces (see the asset library, /assets.html). Each entry draws one piece type
   into a VoxKit; anything not listed here falls back to 82-castle-mesh.js. */
(function (G) {
  const K = G.K, THREE = G.THREE, CYL = K.VoxKit.CYL, CYL8 = K.VoxKit.CYL8, CONE6 = new THREE.ConeGeometry(1, 1, 6);
  const ART = {
    // type: function (k, opts) { ...draw into k... }
  };
  const proto = K.CastleArt.prototype, base = proto.draw;
  proto.draw = function (k, type, opts = {}) { const f = ART[type]; if (f && !opts.ruin) return f.call(this, k, opts) || k; return base.call(this, k, type, opts); };
  void CYL; void CYL8; void CONE6;
})(typeof window !== 'undefined' ? window : globalThis);
