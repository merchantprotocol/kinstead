/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · MobActorPool: the animated actors that stand in for other players' creatures.
   Building a rigged actor is expensive, so one that walks out of view is hidden and kept for the next creature
   of the same kind instead of being thrown away. */
(function (G) {
  const K = G.K;

  class MobActorPool {
    static KEEP = 60;   // hidden actors kept in all (as many as can be on screen at once)

    constructor(game) {
      this.g = game;
      this.free = new Map();   // kind -> [hidden actors]
      this.kept = 0;
    }

    /** an actor in play for this creature: a recycled one when there is one, else a new one */
    acquire(rec) {
      const list = this.free.get(rec.kind);
      const reuse = !!(list && list.length);
      const a = reuse ? list.pop() : this.build(rec.kind, rec);
      if (reuse) this.kept--;
      this.dress(a, rec);
      this.g.play.actors.push(a);
      a.view.setVisible(true);
      return a;
    }

    build(kind, rec) {
      const g = this.g, worker = kind.startsWith('person:');
      const sprite = worker ? kind.slice(7) : kind === 'bear' ? 'bear' : kind === 'wolf' ? 'wolf' : 'ranger';
      const a = g.addActor({
        id: 'mob:' + rec.owner + ':' + rec.id, role: 'remote', spriteId: sprite, name: rec.name || kind, x: rec.tx, z: rec.tz,
        hpMax: rec.hpMax || 30, atk: 0, def: 0, speed: 3, cd: 1, reach: 1, r: kind === 'bear' ? 0.8 : 0.45, scale: 1, level: 1,
        info: { xp: 0, loot: [] },
      });
      this.detach(a);
      a.remote = true;
      a.hostile = !worker;
      if (worker) a.worker = true;
      if (kind === 'raider') a.view.setTint(0x6e4a42);
      if (K.GAME_ANIMALS && K.GAME_ANIMALS[kind]) {   // a deer, elk, bison or wild horse someone else's game runs
        a.view.dispose();
        a.view = new K.AnimalView(g.R, kind);
        a.gameKind = kind;
        a.r = K.GAME_ANIMALS[kind].r;
      }
      a.poolKind = kind;
      return a;
    }

    dress(a, rec) {
      a.id = 'mob:' + rec.owner + ':' + rec.id;
      a.name = rec.name || rec.kind;
      a.mob = { owner: rec.owner, id: rec.id };
      a.x = rec.tx;
      a.z = rec.tz;
      a.y = rec.ty;
      a.hpMax = rec.hpMax || a.hpMax;
      a.hp = rec.hp;
      a.alive = true;
      a.deadT = 0;
      a.dropped = false;
      a.path = null;
      a.aggro = false;
      a.view.setPosition(a.x, a.y || 0, a.z);
      a.view.setState('idle');
    }

    /** out of view: hidden and kept, or let go when enough are already waiting */
    release(a) {
      this.detach(a);
      a.brain = null;
      const list = this.free.get(a.poolKind) || [];
      if (this.kept >= MobActorPool.KEEP) {
        a.view.dispose();
        return;
      }
      a.view.setVisible(false);
      list.push(a);
      this.kept++;
      this.free.set(a.poolKind, list);
    }

    /** out of the game's actor list (no longer updated, targeted or hovered), not destroyed */
    detach(a) {
      const play = this.g.play, i = play.actors.indexOf(a);
      if (i >= 0) play.actors.splice(i, 1);
      if (play.target === a) play.target = null;
      if (play.hover === a) play.hover = null;
    }

    dispose() {
      for (const list of this.free.values()) for (const a of list) a.view.dispose();
      this.free.clear();
      this.kept = 0;
    }
  }

  K.MobActorPool = MobActorPool;
})(typeof window !== 'undefined' ? window : globalThis);
