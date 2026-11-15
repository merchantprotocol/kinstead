/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · TrollFight: the Rime Troll at the bridge and its ground slam (a glowing ring, then a hit inside it). */
(function (G) {
  const K = G.K;

  class TrollFight {
    constructor(game) { this.g = game; this.troll = null; this.ring = null; }
    reset() { this.troll = null; this.ring = null; }
    spawn() {
      const g = this.g, e = g.data.enemy('rime_troll'), at = g.L.troll;
      const scale = K.ActorViews && K.ActorViews.enabled ? 1.15 : 1.55;   // the voxel troll is 2.9 m at scale 1
      const desc = 'Bridge-keeper. Every third swing is a ground slam: step out of the glowing ring.';
      const a = g.addActor({ id: 'troll', role: 'enemy', spriteId: 'troll', name: e.name, x: at.x, z: at.z, hpMax: e.hp, atk: e.atk, def: e.defense,
        speed: 1.5, cd: 2, reach: 1.25, r: 0.7, scale, level: 4, flip: true, info: { xp: 0, loot: [], desc } });
      a.enemy = e;
      a.boss = true;
      a.hostile = true;
      a.brain = new K.TrollBrain(g, a);
      this.troll = a;
    }
    slamStart(s) {
      const g = this.g;
      this.ring = g.art.ring();
      this.ring.scale.setScalar(s.r);
      g.place(this.ring, s.x, s.z, 0);
      this.ring.position.y += 0.08;
      g.cui.toast('Ground slam! Step out of the ring!');
    }
    slamRing(s, k) {
      if (!this.ring) return;
      this.ring.material.opacity = 0.35 + 0.6 * k;
      this.ring.scale.setScalar(s.r * (0.6 + 0.4 * k));
    }
    slamHit(s, dmg) {
      const g = this.g, me = g.play.me;
      if (this.ring) {
        g.group.remove(this.ring);
        this.ring.geometry.dispose();
        this.ring = null;
      }
      g.sound.play('thunk');
      g.shake(0.4);
      g.puff(s.x, s.z);
      if (me.alive && Math.hypot(me.x - s.x, me.z - s.z) < s.r) this.hitHero(me, dmg);
      else if (me.alive) g.play.float(me, 'dodged!', 'heal');
      for (const a of Object.values(g.kinActors)) {
        if (a.alive && g.castle.kin.has(a.kinId) && Math.hypot(a.x - s.x, a.z - s.z) < s.r) g.hurtAlly(a, dmg * 0.5);
      }
    }
    hitHero(me, dmg) {
      const play = this.g.play;
      play.float(me, '-' + Math.round(dmg), 'hurt');
      me.view.flash('hit');
      if (play.player.hurt(Math.round(dmg))) play.defeat();
    }
  }

  K.TrollFight = TrollFight;
})(typeof window !== 'undefined' ? window : globalThis);
