/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the bear. When your fences and gates shut the wolves out of the food you keep outside, something
   bigger comes for it. A bear walks up to the food; if a wall or gate is in the way it breaks it (a gate quickly, a
   wood wall with more effort, a stone gate's drawbridge only after a very long time) or digs through a dirt wall.
   It cannot get through a stone wall, and it cannot cross a hole three blocks deep, so a deep pit in front of a
   stone gate keeps it off the drawbridge for good.
     BearBrain      the bear's mind: food, obstacles, fighting back
     BearDirector   decides when a bear comes (night, food outside, the wolves shut out for a while) */
(function (G) {
  const K = G.K;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  class BearBrain extends K.Brain {
    constructor(game, actor) {
      super(game, actor); this.mode = 'food'; this.breach = new K.Breacher(game, actor, 'bear'); this.plunder = new K.Plunder(game, actor, 16); this.food = null; this.bad = new Map(); this.stuckT = 0; this.leave = null;
    }
    blocker() { const g = this.g, T = K.TILE; return (i, j) => g.gateTiles.has(i + ',' + j) || g.insideBuilding((i + 0.5) * T, (j + 0.5) * T); }
    /** walk like Brain.goTo, but with a bear's long stride over steps */
    walk(x, z, range, dt) {
      const a = this.a, P = this.P; this.repath -= dt;
      if (this.repath <= 0 || !a.path) { this.repath = 0.5; a.path = P.nav.find(a.x, a.z, x, z, { range, maxNodes: 5000, blocked: this.blocker(), maxStep: this.breach.climb }) || null; }
      this.noWay = !a.path; const moved = a.path ? P.move(a, dt, a.speed) : false; this.anim(moved, a.speed); return moved;
    }
    retreat() { this.mode = 'leave'; this.leave = this.g.wild.leavePoint(this.a); this.a.path = null; }
    pickFood() {
      const a = this.a, now = this.P.t;
      return this.g.home.stores.filter((s) => (s.res === 'food' || s.res === 'bread') && s.present && s.amount >= 1 && !(this.bad.get(s) > now)).sort((p, q) => dist(p.ent, a) - dist(q.ent, a))[0] || null;
    }
    update(dt) {
      const g = this.g, a = this.a, me = this.P.me; if (!this.tickDead(dt)) return;
      this.cd -= dt; if (this.plunder) this.plunder.follow(); const d = dist(a, me);
      if (d > 90 && this.mode !== 'leave') { this.plunder.release(); g.removeActor(a); return; }
      if (this.mode === 'leave') { if (dist(a, this.leave) < 4) { this.plunder.escape(); g.removeActor(a); return; } this.walk(this.leave.x, this.leave.z, 1.5, dt); return; }
      if ((a.hp < a.hpMax - 0.01 || d < 4.5) && me.alive && !g.isSanctuary(me.x, me.z)) {    // hurt or crowded: it turns on you
        const reach = a.reach + (me.r || 0.3) + 0.35; if (d <= reach) { a.path = null; this.face(me); if (this.cd <= 0) this.bite(me); this.anim(false); } else this.walk(me.x, me.z, reach * 0.8, dt); this.keepOut(); return;
      }
      if (this.plunder.done) { this.retreat(); return; }
      let st = this.food; if (!st || !st.present || st.amount < 1 || this.bad.get(st) > this.P.t) { st = this.food = this.pickFood(); if (!st) { this.stuckT += dt; if (this.stuckT > 25) this.retreat(); else this.idleAround(dt); return; } }
      const tx = st.ent.x, tz = st.ent.z;
      if (dist(a, { x: tx, z: tz }) <= 1.7) { a.path = null; this.face({ x: tx, z: tz }); if (!this.plunder.gnaw(dt, st) && this.plunder.done) this.retreat(); this.anim(false); this.keepOut(); return; }
      this.walk(tx, tz, 1.3, dt);
      if (this.noWay) {
        const r = this.breach.advance(tx, tz, 1.3, dt);
        if (r === 'stuck') { this.bad.set(st, this.P.t + 30); this.food = null; }      // a stone wall, or a hole it cannot cross: try something else
        else this.stuckT = 0;
      }
      this.keepOut();
    }
    idleAround(dt) { const a = this.a; if (!this.spot || dist(a, this.spot) < 1.2) { this.spot = this.g.home.prowlPoint(); a.path = null; } this.walk(this.spot.x, this.spot.z, 0.8, dt); }
    keepOut() { const a = this.a, g = this.g; if (!g.isSanctuary(a.x, a.z)) { this.px = a.x; this.pz = a.z; return; } if (this.px != null) { a.x = this.px; a.z = this.pz; } a.path = null; this.repath = 0; }
    onDeath() { if (this.plunder) this.plunder.drop(); }
  }

  class BearDirector {
    constructor(game) { this.g = game; this.t = 0; this.chk = 10; this.next = 0; this.shutOut = 0; }
    get wild() { return this.g.wild; }
    bears() { return this.g.play.actors.filter((a) => a.alive && a.bear); }
    foodStores() { return this.g.home.stores.filter((s) => (s.res === 'food' || s.res === 'bread') && s.present && s.amount >= 1); }   // a bear wants everything edible; wolves only want raw meat
    /** could a wolf get to this food (walk, or dig through dirt)? */
    wolfCanReach(from, store) {
      const probe = { x: from.x, z: from.z, speed: 2.8, view: { setState() {}, setFacing() {}, state: '' }, atk: 0 };
      const plan = new K.Breacher(this.g, probe, 'wolf').makePlan(store.ent.x, store.ent.z, 1.3); return !plan.stuck;
    }
    update(dt) {
      this.t += dt; this.chk -= dt; if (this.chk > 0) return; this.chk = 6;
      if (this.g.xp.level < K.Experience.BEAR_LEVEL) return;   // not before you are level 4: time to enjoy the new fence first
      if (!this.g.calendar.isNight || this.t < this.next || this.bears().length) { if (!this.g.calendar.isNight) this.shutOut = 0; return; }
      const stores = this.foodStores(); if (!stores.length) return;
      const from = this.wild.edgePoint(); if (!from) return;
      const near = stores.sort((p, q) => dist(p.ent, from) - dist(q.ent, from)).slice(0, 3);
      if (near.some((s) => s.res === 'food' && this.wolfCanReach(from, s))) { this.shutOut = 0; return; }   // wolves can still get at raw meat: no bear yet
      this.shutOut += 6; if (this.shutOut < 60) return;     // the wolves have been shut out for a good while
      this.spawn(from); this.next = this.t + 240; this.shutOut = 0;
    }
    spawn(at) {
      const g = this.g, a = g.addActor({ id: 'b' + Math.random().toString(36).slice(2, 7), role: 'enemy', spriteId: 'bear', name: 'Bear', x: at.x, z: at.z, hpMax: 160, atk: 12, def: 0, speed: 2.5, cd: 1.5, reach: 1.4, r: 0.8, scale: 1, level: 1, info: { xp: 0, loot: [] } });
      a.hostile = true; a.aggro = false; a.bear = true; a.enemy = { drops: [] }; a.brain = new BearBrain(g, a);
      g.cui.toast('Something big is crashing through the trees toward your food…'); g.sound.play('horn'); return a;
    }
  }

  Object.assign(K, { BearBrain, BearDirector });
})(typeof window !== 'undefined' ? window : globalThis);
