/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · WorkerJob: what every townsperson has in common. They appear as an actor, run an Errands list, fetch from
   the market, go to bed at dusk and come out at dawn (see TownNight), and stop to talk with each other. Each trade
   (Cook, Smith, Clerk, Keeper, HallJob) extends it with its own idle() and report(). */
(function (G) {
  const K = G.K;

  class WorkerJob {
    constructor(w, opts) { this.w = w; this.g = w.g; this.cool = 3; this.a = null; this.opts = opts; this.asleep = false; this.huddled = null; this.loop = 0; }
    get eco() { return this.g.economy; }
    get market() { return this.eco.of('market')[0] || null; }
    /** the spot in front of the market stalls where a worker stands to fetch */
    get counter() { const m = this.market; if (!m) return null; const r = m.rot || 0; return { x: m.x + Math.sin(r) * 1.6, z: m.z + Math.cos(r) * 1.6 }; }
    spawn(at) {
      const o = this.opts, g = this.g;
      const a = g.addActor({ id: 'wk:' + o.role, role: 'npc', spriteId: o.sprite, name: o.name, x: at.x, z: at.z, hpMax: 60, atk: 0, def: 0,
        speed: o.speed || 1.6, cd: 1, reach: 1, r: 0.3, scale: o.scale || 0.95, level: 1 });
      a.hostile = false; a.worker = o.role; a.type = 'c_worker'; if (o.tint != null) a.view.setTint(o.tint);
      a.brain = new K.Errands(g, a, this); a.view.poser = this.w.poser; this.a = a;
      if (this.w.night.bedtime) { this.asleep = true; this.show(false); }   // built after dark: they turn up at dawn
      return a;
    }
    despawn() { if (this.a) { this.g.removeActor(this.a); this.a = null; } }
    show(on) { if (!this.a) return; this.a.view.setVisible(on); this.a.hidden = !on; if (!on) this.a.view.carry = null; }
    /** take goods from the market (and only from there); false if it is not all there any more */
    fetch(need) {
      const l = this.eco.ledger(this.market); if (!Object.entries(need).every(([r, n]) => l.amount(r) >= n)) return false;
      for (const [r, n] of Object.entries(need)) l.take(r, n); return true;
    }
    /** what to do next: off to bed in the evening, back out at dawn, otherwise the day's work */
    next(e, dt) {
      const night = this.w.night;
      if (night.bedtime) { night.turnIn(this, e); return; }
      if (this.asleep || this.huddled) { night.wake(this, e); return; }
      this.idle(e, dt);
    }
    idle() {}
    /** every frame: the trade's own cooldown runs down, busy or not */
    tick(dt) { this.cool -= dt; }
    /** meet another worker here: both stop and face each other and say their lines. give = { prop, toMe }: a load passes hands
        (toMe: they hand theirs over; otherwise I hand mine to them and they carry it off) */
    meet(e, other, mine, theirs, give) {
      return e.then(() => {
        const b = other && other.a, me = this.a; if (!b || b.hidden || K.WorkSpots.dist(b, me) > 4) return;
        const W = this.w; b.chatT = 2.6; b.chatWith = me; b.path = null; me.chatT = 2.6; me.chatWith = b;
        W.say(me, mine, 2.6); W.later(0.9, () => W.say(b, theirs, 2.4));
        if (give && give.toMe) this.handOver(b, me, give.prop);
        else if (give) this.handOver(me, b, give.prop);
      }).pause(0.1);
    }
    /** from holds the load while they talk, then to has it */
    handOver(from, to, prop) {
      const W = this.w, was = from.view.carry; from.view.carry = prop;
      W.later(2.2, () => { from.view.carry = was === prop ? null : was; to.view.carry = prop; });
      if (to !== this.a) W.later(5, () => { if (to.view.carry === prop) to.view.carry = null; });
    }
    report() { return ['All is well.']; }
  }

  K.WorkerJob = WorkerJob;
})(typeof window !== 'undefined' ? window : globalThis);
