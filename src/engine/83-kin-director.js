/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · KinDirector: your kin. The Pinewarden, the Emberwright and the Rime Brute: where they wait in the ice,
   when they join you, how strong they are, and the brute's long walk to your fire. */
(function (G) {
  const K = G.K;

  class KinDirector {
    static LINES = {
      pinewarden: '“You kept a fire lit? Then I’m staying.”',
      emberwright: '“A seat at the table? Then I’ll keep your braziers burning.”',
      rime_brute: '“Your fire is warmer than the frost. I’ll fight beside you.”',
    };

    constructor(game) { this.g = game; this.actors = {}; }
    get c() { return this.g.castle; }
    reset() { this.actors = {}; }
    tier() { return this.c.has('ember_forge') ? 3 : this.c.has('smithy') ? 2 : 1; }
    stats(id) {
      const t = this.tier(), night = this.g.isNightish() && this.c.has('barracks') ? 1.2 : 1;
      if (id === 'pinewarden') return { hp: 60 + 20 * t, atk: (4 + 2 * t) * night, cd: 1.3, ranged: true, color: 0xffe6a0 };
      if (id === 'emberwright') return { hp: 50 + 20 * t, atk: (5 + 2 * t) * night, cd: 1.5, ranged: true, color: 0xff8a3c };
      return { hp: 120 + 30 * t, atk: (8 + 3 * t) * night, cd: 1.6, ranged: false };
    }
    spawn(id) {
      const g = this.g, c = this.c, at = g.L.kin[id], joined = c.kin.has(id), brute = id === 'rime_brute';
      if (brute && !joined && !c.flags.has('brute:walking')) return undefined;
      const v3 = !!(K.ActorViews && K.ActorViews.enabled);   // the 3D view has a hooded ranger; the 2D sprite set does not
      const sprite = { pinewarden: v3 ? 'ranger' : 'warden', emberwright: 'witch', rime_brute: 'troll' }[id], h = g.data.hero(id);
      const pos = joined ? { x: g.play.me.x + 1, z: g.play.me.z + 1 } : at;
      const scale = brute ? (v3 ? 0.75 : 0.95) : 1;
      const a = g.addActor({ id: 'kin:' + id, role: 'npc', spriteId: sprite, name: h.name, x: pos.x, z: pos.z, hpMax: 80, atk: 6, def: 0,
        speed: brute ? 2.0 : 2.3, cd: 1.4, reach: 1, scale, level: 1 });
      a.type = 'c_kin';
      a.kinId = id;
      a.hostile = false;
      if (!v3) this.tint(a, id);
      a.brain = new K.KinBrain(g, a, id);
      this.actors[id] = a;
      if (!joined && !brute) this.freeze(a, at, id);
      if (brute && !joined) a.walkIn = true;
      return a;
    }
    /** the voxel troll is already ice-blue: a tint only washes it out, so only the 2D sprites are tinted */
    tint(a, id) {
      if (id === 'pinewarden') a.view.setTint(0x9fdc8a);
      if (id === 'rime_brute') a.view.setTint(0xa8d8ff);
    }
    freeze(a, at, id) {
      const ice = this.g.art.ice(1.1, 1.9, 0.9, id.length);
      this.g.place(ice, at.x, at.z, 0);
      a.ice = ice;
    }
    join(id, line) {
      const g = this.g, c = this.c;
      if (c.kin.has(id)) return;
      c.kin.add(id);
      const a = this.actors[id] || this.spawn(id), h = g.data.hero(id);
      if (a.ice) {
        g.group.remove(a.ice);
        a.ice = null;
        g.sound.play('crack');
        g.puff(a.x, a.z);
      }
      a.view.flash('heal');
      g.play.float(a, 'Joins you!', 'heal');
      g.sound.play('fanfare');
      g.cui.banner(h.name + ' joins', line + ' · ' + h.perk, 'kin');
      g.changed();
    }
    touchEmberwright() {
      const g = this.g, c = this.c;
      c.flags.add('touched:emberwright');
      if (c.has('great_hall')) this.join('emberwright', KinDirector.LINES.emberwright);
      else {
        g.play.float(this.actors.emberwright, '…a seat at a table…', 'loot');
        g.cui.toast('The ice cracks. She whispers: “Give me a seat at a table, and I’ll come.” (Restore the Great Hall.)');
        g.sound.play('crack');
      }
      g.changed();
    }
    /** per frame: anyone ready to join does, and the brute keeps walking to the fire */
    check(dt) {
      const g = this.g, c = this.c, L = g.L;
      if (g.survival) return;
      const wardenDist = Math.hypot(L.kin.pinewarden.x - L.keep.x, L.kin.pinewarden.z - L.keep.z);
      if (!c.kin.has('pinewarden') && c.cl() >= 2 && c.glowRadius() >= wardenDist) this.join('pinewarden', KinDirector.LINES.pinewarden);
      if (!c.kin.has('emberwright') && c.flags.has('touched:emberwright') && c.has('great_hall')) this.join('emberwright', KinDirector.LINES.emberwright);
      if (!c.kin.has('rime_brute') && c.flags.has('dawn:night2') && c.cl() >= 4 && !c.flags.has('brute:walking')) {
        c.flags.add('brute:walking');
        this.spawn('rime_brute');
        g.cui.toast('Something huge walks out of the frost… and kneels by your fire.');
      }
      this.walkBruteIn(dt);
    }
    walkBruteIn(dt) {
      const g = this.g, b = this.actors.rime_brute;
      if (!b || !b.walkIn || this.c.kin.has('rime_brute')) return;
      const kx = g.L.hearth.x + 1.5, kz = g.L.hearth.z + 2.5;
      if (!b.path) b.path = g.play.nav.find(b.x, b.z, kx, kz, { range: 1.2 });
      if (!g.play.move(b, dt, 2.2) || Math.hypot(b.x - kx, b.z - kz) < 1.5) {
        b.walkIn = false;
        this.join('rime_brute', KinDirector.LINES.rime_brute);
      } else b.view.setState('walk');
    }
  }

  K.KinDirector = KinDirector;
})(typeof window !== 'undefined' ? window : globalThis);
