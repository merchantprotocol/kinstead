/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · StructureDamage: enemies hitting what you built. Piece strength, the defense in a raider's way, broken
   walls and gates, a frosted producer, and the Keep's own hit points during a raid. */
(function (G) {
  const K = G.K;

  class StructureDamage {
    constructor(game) { this.g = game; }
    pieceHpMax(p) {
      const g = this.g, d = g.data.piece(p.type), base = typeof d.hp === 'number' ? d.hp : 100;
      return Math.round(base * (d.category === 'defense' && g.castle.kin.has('rime_brute') ? 1.5 : 1));
    }
    /** the first standing defense piece whose footprint the point (x, z) with radius r touches */
    blockingPiece(x, z, r) {
      const g = this.g;
      for (const p of g.castle.pieces) {
        const d = g.data.piece(p.type);
        if (d.category !== 'defense' || p.broken || p.type === 'ember_brazier') continue;
        const [w, dd] = K.CastleArt.size(p.type), c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.x, dz = z - p.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= w / 2 + r && Math.abs(lz) <= dd / 2 + r) return p;
      }
      return null;
    }
    shakeMesh(p) {
      const m = this.g.meshes.get('p' + p.uid);
      if (m) m.userData.shake = 0.25;
      return m;
    }
    /** an armed enemy hits one of your structures (a gate, a wall, the door). Unarmed creatures never call this. */
    hurtStructure(s, n) {
      const g = this.g;
      g.sound.play('hit');
      g.shake(0.05);
      if (s.door) { s.door.hurt(n); return; }
      const p = s.piece;
      this.shakeMesh(p);
      p.hp -= n;
      g.play.float({ x: p.x, z: p.z, y: g.play.nav.y(p.x, p.z), h: 1 }, '-' + n, 'hurt');
      if (p.hp > 0) return;
      g.cui.toast(`Your ${g.data.piece(p.type).name.toLowerCase()} was broken down!`);
      g.demolishPiece(p, { refund: false });
    }
    /** a raider hits a defense piece: at 0 hp it breaks (and stands again free at dawn) */
    hurtPiece(p, n) {
      const g = this.g;
      p.hp -= n;
      g.sound.play('hit');
      const m = this.shakeMesh(p);
      g.play.ui.float(p.x, 1.6, p.z, '-' + n, 'hurt');
      if (p.hp > 0 || p.broken) return;
      p.broken = true;
      if (m) m.visible = false;
      g.puff(p.x, p.z);
      g.cui.toast(`A ${g.data.piece(p.type).name.toLowerCase()} is broken! (It rebuilds free at dawn.)`);
    }
    hurtKeep(n) {
      const g = this.g, r = g.raid;
      if (!r || r.lost) return;
      r.keepHp -= n;
      g.play.ui.float(g.L.keep.x, 4.5, g.L.keep.z, '-' + n, 'hurt');
      g.sound.play('hit');
      if (r.keepHp > 0) return;
      r.keepHp = 0;
      g.endNight(true);
    }
    onFrosted(p) {
      const g = this.g;
      g.setFrost(p, true);
      if (g.raid) g.raid.frosted++;
      g.play.ui.float(p.x, 2.2, p.z, 'Frosted!', 'hurt');
      g.sound.play('crack');
      g.cui.toast(`Raiders frosted your ${g.data.piece(p.type).name}: no production until the morning. Walls protect income.`);
    }
  }

  K.StructureDamage = StructureDamage;
})(typeof window !== 'undefined' ? window : globalThis);
