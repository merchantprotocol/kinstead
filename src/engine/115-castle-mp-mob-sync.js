/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* MobSync: the creatures and townsfolk this game runs, told to everyone else, and blows struck across games. */
(function (G) {
  const K = G.K;

  class MobSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      this.castT = 0;
      this.hadMobs = false;
      this.net.on('mobs', (m) => this.mp.mobs.update(m.from, m.list || []));
      this.net.on('mobhurt', (m) => this.onMobHurt(m));
      this.net.on('leave', (m) => this.mp.mobs.dropOwner(m.id));
    }

    /** a few times a second */
    update(dt) {
      this.castT -= dt;
      if (this.castT > 0) return;
      this.castT = 0.2;
      this.castMobs();
    }

    isTownsperson(actor) {
      return !!actor.worker || (actor.role === 'npc' && String(actor.id).startsWith('kin:'));
    }

    isShared(actor) {
      if (actor.remote || actor === this.g.play.me) return false;
      if (this.isTownsperson(actor)) return true;
      return !!actor.hostile && !!(actor.wolf || actor.bear || actor.thief || actor.gameKind);
    }

    kindOf(actor) {
      if (this.isTownsperson(actor)) return 'person:' + actor.spriteId;
      if (actor.gameKind) return actor.gameKind;
      if (actor.bear) return 'bear';
      return actor.wolf ? 'wolf' : 'raider';
    }

    describe(actor) {
      const dir = actor.view.dir;
      return [
        actor.id,
        this.kindOf(actor),
        +actor.x.toFixed(2),
        +actor.z.toFixed(2),
        +(actor.y || 0).toFixed(2),
        +Math.atan2(dir.z, dir.x).toFixed(2),
        actor.alive ? actor.view.state : 'dead',
        Math.round(actor.hp),
        actor.hpMax,
        actor.name,
      ];
    }

    castMobs() {
      const list = [];
      for (const actor of this.g.play.actors) {
        if (!this.isShared(actor)) continue;
        list.push(this.describe(actor));
        if (list.length >= 40) break;
      }
      if (list.length || this.hadMobs) this.net.send({ t: 'mobs', list });
      this.hadMobs = list.length > 0;
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
