/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the shape of the ramparts, shared by the art that draws them and the walk that uses them.
   Stone walls, stone towers and the stone gate all have their walk at the same height (WALK above the ground the
   piece stands on), so a wall top, a tower deck and the gate's battlement walk join level. A stone tower has a door
   in each corner and a stair that climbs one and a half turns round the inside to its deck.

     RampartPlan   heights and the stone tower's stair and doors, in piece-local metres */
(function (G) {
  const K = G.K;

  class RampartPlan {
    /** the walk height above the piece's ground (the stone gate's battlement walk: span 3.32 + slab 0.08) */
    static get WALK() { return 3.4; }
    /** the stone gate's two flanking towers stand this much above its battlement walk */
    static get GATE_FLANK() { return 0.64; }
    /** the stone tower's stair: local [x, z, y] corners from the foot inside the tower to the deck */
    static get STAIR() {
      return [[-0.38, -0.38, 0.16], [0.38, -0.38, 0.72], [0.38, 0.38, 1.28], [-0.38, 0.38, 1.84],
        [-0.38, -0.38, 2.4], [0.38, -0.38, 2.96], [0.38, 0.38, 3.4]];
    }
    /** the tower's corner doors: [sx, sz] signs; the door opens onto the diagonal tile outside that corner */
    static get DOORS() { return [[-1, -1], [1, -1], [1, 1], [-1, 1]]; }
    /** how far out (local, per axis) the ground just outside a corner door is, and the doorway inside it */
    static get DOOR_OUT() { return 1.0; }
    static get DOOR_IN() { return 0.55; }
    /** is this piece type part of the walk? */
    static walkable(type) { return type === 'stone_wall' || type === 'stone_tower' || type === 'stone_gate'; }
    /** the walk height of a piece tile, lx along the piece's local x */
    static topOf(type, lx) { return RampartPlan.WALK + (type === 'stone_gate' && Math.abs(lx) > 1.5 ? RampartPlan.GATE_FLANK : 0); }
  }

  K.RampartPlan = RampartPlan;
})(typeof window !== 'undefined' ? window : globalThis);
