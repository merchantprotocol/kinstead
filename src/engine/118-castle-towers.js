/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · watchtowers. Each of your watchtowers has a bowman on top who shoots the nearest wolf, bear or raider
   within 24 m. Bowmen focus each target until an arrow is already lethal, letting them clear packs. His arrows fly from the platform and land a moment later.
     Towers   finds targets, looses arrows, lands the hits */
(function (G) {
  const K = G.K, THREE = G.THREE;

  class Towers {
    static RANGE = 24;
    static COOLDOWN = 0.5;
    static DAMAGE = 7;
    static WOLF_DAMAGE = 30;
    static ARROW_SPEED = 60;
    static PLATFORM_HEIGHT = 3.4;

    constructor(game) { this.g = game; this.cd = new Map(); this.flying = []; }
    get play() { return this.g.play; }
    /** a creature a bowman will shoot: hostile, alive, and run by this game (other players' creatures are theirs) */
    target(t) {
      let best = null, bd = Towers.RANGE;
      for (const actor of this.play.actors) {
        if (!actor.alive || !actor.hostile || actor.remote || actor === this.play.me) continue;
        if (this.pendingDamage(actor) >= actor.hp) continue;
        const distance = Math.hypot(actor.x - t.x, actor.z - t.z);
        if (distance < bd) { bd = distance; best = actor; }
      }
      return best;
    }
    pendingDamage(actor) {
      return this.flying.filter((arrow) => arrow.foe === actor).length * this.damage(actor);
    }
    damage(actor) { return actor.wolf ? Towers.WOLF_DAMAGE : Towers.DAMAGE; }
    update(dt) {
      const g = this.g, now = this.play.t;
      for (const p of g.castle.pieces) {
        if (p.type !== 'watchtower' && p.type !== 'stone_tower') continue;
        if ((this.cd.get(p.uid) || 0) > now) continue;
        const foe = this.target(p);
        if (!foe) continue;
        this.cd.set(p.uid, now + Towers.COOLDOWN);
        this.loose(p, foe);
      }
      this.flying = this.flying.filter((arrow) => {
        arrow.t += dt;
        const progress = Math.min(1, arrow.t / arrow.dur), actor = arrow.foe;
        const x = arrow.x0 + (actor.x - arrow.x0) * progress;
        const z = arrow.z0 + (actor.z - arrow.z0) * progress;
        const y = arrow.y0 + ((actor.y || 0) + 0.8 - arrow.y0) * progress + Math.sin(progress * Math.PI) * 0.6;
        arrow.mesh.position.set(x, y, z);
        arrow.mesh.lookAt(actor.x, (actor.y || 0) + 0.8, actor.z);
        if (progress < 1) return true;
        g.group.remove(arrow.mesh);
        arrow.mesh.geometry.dispose();
        if (actor.alive) {
          const damage = this.damage(actor);
          actor.hp -= damage;
          actor.aggro = true;
          this.play.float(actor, String(damage), 'dealt');
          actor.view.flash && actor.view.flash('hit');
          if (actor.hp <= 0) this.play.kill(actor);
        }
        return false;
      });
    }
    loose(p, foe) {
      const g = this.g, y0 = this.play.nav.y(p.x, p.z) + Towers.PLATFORM_HEIGHT;
      const d = Math.hypot(foe.x - p.x, foe.z - p.z);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), this.mat || (this.mat = new THREE.MeshLambertMaterial({ color: 0x8a5a32 })));
      g.group.add(mesh); this.flying.push({ mesh, foe, t: 0, dur: Math.max(0.15, d / Towers.ARROW_SPEED), x0: p.x, z0: p.z, y0 }); g.sound.play('swish');
    }
    dispose() { for (const f of this.flying) this.g.group.remove(f.mesh); this.flying = []; }
  }

  K.Towers = Towers;
})(typeof window !== 'undefined' ? window : globalThis);
