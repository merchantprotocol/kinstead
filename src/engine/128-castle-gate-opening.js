/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* GateOpening: the passage a closing gate sweeps through (not its deck, walkway or flanks), who stands in it,
   and stepping townsfolk out of it (into the castle) so the gate can shut. */
(function (G) {
  const K = G.K;

  class GateOpening {
    /* half the passage width (across the gate) and half its depth (through it), in metres */
    static SIZES = { stone_gate: { half: 1.5, depth: 0.75 }, gate: { half: 1.0, depth: 0.25 } };
    static BODY = 0.3;    // a body this close to the passage is in the way
    static STEP = 0.7;    // how far past the passage a townsperson is stepped out

    constructor(sizes = GateOpening.SIZES) { this.sizes = sizes; }

    size(gate) { return this.sizes[gate.type] || this.sizes.gate; }

    /** where a point is, in the gate's own frame: `across` the opening and `ahead` through it */
    local(gate, x, z) {
      const c = Math.cos(gate.rot || 0), s = Math.sin(gate.rot || 0), dx = x - gate.x, dz = z - gate.z;
      return { across: dx * c - dz * s, ahead: dx * s + dz * c };
    }

    world(gate, across, ahead) {
      const c = Math.cos(gate.rot || 0), s = Math.sin(gate.rot || 0);
      return { x: gate.x + across * c + ahead * s, z: gate.z - across * s + ahead * c };
    }

    contains(gate, actor) {
      if (!actor || actor.alive === false) return false;
      const size = this.size(gate), at = this.local(gate, actor.x, actor.z);
      return Math.abs(at.across) <= size.half && Math.abs(at.ahead) <= size.depth + GateOpening.BODY;
    }

    /** everyone standing in the passage right now */
    bodies(gate, actors) { return actors.filter((actor) => this.contains(gate, actor)); }

    /** step someone out of the passage into the castle (the bridge side may be a pit once the bridge is up) */
    stepOut(gate, actor) {
      const at = this.local(gate, actor.x, actor.z);
      const out = this.world(gate, at.across, -(this.size(gate).depth + GateOpening.STEP));
      actor.x = out.x;
      actor.z = out.z;
      actor.path = null;
    }
  }

  K.GateOpening = GateOpening;
})(typeof window !== 'undefined' ? window : globalThis);
