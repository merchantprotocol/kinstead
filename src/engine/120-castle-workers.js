/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the townsfolk (see docs/ECONOMY.md, phase 3). They live in your buildings and work from the marketplace.
     Errands     a worker's to-do list: walk somewhere, wait, do something
     Cook        lives in your cottage: fetches wheat, eggs, milk and beef from the market and cooks meals into your kitchen hearth
     Smith       lives in your blacksmith: fetches wood and iron from the market and forges what you order; spare arrows go to market
     Clerk       stands at your market stalls and sells to passing traders and to other players, at the prices you set
     Workers     all of them, prices, trading with other players over the server, saving */
(function (G) {
  const K = G.K, THREE = G.THREE, TILE = K.TILE;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const PRICE = { potion_heal: 12, potion_speed: 10, potion_strength: 10, potion_warmth: 8, wheat: 1, bread: 3, egg: 2, milk: 2, beef: 5, food: 2, arrow: 1, wood: 1, stone: 1, iron: 4, dirt: 1 };
  const MEALS = [
    { id: 'stew', name: 'beef stew', need: { beef: 1, milk: 1, wheat: 1 } },
    { id: 'omelette', name: 'omelette', need: { egg: 2, milk: 1 } },
    { id: 'cooked_meat', name: 'roast meat', need: { beef: 1 } },
    { id: 'bread', name: 'bread', need: { wheat: 3 } },
  ];
  const PANTRY_MAX = 8, COOK_TIME = 8, FORGE_TIME = 10;
  const POTIONS = { potion_heal: 'healing potion', potion_speed: 'potion of speed', potion_strength: 'potion of strength', potion_warmth: 'potion of warmth' };
  const ODDS = ['wood', 'stone', 'iron', 'wheat', 'egg', 'milk', 'beef', 'dirt'];

  const e3 = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

  /** What a worker's arms and body do while they work, on top of the base pose (play only asks views for 'action'):
      chop, hammer, saw, stir, sweep, pitch, lift, knead, milk, feed, brush, read, look, talk, warm. And what they carry:
      a sack, a log, a stone, a bucket… held in front in both arms. One shared instance; each view carries its own state
      (view.work, view.carry). Props are tiny shared VoxKit meshes, so dozens of workers cost almost nothing. */
  class WorkPoser {
    constructor(mats) { this.mats = mats; this.props = new Map(); }
    static PROPS = {
      sack: (k) => { k.box('canvas', 0, -0.13, 0, 0.3, 0.26, 0.2); k.box('rope', 0, 0.12, 0, 0.12, 0.04, 0.1); },
      flour: (k) => { k.box('paintWhite', 0, -0.13, 0, 0.3, 0.26, 0.2); k.box('rope', 0, 0.12, 0, 0.12, 0.04, 0.1); },
      wheat: (k) => { for (let i = 0; i < 5; i++) k.box('wheatGold', -0.08 + i * 0.04, -0.16, 0, 0.03, 0.42, 0.03, 0, 0, (i - 2) * 0.08); k.box('rope', 0, -0.02, 0, 0.2, 0.04, 0.05); },
      log: (k) => { k.geo('bark', K.VoxKit.CYL8, 0, 0, 0, 0, 0, Math.PI / 2, 0.09, 0.62, 0.09); k.geo('woodLight', K.VoxKit.CYL8, 0, 0, 0, 0, 0, Math.PI / 2, 0.07, 0.64, 0.07); },
      plank: (k) => { k.box('woodLight', 0, -0.03, 0, 0.72, 0.05, 0.14); k.box('woodLight', 0, 0.025, 0, 0.72, 0.05, 0.14); },
      stone: (k) => { k.box('stoneLight', 0, -0.12, 0, 0.28, 0.22, 0.24); },
      crate: (k) => { k.box('woodLight', 0, -0.15, 0, 0.3, 0.3, 0.26); k.box('woodDark', 0, -0.03, 0, 0.32, 0.05, 0.28); },
      bucket: (k) => { k.geo('woodMid', K.VoxKit.CYL, 0, -0.1, 0, 0, 0, 0, 0.1, 0.2, 0.1); k.geo('eggWhite', K.VoxKit.CYL, 0, 0.005, 0, 0, 0, 0, 0.085, 0.01, 0.085); k.box('ironDark', 0, 0.02, 0, 0.2, 0.02, 0.02); },
      bread: (k) => { k.box('woodMid', 0, -0.1, 0, 0.36, 0.08, 0.24); for (let i = 0; i < 3; i++) k.box('bread', -0.1 + i * 0.1, -0.03, 0, 0.09, 0.07, 0.18); },
      hay: (k) => { k.box('hay', 0, -0.14, 0, 0.42, 0.26, 0.28); k.box('rope', 0, -0.145, 0, 0.03, 0.27, 0.29); },
      meat: (k) => { k.box('meatRed', 0, -0.12, 0, 0.26, 0.18, 0.16); k.box('eggWhite', 0.1, -0.04, 0, 0.05, 0.05, 0.05); },
      eggs: (k) => { k.box('woodMid', 0, -0.1, 0, 0.3, 0.1, 0.2); for (let i = 0; i < 4; i++) k.box('eggWhite', -0.08 + (i % 2) * 0.12, -0.02, -0.04 + (i >> 1) * 0.08, 0.06, 0.07, 0.06); },
      potion: (k) => { k.box('potionPink', -0.05, -0.08, 0, 0.07, 0.12, 0.07); k.box('potionTeal', 0.06, -0.08, 0, 0.07, 0.12, 0.07); k.box('woodMid', 0, -0.12, 0, 0.22, 0.04, 0.12); },
      arrows: (k) => { for (let i = 0; i < 5; i++) k.box('woodLight', -0.06 + i * 0.03, -0.05, 0, 0.015, 0.015, 0.6); k.box('rope', 0, -0.05, 0, 0.18, 0.03, 0.04); },
      tray: (k) => { k.box('woodMid', 0, -0.06, 0, 0.36, 0.03, 0.26); k.box('food', -0.06, -0.03, 0, 0.12, 0.05, 0.1); k.box('bread', 0.08, -0.03, 0.02, 0.1, 0.06, 0.08); },
    };
    /** the shared meshes for one prop (built once) */
    meshes(name) {
      let m = this.props.get(name); if (m) return m; const f = WorkPoser.PROPS[name]; if (!f) return null;
      const k = new K.VoxKit(); f(k); m = k.meshes(this.mats, { cast: false }); this.props.set(name, m); return m;
    }
    /** keep the prop in the view's arms in step with view.carry */
    holdProp(v) {
      if (v.carryShown === v.carry) return; const R = v.rig; if (!R) return;
      if (v.carryGroup) { R.group.remove(v.carryGroup); v.carryGroup = null; } v.carryShown = v.carry; if (!v.carry) return;
      const ms = this.meshes(v.carry); if (!ms) return; const grp = new THREE.Group(), H = (v.h || 1.4) / (v.scale || 1);
      for (const m of ms) grp.add(new THREE.Mesh(m.geometry, m.material)); grp.position.set(0, H * 0.5, H * 0.2); R.group.add(grp); v.carryGroup = grp;
    }
    pose(v, t) {
      const R = v.rig; if (!R) return; this.holdProp(v);
      const B = R.bones, rest = R.rest, ph = v.phase || 0;
      const set = (n, x, y = 0, z = 0) => { const b = B[n]; if (!b) return; const r = rest[n].r; b.rotation.set(r.x + x, r.y + y, r.z + z); };
      const add = (n, x, y = 0, z = 0) => { const b = B[n]; if (b) { b.rotation.x += x; b.rotation.y += y; b.rotation.z += z; } };
      if (v.carry) { set('armR', -1.2, 0, 0.12); set('armL', -1.2, 0, -0.12); if (v.state !== 'action') return; }
      if (v.state !== 'action' || !v.work) return; const T = t + ph;
      switch (v.work) {
        case 'chop': { const c = (T % 1.05) / 1.05, a = c < 0.62 ? e3(c / 0.62) : 1 - e3((c - 0.62) / 0.14); set('armR', -0.4 - 2.3 * a, 0, -0.1); set('armL', -0.4 - 2.3 * a, 0, 0.1); add('torso', 0.28 * (1 - a) - 0.08); break; }
        case 'hammer': { const c = (T % 0.62) / 0.62, a = c < 0.6 ? e3(c / 0.6) : 1 - e3((c - 0.6) / 0.15); set('armR', -0.6 - 1.9 * a, 0, -0.12); set('armL', -0.95, 0, 0.2); add('torso', 0.14 * (1 - a)); break; }
        case 'saw': { const s = Math.sin(T * 8); set('armR', -1.1 + 0.38 * s, 0, -0.1); set('armL', -0.9, 0, 0.18); add('torso', 0.18, 0.1 * s); break; }
        case 'stir': { const s = Math.sin(T * 3), c = Math.cos(T * 3); set('armR', -1.0 + 0.18 * s, 0, -0.1 + 0.15 * c); set('armL', -1.0 + 0.18 * s, 0, 0.1 + 0.15 * c); add('torso', 0.14, 0.25 * c); break; }
        case 'sweep': { const s = Math.sin(T * 3.2); set('armR', -0.55, 0, -0.12); set('armL', -0.8, 0, 0.12); add('torso', 0.22, 0.45 * s); break; }
        case 'pitch': { const a = Math.sin(((T % 1.4) / 1.4) * Math.PI); set('armR', -0.7 - 0.9 * a, 0, -0.1); set('armL', -0.95 - 0.7 * a, 0, 0.1); add('torso', 0.45 * (1 - a), 0.3 * a); break; }
        case 'lift': { const a = Math.sin(((T % 1.6) / 1.6) * Math.PI); add('torso', 0.75 * a); set('armR', -0.5 - 0.9 * a); set('armL', -0.5 - 0.9 * a); add('head', -0.2 * a); break; }
        case 'knead': { const s = Math.abs(Math.sin(T * 4)); set('armR', -1.0 - 0.32 * s, 0, -0.05); set('armL', -1.0 - 0.32 * s, 0, 0.05); add('torso', 0.25 + 0.12 * s); break; }
        case 'milk': { const s = Math.sin(T * 7); add('torso', 0.55); set('armR', -0.9 + 0.28 * s); set('armL', -0.9 - 0.28 * s); break; }
        case 'feed': { const c = (T % 1.2) / 1.2, a = c < 0.3 ? c / 0.3 : 1 - (c - 0.3) / 0.7; set('armR', -0.4 - 1.0 * a, 0, -0.3 * a); set('armL', -0.85, 0, 0.2); add('torso', 0.06, 0.2 * a); break; }
        case 'brush': { const s = Math.sin(T * 5), c = Math.cos(T * 5); set('armR', -1.2 + 0.25 * s, 0, -0.2 + 0.2 * c); set('armL', -0.35, 0, 0.1); add('torso', 0.08, 0.1 * s); break; }
        case 'read': { set('armR', -0.95, 0, -0.25); set('armL', -0.95, 0, 0.25); add('head', 0.28 + 0.05 * Math.sin(T), 0.15 * Math.sin(T * 0.7)); break; }
        case 'look': { set('armR', -2.3, 0, -0.5); add('head', -0.05, 0.55 * Math.sin(T * 0.8)); add('torso', 0, 0.2 * Math.sin(T * 0.8)); break; }
        case 'talk': { const s = Math.sin(T * 4); set('armR', -0.7 + 0.32 * s, 0, -0.25); set('armL', -0.2, 0, 0.1); add('head', 0.06 * Math.sin(T * 6)); break; }
        case 'warm': { set('armR', -1.1, 0, -0.25); set('armL', -1.1, 0, 0.25); add('torso', 0.12); add('head', 0.1); break; }
      }
    }
  }

  /** Speech over a worker's head: a little bubble that follows them for a few seconds */
  class Bubbles {
    constructor(game) { this.g = game; this.live = []; this.root = document.createElement('div'); this.root.id = 'cTalk'; (game.cui && game.cui.root ? game.cui.root : document.body).appendChild(this.root); }
    say(a, text, t = 3) {
      if (!a || a.hidden) return; const old = this.live.find((b) => b.a === a); if (old) { old.el.textContent = text; old.t = t; return; }
      const el = document.createElement('div'); el.className = 'wk-say'; el.textContent = text; this.root.appendChild(el); this.live.push({ a, el, t });
    }
    update(dt) {
      const P = this.g.play; this.live = this.live.filter((b) => {
        if ((b.t -= dt) <= 0 || !b.a.view || b.a.hidden) { b.el.remove(); return false; }
        const [x, y, front] = P.toScreen(b.a.x, (b.a.y || 0) + (b.a.view.h || 1.4) + 0.3, b.a.z); b.el.style.display = front ? '' : 'none';
        b.el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`; return true;
      });
    }
    dispose() { for (const b of this.live) b.el.remove(); this.live = []; this.root.remove(); }
  }

  /** a worker's to-do list, run one step at a time */
  class Errands {
    constructor(game, a, job) { this.g = game; this.a = a; this.job = job; this.steps = []; this.repath = 0; }
    go(x, z) { this.steps.push({ go: { x, z } }); return this; }
    then(fn) { this.steps.push({ fn }); return this; }
    pause(t, anim = 'idle') { this.steps.push({ wait: t, anim }); return this; }
    /** work at a spot for t seconds: the pose is the trade (chop, hammer, stir…); face turns them toward what they work on */
    work(t, pose, face, opts = {}) { this.steps.push({ wait: t, anim: 'action', pose, face, spin: opts.spin || null }); return this; }
    carry(prop) { return this.then(() => { this.a.view.carry = prop || null; }); }
    say(text, t = 3) { return this.then(() => { this.job.w.bubbles && this.job.w.bubbles.say(this.a, text, t); }); }
    get busy() { return this.steps.length > 0; }
    update(dt) {
      const a = this.a, P = this.g.play, v = a.view, st = (s) => { if (v.state !== s && v.state !== 'hurt') v.setState(s); };
      if (a.chatT > 0) {   // stopped to talk to someone: face them, gesture, then carry on
        a.chatT -= dt; a.path = null; if (a.chatWith) P.face(a, a.chatWith); v.work = 'talk'; st('action'); if (a.chatT <= 0) { v.work = null; a.chatWith = null; } return;
      }
      if (!this.steps.length) { this.job.next(this, dt); if (!this.steps.length) { v.work = null; st('idle'); return; } }
      const s = this.steps[0];
      if (s.go) {
        if (dist(a, s.go) < 0.45) { this.steps.shift(); a.path = null; return; }
        if (!a.path || !a.path.length) {
          if ((this.repath -= dt) > 0) return; this.repath = 1;
          a.path = P.nav.find(a.x, a.z, s.go.x, s.go.z, { range: 0.3, maxNodes: 40000 }) || null;
          if (!a.path) { s.fail = (s.fail || 0) + 1; if (s.fail > 3) { a.x = s.go.x; a.z = s.go.z; this.steps.shift(); } return; }   // no way round: they get there anyway (a worker never stands stuck)
        }
        v.work = null; P.move(a, dt, a.speed); st('walk'); return;
      }
      if (s.wait != null) {
        if (s.face) P.face(a, s.face); v.work = s.pose || null; st(s.anim);
        if (s.spin) s.spin.turning = 0.3;
        if ((s.wait -= dt) <= 0) { this.steps.shift(); v.work = null; } return;
      }
      this.steps.shift(); if (s.fn && s.fn() === false) { this.steps = []; v.carry = null; }   // a step that fails ends the errand
    }
  }

  /** the door of a building spec, just outside */
  const doorOf = (spec) => { const d = spec.doors.find((q) => q.kind !== 'interior') || spec.doors[0], F = spec.footprint;
    let x = spec.x + d.x + (d.side === 'n' || d.side === 's' ? d.w / 2 : 0), z = spec.z + d.z + (d.side === 'e' || d.side === 'w' ? d.w / 2 : 0);
    if (d.side === 's') z += 1.8; else if (d.side === 'n') z -= 0.8; else if (d.side === 'e') x += 1.8; else x -= 0.8; void F; return { x: x * TILE, z: z * TILE }; };
  /** just inside the front door of a building spec */
  const insideOf = (spec) => { const d = spec.doors.find((q) => q.kind !== 'interior') || spec.doors[0];
    let x = spec.x + d.x + (d.side === 'n' || d.side === 's' ? d.w / 2 : 0.5), z = spec.z + d.z + (d.side === 'e' || d.side === 'w' ? d.w / 2 : 0.5);
    if (d.side === 's') z -= 1.2; else if (d.side === 'n') z += 1.2; else if (d.side === 'e') x -= 1.2; else x += 1.2; return { x: x * TILE, z: z * TILE }; };
  /** a point in a piece's own frame (lx along its width, lz toward its front) in the world */
  const local = (p, lx, lz) => { const r = p.rot || 0, c = Math.cos(r), s = Math.sin(r); return { x: p.x + lx * c + lz * s, z: p.z - lx * s + lz * c }; };

  /** where a worker stands to use a piece of furniture inside a walk-in building: a free floor tile right next to it, facing it */
  class Stations {
    constructor(game) { this.g = game; this.cache = new Map(); }
    /** [{ x, z, face, type }] for every item of these furniture types in the building */
    of(spec, types) {
      if (!spec) return []; const key = spec.id + ':' + spec.x + ',' + spec.z + ':' + types.join(','); let out = this.cache.get(key); if (out) return out;
      const nav = this.g.play.nav, F = K.FURNITURE || {}; out = [];
      for (const f of spec.furniture || []) {
        if (!types.includes(f.type)) continue; const def = F[f.type], [w0, d0] = def && def.size ? def.size : [1, 1], [w, d] = (f.rot || 0) % 2 ? [d0, w0] : [w0, d0];
        const cx = (spec.x + f.x + w / 2) * TILE, cz = (spec.z + f.z + d / 2) * TILE; let best = null, bd = 1e9;
        for (let r = 1; r <= 3 && !best; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const x = cx + di * TILE * 0.9, z = cz + dj * TILE * 0.9; if (!nav.standable(x, z) || !this.g.insideBuilding(x, z)) continue;
          const dd = Math.hypot(x - cx, z - cz); if (dd < bd) { bd = dd; best = { x, z }; }
        }
        if (best) out.push({ x: best.x, z: best.z, face: { x: cx, z: cz }, type: f.type });
      }
      this.cache.set(key, out); return out;
    }
  }

  /** what people say to each other when they meet in the street (small talk only: no promises about the game) */
  const SMALL_TALK = [['Morning!', 'Morning to you.'], ['Cold one today.', 'Keep moving, it helps.'], ['Busy day?', 'Always.'], ['How goes it?', 'Can’t complain.'], ['Mind the wolves tonight.', 'I’ll be in before dark.'], ['Nice work yesterday.', 'Thanks, friend.']];

  class Job {
    constructor(w, opts) { this.w = w; this.g = w.g; this.cool = 3; this.a = null; this.opts = opts; this.asleep = false; this.loop = 0; }
    get eco() { return this.g.economy; }
    get market() { return this.eco.of('market')[0] || null; }
    /** the spot in front of the market stalls where a worker stands to fetch */
    get counter() { const m = this.market; if (!m) return null; const r = m.rot || 0; return { x: m.x + Math.sin(r) * 1.6, z: m.z + Math.cos(r) * 1.6 }; }
    spawn(at) {
      const o = this.opts, g = this.g;
      const a = g.addActor({ id: 'wk:' + o.role, role: 'npc', spriteId: o.sprite, name: o.name, x: at.x, z: at.z, hpMax: 60, atk: 0, def: 0, speed: o.speed || 1.6, cd: 1, reach: 1, r: 0.3, scale: o.scale || 0.95, level: 1 });
      a.hostile = false; a.worker = o.role; a.type = 'c_worker'; if (o.tint != null) a.view.setTint(o.tint); a.brain = new Errands(g, a, this); a.view.poser = this.w.poser; this.a = a;
      if (this.w.bedtime) { this.asleep = true; this.show(false); }   // built at night: they turn up at dawn
      return a;
    }
    despawn() { if (this.a) { this.g.removeActor(this.a); this.a = null; } }
    show(on) { if (this.a) { this.a.view.setVisible(on); this.a.hidden = !on; if (!on) this.a.view.carry = null; } }
    /** take goods from the market (and only from there); false if it is not all there any more */
    fetch(need) { const l = this.eco.ledger(this.market); if (!Object.entries(need).every(([r, n]) => l.amount(r) >= n)) return false; for (const [r, n] of Object.entries(need)) l.take(r, n); return true; }
    /** what to do next: off to bed in the evening, back out at dawn, otherwise the day's work */
    next(e, dt) {
      if (this.w.bedtime) { this.bedtime(e); return; }
      if (this.asleep) { this.wake(e); return; }
      this.idle(e, dt);
    }
    /** walk to the bunkhouse (or the cottage, or the fire) and turn in */
    bedtime(e) {
      if (this.asleep || this.huddled) { if (this.huddled) e.work(4, 'warm', this.huddled.face); return; }
      const bed = this.w.bed(this);
      if (bed.fire) { e.go(bed.x, bed.z).then(() => { this.huddled = bed; }).work(4, 'warm', bed.face); return; }
      e.go(bed.door.x, bed.door.z).go(bed.inside.x, bed.inside.z).then(() => { this.asleep = true; this.show(false); this.sleptAt = bed; });
    }
    /** morning: out of the door (each a moment apart) and back to work */
    wake(e) {
      const b = this.sleptAt; this.asleep = false; this.huddled = null;
      if (!b) { this.show(true); return; }
      this.a.x = b.inside.x; this.a.z = b.inside.z; this.a.path = null;
      e.pause(Math.random() * 4).then(() => this.show(true)).go(b.door.x, b.door.z).say(['Up and at it.', 'Another day.', 'Right then, to work.'][Math.floor(Math.random() * 3)], 2.5);
    }
    /** meet another worker here: both stop and face each other and say their lines. give = { prop, toMe }: a load passes hands
        (toMe: they hand it over; otherwise I hand mine to them, and they carry it off a moment later) */
    meet(e, other, mine, theirs, give) {
      return e.then(() => {
        const b = other && other.a, me = this.a; if (!b || b.hidden || dist(b, me) > 4) return;
        const W = this.w; b.chatT = 2.6; b.chatWith = me; b.path = null; me.chatT = 2.6; me.chatWith = b;
        if (W.bubbles) { W.bubbles.say(me, mine, 2.6); W.later(0.9, () => W.bubbles.say(b, theirs, 2.4)); }
        if (give && give.toMe) { const was = b.view.carry; b.view.carry = give.prop; W.later(2.2, () => { b.view.carry = was === give.prop ? null : was; me.view.carry = give.prop; }); }
        else if (give) { me.view.carry = give.prop; W.later(2.2, () => { me.view.carry = null; b.view.carry = give.prop; }); W.later(5, () => { if (b.view.carry === give.prop) b.view.carry = null; }); }
      }).pause(0.1);
    }
    report() { return ['All is well.']; }
  }

  /** a cook, smith or hall worker's own trade inside their building: walk between the stations and work each one */
  const TRADE = {
    cook: { stations: ['hearth', 'pantry', 'table'], poses: { hearth: 'stir', pantry: 'lift', table: 'knead' } },
    smith: { stations: ['anvil', 'forge', 'quench_tub', 'grindstone', 'workbench'], poses: { anvil: 'hammer', forge: 'stir', quench_tub: 'lift', grindstone: 'saw', workbench: 'hammer' } },
    bakery: { stations: ['kneading_table', 'oven', 'bread_rack', 'flour_sack'], poses: { kneading_table: 'knead', oven: 'stir', bread_rack: 'lift', flour_sack: 'lift' } },
    butcher: { stations: ['chopping_block', 'meat_hooks', 'counter'], poses: { chopping_block: 'chop', meat_hooks: 'lift', counter: 'knead' } },
    library: { stations: ['cauldron', 'alchemy_table', 'bookshelf', 'potion_shelf'], poses: { cauldron: 'stir', alchemy_table: 'knead', bookshelf: 'read', potion_shelf: 'lift' } },
    stable: { stations: ['horse', 'trough', 'hay_bale', 'tack_rack'], poses: { horse: 'brush', trough: 'lift', hay_bale: 'pitch', tack_rack: 'lift' } },
  };
  /** the work a cook, smith or hall worker does at their stations: one or two stations per call */
  const shopWork = (job, e, spec, kind, secs = 8) => {
    const T = TRADE[kind], st = job.w.stations.of(spec, T.stations); if (!st.length) { e.pause(2, 'action'); return false; }
    let left = secs; while (left > 0) { const s = st[(job.loop++) % st.length], t = Math.min(left, 3 + Math.random() * 2.5); e.go(s.x, s.z).work(t, T.poses[s.type] || 'lift', s.face); left -= t; }
    return true;
  };

  class Cook extends Job {
    constructor(w) { super(w, { role: 'cook', sprite: 'cook', name: 'Cook', tint: null, speed: 1.5, scale: 0.9 }); }
    get home() { return this.g.home.built ? this.g.home : null; }
    update() { if (this.home && !this.a) this.spawn(this.home.doorPoint); else if (!this.home && this.a) this.despawn(); }
    meals() { return this.g.purse.hearth.tray.reduce((s, t) => s + (t.n || 1), 0); }
    idle(e, dt) {
      const home = this.home, spec = home && home.spec; if (!home) return;
      const m = this.market, c = this.counter, cookNow = (this.cool -= dt) <= 0; if (cookNow) this.cool = 6;
      const l = m ? this.eco.ledger(m) : null, meal = cookNow && l && this.meals() < PANTRY_MAX ? MEALS.find((r) => Object.entries(r.need).every(([g, n]) => l.amount(g) >= n)) : null;
      if (!meal) { shopWork(this, e, spec, 'cook', 7); return; }   // nothing to fetch: tidy, knead and tend the hearth
      const door = home.doorPoint, clerk = this.w.clerk;
      e.go(door.x, door.z).go(c.x, c.z).work(1.2, 'lift', m).then(() => this.fetch(meal.need) || (this.backHome(e), false)).carry('tray');
      this.meet(e, clerk, 'Something for the pot, please.', 'Fresh in today.');
      e.go(door.x, door.z).carry(null); shopWork(this, e, spec, 'cook', COOK_TIME);
      e.then(() => { this.g.purse.hearth.addMeal(meal.id); this.g.cui.toast(`Your cook made ${meal.name}. It is on the kitchen hearth.`); this.g.changed(); });
    }
    report() {
      const n = this.meals(), m = this.market, out = [n ? `I have ${n} meal${n > 1 ? 's' : ''} ready on the kitchen hearth. Help yourself.` : 'The kitchen hearth is empty right now.'];
      if (!m) { out.push('We have no marketplace, so I have nothing to cook with. Build one and keep it stocked.'); return out; }
      const l = this.eco.ledger(m), can = MEALS.filter((r) => Object.entries(r.need).every(([g, k]) => l.amount(g) >= k)).map((r) => r.name);
      out.push(`In the market: ${['wheat', 'egg', 'milk', 'beef'].map((g) => `${l.amount(g)} ${K.CastleData.resName(g)}`).join(', ')}.`);
      out.push(can.length ? `I can make ${can.join(', ')}.` : 'I cannot cook anything: I need 3 wheat for bread, 2 eggs and a milk for an omelette, or beef, milk and wheat for a stew.');
      if (n >= PANTRY_MAX) out.push('The hearth is full, so I am resting until you eat something.'); return out;
    }
    backHome(e) { const d = this.home && this.home.doorPoint; if (d) { e.steps = []; e.go(d.x, d.z); } }
  }

  class Smith extends Job {
    constructor(w) { super(w, { role: 'smith', sprite: 'smith', name: 'Smith', tint: null, speed: 1.4, scale: 1.05 }); this.orders = []; }
    get shop() { return this.g.smithy || null; }
    update() { if (this.shop && !this.a) this.spawn(doorOf(this.shop)); else if (!this.shop && this.a) this.despawn(); }
    /** you order something at the forge: he gathers the materials (market first, then your purse) and makes it */
    order(r) { this.orders.push(r); this.g.cui.toast(`The smith will make the ${r.name.toLowerCase()}. He fetches what he needs from the market first.`); }
    report() {
      const out = [], m = this.market, l = m ? this.eco.ledger(m) : null, c = this.g.castle;
      out.push(this.orders.length ? `I have ${this.orders.length} order${this.orders.length > 1 ? 's' : ''} to make: ${this.orders.map((r) => r.name.toLowerCase()).join(', ')}.` : 'No orders right now. Order weapons at the forge and I will fetch what I need.');
      out.push(`Wood: ${l ? l.amount('wood') : 0} in the market, ${c.amount('wood')} in your purse. Iron: ${l ? l.amount('iron') : 0} in the market, ${c.amount('iron')} in your purse.`);
      if (!m) out.push('With a marketplace I would make arrows for it whenever I am idle.'); else if (l.amount('wood') < 2) out.push('The market has no wood for arrows. Send some over and I will keep the racks full.'); else out.push(`The market has ${l.amount('arrow')} arrows. I make more whenever it is low.`);
      return out;
    }
    gather(cost) {
      const c = this.g.castle, l = this.market ? this.eco.ledger(this.market) : null;
      for (const [r, n] of Object.entries(cost)) if ((l ? l.amount(r) : 0) + c.amount(r) < n) return false;
      for (const [r, n] of Object.entries(cost)) { const k = l ? l.take(r, n) : 0; if (n - k > 0) c.spend({ [r]: n - k }); } return true;
    }
    idle(e, dt) {
      const shop = this.shop, door = shop && doorOf(shop), c = this.counter; if (!door) return;
      const due = (this.cool -= dt) <= 0; if (due) this.cool = 8; const r = due ? this.orders[0] : null;
      if (r) {
        if (!this.gather(r.cost)) { this.orders.shift(); this.g.cui.toast(`The smith cannot find the materials for the ${r.name.toLowerCase()}.`); return; } this.orders.shift();
        if (c) e.go(door.x, door.z).go(c.x, c.z).work(1.2, 'lift', this.market).carry('log').go(door.x, door.z).carry(null);
        shopWork(this, e, shop, 'smith', FORGE_TIME); e.then(() => { this.g.forge.finish(r); this.g.cui.toast(`The smith finished the ${r.name.toLowerCase()}. It is on the forge.`); });
        return;
      }
      const m = this.market, l = m && c ? this.eco.ledger(m) : null;   // nothing ordered: arrows for the market, from the market's wood
      if (!due || !l || l.amount('wood') < 2 || l.amount('arrow') >= 80) { shopWork(this, e, shop, 'smith', 7); return; }
      e.go(door.x, door.z).go(c.x, c.z).work(1, 'lift', m).then(() => this.fetch({ wood: 2 })).carry('log').go(door.x, door.z).carry(null);
      shopWork(this, e, shop, 'smith', FORGE_TIME);
      e.carry('arrows').go(door.x, door.z).go(c.x, c.z).work(1, 'lift', m).then(() => { l.add('arrow', 8); }).carry(null);
      this.meet(e, this.w.clerk, 'Eight more arrows for the rack.', 'Good, they sell well.');
      e.go(door.x, door.z);
    }
  }

  class Clerk extends Job {
    constructor(w) { super(w, { role: 'clerk', sprite: 'clerk', name: 'Clerk', tint: null, speed: 1.2, scale: 0.95 }); this.t = 40; }
    get post() { const m = this.market; if (!m) return null; const r = m.rot || 0; return { x: m.x - Math.sin(r) * 0.15, z: m.z - Math.cos(r) * 0.15 }; }
    update(dt) { const p = this.post; if (p && !this.a) this.spawn(p); else if (!p && this.a) this.despawn(); this.t -= dt || 0; }
    report() {
      const m = this.market; if (!m) return ['No market, no customers.']; const l = this.eco.ledger(m), w = this.w, on = Object.entries(w.prices).filter(([, pr]) => pr > 0);
      const stock = Object.entries(l.goods).filter(([g, n]) => n > 0 && g !== 'gold').sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, n]) => `${n} ${K.CastleData.resName(g)}`);
      return [stock.length ? `On the stalls: ${stock.join(', ')}.` : 'The stalls are bare. The carts bring whatever your town makes.', `I have taken ${l.amount('gold')} gold so far. It is in the market for you.`, `I sell ${on.length} kinds of goods at the prices you set. Other settlers pay; your own team takes what they need for free.`, w.sold ? `Today I sold ${w.sold} lots.` : 'No sales yet today.'];
    }
    idle(e, dt) {
      const p = this.post, m = this.market; if (!p) return;
      if (this.t <= 0) {   // a passing trader buys a little of something you have priced
        this.t = 45 + Math.random() * 30; const l = this.eco.ledger(m), on = Object.entries(this.w.prices).filter(([g, pr]) => pr > 0 && l.amount(g) >= 1);
        if (on.length) {
          const [good, pr] = on[Math.floor(Math.random() * on.length)], n = Math.min(l.amount(good), 1 + Math.floor(Math.random() * 4));
          l.take(good, n); l.add('gold', n * pr); this.w.sold = (this.w.sold || 0) + 1; e.go(p.x, p.z).say('Thank you kindly!', 2).work(2, 'talk', local(m, 0, 4));
          this.g.cui.toast(`A passing trader bought ${n} ${K.CastleData.resName(good)} from your clerk for ${n * pr} gold.`); this.g.changed(); return;
        }
      }
      const i = this.loop++ % 4, sx = [-4.0, -1.0, 1.0, 4.0][i], at = local(m, sx * 0.85, -0.55), face = local(m, sx, -0.2);   // walk the stalls: stack, straighten and sweep
      e.go(at.x, at.z).work(2.5 + Math.random() * 1.5, ['lift', 'sweep', 'lift', 'knead'][i], face).go(p.x, p.z).work(1, 'talk', local(m, 0, 4));
    }
  }

  /** the person who runs a workshop or farm building, and how they keep busy there */
  const KEEP = {
    farm: { name: 'Farmer', sprite: 'ranger', tint: 0xe8d090 }, coop: { name: 'Henwife', sprite: 'witch', tint: 0xf0e0c0 }, barn: { name: 'Cowherd', sprite: 'warden', tint: 0xd0b080 },
    woodcutter: { name: 'Woodcutter', sprite: 'ranger', tint: 0x9ac080 }, quarry: { name: 'Quarryman', sprite: 'warden', tint: 0xc0b8a8 }, storehouse: { name: 'Miller', sprite: 'warden', tint: 0xb0c8a0 },
    silo: { name: 'Granary keeper', sprite: 'ranger', tint: 0xf0e8d0 }, watchtower: { name: 'Archer', sprite: 'ranger', tint: 0xc8e0ff },
  };
  class Keeper extends Job {
    constructor(w, p) { const k = KEEP[p.type], look = (K.WORKER_LOOKS || {})[k.name]; super(w, { role: 'keep' + p.uid, sprite: look ? look.sprite : k.sprite, name: k.name, tint: look ? look.tint : k.tint, speed: 1.2 }); this.p = p; this.wanderT = Math.random() * 3; }
    get post() { const p = this.p, [, d] = K.CastleArt.size(p.type), r = p.rot || 0, o = d / 2 + 0.9; return { x: p.x + Math.sin(r) * o + Math.cos(r) * 0.6, z: p.z + Math.cos(r) * o - Math.sin(r) * 0.6 }; }
    update() { if (!this.a) { const at = this.post; if (this.g.play.nav.standable(at.x, at.z)) this.spawn(at); } }
    /** the millstone of this storehouse (it turns while the miller grinds) */
    get spinner() { const m = this.g.meshes && this.g.meshes.get('p' + this.p.uid); return m && m.userData.spin ? m.userData.spin : null; }
    /** the woodcutter and the quarryman go out to real trees and rocks, work them and carry the load back; every few loads a cart takes it to your stores */
    courier(e) {
      const g = this.g, p = this.p, wood = p.type === 'woodcutter', kinds = wood ? ['c_tree'] : ['c_boulder', 'c_rubble'], P = g.play;
      let best = null, bd = 32; for (const n of g.forest.nodes) { if (!kinds.includes(n.type) || !g.forest.live(n)) continue; const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = n; } }
      if (!best) return false; const dx = p.x - best.x, dz = p.z - best.z, L = Math.hypot(dx, dz) || 1, r = (best.r || 0.5) + 0.55, at = { x: best.x + dx / L * r, z: best.z + dz / L * r };
      if (!P.nav.standable(at.x, at.z)) return false; const sp = K.CastleArt.workSpots(p.type), drop = sp ? local(p, sp[2].x, sp[2].z) : this.post;
      e.go(at.x, at.z).work(4.5, 'chop', best).carry(wood ? 'log' : 'stone').go(drop.x, drop.z).work(1, 'lift', sp ? local(p, ...sp[2].face) : p).carry(null).then(() => {
        this.trips = (this.trips || 0) + 1; if (this.trips % 3) return;
        const eco = g.economy, to = eco.of('storehouse').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0] || eco.of('market')[0];
        if (to && Math.hypot(to.x - p.x, to.z - p.z) > 3 && eco.carts.length < 12) eco.carts.push(new K.Cart(eco, p, to, wood ? 'wood' : 'stone', 0));
      });
      return true;
    }
    /** a round at the workshop's own work spots (from the art: chopping block, saw-horse, millstones, hay shed…) */
    yardWork(e, n = 2) {
      const p = this.p, sp = K.CastleArt.workSpots(p.type); if (!sp) return false;
      for (let q = 0; q < n; q++) {
        const s = sp[(this.loop++) % sp.length], at = local(p, s.x, s.z), face = local(p, s.face[0], s.face[1]), t = 3 + Math.random() * 2.5;
        if (s.carry) {   // pick it up here, carry it to the next spot, set it down
          const nx = sp[this.loop % sp.length], to = local(p, nx.x, nx.z);
          e.go(at.x, at.z).work(1.4, 'lift', face).carry(s.carry).go(to.x, to.z).work(1, 'lift', local(p, nx.face[0], nx.face[1])).carry(null);
        } else e.go(at.x, at.z).work(t, s.pose, face, { spin: s.spin ? this.spinner : null });
      }
      return true;
    }
    /** a short round about the outside of the building, doing something with its hands at each stop */
    round(e, poses, r0 = 0.9) {
      const p = this.p, [w, d] = K.CastleArt.size(p.type), R = Math.max(w, d) / 2 + r0;
      for (let q = 0; q < 2; q++) { const ang = Math.random() * 6.283, x = p.x + Math.cos(ang) * R, z = p.z + Math.sin(ang) * R; if (!this.g.play.nav.standable(x, z)) continue; e.go(x, z).work(2.5 + Math.random() * 2, poses[q % poses.length], q ? null : p); }
      if (!e.busy) e.work(2.5, poses[0], p);
    }
    idle(e, dt) {
      const p = this.p, g = this.g, eco = this.eco;
      if ((this.wanderT -= dt) > 0) return; this.wanderT = 0.5;
      switch (p.type) {
        case 'woodcutter': case 'quarry': if (this.loop % 3 === 2 && this.courier(e)) { this.loop++; return; } this.yardWork(e, 2); return;
        case 'storehouse': this.yardWork(e, 2); return;
        case 'farm': {   // hoe the wheat, bring a sheaf home, fork hay in the shed
          const mine = [...eco.fields.tiles.values()].filter((t) => eco.nearestFarm((t.i + 0.5) * TILE, (t.j + 0.5) * TILE) === p);
          if (mine.length && this.loop % 2 === 0) { const t = mine[Math.floor(Math.random() * mine.length)], x = (t.i + 0.5) * TILE, z = (t.j + 0.5) * TILE, back = local(p, -1.0, 0.75);
            e.go(x, z + 0.3).work(4, eco.fields.stage(t) === 2 ? 'chop' : 'pitch', { x, z }).carry('wheat').go(back.x, back.z).work(1, 'lift', local(p, -1.0, 1.0)).carry(null); this.loop++; return; }
          this.yardWork(e, 2); return;
        }
        case 'barn': {   // milk a cow into a pail, carry it to the trough-side, fork the hay
          const h = eco.stock.herd(p);
          if (h.length && this.loop % 2 === 0) { const b = h[Math.floor(Math.random() * h.length)], back = local(p, 0.85, 0.1);
            e.go(b.x + 0.5, b.z).then(() => { b.a.path = null; b.wait = 6; }).work(4, 'milk', b.a).carry('bucket').go(back.x, back.z).work(1, 'lift', local(p, 1.15, 0.08)).carry(null); this.loop++; return; }
          this.yardWork(e, 2); return;
        }
        case 'coop': {   // scatter grain among the hens, gather eggs into a basket
          const h = eco.stock.herd(p), b = h.length ? h[Math.floor(Math.random() * h.length)] : null, front = local(p, 0, 1.3);
          if (b) e.go(b.x + 0.5, b.z).work(3, 'feed', b.a); else e.go(front.x, front.z).work(3, 'feed', local(p, 0, 2.5));
          e.go(front.x, front.z).work(2, 'lift', p).carry('eggs').go(front.x + 0.6, front.z).carry(null).work(1.5, 'lift', p); return;
        }
        case 'silo': {   // sack wheat at the silo; with a mill in town, carry a sack over to it
          const mill = eco.of('storehouse')[0], at = this.post; e.go(at.x, at.z).work(3, 'lift', p).carry('sack');
          if (mill && Math.hypot(mill.x - p.x, mill.z - p.z) < 40) { const drop = local(mill, 0.75, -0.3), miller = g.workers.keepers.get(mill.uid); e.go(drop.x, drop.z); this.meet(e, miller, 'More wheat for the stones.', 'Set it by the wall, thanks.'); e.work(1, 'lift', local(mill, 0.7, -0.85)).carry(null).go(at.x, at.z); }
          else e.work(2, 'sweep', p).carry(null); return;
        }
        case 'watchtower': this.round(e, ['look', 'look', 'sweep'], 0.6); return;
      }
      this.round(e, ['sweep', 'lift']);
    }
    report() {
      const g = this.g, p = this.p, c = g.castle, e = g.economy, l = e.ledger(p), held = Object.entries(p.held || {}).filter(([, n]) => n >= 1).map(([r, n]) => `${Math.floor(n)} ${K.CastleData.resName(r)}`);
      const full = held.length ? `Your purse and storehouses are full, so I have ${held.join(', ')} stacked here. Build a storehouse and I will send it over.` : null;
      switch (p.type) {
        case 'farm': { const f = [...e.fields.tiles.values()].filter((t) => e.nearestFarm((t.i + 0.5) * TILE, (t.j + 0.5) * TILE) === p), ripe = f.filter((t) => e.fields.stage(t) === 2).length;
          return [f.length ? `I tend ${f.length} squares of wheat. ${ripe} are golden now.` : 'I have no fields. Pick Wheat field in the drawer and draw squares around me.', `${l.amount('wheat')} wheat is waiting in the barn. A cart takes it to the silo every 10.`, 'The bigger the field, the more wheat.']; }
        case 'coop': { const h = e.stock.herd(p), out = h.filter((b) => b.exposed).length;
          return [h.length ? `${h.length} hens, each laying an egg a minute.` : 'No hens yet. Buy them here for 5 wheat each.', `${l.amount('egg')} eggs waiting. The carts take them to the market.`, out ? `${out} of them are outside your walls. Wolves will take them.` : (h.length ? 'They are safe inside the walls.' : '')].filter(Boolean); }
        case 'barn': { const h = e.stock.herd(p), hungry = h.filter((b) => !b.fed).length;
          return [h.length ? `${h.length} cows.` : 'No cows yet. Buy them here for 10 wheat each.', hungry ? `${hungry} are hungry. They need wheat in the silo or the market.` : (h.length ? 'They are fed and giving milk.' : ''), `${l.amount('milk')} milk and ${l.amount('beef')} beef here.`].filter(Boolean); }
        case 'woodcutter': case 'quarry': { const pr = c.producesOf(p) || {}, [r, n] = Object.entries(pr)[0] || ['wood', 0];
          return [`We cut ${n} ${K.CastleData.resName(r)} a minute${p.level >= 2 ? ' (upgraded)' : ''}.`, full || `It all goes straight to your stores. You hold ${c.amount(r)} of ${c.caps()[r]}.`]; }
        case 'storehouse': { const caps = c.caps(); return [`With your storehouses you can hold ${caps.wood} wood, ${caps.stone} stone, ${caps.iron} iron and ${caps.gold} gold.`, `Right now: ${c.amount('wood')} wood, ${c.amount('stone')} stone, ${c.amount('iron')} iron.`, 'Another storehouse holds even more, and raiders take less.']; }
        case 'silo': return [`${l.amount('wheat')} of 200 wheat in the silo.`, l.amount('wheat') >= 190 ? 'Nearly full: the extra goes to the market.' : 'Wheat from the farms comes here first.'];
        case 'watchtower': return ['I shoot anything hostile within 12 m of this tower.', 'Keep the tower inside your walls and it covers the gate.'];
      }
      return ['All is well.'];
    }
  }

  /** the people in your walk-in workshops: baker, butcher, alchemist, stablehand. They work in plain sight inside, and walk the town for supplies */
  const HALL = {
    bakery: { name: 'Baker', sprite: 'witch', tint: 0xfff4e0 }, butcher: { name: 'Butcher', sprite: 'warden', tint: 0xf0d0d0 },
    library: { name: 'Alchemist', sprite: 'witch', tint: 0xc0a0f0 }, stable: { name: 'Stablehand', sprite: 'ranger', tint: 0xd8c090 },
  };
  class HallJob extends Job {
    constructor(w, type) { const h = HALL[type], look = (K.WORKER_LOOKS || {})[h.name]; super(w, { role: type, sprite: look ? look.sprite : h.sprite, name: h.name, tint: look ? look.tint : h.tint, speed: 1.4 }); this.type = type; this.made = 0; this.cool = 4; }
    get hall() { const h = this.g.halls[this.type]; return h ? h.spec : null; }
    get door() { return this.hall && doorOf(this.hall); }
    update() { const d = this.door; if (d && !this.a) this.spawn(d); else if (!d && this.a) this.despawn(); }
    /** carry what was made to the market stalls and hand it to the clerk */
    deliver(e, good, n, done, prop, line) {
      const c = this.counter, d = this.door; if (!c) return;
      e.carry(prop).go(d.x, d.z).go(c.x, c.z); this.meet(e, this.w.clerk, line || 'Fresh from the shop.', 'Lovely. I’ll put it out.');
      e.work(1.2, 'lift', this.market).then(() => { this.eco.ledger(this.market).add(good, n); this.made += n; if (done) done(); }).carry(null).go(d.x, d.z);
    }
    /** the baker's rounds: flour from the mill, a pail from the barn, knead and bake, then bread to the market */
    bakerRound(e) {
      const g = this.g, eco = this.eco, m = this.market, l = m ? eco.ledger(m) : null, d = this.door, spec = this.hall; if (!m) return false;
      if (l.amount('bread') >= 60) return false;
      const mill = eco.of('storehouse')[0], silo = eco.of('silo').find((s) => eco.ledger(s).amount('wheat') >= 3), barn = eco.of('barn')[0];
      const fromMill = mill && eco.wheatHeld() - g.castle.amount('wheat') >= 3, fromMarket = l.amount('wheat') >= 3;
      if (!fromMill && !fromMarket) return false;
      e.go(d.x, d.z);
      if (fromMill) {   // the mill: the miller hands over a sack (the wheat itself comes out of your silo, market or farms)
        const at = local(mill, 1.0, 1.25), miller = this.w.keepers.get(mill.uid);
        e.go(at.x, at.z).then(() => eco.takeWheat(3, false)); this.meet(e, miller, 'Three sacks’ worth for the ovens?', 'Here you are, ground this morning.', { prop: 'flour', toMe: true });
        e.pause(2.4).carry('flour');
      } else if (silo) { const at = local(silo, 0, 1.4); e.go(at.x, at.z).work(1.2, 'lift', silo).then(() => eco.ledger(silo).take('wheat', 3) >= 3 || this.fetch({ wheat: 3 }) || false).carry('sack'); }
      else { const c = this.counter; e.go(c.x, c.z).work(1, 'lift', m).then(() => this.fetch({ wheat: 3 })).carry('sack'); }
      if (barn) { const at = local(barn, -0.9, 1.5), cowherd = this.w.keepers.get(barn.uid); e.go(at.x, at.z); this.meet(e, cowherd, 'A pail of milk for the dough?', 'Take this one, still warm.', { prop: 'bucket', toMe: true }); e.pause(2.4).carry('bucket'); }   // the pail is for show: bread is made from wheat alone
      e.go(d.x, d.z).carry(null); shopWork(this, e, spec, 'bakery', 10);
      this.deliver(e, 'bread', 2, () => g.cui.toast('The baker brought 2 loaves of bread to the market.'), 'bread', 'Two fresh loaves!');
      return true;
    }
    idle(e, dt) {
      const g = this.g, eco = this.eco, m = this.market, c = this.counter, d = this.door, spec = this.hall; if (!d) return;
      const due = (this.cool -= dt) <= 0;
      if (this.type === 'stable' || !due || !m || !c) { if (due) this.cool = 6; shopWork(this, e, spec, this.type, 7); return; }   // their own trade, inside, in plain sight
      const l = eco.ledger(m);
      if (this.type === 'bakery') { this.cool = 12; if (!this.bakerRound(e)) shopWork(this, e, spec, 'bakery', 7); return; }
      if (this.type === 'butcher') {
        this.cool = 40; const st = eco.stock, pick = eco.of('barn').map((p) => [p, st.herd(p), 2, 'cow', 6]).concat(eco.of('coop').map((p) => [p, st.herd(p), 4, 'chicken', 2])).find(([, h, keep]) => h.length > keep);
        if (!pick) { shopWork(this, e, spec, 'butcher', 7); return; } const [p, h, , kind, meat] = pick, at = { x: p.x + Math.sin(p.rot || 0) * 2, z: p.z + Math.cos(p.rot || 0) * 2 }, keeper = this.w.keepers.get(p.uid);
        e.go(d.x, d.z).go(at.x, at.z); this.meet(e, keeper, kind === 'cow' ? 'One of the spare cows, please.' : 'A spare hen for the pot?', 'Take that one. Mind she’s not one I’m breeding from.');
        e.work(2, 'lift', p).then(() => { const b = h[h.length - 1]; if (!b) return false; st.remove(b); }).carry('meat').go(d.x, d.z).carry(null); shopWork(this, e, spec, 'butcher', 8);
        this.deliver(e, 'beef', meat, () => g.cui.toast(`The butcher brought ${meat} meat from a ${kind} to the market. He keeps your breeding stock.`), 'meat', 'Fresh cuts for the stall.'); return;
      }
      if (this.type === 'library') {
        this.cool = 30; const have = ODDS.filter((r) => l.amount(r) >= 1); if (have.length < 2 || Object.keys(POTIONS).reduce((n, k) => n + l.amount(k), 0) >= 30) { shopWork(this, e, spec, 'library', 7); return; }
        const need = {}; for (let i = 0; i < 3; i++) { const r = have[Math.floor(Math.random() * have.length)]; need[r] = Math.min(l.amount(r), (need[r] || 0) + 1); }
        const pot = Object.keys(POTIONS)[Math.floor(Math.random() * 4)];
        e.go(d.x, d.z).go(c.x, c.z).work(1, 'lift', m).then(() => this.fetch(need)).carry('crate').go(d.x, d.z).carry(null); shopWork(this, e, spec, 'library', 12);
        this.deliver(e, pot, 1, () => g.cui.toast(`The alchemist brewed a ${POTIONS[pot]} from ${Object.entries(need).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', ')}. It is in the market.`), 'potion', 'A new brew for the shelf.');
      }
    }
    report() {
      const m = this.market, l = m ? this.eco.ledger(m) : null, eco = this.eco;
      switch (this.type) {
        case 'bakery': return [m ? `The market has ${l.amount('wheat')} wheat and ${l.amount('bread')} loaves.` : 'Without a marketplace I have no wheat and nowhere to sell.', `I have baked ${this.made} loaves so far. Three wheat makes two loaves.`, 'Bread is food you can eat; wheat on its own is not.'];
        case 'butcher': { const cows = eco.of('barn').reduce((n, p) => n + eco.stock.herd(p).length, 0), hens = eco.of('coop').reduce((n, p) => n + eco.stock.herd(p).length, 0);
          return [`You have ${cows} cows and ${hens} chickens. I keep 2 cows a barn and 4 hens a coop to breed from, and butcher the rest.`, `I have brought ${this.made} meat to the market.`, 'Your cook turns the meat into meals.']; }
        case 'library': return [m ? `The market holds ${Object.keys(POTIONS).map((k) => `${l.amount(k)} ${POTIONS[k]}s`).join(', ')}.` : 'I need a marketplace to work from.', 'I take three odds and ends from the market and brew whatever the books suggest. Drink a potion by clicking it in your purse.', 'Healing mends you, speed and strength last a minute, warmth keeps the cold off for two.'];
        case 'stable': return ['The horses are fed and saddled when you want them.', 'Walk into the stable, saddle a horse and mount up. You ride far faster on open ground.'];
      }
      return ['All is well.'];
    }
  }

  class Workers {
    constructor(game) {
      this.g = game; this.prices = Object.assign({}, PRICE); this.poser = new WorkPoser(game.R.bmats); this.stations = new Stations(game); this.timers = []; this.clock = 0; this.meetT = 1;
      this.bubbles = typeof document !== 'undefined' ? new Bubbles(game) : null;
      this.cook = new Cook(this); this.smith = new Smith(this); this.clerk = new Clerk(this); this.pubT = 2; this.pubSig = ''; this.markets = new Map(); this.hooked = false; this.keepers = new Map(); this.keepT = 0; this.halls = new Map(); this.buffs = {};
    }
    /** evening till dawn: everyone turns in (from the sunset warning, so they are indoors before the wolves come) */
    get bedtime() { const g = this.g; return !!(g.isNightish && g.isNightish()); }
    /** where a worker sleeps: the bunkhouse, else your cottage, else they huddle round the Keep's fire */
    bed(job) {
      const g = this.g, bh = g.halls && g.halls.bunkhouse;
      if (bh) { const s = bh.spec, n = this.jobs.indexOf(job), fw = s.footprint.w, fh = s.footprint.h, i = n % 4, j = Math.floor(n / 4) % 2;   // spread out over the bunk room
        const inside = { x: (s.x + fw * (0.25 + 0.17 * i)) * TILE, z: (s.z + fh * (0.4 + 0.2 * j)) * TILE }; return { door: doorOf(s), inside: g.play.nav.standable(inside.x, inside.z) ? inside : insideOf(s), kind: 'bunkhouse' }; }
      if (g.home && g.home.built) return { door: g.home.doorPoint, inside: g.home.center, kind: 'cottage' };
      const k = g.L.keep, n = this.jobs.indexOf(job), ang = n * 0.9 + 1.2, r = (k.r || 2.3) + 1.6, x = k.x + Math.cos(ang) * r, z = k.z + Math.sin(ang) * r;
      return { fire: true, x, z, face: { x: k.x, z: k.z }, kind: 'fire' };
    }
    /** run fn after s seconds of game time */
    later(s, fn) { this.timers.push({ at: this.clock + s, fn }); }
    /** two workers passing in the street now and then stop for a word */
    smallTalk() {
      const live = this.jobs.filter((j) => j.a && !j.a.hidden && j.a.view.state === 'walk' && !(j.a.chatT > 0) && (j.talkedT || 0) < this.clock);
      for (let i = 0; i < live.length; i++) for (let k = i + 1; k < live.length; k++) {
        const A = live[i], B = live[k]; if (dist(A.a, B.a) > 1.6 || Math.random() > 0.5) continue;
        const [l1, l2] = SMALL_TALK[Math.floor(Math.random() * SMALL_TALK.length)]; A.talkedT = B.talkedT = this.clock + 40;
        for (const [x, y] of [[A, B], [B, A]]) { x.a.chatT = 2.6; x.a.chatWith = y.a; x.a.path = null; }
        this.bubbles.say(A.a, l1, 2.6); this.later(0.9, () => this.bubbles.say(B.a, l2, 2.4)); return;
      }
    }
    get jobs() { return [this.cook, this.smith, this.clerk, ...this.keepers.values(), ...this.halls.values()]; }
    /** one keeper per workshop and farm building; they go when the building goes */
    syncKeepers() {
      const live = new Set();
      for (const p of this.g.castle.pieces) if (KEEP[p.type]) { live.add(p.uid); if (!this.keepers.has(p.uid)) this.keepers.set(p.uid, new Keeper(this, p)); }
      for (const [uid, k] of this.keepers) if (!live.has(uid)) { k.despawn(); this.keepers.delete(uid); }
    }
    /** talk to someone: they tell you how it is going */
    talk(a) {
      const j = this.jobs.find((x) => x.a === a); if (!j) return; const lines = j.report();
      this.g.cui.modal(`<h2>${j.opts.name}</h2>${lines.map((t) => `<p>${t}</p>`).join('')}`, [{ label: 'Thanks', pri: true }]);
      if (j.a) { j.a.path = null; this.g.play.face(j.a, this.g.play.me); }
    }
    update(dt) {
      if ((this.keepT -= dt) <= 0) { this.keepT = 2; this.syncKeepers(); for (const t of Object.keys(this.g.halls || {})) if (HALL[t] && !this.halls.has(t)) this.halls.set(t, new HallJob(this, t)); }
      for (const j of this.jobs) j.update(dt);
      this.clock += dt; if (this.timers.length) { const due = this.timers.filter((t) => t.at <= this.clock); if (due.length) { this.timers = this.timers.filter((t) => t.at > this.clock); for (const t of due) t.fn(); } }
      if (this.bubbles) { this.bubbles.update(dt); if ((this.meetT -= dt) <= 0) { this.meetT = 0.5; this.smallTalk(); } }
      for (const k of this.keepers.values()) { const s = k.p.type === 'storehouse' && k.spinner; if (s && s.turning > 0) { s.turning -= dt; s.rotation.y += dt * 1.6; } }   // the millstone turns while the miller grinds
      const mp = this.g.mp; if (!mp) return; if (!this.hooked) this.hook(mp);
      if ((this.pubT -= dt) <= 0) { this.pubT = 5; this.publish(); }
    }
    hallBuilt() { this.keepT = 0; }
    /* ---------- food and potions from your purse ---------- */
    buff(k) { return (this.buffs[k] || 0) > this.g.play.t; }
    get speedMul() { return this.buff('speed') ? 1.5 : 1; }
    get strengthMul() { return this.buff('strength') ? 1.5 : 1; }
    /** click bread or a potion in your purse: eat or drink it. false for anything else */
    use(id) {
      const g = this.g, c = g.castle, P = g.play, p = P.player, max = g.vitals.hpMax; if (c.amount(id) < 1) return false;
      if (id === 'bread') { if (p.hp >= max - 0.5) { g.cui.toast('You are not hungry.'); return true; } c.spend({ bread: 1 }); p.heal(14); P.float(P.me, '+14', 'heal'); g.sound.play('gather'); g.changed(); return true; }
      if (!POTIONS[id]) return false; c.spend({ [id]: 1 }); g.sound.play('fanfare');
      if (id === 'potion_heal') { p.heal(40); P.float(P.me, '+40', 'heal'); }
      else { const k = id.slice(7), sec = k === 'warmth' ? 120 : 60; this.buffs[k] = P.t + sec; P.float(P.me, { speed: 'Swift!', strength: 'Strong!', warmth: 'Warm!' }[k], 'heal'); g.cui.toast(`You drink the ${POTIONS[id]}: it lasts ${sec} seconds.`); }
      g.changed(); return true;
    }
    /* ---------- trading with other players ---------- */
    hook(mp) {
      this.hooked = true; const net = mp.net, w = net.welcome || {};
      for (const m of w.markets || []) this.markets.set(m.owner, m); for (const s of w.sales || []) this.sold(s);
      net.on('welcome', (m) => { for (const x of m.markets || []) this.markets.set(x.owner, x); for (const s of m.sales || []) this.sold(s); });
      net.on('market', (m) => { if (m.m) this.markets.set(m.m.owner, m.m); });
      net.on('bought', (m) => this.bought(m)); net.on('sold', (m) => this.sold(m)); net.on('buyfail', (m) => this.g.cui.toast(m.why || 'The clerk could not sell you that.'));
    }
    /** what your market has for sale, for everyone to see */
    publish() {
      const mk = this.cook.market, mp = this.g.mp; if (!mk || !mp) return; const l = this.g.economy.ledger(mk), stock = {}, prices = {};
      for (const [g, n] of Object.entries(l.goods)) if (n >= 1 && g !== 'gold') stock[g] = Math.floor(n);   // everything shows (your team may take any of it); outsiders only see what has a price
      for (const [g, pr] of Object.entries(this.prices)) if (pr > 0) prices[g] = pr;
      const sig = JSON.stringify([stock, prices, Math.round(mk.x), Math.round(mk.z)]); if (sig === this.pubSig) return; this.pubSig = sig;
      mp.net.send({ t: 'market', x: mk.x, z: mk.z, stock, prices });
    }
    buy(owner, good, n) {
      const g = this.g, m = this.markets.get(owner); if (!m) return; const cost = g.mp.mayUse(owner) ? 0 : (m.prices[good] || 0) * n;   // your team takes for free
      if (g.castle.amount('gold') < cost) { g.cui.toast(`That costs ${cost} gold. You have ${g.castle.amount('gold')}.`); g.sound.play('clank'); return; }
      g.mp.net.send({ t: 'buy', owner, good, n });
    }
    bought(m) {
      const g = this.g, c = g.castle; c.spend({ gold: m.cost }); const got = c.add(m.good, m.n);
      g.cui.toast(`${m.cost ? 'You bought' : 'You took'} ${m.n} ${K.CastleData.resName(m.good)}${m.cost ? ` for ${m.cost} gold` : ''}.${got < m.n ? ' Your purse was full; the rest is lost.' : ''}`); g.sound.play('gather'); g.changed();
      const mk = this.markets.get(m.owner); if (mk && mk.stock) mk.stock[m.good] = Math.max(0, (mk.stock[m.good] || 0) - m.n); if (this.tradeWith === m.owner) this.trade(m.owner);
    }
    /** someone bought from your clerk (now, or while you were away) */
    sold(s) {
      const g = this.g, mk = this.cook.market; if (!mk) return; const l = g.economy.ledger(mk); l.take(s.good, s.n); l.add('gold', s.gold);
      g.cui.toast(s.gold ? `${s.by} bought ${s.n} ${K.CastleData.resName(s.good)} from your clerk for ${s.gold} gold.` : `${s.by} (your team) took ${s.n} ${K.CastleData.resName(s.good)} from your market.`); g.changed(); this.pubSig = '';
    }
    /** the trading window at another player's market */
    trade(owner) {
      const g = this.g, m = this.markets.get(owner); this.tradeWith = owner;
      if (!m || !Object.entries(m.stock || {}).some(([gd, n]) => n > 0 && (g.mp.mayUse(owner) || (m.prices || {})[gd] > 0))) { g.cui.modal(`<h2>The clerk shrugs</h2><p>Nothing is for sale here right now.</p>`, [{ label: 'Leave', pri: true }]); return; }
      const team = g.mp.mayUse(owner), verb = team ? 'Take' : 'Buy';
      const rows = Object.entries(m.stock).filter(([gd, n]) => n > 0 && (team || m.prices[gd] > 0)).map(([gd, n]) => `<div class="trow"><b>${K.CastleData.resName(gd)}</b> <span>${n} in stock${team ? '' : ` · ${m.prices[gd]} gold each`}</span> <button class="cb" data-buy="${gd}" data-n="1">${verb} 1</button> <button class="cb" data-buy="${gd}" data-n="5">${verb} 5</button></div>`).join('');
      g.cui.modal(`<h2>${m.name || 'A settler'}'s market</h2><p>${team ? 'Your team: take what you need, free.' : `You have ${g.castle.amount('gold')} gold.`}</p><div class="trade">${rows}</div>`, [{ label: 'Done', pri: true, run: () => { this.tradeWith = null; } }]);
      const box = g.cui.$('cModal'), prev = box.onclick; box.onclick = (e) => { const b = e.target.closest('[data-buy]'); if (b) { this.buy(owner, b.dataset.buy, +b.dataset.n); return; } prev(e); };
    }
    /** your own prices, set at your market */
    setPrices() {
      const g = this.g, P = this.prices, rows = () => Object.keys(PRICE).map((gd) => `<div class="trow"><b>${K.CastleData.resName(gd)}</b> <button class="cb" data-p="${gd}" data-d="-1">−</button> <span>${P[gd] ? P[gd] + ' gold' : 'not for sale'}</span> <button class="cb" data-p="${gd}" data-d="1">+</button></div>`).join('');
      const draw = () => { g.cui.modal(`<h2>Your clerk's prices</h2><p>Passing traders and other players buy at these prices. The gold lands in your market.</p><div class="trade">${rows()}</div>`, [{ label: 'Done', pri: true }]);
        const box = g.cui.$('cModal'), prev = box.onclick; box.onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { P[b.dataset.p] = Math.max(0, Math.min(99, (P[b.dataset.p] || 0) + +b.dataset.d)); this.pubSig = ''; g.changed(); draw(); return; } prev(e); }; };
      draw();
    }
    /* ---------- saving ---------- */
    toJSON() { return { prices: this.prices, meals: this.g.purse.hearth.tray.map((t) => [t.id, t.n || 1]), orders: this.smith.orders.map((r) => r.id) }; }
    restore(x) {
      if (!x) return; Object.assign(this.prices, x.prices || {}); for (const [id, n] of x.meals || []) for (let i = 0; i < n; i++) this.g.purse.hearth.addMeal(id);
      for (const id of x.orders || []) { const r = this.g.forge && this.g.forge.recipe(id); if (r) this.smith.orders.push(r); }
    }
    dispose() { for (const j of this.jobs) j.despawn(); if (this.bubbles) this.bubbles.dispose(); }
  }

  Object.assign(K, { Workers, Errands, WorkPoser, Bubbles, Stations, MEALS, MARKET_PRICES: PRICE, POTIONS, WORKER_TRADE: TRADE });
})(typeof window !== 'undefined' ? window : globalThis);
