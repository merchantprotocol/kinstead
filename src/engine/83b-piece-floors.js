/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · PieceFloors: workshops you can walk into (the mill, the woodcutter's yard, the quarry's lean-to, the farm's hay
   shed, the cattle paddock). Their whole footprint is taken, so nothing else is built on it, but only their solid parts
   (WorkshopLayout) block feet. And when you stand on one, its roof lifts away so you see the people working inside. */
(function (G) {
  const K = G.K;

  class PieceFloors {
    constructor(game) { this.g = game; }
    handles(type) { return !!K.WorkshopLayout.solids(type); }
    /** take the footprint for building, block only the solid parts for walking */
    block(p) {
      const g = this.g, nav = g.play.nav, [w, d] = K.CastleArt.size(p.type);
      g.rectTiles(p.x, p.z, w, d, p.rot, (i, j, lx, lz) => { const k = j * nav.w + i; g.occ[k] = 1; if (K.WorkshopLayout.solidAt(p.type, lx,
          lz)) nav.walk[k] = 0; });
      const me = g.play.me; if (!me || nav.standable(me.x, me.z)) return;
      const q = nav.nearestOk(...nav.tile(me.x, me.z), 8); if (q) { [me.x, me.z] = nav.centre(...q); me.path = null; }
    }
    /** is (x, z) on the piece's floor? */
    on(p, x, z, pad = 0) {
      const [w, d] = K.CastleArt.size(p.type), c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0), dx = x - p.x, dz = z - p.z;
      return Math.abs(dx * c - dz * s) <= w / 2 + pad && Math.abs(dx * s + dz * c) <= d / 2 + pad;
    }
    /** a piece mesh with a liftable roof: hide the roof while `me` stands under it. True if they are under it (no fading then) */
    liftRoof(m, me) {
      const roof = m.userData.roof, p = m.userData.piece; if (!roof || !p) return false;
      const under = this.on(p, me.x, me.z, 0.1); if (roof.visible === under) roof.visible = !under;
      if (under && m.userData.faded) this.g.setFaded(m, false);
      return under;
    }
  }

  K.PieceFloors = PieceFloors;
})(typeof window !== 'undefined' ? window : globalThis);
