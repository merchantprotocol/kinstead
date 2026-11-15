/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · CombatRules: the castle's fight rules. How hard a hit lands, who is nearest to strike, damage to kin and
   frost creatures from anything but the hero's own swing, and what a kill drops. */
(function (G) {
  const K = G.K;

  class CombatRules {
    constructor(game) { this.g = game; }
    /** a.dmgScale: the hero is weaker with a work tool than with a sword */
    damage(a, b) {
      const g = this.g, strength = a === g.play.me && g.workers ? g.workers.strengthMul : 1;
      return Math.max(1, Math.round((a.atk - (b.def || 0)) * (a.dmgScale || 1) * strength));
    }
    onHit(a, b) {
      const g = this.g, mine = a === g.play.me;
      if (mine) { g.sound.play('hit'); g.xp.dealt(); }
      if (b.raider && b.brain && g.castle.weapons.has('ember_brand') && mine) b.brain.burnT = 3;
    }
    wakeSec() { return this.g.castle.has('chapel') ? 2 : 5; }
    nearestEnemy(a, range) {
      const g = this.g, bridgeOpen = g.castle.zoneOpen('troll_bridge');
      let best = null, bd = range;
      for (const e of g.play.actors) {
        if (!e.alive || !(e.raider || (e.boss && bridgeOpen))) continue;
        const d = Math.hypot(e.x - a.x, e.z - a.z);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    /** the watchtower the Pinewarden climbs at dusk: the nearest one still standing and not frosted */
    towerFor(a) {
      let best = null, bd = Infinity;
      for (const p of this.g.castle.pieces) {
        if (p.type !== 'watchtower' || p.hp <= 0 || this.g.castle.isFrosted(p)) continue;
        const d = Math.hypot(p.x - a.x, p.z - a.z);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }
    /** the hero or a joined kin (not up a tower) nearest to a, within range */
    nearestAlly(a, range) {
      const g = this.g, me = g.play.me;
      let best = null, bd = range;
      if (me.alive) {
        const d = Math.hypot(me.x - a.x, me.z - a.z);
        if (d < bd) { bd = d; best = me; }
      }
      for (const k of Object.values(g.kinActors)) {
        if (!k.alive || !g.castle.kin.has(k.kinId) || k.manning) continue;
        const d = Math.hypot(k.x - a.x, k.z - a.z);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    }
    hurtAlly(k, n) {
      k.hp -= n;
      k.view.flash('hit');
      this.g.play.float(k, '-' + Math.round(n), 'hurt');
      if (k.hp <= 0 && k.brain && k.brain.knock) k.brain.knock();
    }
    /** damage to a frost creature from anything that isn't the hero's own swing; fractions add up */
    hurtEnemy(a, n, src, show) {
      if (!a.alive) return;
      a.hp -= n;
      a.dmgAcc = (a.dmgAcc || 0) + n;
      if (show || a.dmgAcc >= 4) {
        this.g.play.float(a, String(Math.round(a.dmgAcc)), src === 'glow' || src === 'burn' ? 'loot' : 'dealt');
        a.dmgAcc = 0;
        a.view.flash('hit');
      }
      if (a.hp <= 0) this.g.play.kill(a);
    }
    onHurt(a) {
      this.g.xp.taken();
      this.g.sweep.defend(a);
    }
    onKill(a) {
      const g = this.g;
      g.wild.onKill(a);
      g.xp.killed(a);
      if (a.gameKind) g.wildGame.onKill(a);
      if (a.raider) this.raiderFell(a);
      if (a.boss) this.trollFell(a);
      g.changed();
    }
    raiderFell(a) {
      const g = this.g, c = g.castle, raid = g.raid, drops = this.rollDrops(a);
      let y = 0;
      for (const [r, n] of Object.entries(drops)) {
        const got = Math.round(c.add(r, n));
        if (got <= 0) continue;
        g.play.ui.float(a.x, a.y + 1.2 + y, a.z, `+${got}`, 'loot', K.CastleUI.ICON[r]);
        y += 0.35;
        g.cui.bump(r);
        if (raid) raid.drops[r] = (raid.drops[r] || 0) + got;
      }
      if (raid) raid.killed++;
      g.sound.play('pop');
    }
    rollDrops(a) {
      const drops = {};
      for (const [r, lo, hi, p] of a.enemy.drops) {
        if (Math.random() < p) drops[r] = (drops[r] || 0) + lo + Math.floor(Math.random() * (hi - lo + 1));
      }
      if (this.g.castle.kin.has('emberwright')) drops.ember_shard = (drops.ember_shard || 0) + 1;
      return drops;
    }
    trollFell(a) {
      const g = this.g, c = g.castle;
      for (const [r, lo] of a.enemy.drops) c.add(r, lo);
      c.flags.add('killed:rime_troll');
      g.sound.play('fanfare');
      g.shake(0.5);
      g.puff(a.x, a.z);
      g.puff(a.x + 0.6, a.z - 0.3);
      g.cui.banner('The Rime Troll falls', 'It drops 10 gold, 4 iron and its warm heart. Carry the heart home to the Keep’s hearth.', 'heart');
    }
  }

  K.CombatRules = CombatRules;
})(typeof window !== 'undefined' ? window : globalThis);
