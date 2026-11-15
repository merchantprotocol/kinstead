/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · experience. You grow by doing: building (every wall, gate and building), and fighting (every hit you
   land, every hit you take, even when you lose the fight), plus a bonus for a kill. Level 2 comes early, within
   the second day; the bigger dangers hold off until you are ready (a bear only comes once you are level 4).
   Each level gives a little more strength and a harder swing.
     Experience   the total, the level, what each deed is worth */
(function (G) {
  const K = G.K;
  const NEED = [0, 60, 160, 320, 560, 900, 1400, 2100, 3000];   // total XP at which levels 1..9 begin
  const BUILD = { dirt: 1, palisade: 3, stone_wall: 4, gate: 12, stone_gate: 40, woodcutter: 30, quarry: 40, storehouse: 50, blacksmith: 60, cottage: 60, watchtower: 40, fire_pot: 4, farm: 30, field: 1, silo: 30, coop: 20, barn: 40, market: 50 };
  const KILL = { 'Wolf pup': 15, Wolf: 30, Bear: 90, Raider: 45, 'Armed raider': 70 };
  const BEAR_LEVEL = 4;

  class Experience {
    constructor(game) { this.g = game; this.xp = 0; this.lastHit = -9; }
    get level() { let l = 1; for (let i = 1; i < NEED.length; i++) if (this.xp >= NEED[i]) l = i + 1; return l; }
    /** progress to the next level: { level, into, need } (need 0 at the top) */
    progress() { const l = this.level, a = NEED[l - 1], b = NEED[l]; return { level: l, into: this.xp - a, need: b ? b - a : 0 }; }
    add(n, why) {
      if (n <= 0) return; const before = this.level; this.xp += n; const g = this.g;
      if (this.level > before) {
        const p = g.play.player; p.heal(10); g.sound.play('fanfare'); g.cui.toast(`Level ${this.level}! You are stronger.${this.level === BEAR_LEVEL ? ' Something bigger is out there now…' : ''}`); g.play.float(g.play.me, `Level ${this.level}`, 'heal');
      }
      g.changed();
    }
    built(type) { this.add(BUILD[type] || 10); }
    /** you landed a hit (a little each time, so a long fight is worth something) */
    dealt() { const t = this.g.play.t; if (t - this.lastHit < 0.35) return; this.lastHit = t; this.add(2); }
    taken() { this.add(1); }
    killed(a) { this.add(KILL[a.name] || 20); }
    toJSON() { return this.xp; }
    restore(x) { this.xp = +x || 0; }
  }
  Experience.BEAR_LEVEL = BEAR_LEVEL;

  K.Experience = Experience;
})(typeof window !== 'undefined' ? window : globalThis);
