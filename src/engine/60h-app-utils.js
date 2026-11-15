/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  /* small shared helpers for the World Builder's collaborators */
  class BuilderAppUtils {
    static byId(id) { return document.getElementById(id); }
    static round3(value) { return Math.round(value * 1000) / 1000; }
    static clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
    static escapeHtml(value) {
      return String(value).replace(/[&<>"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      })[character]);
    }
    static segmentDistance(x, z, a, b) {
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const lengthSquared = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared));
      return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    }
    static describe(object) {
      if (object.kind === 'prop') return (K.PropBuilder.PROPS[object.type] || { name: object.type }).name;
      if (object.kind === 'building') return (K.BUILDING_PREFABS[object.prefab] || { name: 'Building' }).name;
      if (object.kind === 'bridge') return 'Bridge';
      return object.closed ? 'Ruined room' : 'Wall';
    }
  }
  K.BuilderAppUtils = BuilderAppUtils;
})(typeof window !== 'undefined' ? window : globalThis);
