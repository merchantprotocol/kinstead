/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · watchtowers. Each of your watchtowers has a bowman on top who shoots the nearest wolf, bear or raider
   within 12 m, about once a second, day and night. His arrows fly from the platform and land a moment later.
     Towers   finds targets, looses arrows, lands the hits */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const RANGE = 12, GAP = 1.1, DMG = 7, SPEED = 26, TOP = 3.4;

  class Towers {
    constructor(game) { this.g = game; this.cd = new Map(); this.flying = []; }
    get play() { return this.g.play; }
    /** a creature a bowman will shoot: hostile, alive, and run by this game (other players' creatures are theirs) */
    target(t) {
      let best = null, bd = RANGE;
      for (const a of this.play.actors) { if (!a.alive || !a.hostile || a.remote || a === this.play.me) continue; const d = Math.hypot(a.x - t.x, a.z - t.z); if (d < bd) { bd = d; best = a; } }
      return best;
    }
    update(dt) {
      const g = this.g, now = this.play.t;
      for (const p of g.castle.pieces) {
        if (p.type !== 'watchtower') continue; if ((this.cd.get(p.uid) || 0) > now) continue;
        const foe = this.target(p); if (!foe) continue; this.cd.set(p.uid, now + GAP); this.loose(p, foe);
      }
      this.flying = this.flying.filter((f) => {
        f.t += dt; const k = Math.min(1, f.t / f.dur), a = f.foe, x = f.x0 + (a.x - f.x0) * k, z = f.z0 + (a.z - f.z0) * k, y = f.y0 + ((a.y || 0) + 0.8 - f.y0) * k + Math.sin(k * Math.PI) * 0.6;
        f.mesh.position.set(x, y, z); f.mesh.lookAt(a.x, (a.y || 0) + 0.8, a.z);
        if (k < 1) return true; g.group.remove(f.mesh); f.mesh.geometry.dispose();
        if (a.alive) { a.hp -= DMG; a.aggro = true; this.play.float(a, String(DMG), 'dealt'); a.view.flash && a.view.flash('hit'); if (a.hp <= 0) this.play.kill(a); }
        return false;
      });
    }
    loose(p, foe) {
      const g = this.g, y0 = this.play.nav.y(p.x, p.z) + TOP, d = Math.hypot(foe.x - p.x, foe.z - p.z);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), this.mat || (this.mat = new THREE.MeshLambertMaterial({ color: 0x8a5a32 })));
      g.group.add(mesh); this.flying.push({ mesh, foe, t: 0, dur: Math.max(0.15, d / SPEED), x0: p.x, z0: p.z, y0 }); g.sound.play('swish');
    }
    dispose() { for (const f of this.flying) this.g.group.remove(f.mesh); this.flying = []; }
  }

  K.Towers = Towers;
})(typeof window !== 'undefined' ? window : globalThis);
