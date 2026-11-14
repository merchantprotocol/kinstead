/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · what work leaves in the world: pickups you walk over (logs, dirt cubes, stone chunks), flying
   chips, and the tree that crashes down. Each thing is a small class with one job; Effects is the facade the
   rest of the game talks to. They know nothing about tools, targets or the economy: Effects is given an
   `env` with floorY(x, z), hero(), canTake(kind), grant(pickup), notifyFull(kind), sound(name), shake(s). */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const COLOR = { dirt: 0x6b4a2b, stone: 0x9aa3b0, wood: 0x6a4424, iron: 0x9a5a3a, snow: 0xeef5fb, leaf: 0x1f4a32, gold: 0xe2a63a, ember_shard: 0xff7a2a, food: 0xd9824a, furn: 0xb07a3a };

  /** Shared geometry + materials, and the one place that makes a little mesh of a given kind. */
  class Materials {
    constructor() {
      this.mats = {}; for (const [k, c] of Object.entries(COLOR)) this.mats[k] = new THREE.MeshLambertMaterial({ color: c, flatShading: true });
      this.geo = { cube: new THREE.BoxGeometry(1, 1, 1), log: new THREE.CylinderGeometry(0.5, 0.5, 1, 7), cone: new THREE.ConeGeometry(1, 1, 7) };
    }
    mat(kind) { return this.mats[kind] || this.mats.stone; }
    /** a randomly turned mesh of `kind`, `size` metres across (a log is a short cylinder) */
    mesh(kind, size) {
      const m = kind === 'wood' ? new THREE.Mesh(this.geo.log, this.mat('wood')) : new THREE.Mesh(this.geo.cube, this.mat(kind));
      if (kind === 'wood') m.scale.set(size * 0.36, size * 1.7, size * 0.36); else m.scale.setScalar(size);
      m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); return m;
    }
    dispose() { Object.values(this.mats).forEach((m) => m.dispose()); Object.values(this.geo).forEach((g) => g.dispose()); }
  }

  /** A cosmetic chip: flies, falls, fades. Not collectable. */
  class Chip {
    constructor(mesh, vx, vy, vz, life) { this.mesh = mesh; this.vx = vx; this.vy = vy; this.vz = vz; this.life = life; }
    /** returns false when it is done and should be removed */
    update(dt, floorY) {
      const p = this.mesh.position; this.life -= dt; this.vy -= 12 * dt;
      p.x += this.vx * dt; p.y += this.vy * dt; p.z += this.vz * dt; this.mesh.rotation.x += dt * 6;
      const fy = floorY(p.x, p.z); if (p.y < fy) { p.y = fy; this.vy = 0; this.vx *= 0.5; this.vz *= 0.5; }
      return this.life > 0;
    }
  }
  class ParticleField {
    constructor(group, materials, floorY, cap = 160) { this.group = group; this.materials = materials; this.floorY = floorY; this.cap = cap; this.chips = []; }
    burst(kind, x, y, z, n, speed) {
      for (let q = 0; q < n && this.chips.length < this.cap; q++) {
        const m = this.materials.mesh(kind, rnd(0.04, 0.085)), a = rnd(0, 6.28), s = rnd(0.3, 1) * speed;
        m.position.set(x, y, z); this.group.add(m); this.chips.push(new Chip(m, Math.cos(a) * s, rnd(1.2, 3.2), Math.sin(a) * s, rnd(0.45, 0.8)));
      }
    }
    update(dt) { this.chips = this.chips.filter((c) => { const live = c.update(dt, this.floorY); if (!live) this.group.remove(c.mesh); return live; }); }
    clear() { for (const c of this.chips) this.group.remove(c.mesh); this.chips = []; }
  }

  /** A thing on the ground you collect by walking over it. A small state machine: tossed -> resting -> flying -> gone. */
  class Pickup {
    constructor(kind, value, mesh, size, vx, vy, vz, exact = false, payload = null) {
      this.exact = exact; this.payload = payload; this.kind = kind; this.value = value; this.mesh = mesh; this.size = size; this.vx = vx; this.vy = vy; this.vz = vz;
      this.state = 'tossed'; this.restT = 0; this.flyT = 0;
    }
    /** returns false once collected */
    update(dt, env) {
      switch (this.state) {
        case 'tossed': this.toss(dt, env); break;
        case 'resting': this.rest(dt, env); break;
        case 'flying': return this.fly(dt, env);
      }
      return true;
    }
    get at() { return this.mesh.position; }
    toss(dt, env) {
      const p = this.mesh.position; this.vy -= 14 * dt; p.x += this.vx * dt; p.y += this.vy * dt; p.z += this.vz * dt;
      this.mesh.rotation.x += dt * 5; this.mesh.rotation.z += dt * 4;
      const fy = env.floorY(p.x, p.z) + this.size * 0.5;
      if (p.y > fy) return;
      p.y = fy;
      if (Math.abs(this.vy) > 1.4) { this.vy = -this.vy * 0.36; this.vx *= 0.55; this.vz *= 0.55; } else { this.vx = this.vy = this.vz = 0; this.state = 'resting'; }
      this.checkReach(env);
    }
    rest(dt, env) {
      this.restT += dt; const p = this.mesh.position;
      p.y = env.floorY(p.x, p.z) + this.size * 0.5 + Math.sin(env.time() * 3 + p.x * 5) * 0.025; this.mesh.rotation.y += dt * 0.8;
      this.checkReach(env);
    }
    /** close enough to the hero: start flying to them (a little magnet once it has settled) */
    checkReach(env) {
      const hero = env.hero(); if (!hero || !hero.alive) return;
      const p = this.mesh.position, reach = this.restT > 0.35 ? 1.5 : 0.8;
      if (Math.hypot(hero.x - p.x, hero.z - p.z) > reach) return;
      if (!env.canTake(this.kind)) { env.notifyFull(this.kind); return; }
      this.state = 'flying';
    }
    fly(dt, env) {
      const hero = env.hero(), p = this.mesh.position; this.flyT += dt;
      if (!hero) return true;
      const k = Math.min(1, dt * 14); p.x += (hero.x - p.x) * k; p.y += (hero.y + 0.7 - p.y) * k; p.z += (hero.z - p.z) * k; this.mesh.scale.multiplyScalar(1 - dt * 3);
      if (this.flyT > 0.18 || Math.hypot(hero.x - p.x, hero.z - p.z) < 0.18) { env.grant(this); return false; }
      return true;
    }
  }
  class PickupField {
    constructor(group, materials, env, cap = 140) { this.group = group; this.materials = materials; this.env = env; this.cap = cap; this.items = []; }
    spawn(kind, value, x, y, z, speed, exact = false, payload = null) {
      if (this.items.length >= this.cap) this.group.remove(this.items.shift().mesh);
      const size = kind === 'wood' ? 0.34 : kind === 'dirt' ? 0.17 : 0.17 + value * 0.04, mesh = this.materials.mesh(kind, size), a = rnd(0, 6.28), s = rnd(0.4, 1) * speed;
      mesh.position.set(x, y, z); this.group.add(mesh);
      this.items.push(new Pickup(kind, value, mesh, size, Math.cos(a) * s, rnd(2.6, 4.4), Math.sin(a) * s, exact, payload));
    }
    update(dt) { this.items = this.items.filter((p) => { const live = p.update(dt, this.env); if (!live) this.group.remove(p.mesh); return live; }); }
    clear() { for (const p of this.items) this.group.remove(p.mesh); this.items = []; }
  }

  /** A pine crashing over, away from the hero. Calls onLanded({x, z}) (the fall direction) when it hits the ground. */
  class FallingTree {
    constructor(group, materials, x, y, z, fromX, fromZ, onLanded) {
      let dx = x - fromX, dz = z - fromZ; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      this.dir = { x: dx, z: dz }; this.at = { x, y, z }; this.axis = new THREE.Vector3(dz, 0, -dx); this.t = 0; this.onLanded = onLanded; this.group = group;
      this.root = new THREE.Group(); const trunk = new THREE.Mesh(materials.geo.log, materials.mat('wood')); trunk.scale.set(0.3, 2.1, 0.3); trunk.position.y = 1.05; this.root.add(trunk);
      for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(materials.geo.cone, materials.mat(k === 3 ? 'snow' : 'leaf')), r = 0.95 - k * 0.2; c.scale.set(r, 0.8, r); c.position.y = 0.9 + k * 0.62; this.root.add(c); }
      this.root.position.set(x, y, z); group.add(this.root);
    }
    /** returns false once it has landed */
    update(dt) {
      this.t += dt; const k = Math.min(1, this.t / 0.95);
      this.root.quaternion.setFromAxisAngle(this.axis, (Math.PI / 2) * k * k * 0.98);
      if (k < 1) return true;
      this.group.remove(this.root); this.onLanded(this.dir); return false;
    }
    clear() { this.group.remove(this.root); }
  }

  /** A cube flying from one place to a moving creature (a raider mining your supplies); calls onArrive when it lands on them. */
  class Courier {
    constructor(group, mesh, from, target, onArrive) { this.group = group; this.mesh = mesh; this.from = from; this.target = target; this.onArrive = onArrive; this.t = 0; group.add(mesh); }
    update(dt) {
      this.t += dt; const k = Math.min(1, this.t / 0.55), a = this.target, p = this.mesh.position, ty = (a.y || 0) + 1.0;
      p.x = this.from.x + (a.x - this.from.x) * k; p.z = this.from.z + (a.z - this.from.z) * k; p.y = this.from.y + (ty - this.from.y) * k + Math.sin(k * Math.PI) * 0.7; this.mesh.rotation.x += dt * 9; this.mesh.rotation.y += dt * 7;
      if (k < 1) return true; this.group.remove(this.mesh); this.onArrive(); return false;
    }
    clear() { this.group.remove(this.mesh); }
  }

  /** The facade: pickups, particles and falling trees behind one small interface. */
  class Effects {
    constructor(group, env) {
      this.group = group; this.env = env; this.materials = new Materials();
      this.particles = new ParticleField(group, this.materials, (x, z) => env.floorY(x, z));
      this.pickups = new PickupField(group, this.materials, env);
      this.trees = []; this.couriers = [];
    }
    burst(kind, x, y, z, n, speed) { this.particles.burst(kind, x, y, z, n, speed); }
    /** a cube of `kind` flies from `from` {x,y,z} to `actor`, then onArrive() */
    courier(kind, from, actor, onArrive) { this.couriers.push(new Courier(this.group, this.materials.mesh(kind, kind === 'wood' ? 0.2 : 0.14), from, actor, onArrive)); }
    /** exact: the value is paid in full (a refund), without the gather bonus a harvest gets */
    spawnPickup(kind, value, x, y, z, speed, exact = false, payload = null) { this.pickups.spawn(kind, value, x, y, z, speed, exact, payload); }
    /** fell a pine: crash, thud, snow puffs, then onLanded({x, z}) so the caller can drop the logs */
    fellTree(x, z, fromX, fromZ, onLanded) {
      const y = this.env.floorY(x, z); this.env.sound('whump');
      this.trees.push(new FallingTree(this.group, this.materials, x, y, z, fromX, fromZ, (dir) => {
        this.env.sound('thunk'); this.env.shake(0.3);
        for (let q = 0; q < 3; q++) this.burst('snow', x + dir.x * (0.6 + q * 0.7), y + 0.2, z + dir.z * (0.6 + q * 0.7), 6, 2.6);
        onLanded(dir);
      }));
    }
    update(dt) { this.trees = this.trees.filter((t) => t.update(dt)); this.couriers = this.couriers.filter((c) => c.update(dt)); this.particles.update(dt); this.pickups.update(dt); }
    dispose() { this.trees.forEach((t) => t.clear()); this.trees = []; this.couriers.forEach((c) => c.clear()); this.couriers = []; this.particles.clear(); this.pickups.clear(); this.materials.dispose(); }
  }

  Object.assign(K, { Materials, Chip, ParticleField, Pickup, PickupField, FallingTree, Courier, Effects });
})(typeof window !== 'undefined' ? window : globalThis);
