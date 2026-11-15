/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · how the hero's height follows a layered path. Play.move walks the waypoints; this class handles what is
   special about them: a stair leg ([x, z, y]) eases the height from where the leg began to the waypoint's height,
   arriving at a waypoint that names a layer switches the hero to it, and between stairs the height comes from the
   hero's own layer (the rampart walk up top, the ground grid down below).

     RampartWalker   stair legs, layer switches and the height of one actor */
(function (G) {
  const K = G.K;

  class RampartWalker {
    constructor(ramparts) { this.r = ramparts; }
    static climbs(wp) { return wp.length > 2; }
    /** a step toward waypoint wp, d away, is about to be taken */
    begin(a, wp, d) {
      if (!RampartWalker.climbs(wp) || a.leg === wp) return;
      a.leg = wp; a.legD = Math.max(d, 1e-4); a.legY = a.y; a.layer = 'stair';
    }
    /** part way along the leg, `left` still to go */
    along(a, wp, left) {
      if (!RampartWalker.climbs(wp)) return;
      a.y = a.legY + (wp[2] - a.legY) * Math.min(1, 1 - left / a.legD);
    }
    /** reached waypoint wp */
    arrive(a, wp) {
      if (!RampartWalker.climbs(wp)) return;
      a.y = wp[2]; a.leg = null;
      if (wp[3]) a.layer = wp[3];
    }
    /** the height the actor settles to when it is not on a stair, or null to leave it to the ground grid */
    rest(a) { return a.layer === 'upper' ? this.r.layer.y(a.x, a.z) : null; }
  }

  K.RampartWalker = RampartWalker;
})(typeof window !== 'undefined' ? window : globalThis);
