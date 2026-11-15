/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · one way up one stone tower: from the ground just outside a corner door, through the doorway, up the
   stair corners (K.RampartPlan.STAIR) to the deck, and the same run back down. Each waypoint is [x, z, y] (a stair
   leg: the walker eases the height in along it); the last one up carries 'upper' and the last one down 'ground',
   the layer the hero is on when it arrives there. Every waypoint knows its run, its index and its tower, so a hero
   stopped half way can finish the flight.

     TowerStair   the waypoints of one door's stair, in world space */
(function (G) {
  const K = G.K;

  class TowerStair {
    /* p: the tower piece; base: the ground height its mesh stands on; door: [sx, sz] corner signs */
    constructor(p, base, door) {
      const Plan = K.RampartPlan, [sx, sz] = door;
      this.p = p;
      this.door = this.world(sx * Plan.DOOR_OUT, sz * Plan.DOOR_OUT);
      const run = [[...this.world(sx * Plan.DOOR_IN, sz * Plan.DOOR_IN), base + 0.16]];
      for (const [lx, lz, ly] of Plan.STAIR) run.push([...this.world(lx, lz), base + ly]);
      this.top = run[run.length - 1]; this.top[3] = 'upper';
      this.up = run;
      this.down = run.slice(0, -1).reverse().map((q) => q.slice(0, 3));
      this.down.push([this.door[0], this.door[1], base, 'ground']);
      this.tag(this.up); this.tag(this.down);
    }
    tag(run) { run.forEach((q, i) => { q.run = run; q.idx = i; q.tower = this.p; }); }
    /** tower-local (lx, lz) to world: the same turn the mesh gets (Object3D.rotation.y = rot) */
    world(lx, lz) {
      const p = this.p, c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0);
      return [p.x + lx * c + lz * s, p.z - lx * s + lz * c];
    }
    /** a rough cost of going from (sx, sz) to (gx, gz) by this stair, to try the likely ones first */
    detour(sx, sz, gx, gz) { return Math.hypot(this.door[0] - sx, this.door[1] - sz) + Math.hypot(this.door[0] - gx, this.door[1] - gz); }
  }

  K.TowerStair = TowerStair;
})(typeof window !== 'undefined' ? window : globalThis);
