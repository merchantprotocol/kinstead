/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* CombatSync: blows between players, and losing your castle to another settler. */
(function (G) {
  const K = G.K;

  class CombatSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      this.net.on('pvphit', (m) => this.onPvpHit(m));
      this.net.on('evicted', () => this.onEvicted());
    }

    pvp(target) {
      const g = this.g;
      this.net.send({ t: 'pvp', to: target, tool: g.tools.tool.id, auto: !!g.sweep.lastSwingAuto });
    }

    /** another player's blow (or their creature's bite) lands on you */
    onPvpHit(m) {
      const g = this.g;
      const me = g.play.me;
      if (!me.alive) return;
      g.play.float(me, '-' + m.dmg, 'hurt');
      if (me.view.flash) me.view.flash('hit');
      g.sound.play('hit');
      if (g.play.player.hurt(m.dmg)) g.play.defeat();
      g.xp.taken();
      if (m.mob) this.defendFromMob(m);
      else this.defendFromPlayer(m);
    }

    /** a creature bit you: fight it like your own */
    defendFromMob(m) {
      const mob = this.mp.mobs.find(m.from, m.mob);
      if (mob) this.g.sweep.defend(mob.a);
    }

    /** one blow back for a blow struck on purpose; a blow struck back is never answered, so it cannot spiral */
    defendFromPlayer(m) {
      const avatar = this.mp.avatars.by.get(m.from);
      if (avatar && !m.auto) this.g.sweep.defend(avatar.a, true);
    }

    onEvicted() {
      try {
        G.localStorage.setItem('kinstead.evict', '1');
      } catch (e) {
        /* private mode */
      }
      const message = '<h2>Your castle was taken</h2>' +
        '<p>Someone broke your door and hung their own. You keep what you carry, ' +
        'and you will wake on a fresh plot.</p>';
      this.g.cui.modal(message, [{ label: 'Start again', pri: true, run: () => G.location.reload() }]);
    }
  }

  K.CombatSync = CombatSync;
})(typeof window !== 'undefined' ? window : globalThis);
