/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameCombat extends K.CastleGameTroll {
    damage(a, b) { return Math.max(1,
    Math.round((a.atk - (b.def || 0)) * (a.dmgScale || 1) * (a === this.play.me && this.workers ? this.workers.strengthMul : 1)));
      }
    // a.dmgScale: the hero is weaker with a work tool than with a sword
    onHit(a, b) { if (a === this.play.me) { this.sound.play('hit');
      this.xp.dealt();
    } if (b.raider && b.brain && this.castle.weapons.has('ember_brand') && a === this.play.me) b.brain.burnT = 3;
      }
    wakeSec() { return this.castle.has('chapel') ? 2 : 5;
      }
    nearestEnemy(a, range) { let best = null, bd = range;
    for (const e of this.play.actors) if (e.alive && (e.raider || (e.boss && this.castle.zoneOpen('troll_bridge')))) { const d = Math.hypot(e.x - a.x,
    e.z - a.z);
      if (d < bd) { bd = d;
      best = e;
      } } return best;
      }
    /* the watchtower the Pinewarden climbs at dusk: the nearest one still standing and not frosted */
    towerFor(a) {
      let best = null, bd = Infinity;
      for (const p of this.castle.pieces) {
        if (p.type !== 'watchtower' || p.hp <= 0 || this.castle.isFrosted(p)) continue;
        const d = Math.hypot(p.x - a.x, p.z - a.z);
          if (d < bd) { bd = d;
          best = p;
          }
      }
      return best;
    }
    nearestAlly(a, range) {
      let best = null, bd = range;
        const me = this.play.me;
      if (me.alive) { const d = Math.hypot(me.x - a.x, me.z - a.z);
        if (d < bd) { bd = d;
        best = me;
        } }
      for (const k of Object.values(this.kinActors)) if (k.alive && this.castle.kin.has(k.kinId) && !k.manning) { const d = Math.hypot(k.x - a.x,
      k.z - a.z);
        if (d < bd) { bd = d;
        best = k;
        } }
      return best;
    }
    hurtAlly(k, n) { k.hp -= n;
      k.view.flash('hit');
      this.play.float(k, '-' + Math.round(n), 'hurt');
    if (k.hp <= 0 && k.brain && k.brain.knock) k.brain.knock();
      }
    /* damage to a frost creature from anything that isn't the hero's own swing; fractions add up */
    hurtEnemy(a, n, src, show) {
      if (!a.alive) return;
        a.hp -= n;
        a.dmgAcc = (a.dmgAcc || 0) + n;
      if (show || a.dmgAcc >= 4) { this.play.float(a, String(Math.round(a.dmgAcc)), src === 'glow' || src === 'burn' ? 'loot' : 'dealt');
      a.dmgAcc = 0;
        a.view.flash('hit');
        }
      if (a.hp <= 0) this.play.kill(a);
    }
    onHurt(a) { this.xp.taken();
      this.sweep.defend(a);
      }
    onKill(a) {
      const c = this.castle;
        this.wild.onKill(a);
        this.xp.killed(a);
        if (a.gameKind) this.wildGame.onKill(a);
      if (a.raider) {
        const drops = {};
        for (const [r, lo, hi, p] of a.enemy.drops) if (Math.random() < p) drops[r] = (drops[r] || 0) + lo + Math.floor(Math.random() * (hi - lo + 1));
        if (c.kin.has('emberwright')) drops.ember_shard = (drops.ember_shard || 0) + 1;
        let y = 0;
          for (const [r, n] of Object.entries(drops)) { const got = Math.round(c.add(r, n));
        if (got > 0) { this.play.ui.float(a.x, a.y + 1.2 + y, a.z, `+${got}`, 'loot', K.CastleUI.ICON[r]);
          y += 0.35;
          this.cui.bump(r);
        if (this.raid) this.raid.drops[r] = (this.raid.drops[r] || 0) + got;
          } }
        if (this.raid) this.raid.killed++;
        this.sound.play('pop');
      }
      if (a.boss) {
        for (const [r, lo] of a.enemy.drops) c.add(r, lo);
        c.flags.add('killed:rime_troll');
          this.sound.play('fanfare');
          this.shake(0.5);
          this.puff(a.x, a.z);
          this.puff(a.x + 0.6, a.z - 0.3);
        this.cui.banner('The Rime Troll falls', 'It drops 10 gold, 4 iron and its warm heart. Carry the heart home to the Keep’s hearth.', 'heart');
      }
      this.changed();
    }
    tracer(a, b, color) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y + 1.1, a.z), new THREE.Vector3(b.x, b.y + 0.7, b.z)]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: color || 0xffe6a0, transparent: true, opacity: 1 }));
        l.userData.t = 0;
      this.group.add(l);
        this.tracers.push(l);
    }

    /* ---------- raids ---------- */
  }
  K.CastleGameCombat = CastleGameCombat;
})(typeof window !== 'undefined' ? window : globalThis);
