/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the handcarts that carry goods between buildings. A cart never moves on its own: it waits parked in front of
   the building that loaded it until that building's worker comes out, takes the handles and pulls it (see Haulage).
     CartRoute   where a cart waits (in front of its building) and where it is unloaded (in front of the one it goes to)
     Cart        the cart itself: its load, its model, following the worker who pulls it, unloading, going home */
(function (G) {
  const K = G.K, THREE = G.THREE;

  class CartRoute {
    constructor(from, to) { this.from = from; this.to = to; }
    /** just in front of a piece, out of its footprint */
    static front(p, extra) { const [, d] = K.CastleArt.size(p.type); return K.WorkSpots.local(p, 0, d / 2 + extra); }
    get park() { return CartRoute.front(this.from, 1.3); }
    get drop() { return CartRoute.front(this.to, 1.6); }
  }

  class Cart {
    /** a load of n of good, from building `from` to building `to`; it waits parked till a worker takes it */
    constructor(eco, from, to, good, n) {
      this.eco = eco; this.from = from; this.to = to; this.good = good; this.n = n; this.route = new CartRoute(from, to);
      this.crew = null; this.done = false; this.heading = (from.rot || 0) + Math.PI;
      const at = this.route.park; this.x = at.x; this.z = at.z; this.mesh = this.build(); eco.g.group.add(this.mesh); this.place();
    }
    static get LOAD_LOOK() { return { wheat: 'hay', egg: 'linen', milk: 'plaster', beef: 'leather', stone: 'ashlar', iron: 'iron' }; }
    build() {
      const k = new K.VoxKit(), good = this.good;
      k.box('planks', 0, 0.28, 0, 0.6, 0.3, 0.9); k.box('timber', 0, 0.58, -0.6, 0.06, 0.06, 0.6, 0, 0.5);
      k.box(Cart.LOAD_LOOK[good] || 'wood', 0, 0.58, 0, 0.5, 0.18, 0.7);
      if (good === 'wood') for (let q = 0; q < 3; q++) k.geo('bark', K.VoxKit.CYL8, -0.15 + q * 0.15, 0.82, 0, Math.PI / 2, 0, 0, 0.07, 0.8, 0.07);
      if (good === 'stone') for (let q = 0; q < 3; q++) k.box('ashlar', -0.15 + q * 0.15, 0.76, -0.1 + (q % 2) * 0.2, 0.14, 0.14, 0.14, q);
      for (const [x, z] of [[-0.34, 0.2], [0.34, 0.2]]) k.geo('wood', K.VoxKit.CYL, x, 0.24, z, 0, 0, Math.PI / 2, 0.5, 0.06, 0.5);
      const grp = new THREE.Group(); for (const m of k.meshes(this.eco.g.R.bmats)) grp.add(m); return grp;
    }
    /** where the puller stands: at the handles, facing away from the cart */
    get handles() { return { x: this.x - Math.sin(this.heading) * 0.95, z: this.z - Math.cos(this.heading) * 0.95 }; }
    place() { const P = this.eco.g.play; this.mesh.position.set(this.x, P.nav.y(this.x, this.z), this.z); this.mesh.rotation.y = this.heading; }
    /** a worker takes the handles (or lets go with null) */
    take(a) { this.crew = a; if (a) { a.view.haul = true; this.follow(); } }
    letGo() { if (this.crew) this.crew.view.haul = false; this.crew = null; }
    /** the cart trails behind whoever pulls it, turning to follow them */
    follow() {
      const a = this.crew, dx = a.x - this.x, dz = a.z - this.z, d = Math.hypot(dx, dz); if (d < 1e-3) return;
      this.heading = Math.atan2(-dx, -dz); const k = (d - 0.95) / d; this.x += dx * k; this.z += dz * k; this.place();
    }
    /** false once it is home and gone */
    update() { if (this.crew && !this.done) this.follow(); return !this.done; }
    /** the load goes into the building it was sent to; what does not fit goes back (an empty cart's run just shows the haul) */
    unload() {
      if (this.n <= 0) return; const led = this.eco.ledger.bind(this.eco), got = led(this.to).add(this.good, this.n);
      if (got < this.n) led(this.from).add(this.good, this.n - got); this.n = 0;
    }
    /** pulled home empty: put away */
    finish() { this.letGo(); this.done = true; this.dispose(); }
    dispose() { this.eco.g.group.remove(this.mesh); }
  }

  Object.assign(K, { Cart, CartRoute });
})(typeof window !== 'undefined' ? window : globalThis);
