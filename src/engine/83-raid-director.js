/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · RaidDirector: the dusk raids. Queues the night's frost creatures, spawns them at the frost edges, lets the
   glow and the towers burn them, and settles the night at dawn (or when the Keep falls). */
(function (G) {
  const K = G.K;

  class RaidDirector {
    /* raider kind -> [sprite, scale, speed, tint] */
    static LOOKS = { frostling: ['ghoulB', 0.8, 1.4, 0xd8f0ff], frost_wolf: ['ghoulA', 0.75, 2.3, 0x9fc8ff], rime_ghoul: ['ghoulA', 1.05, 1.15, 0x7fb0ff] };

    constructor(game) { this.g = game; this.raid = null; }
    reset() { this.raid = null; }
    keepGoal() { return { x: this.g.L.keep.x, z: this.g.L.keep.z }; }
    isNightish() { const day = this.g.day; return day.isNight || (day.kind === 'day' && day.warned); }
    start() {
      const g = this.g;
      if (g.survival) return;   // the wild (wolves, a thief) replaces raids
      const ph = g.day.phase, spec = g.data.raw.aiRaids[ph.raid];
      if (!spec) return;
      const list = this.shuffledSpawns(spec), sides = spec.sides >= 2 ? ['north', 'south'] : ['north'];
      const queue = list.map((id, i) => ({ id, at: (i / Math.max(1, list.length - 1)) * spec.spawnWindowSec, side: sides[i % sides.length] }));
      this.raid = { phase: ph.id, spec, queue, t: 0, keepHp: g.castle.keepHpMax(), alive: 0, killed: 0, drops: {}, frosted: 0, lost: false, spawned: 0 };
      for (const p of g.castle.pieces) p.hp = g.pieceHpMax(p);
      g.cui.raidStart(this.raid);
    }
    shuffledSpawns(spec) {
      const list = [];
      for (const [id, n] of Object.entries(spec.spawns)) for (let i = 0; i < n; i++) list.push(id);
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    }
    spawnRaider(q) {
      const g = this.g, e = g.data.enemy(q.id), edge = g.L.frostEdges[q.side], x = edge.x0 + Math.random() * (edge.x1 - edge.x0), z = edge.z;
      const look = RaidDirector.LOOKS[q.id], desc = 'A frost creature. It walks straight at the Keep and attacks whatever is in its way.';
      const a = g.addActor({ id: 'r' + Math.random().toString(36).slice(2, 8), role: 'enemy', spriteId: look[0], name: e.name, x, z, hpMax: e.hp,
        atk: e.atk, def: e.defense, speed: look[2], cd: 1.4, reach: 0.9, scale: look[1], level: 1, info: { xp: 0, loot: [], desc } });
      a.view.setTint(look[3]);
      a.enemy = e;
      a.raider = true;
      a.frost = true;
      a.hostile = true;
      a.fast = q.id === 'frost_wolf';
      a.brain = new K.RaiderBrain(g, a, this.goalFor(x, z));
      this.raid.alive++;
      this.raid.spawned++;
    }
    /** a third of them go for an exposed producer first */
    goalFor(x, z) {
      const prods = this.g.castle.producers().filter((p) => !p.frosted);
      if (!prods.length || Math.random() >= 0.35) return this.keepGoal();
      prods.sort((p1, p2) => Math.hypot(p1.x - x, p1.z - z) - Math.hypot(p2.x - x, p2.z - z));
      return { x: prods[0].x, z: prods[0].z, piece: prods[0] };
    }
    update(dt) {
      const r = this.raid;
      if (!r) return;
      r.t += dt;
      while (r.queue.length && r.queue[0].at <= r.t) this.spawnRaider(r.queue.shift());
      const raiders = this.g.play.actors.filter((a) => a.raider && a.alive);
      r.alive = raiders.length;
      this.burnInGlow(raiders, dt);   // the glow burns frost creatures (at most 3 at once), towers shoot, braziers burn
      for (const p of this.g.castle.pieces) this.shoot(p, raiders, dt);
      this.heroEngages(raiders);
      this.g.cui.raidTick(r);
    }
    burnInGlow(raiders, dt) {
      const g = this.g, c = g.castle, keep = g.L.keep, dist = (a) => Math.hypot(a.x - keep.x, a.z - keep.z);
      const inGlow = raiders.filter((a) => dist(a) <= c.glowRadius()).sort((a, b) => dist(a) - dist(b)).slice(0, g.data.raw.aiRaids.thawTargets);
      for (const a of inGlow) g.hurtEnemy(a, c.row().thawDps * dt, 'glow');
    }
    /** a watchtower or brazier shoots the nearest raider in range (a manned tower hits harder) */
    shoot(p, raiders, dt) {
      const g = this.g;
      if (p.broken || (p.type !== 'watchtower' && p.type !== 'ember_brazier')) return;
      p.shotT = (p.shotT || 0) - dt;
      if (p.shotT > 0) return;
      const d = g.data.piece(p.type), manned = p.type === 'watchtower' && Object.values(g.kinActors).some((k) => k.manning === p);
      const best = this.nearest(raiders, p, d.rangeM);
      if (!best) return;
      p.shotT = 0.5;
      if (p.type === 'watchtower') g.tracer({ x: p.x, y: g.play.nav.y(p.x, p.z) + 2.6, z: p.z }, best, 0xfff0c0);
      g.hurtEnemy(best, (manned ? d.dpsManned : d.dps) * 0.5, 'tower', true);
    }
    nearest(raiders, from, range) {
      let best = null, bd = range;
      for (const a of raiders) {
        if (!a.alive) continue;
        const d = Math.hypot(a.x - from.x, a.z - from.z);
        if (d < bd) { bd = d; best = a; }
      }
      return best;
    }
    /** the hero swings at raiders in reach when idle */
    heroEngages(raiders) {
      const play = this.g.play, me = play.me;
      if (!me.alive || play.target || play.ch || me.path) return;
      const best = this.nearest(raiders, me, 2.4);
      if (best) play.target = best;
    }
    /** the night ends: dawn came (the clock already moved on) or the Keep fell (move the clock on now) */
    endNight(lost, ev) {
      const g = this.g, c = g.castle, r = this.raid;
      if (r && r.done) return;
      if (r) r.done = true;
      const ph = ev ? ev.from : g.day.phase;
      this.clearRaiders();
      let lossTxt = null;
      if (lost) {
        lossTxt = c.raidLoss();
        c.flags.add('ended:' + ph.id);
        g.sound.play('crack');
      } else {
        c.flags.add('survived:' + ph.id);
        c.flags.add('ended:' + ph.id);
        g.sound.play('fanfare');
      }
      if (!ev) ev = g.day.advance({ lost: !!lost });
      this.raid = null;
      const tally = { drops: r ? r.drops : {}, killed: r ? r.killed : 0, frosted: r ? r.frosted : 0 };
      g.cui.raidResult(Object.assign({ lost: !!lost, loss: lossTxt, night: ph, next: ev.phase }, tally));
      this.onDawn(ph);
      g.changed();
    }
    clearRaiders() {
      const g = this.g;
      for (const a of g.play.actors.slice()) {
        if (!a.raider) continue;
        if (a.alive) g.puff(a.x, a.z);
        g.removeActor(a);
      }
    }
    /** dawn: frost thaws, broken pieces stand again at full strength, and zones whose night is over open */
    onDawn(night) {
      const g = this.g, c = g.castle;
      c.flags.add('dawn:' + night.id);
      c.thawAtDawn();
      for (const p of c.pieces) this.rebuild(p);
      for (const z of g.data.raw.zones) {
        if (z.opensAfter !== night.id || c.zoneOpen(z.id)) continue;
        c.flags.add('zone:' + z.id);
        g.openBarrier(z.id);
      }
      for (const p of c.pieces) g.setFrost(p, c.isFrosted(p));
      g.play.refreshProps();
    }
    rebuild(p) {
      const g = this.g;
      p.hp = g.pieceHpMax(p);
      if (!p.broken) return;
      p.broken = false;
      const m = g.meshes.get('p' + p.uid);
      if (m) { m.visible = true; g.pop(m, 0.5); }
    }
  }

  K.RaidDirector = RaidDirector;
})(typeof window !== 'undefined' ? window : globalThis);
