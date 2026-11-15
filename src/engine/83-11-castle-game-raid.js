/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameRaid extends K.CastleGameCombat {
    keepGoal() { return { x: this.L.keep.x, z: this.L.keep.z };
      }
    isNightish() { return this.day.isNight || (this.day.kind === 'day' && this.day.warned);
      }
    startRaid() {
      if (this.survival) return;
        // the wild (wolves, a thief) replaces raids
      const ph = this.day.phase, spec = this.data.raw.aiRaids[ph.raid];
        if (!spec) return;
      const list = [];
        for (const [id, n] of Object.entries(spec.spawns)) for (let i = 0; i < n; i++) list.push(id);
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
        }
      const sides = spec.sides >= 2 ? ['north', 'south'] : ['north'];
      this.raid = { phase: ph.id, spec,
      queue: list.map((id, i) => ({ id, at: (i / Math.max(1, list.length - 1)) * spec.spawnWindowSec, side: sides[i % sides.length] })), t: 0,
      keepHp: this.castle.keepHpMax(), alive: 0, killed: 0, drops: {}, frosted: 0, lost: false, spawned: 0 };
      for (const p of this.castle.pieces) p.hp = this.pieceHpMax(p);
      this.cui.raidStart(this.raid);
    }
    spawnRaider(q) {
      const e = this.data.enemy(q.id), edge = this.L.frostEdges[q.side], x = edge.x0 + Math.random() * (edge.x1 - edge.x0), z = edge.z;
      const look = { frostling: ['ghoulB', 0.8, 1.4, 0xd8f0ff], frost_wolf: ['ghoulA', 0.75, 2.3, 0x9fc8ff], rime_ghoul: ['ghoulA', 1.05, 1.15,
      0x7fb0ff] }[q.id];
      const a = this.addActor({ id: 'r' + Math.random().toString(36).slice(2, 8), role: 'enemy', spriteId: look[0], name: e.name, x, z, hpMax: e.hp,
      atk: e.atk, def: e.defense, speed: look[2], cd: 1.4, reach: 0.9, scale: look[1], level: 1, info: { xp: 0, loot: [],
      desc: 'A frost creature. It walks straight at the Keep and attacks whatever is in its way.' } });
      a.view.setTint(look[3]);
        a.enemy = e;
        a.raider = true;
        a.frost = true;
        a.hostile = true;
        a.fast = q.id === 'frost_wolf';
      // a third of them go for an exposed producer first
      const prods = this.castle.producers().filter((p) => !p.frosted);
      let goal = this.keepGoal();
      if (prods.length && Math.random() < 0.35) { prods.sort((p1, p2) => Math.hypot(p1.x - x, p1.z - z) - Math.hypot(p2.x - x, p2.z - z));
      goal = { x: prods[0].x, z: prods[0].z, piece: prods[0] };
        }
      a.brain = new K.RaiderBrain(this, a, goal);
        this.raid.alive++;
        this.raid.spawned++;
    }
    pieceHpMax(p) { const d = this.data.piece(p.type);
    return Math.round((typeof d.hp === 'number' ? d.hp : 100) * (d.category === 'defense' && this.castle.kin.has('rime_brute') ? 1.5 : 1));
      }
    /* the first standing defense piece whose footprint the point (x,z) with radius r touches */
    blockingPiece(x, z, r) {
      for (const p of this.castle.pieces) {
        const d = this.data.piece(p.type);
          if (d.category !== 'defense' || p.broken || p.type === 'ember_brazier') continue;
        const [w, dd] = CastleArt.size(p.type), c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.x, dz = z - p.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= w / 2 + r && Math.abs(lz) <= dd / 2 + r) return p;
      }
      return null;
    }
    /* an armed enemy hits one of your structures (a gate, a wall, the door). Unarmed creatures never call this. */
    hurtStructure(s, n) {
      this.sound.play('hit');
        this.shake(0.05);
      if (s.door) { s.door.hurt(n);
        return;
        }
      const p = s.piece, m = this.meshes.get('p' + p.uid);
        if (m) m.userData.shake = 0.25;
      p.hp -= n;
        this.play.float({ x: p.x, z: p.z, y: this.play.nav.y(p.x, p.z), h: 1 }, '-' + n, 'hurt');
      if (p.hp <= 0) { this.cui.toast(`Your ${this.data.piece(p.type).name.toLowerCase()} was broken down!`);
        this.demolishPiece(p, { refund: false });
        }
    }
    hurtPiece(p, n) {
      p.hp -= n;
        this.sound.play('hit');
      const m = this.meshes.get('p' + p.uid);
        if (m) { m.userData.shake = 0.25;
        }
      this.play.ui.float(p.x, 1.6, p.z, '-' + n, 'hurt');
      if (p.hp <= 0 && !p.broken) { p.broken = true;
        if (m) m.visible = false;
        this.puff(p.x, p.z);
      this.cui.toast(`A ${this.data.piece(p.type).name.toLowerCase()} is broken! (It rebuilds free at dawn.)`);
        }
    }
    hurtKeep(n) {
      const r = this.raid;
        if (!r || r.lost) return;
        r.keepHp -= n;
        this.play.ui.float(this.L.keep.x, 4.5, this.L.keep.z, '-' + n, 'hurt');
      this.sound.play('hit');
      if (r.keepHp <= 0) { r.keepHp = 0;
        this.endNight(true);
        }
    }
    onFrosted(p) { this.setFrost(p, true);
      if (this.raid) this.raid.frosted++;
      this.play.ui.float(p.x, 2.2, p.z, 'Frosted!', 'hurt');
    this.sound.play('crack');
      this.cui.toast(`Raiders frosted your ${this.data.piece(p.type).name}: no production until the morning. Walls protect income.`);
      }
  }
  K.CastleGameRaid = CastleGameRaid;
})(typeof window !== 'undefined' ? window : globalThis);
