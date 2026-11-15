/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* MobSync: creatures across games. MobCaster sends ours, RemoteMobs shows theirs, and blows struck across games land here. */
(function (G) {
  const K = G.K;

  class MobSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      this.caster = new K.MobCaster(multiplayer.g, multiplayer.net);
      this.net.on('mobs', (m) => this.mp.mobs.update(m.from, m.list || []));
      this.net.on('mobz', (m) => this.mp.mobs.batch(m));
      this.net.on('mobhurt', (m) => this.onMobHurt(m));
      this.net.on('leave', (m) => this.mp.mobs.dropOwner(m.id));
    }

    /** a new connection: the server knows nothing about our creatures yet */
    reset() {
      this.caster.reset();
    }

    /** ours go out four times a second (only what changed); theirs step toward where they were last seen */
    update(dt) {
      this.caster.update(dt);
      this.mp.mobs.tick(dt);
    }

    castMobs() {
      this.caster.cast();
    }

    /** you struck someone else's creature: its owner's game takes the blow */
    mobHit(target) {
      this.net.send({ t: 'mobhit', to: target.mob.owner, id: target.mob.id, tool: this.g.tools.tool.id });
    }

    /** one of your creatures bit another player */
    mobBite(attacker, target) {
      const dmg = Math.round(attacker.atk || 5);
      this.net.send({ t: 'mobbite', to: target.pid, mob: attacker.id, name: attacker.name, dmg });
    }

    onMobHurt(m) {
      const play = this.g.play;
      const actor = play.actors.find((x) => x.id === m.id && !x.remote);
      if (!actor || !actor.alive || !actor.hostile) return;
      actor.hp -= m.dmg;
      actor.aggro = true;
      actor.lastFight = play.t;
      play.float(actor, String(m.dmg), 'dealt');
      if (actor.view.flash) actor.view.flash('hit');
      if (actor.hp <= 0) play.kill(actor);
    }
  }

  K.MobSync = MobSync;
})(typeof window !== 'undefined' ? window : globalThis);
