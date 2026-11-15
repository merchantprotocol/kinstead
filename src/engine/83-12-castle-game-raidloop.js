/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameRaidLoop extends K.CastleGameRaid {
    updateRaid(dt) {
      const r = this.raid; if (!r) return; r.t += dt;
      while (r.queue.length && r.queue[0].at <= r.t) this.spawnRaider(r.queue.shift());
      const raiders = this.play.actors.filter((a) => a.raider && a.alive); r.alive = raiders.length;
      const c = this.castle, keep = this.L.keep;
      // the glow burns frost creatures (at most 3 at once), towers shoot, braziers burn
      const inGlow = raiders.filter((a) => Math.hypot(a.x - keep.x, a.z - keep.z) <= c.glowRadius()).sort((a, b) => Math.hypot(a.x - keep.x,
      a.z - keep.z) - Math.hypot(b.x - keep.x, b.z - keep.z)).slice(0, this.data.raw.aiRaids.thawTargets);
      for (const a of inGlow) this.hurtEnemy(a, c.row().thawDps * dt, 'glow');
      for (const p of c.pieces) {
        if (p.broken) continue; const d = this.data.piece(p.type);
        if (p.type === 'watchtower' || p.type === 'ember_brazier') {
          p.shotT = (p.shotT || 0) - dt; if (p.shotT > 0) continue;
          const manned = p.type === 'watchtower' && Object.values(this.kinActors).some((k) => k.manning === p);
          const range = d.rangeM, dps = manned ? d.dpsManned : d.dps;
          let best = null, bd = range; for (const a of raiders) { if (!a.alive) continue; const dd = Math.hypot(a.x - p.x, a.z - p.z);
          if (dd < bd) { bd = dd; best = a; } }
          if (best) { p.shotT = 0.5; if (p.type === 'watchtower') this.tracer({ x: p.x, y: this.play.nav.y(p.x, p.z) + 2.6, z: p.z }, best, 0xfff0c0);
          this.hurtEnemy(best, dps * 0.5, 'tower', true); }
        }
      }
      // the hero swings at raiders in reach when idle
      const play = this.play, me = play.me;
      if (me.alive && !play.target && !play.ch && !me.path) { let best = null, bd = 2.4;
      for (const a of raiders) { const d = Math.hypot(a.x - me.x, a.z - me.z); if (d < bd) { bd = d; best = a; } } if (best) { play.target = best; } }
      this.cui.raidTick(r);
    }
    /* the night ends: dawn came (the clock already moved on) or the Keep fell (move the clock on now) */
    endNight(lost, ev) {
      const r = this.raid; if (r && r.done) return; if (r) r.done = true;
      const ph = ev ? ev.from : this.day.phase;
      for (const a of this.play.actors.slice()) if (a.raider) { if (a.alive) this.puff(a.x, a.z); this.removeActor(a); }
      let lossTxt = null;
      if (lost) { lossTxt = this.castle.raidLoss(); this.castle.flags.add('ended:' + ph.id); this.sound.play('crack'); }
      else { this.castle.flags.add('survived:' + ph.id); this.castle.flags.add('ended:' + ph.id); this.sound.play('fanfare'); }
      if (!ev) ev = this.day.advance({ lost: !!lost });
      this.raid = null;
      this.cui.raidResult({ lost: !!lost, loss: lossTxt, drops: r ? r.drops : {}, killed: r ? r.killed : 0, frosted: r ? r.frosted : 0, night: ph,
      next: ev.phase });
      this.onDawn(ph);
      this.changed();
    }
    onDawn(night) {
      const c = this.castle; c.flags.add('dawn:' + night.id); c.thawAtDawn();
      for (const p of c.pieces) { p.hp = this.pieceHpMax(p); if (p.broken) { p.broken = false; const m = this.meshes.get('p' + p.uid);
      if (m) { m.visible = true; this.pop(m, 0.5); } } }
      for (const z of this.data.raw.zones) if (z.opensAfter === night.id && !c.zoneOpen(z.id)) { c.flags.add('zone:' + z.id); this.openBarrier(z.id); }
      for (const p of c.pieces) this.setFrost(p, c.isFrosted(p));
      this.play.refreshProps();
    }
  }
  K.CastleGameRaidLoop = CastleGameRaidLoop;
})(typeof window !== 'undefined' ? window : globalThis);
