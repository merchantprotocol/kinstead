/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the bow. It hangs on the weapon rack inside your house; take it and it joins your hotbar (key 6),
   and you swap between it and your sword like any other tool. Click a foe to shoot it; hold Shift and click
   anywhere to shoot at that spot. Arrows fly over fences and walls of any kind (wood, dirt, stone), so you can
   defend your fort from behind it.
     BowTool   the hotbar entry (not a harvest tool; weak in melee)
     Arrow     one arrow in flight
     Archery   firing, flight, hits */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const SPEED = 24, RANGE = 26, GAP = 0.55, DAMAGE = 0.85;

  class BowTool extends K.Tool {
    constructor() { super('bow', '6', 'Bow', 'Bow out. Click a foe to shoot it. Hold Shift and click to shoot anywhere. Arrows fly over walls.'); }
    accepts() { return false; }
    get verb() { return 'shoot'; }
    get kind() { return 'weapon'; }
    get ranged() { return true; }
    get blurb() { return 'Click a foe to shoot it. Hold Shift and click to shoot anywhere. Arrows fly over walls.'; }
    get combat() { return { scale: 0.3, gap: 0.3, radius: 1.8, arc: Math.PI * 0.45 }; }   // in melee a bow is a poor club
  }

  class Arrow {
    constructor(group, mats, x, y, z, dx, dz) {
      this.dx = dx; this.dz = dz; this.travelled = 0; this.group = group;
      this.mesh = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.62), mats.mat('wood')), head = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 5), mats.mat('stone')), fletch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), mats.mat('snow'));
      head.rotation.x = Math.PI / 2; head.position.z = 0.36; fletch.position.z = -0.27; this.mesh.add(shaft, head, fletch);
      this.mesh.position.set(x, y, z); this.mesh.rotation.y = Math.atan2(dx, dz); group.add(this.mesh);
    }
    get at() { return this.mesh.position; }
    step(dt) { const d = SPEED * dt; this.mesh.position.x += this.dx * d; this.mesh.position.z += this.dz * d; this.travelled += d; }
    dispose() { this.group.remove(this.mesh); this.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  }

  class Archery {
    constructor(game) {
      this.g = game; this.arrows = []; this.lastShot = -9; this.shift = false; this.idleAt = 0;
      this.down = (e) => { if (e.key === 'Shift') this.shift = true; }; this.up = (e) => { if (e.key === 'Shift') this.shift = false; };
      G.addEventListener('keydown', this.down); G.addEventListener('keyup', this.up);
    }
    get play() { return this.g.play; }
    get fx() { return this.g.tools.effects; }
    /** a left-click with the bow out: shoot the foe under the pointer, or (Shift) the ground there. false = just walk. */
    click(sx, sy) {
      const P = this.play, e = P.pick(sx, sy);
      if (e && this.g.sweep.isFoe(e)) { this.shoot(e.x, e.z); return true; }
      if (this.shift) { const p = this.g.app.pickGround(sx, sy); if (p) { this.shoot(p.x, p.z); return true; } }
      return false;
    }
    shoot(tx, tz) {
      const P = this.play, me = P.me; if (!me.alive || P.t - this.lastShot < GAP) return;
      let dx = tx - me.x, dz = tz - me.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      this.lastShot = P.t; P.face(me, { x: tx, z: tz }); P.cancelChannel(); me.path = null; P.target = null;
      me.view.setState('action'); this.idleAt = P.t + 0.35; this.g.sound.play('swish');
      this.arrows.push(new Arrow(this.fx.group, this.fx.materials, me.x + dx * 0.5, (me.y || 0) + 1.0, me.z + dz * 0.5, dx, dz));
    }
    update(dt) {
      const P = this.play, me = P.me, nav = P.nav;
      this.arrows = this.arrows.filter((a) => {
        a.step(dt); const p = a.at;
        if (a.travelled > RANGE || p.y < nav.y(p.x, p.z) + 0.02) { a.dispose(); return false; }   // out of range, or into a hill; walls and fences do not stop it
        for (const f of P.actors) {
          if (!this.g.sweep.isFoe(f)) continue;
          if (Math.hypot(f.x - p.x, f.z - p.z) < (f.r || 0.4) + 0.3 && p.y > (f.y || 0) - 0.1 && p.y < (f.y || 0) + 1.7) { this.hit(f); a.dispose(); return false; }
        }
        return true;
      });
      if (this.idleAt && P.t > this.idleAt) { this.idleAt = 0; if (me.alive && me.view.state === 'action' && !P.ch) me.view.setState('idle'); }
    }
    hit(foe) {
      const P = this.play, me = P.me; me.dmgScale = DAMAGE; foe.aggro = true; foe.hostile = true; P.resolveHit(me, foe, 99);
      this.fx.burst('wood', foe.x, (foe.y || 0) + 0.7, foe.z, 4, 2); this.g.sound.play('hit');
    }
    dispose() { G.removeEventListener('keydown', this.down); G.removeEventListener('keyup', this.up); this.arrows.forEach((a) => a.dispose()); this.arrows = []; }
  }

  Object.assign(K, { BowTool, Arrow, Archery });
})(typeof window !== 'undefined' ? window : globalThis);
