/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Errands: a worker's to-do list, run one step at a time. Steps: walk somewhere, work there for a while
   (with a trade pose, facing what they work on), carry or set down a load, say something, or run a bit of logic.
   When the list runs dry it asks the job what to do next. A worker stopped by someone for a chat stands and talks first. */
(function (G) {
  const K = G.K;

  class Errands {
    constructor(game, a, job) { this.g = game; this.a = a; this.job = job; this.steps = []; this.repath = 0; }
    go(x, z) { this.steps.push({ go: { x, z } }); return this; }
    then(fn) { this.steps.push({ fn }); return this; }
    pause(t, anim = 'idle') { this.steps.push({ wait: t, anim }); return this; }
    /** work at a spot for t seconds: the pose is the trade (chop, hammer, stir…); face turns them toward what they work on */
    work(t, pose, face, opts = {}) { this.steps.push({ wait: t, anim: 'action', pose, face, spin: opts.spin || null }); return this; }
    carry(prop) { return this.then(() => { this.a.view.carry = prop || null; }); }
    say(text, t = 3) { return this.then(() => this.job.w.say(this.a, text, t)); }
    get busy() { return this.steps.length > 0; }
    /** set the view's state unless it is reeling from a hit */
    state(s) { const v = this.a.view; if (v.state !== s && v.state !== 'hurt') v.setState(s); }
    update(dt) {
      const a = this.a, v = a.view;
      if (a.chatT > 0) { this.chat(dt); return; }
      if (!this.steps.length) { this.job.next(this, dt); if (!this.steps.length) { v.work = null; this.state('idle'); return; } }
      const s = this.steps[0];
      if (s.go) { this.walk(s, dt); return; }
      if (s.wait != null) { this.hold(s, dt); return; }
      this.steps.shift(); if (s.fn && s.fn() === false) { this.steps = []; v.carry = null; }   // a step that fails ends the errand
    }
    /** stopped to talk to someone: face them, gesture, then carry on */
    chat(dt) {
      const a = this.a; a.chatT -= dt; a.path = null; if (a.chatWith) this.g.play.face(a, a.chatWith);
      a.view.work = 'talk'; this.state('action'); if (a.chatT <= 0) { a.view.work = null; a.chatWith = null; }
    }
    walk(s, dt) {
      const a = this.a, P = this.g.play;
      if (K.WorkSpots.dist(a, s.go) < 0.45) { this.steps.shift(); a.path = null; return; }
      if (!a.path || !a.path.length) {
        if ((this.repath -= dt) > 0) return; this.repath = 1;
        a.path = P.nav.find(a.x, a.z, s.go.x, s.go.z, { range: 0.3, maxNodes: 40000 }) || null;
        if (!a.path) { s.fail = (s.fail || 0) + 1; if (s.fail > 3) { a.x = s.go.x; a.z = s.go.z; this.steps.shift(); } return; }   // no way round: they get there anyway
      }
      a.view.work = null; P.move(a, dt, a.speed); this.state('walk');
    }
    hold(s, dt) {
      const v = this.a.view; if (s.face) this.g.play.face(this.a, s.face);
      v.work = s.pose || null; this.state(s.anim); if (s.spin) s.spin.turning = 0.3;
      if ((s.wait -= dt) <= 0) { this.steps.shift(); v.work = null; }
    }
  }

  K.Errands = Errands;
})(typeof window !== 'undefined' ? window : globalThis);
