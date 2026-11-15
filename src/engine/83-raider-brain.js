/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · RaiderBrain: a frost raider walks at a producer or the Keep and attacks whatever stands in its way. */
(function (G) {
  const K = G.K;

  class RaiderBrain {
    constructor(game, a, goal) { this.g = game; this.a = a; this.goal = goal; this.cd = 0; this.burnT = 0; }
    update(dt) {
      const g = this.g, a = this.a;
      if (!a.alive) { this.fade(dt); return; }
      if (this.burnT > 0) {
        this.burnT -= dt;
        g.hurtEnemy(a, 3 * dt, 'burn');
        if (!a.alive) return;
      }
      this.cd -= dt;
      const foe = g.nearestAlly(a, 1.3);   // fight a hero or kin standing in the way
      if (foe) {
        this.face(foe);
        if (this.cd <= 0) this.strike(foe);
        this.anim(false);
        return;
      }
      this.march(dt);
    }
    /** dead: the body fades, then leaves play */
    fade(dt) {
      const a = this.a;
      a.deadT += dt;
      if (a.deadT > 0.8 && a.view.visible) a.view.setVisible(false);
      if (a.deadT > 1.2) this.g.removeActor(a);
    }
    /** a producer to frost while it still stands unfrosted, else the Keep */
    target() {
      const g = this.g, tgt = this.goal;
      if (tgt && tgt.piece && (tgt.piece.frosted || !g.castle.pieces.includes(tgt.piece))) this.goal = g.keepGoal();
      return this.goal;
    }
    /** walk at the goal in a straight line, frosting producers and hitting walls on the way */
    march(dt) {
      const g = this.g, a = this.a, tgt = this.target();
      const dx = tgt.x - a.x, dz = tgt.z - a.z, d = Math.hypot(dx, dz);
      const reach = tgt.piece ? g.pieceRadius(tgt.piece) + 0.4 : g.L.keep.r + 0.7;
      if (d <= reach) { this.arrive(tgt); return; }
      const step = a.speed * dt, nx = a.x + dx / d * step, nz = a.z + dz / d * step;
      const wall = g.blockingPiece(nx, nz, a.r);
      if (wall) {
        this.face(wall);
        this.hit(() => g.hurtPiece(wall, a.atk));
        this.anim(false);
        return;
      }
      this.frostNear(nx, nz);
      a.x = nx;
      a.z = nz;
      a.y = g.play.nav.y(a.x, a.z);
      a.view.setFacing(dx, dz);
      this.anim(true);
    }
    arrive(tgt) {
      const g = this.g;
      if (tgt.piece) {
        if (g.castle.frost(tgt.piece)) g.onFrosted(tgt.piece);
        this.goal = g.keepGoal();
      } else {
        this.face(tgt);
        this.hit(() => g.hurtKeep(this.a.atk));
      }
      this.anim(false);
    }
    frostNear(x, z) {
      const g = this.g;
      for (const p of g.castle.producers()) {
        if (p.frosted || Math.hypot(p.x - x, p.z - z) >= g.pieceRadius(p) + 0.3) continue;
        if (g.castle.frost(p)) g.onFrosted(p);
      }
    }
    /** swing when the cooldown allows */
    hit(fn) {
      if (this.cd > 0) return;
      this.cd = this.a.cd;
      this.a.view.setState('attack');
      fn();
    }
    face(t) { this.a.view.setFacing(t.x - this.a.x, t.z - this.a.z); }
    strike(foe) {
      const a = this.a;
      this.cd = a.cd;
      if (foe === this.g.play.me) this.g.play.swing(a, foe);
      else {
        a.view.setState('attack');
        this.g.hurtAlly(foe, a.atk);
      }
    }
    anim(moving) {
      const v = this.a.view;
      if (moving) {
        if (v.state !== 'attack' && v.state !== 'hurt' && v.state !== 'walk') v.setState(this.a.fast ? 'run' : 'walk');
      } else if (v.state === 'walk' || v.state === 'run') v.setState('idle');
    }
  }

  K.RaiderBrain = RaiderBrain;
})(typeof window !== 'undefined' ? window : globalThis);
