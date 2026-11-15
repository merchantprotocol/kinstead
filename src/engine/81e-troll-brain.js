/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  class TrollBrain {
    constructor(game, a) { this.g = game; this.a = a; this.cd = 1.5; this.swings = 0; this.slam = null; this.roared = false; this.home = { x: a.x, z: a.z }; }
    update(dt) {
      const g = this.g, a = this.a, me = g.play.me;
      if (!a.alive) { a.deadT += dt; if (a.deadT > 1.6 && a.view.visible) a.view.setVisible(false); return; }
      if (!g.castle.zoneOpen('troll_bridge')) return;
      if (this.slam) {
        this.slam.t += dt; const k = this.slam.t / 1.0; g.slamRing(this.slam, k);
        if (k >= 1) { g.slamHit(this.slam, a.atk * 1.6); this.slam = null; }
        return;
      }
      if (!this.roared && a.hp <= a.hpMax / 2) { this.roared = true; a.view.setState('attack'); g.play.float(a, 'ROAR!', 'hurt');
      g.sound.play('roar'); g.shake(0.5); g.ui.toast('The troll roars. Frost wisps fall off its hide.'); }
      const dm = me.alive ? Math.hypot(me.x - a.x, me.z - a.z) : 99, dh = Math.hypot(this.home.x - a.x, this.home.z - a.z);
      const foe = dm < 7 && dh < 9 ? me : g.nearestAlly(a, 2.2);
      this.cd -= dt;
      if (!foe) { if (dh > 0.4) { a.path = a.path || g.play.nav.find(a.x, a.z, this.home.x, this.home.z, { range: 0.3 }); g.play.move(a, dt, a.speed);
      a.view.setState('walk'); } else if (a.view.state === 'walk') a.view.setState('idle'); return; }
      const d = Math.hypot(foe.x - a.x, foe.z - a.z), reach = a.reach + 0.4;
      if (d > reach) { a.path = g.play.nav.find(a.x, a.z, foe.x, foe.z, { range: reach * 0.8, maxNodes: 800 });
      if (g.play.move(a, dt, a.speed)) { if (a.view.state !== 'attack') a.view.setState('walk'); } return; }
      a.path = null; a.view.setFacing(foe.x - a.x, foe.z - a.z);
      if (this.cd > 0) return;
      this.cd = 2; this.swings++;
      if (this.swings % 3 === 0) { this.slam = { x: foe.x, z: foe.z, r: 2.2, t: 0 }; a.view.setState('attack'); g.slamStart(this.slam); return; }
      if (foe === me) g.play.swing(a, me); else { a.view.setState('attack'); g.hurtAlly(foe, a.atk); }
    }
  }
  K.TrollBrain = TrollBrain;
})(typeof window !== 'undefined' ? window : globalThis);
