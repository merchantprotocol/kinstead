/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameTroll extends K.CastleGameKin {
    slamStart(s) { this.ring = this.art.ring(); this.ring.scale.setScalar(s.r); this.place(this.ring, s.x, s.z, 0); this.ring.position.y += 0.08;
    this.cui.toast('Ground slam! Step out of the ring!'); }
    slamRing(s, k) { if (this.ring) { this.ring.material.opacity = 0.35 + 0.6 * k; this.ring.scale.setScalar(s.r * (0.6 + 0.4 * k)); } }
    slamHit(s, dmg) {
      if (this.ring) { this.group.remove(this.ring); this.ring.geometry.dispose(); this.ring = null; }
      this.sound.play('thunk'); this.shake(0.4); this.puff(s.x, s.z);
      const me = this.play.me; if (me.alive && Math.hypot(me.x - s.x, me.z - s.z) < s.r) { this.play.float(me, '-' + Math.round(dmg), 'hurt');
      me.view.flash('hit'); if (this.play.player.hurt(Math.round(dmg))) this.play.defeat(); }
      else if (me.alive) this.play.float(me, 'dodged!', 'heal');
      for (const a of Object.values(this.kinActors)) if (a.alive && this.castle.kin.has(a.kinId) && Math.hypot(a.x - s.x,
      a.z - s.z) < s.r) this.hurtAlly(a, dmg * 0.5);
    }

    /* ---------- combat glue ---------- */
  }
  K.CastleGameTroll = CastleGameTroll;
})(typeof window !== 'undefined' ? window : globalThis);
