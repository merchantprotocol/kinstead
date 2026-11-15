/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · wild game. Deer, elk, bison and wild horses wander the map in small herds by day and are gone at night.
   Hunt them for raw meat (cook it at your hearth, or let your cook do it).
     AnimalView   a voxel animal body (boxes with swinging legs) that stands in for the usual actor view
     GrazerBrain  grazes with its herd; runs from you when you come close or hit it (a bison turns and fights)
     WildGame     keeps a few herds around you in daylight, sends them away at dusk, hands out the meat */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const rnd = (a, b) => a + Math.random() * (b - a), dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  /* the animals: size, colours, how they behave and what they give */
  const KINDS = {
    deer: { name: 'Deer', hp: 22, speed: 1.0, flee: 3.6, meat: 3, scale: 1, r: 0.35, herd: [2, 4], body: 0xb37a45, belly: 0xe9d8bc, dark: 0x4a3322, antler: 0xd8c7a0, fight: false },
    elk: { name: 'Elk', hp: 48, speed: 0.9, flee: 3.2, meat: 6, scale: 1.35, r: 0.5, herd: [2, 3], body: 0x7a5232, belly: 0xc8a878, dark: 0x3a2618, antler: 0xe0d2b0, fight: false },
    bison: { name: 'Bison', hp: 90, speed: 0.7, flee: 2.6, meat: 9, scale: 1.45, r: 0.7, herd: [3, 5], body: 0x4a3020, belly: 0x5e3e28, dark: 0x2a1a10, antler: 0xd8d4c8, fight: true, atk: 9 },
    horse: { name: 'Wild horse', hp: 36, speed: 1.1, flee: 4.2, meat: 4, scale: 1.25, r: 0.45, herd: [2, 4], body: 0x8a4a26, belly: 0x9a5a32, dark: 0x2a1a12, antler: 0x2a1a12, fight: false },
  };
  const HORSE_COATS = [0x8a4a26, 0x6e6a66, 0xd8d0c4, 0x3a2a20, 0xb07a40];

  const BOX = new THREE.BoxGeometry(1, 1, 1);
  /** a voxel animal: same methods as the sprite/voxel actor views, so the game drives it like any other actor */
  class AnimalView {
    constructor(R, kind, opts = {}) {
      this.R = R; this.kind = kind; const s = this.spec = KINDS[kind]; this.scale = (opts.scale || 1) * s.scale; this.phase = Math.random() * 7;
      this.pos = new THREE.Vector3(); this.dir = new THREE.Vector3(0, 0, 1); this.state = 'idle'; this.stateT = 0; this.visible = true; this.flashT = 0; this.hl = null; this.deadT = 0;
      this.mats = []; const mat = (hex) => { const m = new THREE.MeshLambertMaterial({ color: hex }); this.mats.push(m); return m; };
      const coat = kind === 'horse' ? HORSE_COATS[Math.floor(Math.random() * HORSE_COATS.length)] : s.body;
      const M = { body: mat(coat), belly: mat(kind === 'horse' ? coat : s.belly), dark: mat(s.dark), horn: mat(s.antler), eye: mat(0x101010), white: mat(0xf4f0e8), nose: mat(0x2a2220) };
      const root = this.group = new THREE.Group(), body = this.body = new THREE.Group(); root.add(body);
      const part = (g, m, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(BOX, m); o.position.set(x, y, z); o.scale.set(w, h, d); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
      const legH = kind === 'bison' ? 0.42 : kind === 'horse' ? 0.62 : 0.55, top = legH;
      this.legs = [];
      for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const pivot = new THREE.Group(); pivot.position.set(x * (kind === 'bison' ? 0.17 : 0.12), top, z * (kind === 'bison' ? 0.3 : 0.27)); body.add(pivot);
        part(pivot, M.body, 0, -legH * 0.3, 0, 0.08, legH * 0.6, 0.08); part(pivot, kind === 'deer' || kind === 'elk' ? M.belly : M.body, 0, -legH * 0.75, 0, 0.065, legH * 0.4, 0.065); part(pivot, M.dark, 0, -legH + 0.03, 0.01, 0.08, 0.06, 0.1);
        this.legs.push(pivot);
      }
      if (kind === 'bison') {
        part(body, M.body, 0, top + 0.2, -0.12, 0.46, 0.44, 0.62); part(body, M.dark, 0, top + 0.22, 0.26, 0.56, 0.6, 0.42); part(body, M.dark, 0, top + 0.55, 0.18, 0.4, 0.22, 0.34);   // shaggy front and hump
        const head = this.head = new THREE.Group(); head.position.set(0, top + 0.2, 0.5); body.add(head);
        part(head, M.dark, 0, 0, 0.1, 0.3, 0.32, 0.28); part(head, M.nose, 0, -0.06, 0.25, 0.2, 0.14, 0.06); part(head, M.dark, 0, -0.18, 0.12, 0.14, 0.14, 0.12);
        part(head, M.horn, -0.18, 0.1, 0.06, 0.12, 0.05, 0.05, 0, 0, 0.6); part(head, M.horn, 0.18, 0.1, 0.06, 0.12, 0.05, 0.05, 0, 0, -0.6); part(head, M.eye, -0.15, 0.04, 0.17, 0.02, 0.04, 0.04); part(head, M.eye, 0.15, 0.04, 0.17, 0.02, 0.04, 0.04);
        part(body, M.dark, 0, top + 0.18, -0.46, 0.04, 0.2, 0.04, 0.4);
      } else {
        const long = kind === 'horse' ? 0.78 : kind === 'elk' ? 0.7 : 0.62, thick = kind === 'horse' ? 0.3 : 0.26;
        part(body, M.body, 0, top + thick / 2, 0, thick, thick, long); part(body, M.belly, 0, top + 0.02, 0, thick * 0.85, 0.06, long * 0.8);
        if (kind !== 'horse') part(body, M.white, 0, top + thick * 0.6, -long / 2 - 0.02, thick * 0.6, thick * 0.5, 0.04);   // the white rump
        const neck = new THREE.Group(); neck.position.set(0, top + thick * 0.8, long / 2 - 0.06); body.add(neck);
        part(neck, M.body, 0, 0.16, 0.06, thick * 0.55, 0.36, thick * 0.6, -0.45);
        if (kind === 'horse') part(neck, M.dark, 0, 0.2, -0.02, 0.05, 0.36, 0.12, -0.45);                     // mane
        if (kind === 'elk') part(neck, M.dark, 0, 0.12, 0.04, thick * 0.65, 0.3, thick * 0.66, -0.45);
        const head = this.head = new THREE.Group(); head.position.set(0, 0.34, 0.2); neck.add(head);
        part(head, M.body, 0, 0, 0.06, 0.16, 0.16, 0.2); part(head, kind === 'horse' ? M.body : M.belly, 0, -0.03, 0.2, 0.12, 0.11, 0.16); part(head, M.nose, 0, -0.03, 0.29, 0.09, 0.07, 0.02);
        part(head, M.eye, -0.085, 0.03, 0.1, 0.02, 0.035, 0.035); part(head, M.eye, 0.085, 0.03, 0.1, 0.02, 0.035, 0.035);
        part(head, M.body, -0.07, 0.11, -0.01, 0.05, 0.1, 0.03, 0, 0, 0.4); part(head, M.body, 0.07, 0.11, -0.01, 0.05, 0.1, 0.03, 0, 0, -0.4);   // ears
        if (kind === 'deer' || kind === 'elk') {   // antlers
          const big = kind === 'elk' ? 1.6 : 1;
          for (const sx of [-1, 1]) { part(head, M.horn, sx * 0.07, 0.17 * big, 0, 0.03, 0.22 * big, 0.03, 0, 0, sx * -0.35); part(head, M.horn, sx * 0.13 * big, 0.3 * big, 0.02, 0.03, 0.16 * big, 0.03, 0.5, 0, sx * -0.9); part(head, M.horn, sx * 0.1 * big, 0.27 * big, 0.06, 0.025, 0.12 * big, 0.025, -0.6, 0, sx * -0.2); }
        }
        part(body, kind === 'horse' ? M.dark : M.white, 0, top + thick * 0.55, -long / 2 - 0.06, 0.06, kind === 'horse' ? 0.36 : 0.1, 0.06, kind === 'horse' ? 0.3 : -0.4);   // tail
      }
      this.h = (top + 0.7) * this.scale; this.w = 0.7 * this.scale; root.scale.setScalar(this.scale);
      this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42 * this.scale, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2;
      R.scene.add(root, this.shadow);
    }
    setTint() {} setSprite() {} setTeam() {}
    setPosition(x, y, z) { this.pos.set(x, y, z); }
    setFacing(dx, dz) { const L = Math.hypot(dx, dz); if (L > 1e-4) this.dir.set(dx / L, 0, dz / L); }
    setState(s) { if (s === this.state && s !== 'attack' && s !== 'hurt') return; this.prev = this.state; this.state = s; this.stateT = 0; }
    setHighlight(c) { this.hl = c || null; }
    flash(kind = 'hit') { this.flashKind = kind; this.flashT = 0.22; }
    setVisible(v) { this.visible = v; this.group.visible = v; this.shadow.visible = v; }
    update(t, dt) {
      this.stateT += dt; const st = this.state, T = this.stateT, g = this.group;
      const sp = st === 'run' ? 16 : st === 'walk' ? 7 : 0, amp = st === 'run' ? 0.8 : st === 'walk' ? 0.45 : 0;
      this.legs.forEach((l, i) => { l.rotation.x = amp ? Math.sin(t * sp + this.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * amp : l.rotation.x * 0.8; });
      if (this.head) this.head.rotation.x = st === 'idle' ? 0.5 + Math.sin(t * 0.7 + this.phase) * 0.25 : st === 'attack' ? 0.6 : 0;   // heads down to graze when standing
      if (st === 'attack' && T > 0.5) this.setState('idle'); if (st === 'hurt' && T > 0.3) this.setState(this.prev === 'hurt' ? 'idle' : this.prev || 'idle');
      const yaw = Math.atan2(this.dir.x, this.dir.z); g.rotation.set(0, yaw, 0);
      let tip = 0, sink = 0; if (st === 'dead') { const k = Math.min(1, T / 0.5); tip = 1.5 * k; sink = 0.1 * k; } g.rotation.z = tip;
      const bob = st === 'run' ? Math.abs(Math.sin(t * 16 + this.phase)) * 0.06 : 0;
      g.position.set(this.pos.x, this.pos.y + bob - sink, this.pos.z); this.shadow.position.set(this.pos.x, this.pos.y + 0.02, this.pos.z);
      const e = this.flashT > 0 ? (this.flashT -= dt, 0xff3020) : this.hl ? new THREE.Color(this.hl).getHex() : 0x000000;
      for (const m of this.mats) m.emissive.setHex(e === 0xff3020 ? 0x601008 : this.hl ? 0x302818 : 0x000000);
    }
    screenRect(camera, W, H) {
      const v = new THREE.Vector3(), p = this.pos, out = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9, front: true };
      for (const [x, y, z] of [[p.x - this.w * 0.6, p.y, p.z], [p.x + this.w * 0.6, p.y + this.h, p.z], [p.x, p.y + this.h * 0.5, p.z - this.w * 0.6], [p.x, p.y + this.h * 0.5, p.z + this.w * 0.6]]) {
        v.set(x, y, z).project(camera); if (v.z > 1) out.front = false; const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
        out.x0 = Math.min(out.x0, sx); out.x1 = Math.max(out.x1, sx); out.y0 = Math.min(out.y0, sy); out.y1 = Math.max(out.y1, sy);
      }
      return out;
    }
    dispose() { this.R.scene.remove(this.group, this.shadow); for (const m of this.mats) m.dispose(); this.shadow.geometry.dispose(); this.shadow.material.dispose(); }
  }

  /** grazes, drifts with its herd, runs from you; a bison stands and fights when hurt */
  class GrazerBrain extends K.Brain {
    constructor(game, a, herd) { super(game, a); this.herd = herd; this.spot = null; this.wait = rnd(0, 4); this.fleeT = 0; this.tired = 0; this.leaving = false; }
    blocker() { const g = this.g, T = K.TILE; return (i, j) => g.gateTiles.has(i + ',' + j) || g.insideBuilding((i + 0.5) * T, (j + 0.5) * T); }
    anim(moving, speed) { const v = this.a.view; if (v.state === 'attack' || v.state === 'hurt' || v.state === 'dead') return; const want = moving ? (speed > 2 ? 'run' : 'walk') : 'idle'; if (v.state !== want) v.setState(want); }
    /** the nearest player (you or another settler) */
    threat() { const P = this.P, g = this.g, cand = [P.me]; if (g.mp) for (const r of g.mp.avatars.by.values()) cand.push(r.a); let best = null, bd = Infinity; for (const c of cand) { if (!c || !c.alive) continue; const d = dist(c, this.a); if (d < bd) { bd = d; best = c; } } return [best, bd]; }
    update(dt) {
      const a = this.a, s = KINDS[a.gameKind]; if (!this.tickDead(dt)) return; this.cd -= dt; this.fleeT -= dt; this.tired = Math.max(0, this.tired - dt * 0.5);
      if (this.leaving) { const lp = this.leaveTo; if (!lp || dist(a, lp) < 2) { this.g.wildGame.remove(a); return; } this.goTo(lp.x, lp.z, s.speed * 2.2, 1.5, dt); return; }
      const [foe, d] = this.threat(), hurt = a.hp < a.hpMax - 0.01;
      if (s.fight && hurt && foe && d < 14) {   // a hurt bison charges whoever is closest
        const reach = a.reach + (foe.r || 0.3) + 0.4; if (d <= reach) { a.path = null; this.face(foe); if (this.cd <= 0) { this.cd = 1.4; this.P.swing(a, foe); } this.anim(false); return; }
        this.goTo(foe.x, foe.z, s.flee, reach * 0.8, dt); return;
      }
      if (foe && (d < 7 || (hurt && d < 18)) && this.tired < 6) {   // too close: bolt directly away (they tire after a long run, so you can catch up)
        if (this.fleeT <= 0 || !a.path || !a.path.length) { this.fleeT = 1.2; const dx = a.x - foe.x, dz = a.z - foe.z, L = Math.hypot(dx, dz) || 1, r = 9; const tx = a.x + dx / L * r, tz = a.z + dz / L * r; a.path = this.P.nav.find(a.x, a.z, tx, tz, { range: 3, maxNodes: 1500, blocked: this.blocker() }) || null; }
        if (a.path && a.path.length) { this.P.move(a, dt, s.flee); this.anim(true, s.flee); this.tired += dt; return; }
      }
      if ((this.wait -= dt) > 0) { if (!a.path || !a.path.length) { this.anim(false); return; } }
      if (!a.path || !a.path.length) {   // graze: amble to a spot near the herd's centre
        this.wait = rnd(3, 9); const c = this.herd.centre(), ang = rnd(0, 6.283), r = rnd(1, 4);
        this.herd.drift(dt * 10); const tx = c.x + Math.cos(ang) * r, tz = c.z + Math.sin(ang) * r;
        if (this.P.nav.standable(tx, tz)) a.path = this.P.nav.find(a.x, a.z, tx, tz, { range: 0.6, maxNodes: 1200, blocked: this.blocker() }) || null;
      }
      const moved = a.path && a.path.length ? this.P.move(a, dt, s.speed) : false; this.anim(moved, s.speed);
    }
    face(t) { this.a.view.setFacing(t.x - this.a.x, t.z - this.a.z); }
  }

  /** a herd: its members graze around a centre that wanders slowly */
  class Herd {
    constructor(x, z) { this.x = x; this.z = z; this.members = []; this.heading = rnd(0, 6.283); }
    centre() { return { x: this.x, z: this.z }; }
    drift(k) { this.heading += rnd(-0.4, 0.4); this.x += Math.cos(this.heading) * 0.15 * k; this.z += Math.sin(this.heading) * 0.15 * k; }
  }

  class WildGame {
    constructor(game) { this.g = game; this.herds = []; this.t = 3; this.max = 14; }
    get animals() { return this.g.play.actors.filter((a) => a.gameKind && a.alive); }
    update(dt) {
      if ((this.t -= dt) > 0) return; this.t = 4; const g = this.g, night = g.calendar.isNight;
      this.herds = this.herds.filter((h) => h.members.some((a) => g.play.actors.includes(a)));
      if (night) { for (const a of this.animals) if (!a.brain.leaving) { a.brain.leaving = true; a.brain.leaveTo = g.wild.leavePoint(a); } return; }   // dusk: they slip away
      const me = g.play.me; for (const a of this.animals) if (dist(a, me) > 110) this.remove(a);   // far behind you: gone
      if (this.animals.length < this.max) this.spawnHerd();
    }
    spawnHerd() {
      const g = this.g, P = g.play, me = P.me, kinds = Object.keys(KINDS), kind = kinds[Math.floor(Math.random() * kinds.length)], s = KINDS[kind];
      for (let tries = 0; tries < 10; tries++) {
        const ang = rnd(0, 6.283), r = rnd(30, 60), x = me.x + Math.cos(ang) * r, z = me.z + Math.sin(ang) * r;
        if (!P.nav.standable(x, z) || g.isSanctuary(x, z) || g.home.inside(x, z)) continue;
        const herd = new Herd(x, z), n = Math.round(rnd(s.herd[0], s.herd[1]));
        for (let i = 0; i < n; i++) { const ax = x + rnd(-2, 2), az = z + rnd(-2, 2); if (P.nav.standable(ax, az)) herd.members.push(this.spawn(kind, ax, az, herd)); }
        if (herd.members.length) { this.herds.push(herd); return herd; }
      }
      return null;
    }
    spawn(kind, x, z, herd) {
      const g = this.g, s = KINDS[kind];
      const a = g.addActor({ id: 'g' + kind[0] + Math.random().toString(36).slice(2, 7), role: 'enemy', spriteId: 'wolf', name: s.name, x, z, hpMax: s.hp, atk: s.atk || 0, def: 0, speed: s.flee, cd: 1.4, reach: 0.9, r: s.r, scale: 1, level: 1, info: { xp: 0, loot: [] } });
      a.view.dispose(); a.view = new AnimalView(g.R, kind); a.view.setPosition(a.x, a.y || 0, a.z); a.view.setFacing(rnd(-1, 1), rnd(-1, 1));
      a.gameKind = kind; a.hostile = true; a.aggro = false; a.prey = true; a.brain = new GrazerBrain(g, a, herd || new Herd(x, z)); return a;
    }
    remove(a) { if (this.g.play.actors.includes(a)) this.g.removeActor(a); }
    /** you brought one down: its meat goes in your bag (cook it at the hearth) */
    onKill(a) {
      const g = this.g, P = g.play, s = KINDS[a.gameKind], n = s.meat;
      const got = P.player.canAdd('raw_meat', n) ? n : 0; if (got) P.player.addItem('raw_meat', got);
      P.float(P.me, got ? `+${got} raw meat` : 'Your bag is full', got ? 'loot' : 'miss'); g.sound.play('pop'); g.cui.toast(got ? `You brought down a ${s.name.toLowerCase()}: ${got} raw meat. Cook it at your hearth.` : 'Your bag is too full to carry the meat.');
    }
    dispose() { for (const a of this.animals) this.remove(a); }
  }

  Object.assign(K, { AnimalView, GrazerBrain, WildGame, GAME_ANIMALS: KINDS });
})(typeof window !== 'undefined' ? window : globalThis);
