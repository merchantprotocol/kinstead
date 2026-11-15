/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Camera orbit and framing state for the builder and game. */
(function (G) {
  const K = G.K;

  /* orbit rig (diorama CameraRig with editor-friendly limits and a top-down mode) */
  class CameraRig {
    constructor(camera) {
      this.cam = camera; this.drift = false;
      this.cur = { tx: 8, ty: 0, tz: 8, yaw: -0.2, pitch: 0.7, dist: 21 }; this.goal = Object.assign({}, this.cur);
      this.bounds = [0, 0, 32, 24];
    }
    set(v, snap) { Object.assign(this.goal, v); this.clamp(); if (snap) this.cur = Object.assign({}, this.goal); }
    clamp() {
      const g = this.goal, b = this.bounds;
      g.pitch = Math.max(0.35, Math.min(1.53, g.pitch)); g.dist = Math.max(4, Math.min(this.maxDist || Math.max(40, (b[2] - b[0]) * 1.4), g.dist));
      g.tx = Math.max(b[0], Math.min(b[2], g.tx)); g.tz = Math.max(b[1], Math.min(b[3], g.tz));
    }
    update(dt, t) {
      const k = 1 - Math.pow(0.0015, dt);
      for (const key of ['tx', 'ty', 'tz', 'yaw', 'pitch', 'dist']) this.cur[key] += (this.goal[key] - this.cur[key]) * k;
      const c = this.cur, yaw = c.yaw + (this.drift ? Math.sin(t * 0.07) * 0.06 : 0), p = c.pitch;
      this.cam.position.set(c.tx + Math.sin(yaw) * Math.cos(p) * c.dist, c.ty + Math.sin(p) * c.dist, c.tz + Math.cos(yaw) * Math.cos(p) * c.dist);
      this.cam.lookAt(c.tx, c.ty, c.tz);
      return c.dist;
    }
  }

  K.CameraRig = CameraRig;
})(typeof window !== 'undefined' ? window : globalThis);
