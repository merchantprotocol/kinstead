/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameKin extends K.CastleGameBuilding {
    touchEmberwright() {
      const c = this.castle;
        c.flags.add('touched:emberwright');
      if (c.has('great_hall')) this.joinKin('emberwright', '“A seat at the table? Then I’ll keep your braziers burning.”');
      else { this.play.float(this.kinActors.emberwright, '…a seat at a table…', 'loot');
      this.cui.toast('The ice cracks. She whispers: “Give me a seat at a table, and I’ll come.” (Restore the Great Hall.)');
        this.sound.play('crack');
        }
      this.changed();
    }

    /* ---------- kin ---------- */
    kinTier() { return this.castle.has('ember_forge') ? 3 : this.castle.has('smithy') ? 2 : 1;
      }
    kinStats(id) {
      const t = this.kinTier(), night = this.isNightish() && this.castle.has('barracks') ? 1.2 : 1;
      if (id === 'pinewarden') return { hp: 60 + 20 * t, atk: (4 + 2 * t) * night, cd: 1.3, ranged: true, color: 0xffe6a0 };
      if (id === 'emberwright') return { hp: 50 + 20 * t, atk: (5 + 2 * t) * night, cd: 1.5, ranged: true, color: 0xff8a3c };
      return { hp: 120 + 30 * t, atk: (8 + 3 * t) * night, cd: 1.6, ranged: false };
    }
    spawnKin(id) {
      const c = this.castle, at = this.L.kin[id], joined = c.kin.has(id);
      if (id === 'rime_brute' && !joined && !c.flags.has('brute:walking')) return;
      const v3 = !!(K.ActorViews && K.ActorViews.enabled);
        // the 3D view has a hooded ranger; the 2D sprite set does not
      const sprite = { pinewarden: v3 ? 'ranger' : 'warden', emberwright: 'witch', rime_brute: 'troll' }[id], h = this.data.hero(id);
      const pos = joined ? { x: this.play.me.x + 1, z: this.play.me.z + 1 } : at;
      const a = this.addActor({ id: 'kin:' + id, role: 'npc', spriteId: sprite, name: h.name, x: pos.x, z: pos.z, hpMax: 80, atk: 6, def: 0,
      speed: id === 'rime_brute' ? 2.0 : 2.3, cd: 1.4, reach: 1, scale: id === 'rime_brute' ? (v3 ? 0.75 : 0.95) : 1, level: 1 });
      a.type = 'c_kin';
        a.kinId = id;
        a.hostile = false;
      if (id === 'pinewarden' && !v3) a.view.setTint(0x9fdc8a);
        if (id === 'rime_brute' && !v3) a.view.setTint(0xa8d8ff);
      // the voxel troll is already ice-blue: a tint only washes it out
      a.brain = new K.KinBrain(this, a, id);
        this.kinActors[id] = a;
      if (!joined && id !== 'rime_brute') { const ice = this.art.ice(1.1, 1.9, 0.9, id.length);
        this.place(ice, at.x, at.z, 0);
        a.ice = ice;
        }
      if (id === 'rime_brute' && !joined) a.walkIn = true;
      return a;
    }
    joinKin(id, line) {
      const c = this.castle;
        if (c.kin.has(id)) return;
        c.kin.add(id);
      const a = this.kinActors[id] || this.spawnKin(id);
      if (a.ice) { this.group.remove(a.ice);
        a.ice = null;
        this.sound.play('crack');
        this.puff(a.x, a.z);
        }
      a.view.flash('heal');
        this.play.float(a, 'Joins you!', 'heal');
        this.sound.play('fanfare');
      this.cui.banner(this.data.hero(id).name + ' joins', line + ' · ' + this.data.hero(id).perk, 'kin');
      this.changed();
    }
    checkKin(dt) {
      const c = this.castle;
        if (this.survival) return;
      if (!c.kin.has('pinewarden') && c.cl() >= 2 && c.glowRadius() >= Math.hypot(this.L.kin.pinewarden.x - this.L.keep.x,
      this.L.kin.pinewarden.z - this.L.keep.z)) this.joinKin('pinewarden', '“You kept a fire lit? Then I’m staying.”');
      if (!c.kin.has('emberwright') && c.flags.has('touched:emberwright') && c.has('great_hall')) this.joinKin('emberwright',
      '“A seat at the table? Then I’ll keep your braziers burning.”');
      if (!c.kin.has('rime_brute') && c.flags.has('dawn:night2') && c.cl() >= 4 && !c.flags.has('brute:walking')) { c.flags.add('brute:walking');
      this.spawnKin('rime_brute');
        this.cui.toast('Something huge walks out of the frost… and kneels by your fire.');
        }
      const b = this.kinActors.rime_brute;
      if (b && b.walkIn && !c.kin.has('rime_brute')) {
        const kx = this.L.hearth.x + 1.5, kz = this.L.hearth.z + 2.5;
        if (!b.path) b.path = this.play.nav.find(b.x, b.z, kx, kz, { range: 1.2 });
        if (!this.play.move(b, dt, 2.2) || Math.hypot(b.x - kx, b.z - kz) < 1.5) { b.walkIn = false;
        this.joinKin('rime_brute', '“Your fire is warmer than the frost. I’ll fight beside you.”');
          }
        else b.view.setState('walk');
      }
    }
    addActor(cfg) {
      const play = this.play, a = new (play.me.constructor)(play, Object.assign({ info: { xp: 0, loot: [] }, flip: false }, cfg));
      play.actors.push(a);
        return a;
    }
    removeActor(a) { const play = this.play;
      const i = play.actors.indexOf(a);
      if (i >= 0) play.actors.splice(i, 1);
      a.view.dispose();
    if (play.target === a) play.target = null;
      if (play.hover === a) play.hover = null;
      }

    /* ---------- the troll ---------- */
    spawnTroll() {
      const e = this.data.enemy('rime_troll'), at = this.L.troll;
      const a = this.addActor({ id: 'troll', role: 'enemy', spriteId: 'troll', name: e.name, x: at.x, z: at.z, hpMax: e.hp, atk: e.atk,
      def: e.defense, speed: 1.5, cd: 2, reach: 1.25, r: 0.7, scale: K.ActorViews && K.ActorViews.enabled ? 1.15 : 1.55,
      /* the voxel troll is 2.9 m at scale 1 */ level: 4, flip: true, info: { xp: 0, loot: [],
      desc: 'Bridge-keeper. Every third swing is a ground slam: step out of the glowing ring.' } });
      a.enemy = e;
        a.boss = true;
        a.hostile = true;
        a.brain = new K.TrollBrain(this, a);
        this.troll = a;
    }
  }
  K.CastleGameKin = CastleGameKin;
})(typeof window !== 'undefined' ? window : globalThis);
