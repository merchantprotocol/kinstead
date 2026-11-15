/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · GoalArrow: the bobbing arrow over the next story goal (hidden in survival, which has no goals). */
(function (G) {
  const K = G.K;

  class GoalArrow {
    constructor(game) { this.g = game; this.arrow = null; }
    attach() {
      this.arrow = this.g.art.arrow();
      this.g.group.add(this.arrow);
    }
    /** where the current objective is, or null */
    target() {
      const g = this.g, c = g.castle, goal = c.currentGoals(1)[0];
      if (!goal) return null;
      const L = g.L, keep = { x: L.hearth.x, z: L.hearth.z, h: 2.4 }, troll = g.troll;
      switch (goal.id) {
        case 'o1': case 'o4': case 'o12': return keep;
        case 'o2': return { x: L.ruins.gatehouse.x, z: L.ruins.gatehouse.z, h: 2 };
        case 'o3': return c.lit ? { x: L.keep.x + 4.2, z: L.keep.z - 1, h: 0.6, build: true } : keep;
        case 'o5': case 'o10': return g.raid ? null : keep;
        case 'o6': return c.zoneOpen('iron_hills') ? { x: L.outcrop.x, z: L.outcrop.z, h: 1.4 } : null;
        case 'o7': return { x: L.ruins.great_hall.x, z: L.ruins.great_hall.z, h: 2 };
        case 'o8': return { x: L.ruins.smithy.x, z: L.ruins.smithy.z, h: 2 };
        case 'o9': return this.smithyTarget();
        case 'o11': return c.zoneOpen('troll_bridge') && troll && troll.alive ? { x: troll.x, z: troll.z, h: 3.4 } : null;
        default: return null;
      }
    }
    smithyTarget() {
      const s = this.g.castle.pieces.find((p) => p.type === 'smithy');
      return s ? { x: s.x, z: s.z, h: 2.4 } : null;
    }
    update() {
      const g = this.g, a = this.arrow;
      if (g.survival) { a.visible = false; return; }   // no goal arrow: there are no goals
      const t = g.cui.placing ? null : this.target();
      a.visible = !!t;
      if (!t) return;
      const y = g.play.nav.y(t.x, t.z) + t.h + 0.5 + Math.abs(Math.sin(g.play.t * 3)) * 0.35;
      a.position.set(t.x, y, t.z);
      a.rotation.y = g.play.t * 1.5;
    }
  }

  K.GoalArrow = GoalArrow;
})(typeof window !== 'undefined' ? window : globalThis);
