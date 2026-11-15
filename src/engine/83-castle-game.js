/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Castle mode: the v1.1 game loop layered on PlayMode (play.ext). Light the Keep, restore the
   ruins, build and upgrade the castle pieces, hold the dusk raids, recruit the kin, forge the weapons,
   break the Rime Troll and bind its heart into the Heartfire hearth. Rules live in K.Castle / K.DayCycle;
   this file is the live world: entities, brains, raids, effects, sound and the save slot. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmtCost = (c) => Object.entries(c || {}).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', ') || 'free';

  /* the hero: level is Castle Level, attack is the best weapon + CL bonus (no XP) */
  class CastleHero extends K.PlayerState {
    constructor(items, castle) { super(items, { name: 'Hearthguard', outfit: 'warden' }); this.castle = castle; this.hp = this.stats().hpMax; }
    stats() {
      if (!this.castle) return super.stats();
      const h = this.castle.heroStats(), L = this.xp ? this.xp.level : 1;   // each level: +10 strength, +1 attack
      return { atk: h.atk + (L - 1), def: 0, hpMax: h.hpMax + 10 * (L - 1), speed: 1, level: L, cd: this.castle.data.swingSec };
    }
    gainXp() { return false; }
  }

  /* tiny WebAudio synth: chimes, thunks, the horn. Silent (never throws) when audio is unavailable. */
  class CastleSound {
    constructor() { this.ctx = null; this.vol = 0.35; }
    unlock() { try { if (!this.ctx) { const AC = G.AudioContext || G.webkitAudioContext; if (AC) this.ctx = new AC(); } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { this.ctx = null; } }
    tone(freq, dur, { type = 'sine', vol = 1, at = 0, slide = 0 } = {}) {
      const c = this.ctx; if (!c || c.state !== 'running') return;
      try {
        const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(this.vol * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
      } catch (e) { /* audio is decoration */ }
    }
    noise(dur, { vol = 1, at = 0, freq = 800 } = {}) {
      const c = this.ctx; if (!c || c.state !== 'running') return;
      try {
        const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + at;
        f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = this.vol * vol; s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(t);
      } catch (e) { /* decoration */ }
    }
    play(name) {
      switch (name) {
        case 'pop': this.tone(880, 0.09, { type: 'triangle', vol: 0.5, slide: 1.4 }); break;
        case 'gather': this.noise(0.08, { vol: 0.5, freq: 1400 }); this.tone(520, 0.07, { type: 'triangle', vol: 0.3 }); break;
        case 'thunk': this.noise(0.18, { vol: 1.2, freq: 260 }); this.tone(110, 0.2, { type: 'sine', vol: 0.9, slide: 0.6 }); break;
        case 'whump': this.noise(0.6, { vol: 1.3, freq: 500 }); this.tone(70, 0.5, { vol: 0.8, slide: 1.8 }); this.chime(0.25); break;
        case 'chime': this.chime(0); break;
        case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', vol: 0.5, at: i * 0.12 })); break;
        case 'horn': this.tone(147, 1.4, { type: 'sawtooth', vol: 0.25 }); this.tone(220, 1.2, { type: 'sawtooth', vol: 0.15, at: 0.15 }); break;
        case 'clank': this.tone(1250, 0.15, { type: 'square', vol: 0.15 }); this.noise(0.12, { vol: 0.6, freq: 3000 }); break;
        case 'hit': this.noise(0.07, { vol: 0.6, freq: 1800 }); break;
        case 'swish': this.noise(0.16, { vol: 0.55, freq: 3200 }); this.tone(420, 0.14, { type: 'sawtooth', vol: 0.12, slide: 0.4 }); break;
        case 'roar': this.tone(90, 1.1, { type: 'sawtooth', vol: 0.4, slide: 0.6 }); this.noise(0.9, { vol: 0.8, freq: 400 }); break;
        case 'crack': this.noise(0.35, { vol: 1, freq: 4200 }); this.tone(1800, 0.2, { type: 'triangle', vol: 0.3, slide: 0.5 }); break;
        case 'thaw': [392, 523, 659, 784, 988, 1175].forEach((f, i) => this.tone(f, 1.2, { vol: 0.35, at: i * 0.18 })); break;
      }
    }
    chime(at) { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.6, { vol: 0.4, at: at + i * 0.09 })); }
  }

  /* ---------- brains: raiders, kin, the troll ---------- */
  class RaiderBrain {
    constructor(game, a, goal) { this.g = game; this.a = a; this.goal = goal; this.cd = 0; this.burnT = 0; }
    update(dt) {
      const g = this.g, a = this.a;
      if (!a.alive) { a.deadT += dt; if (a.deadT > 0.8 && a.view.visible) a.view.setVisible(false); if (a.deadT > 1.2) g.removeActor(a); return; }
      if (this.burnT > 0) { this.burnT -= dt; g.hurtEnemy(a, 3 * dt, 'burn'); if (!a.alive) return; }
      this.cd -= dt;
      // fight a hero or kin standing in the way
      const foe = g.nearestAlly(a, 1.3);
      if (foe) { this.face(foe); if (this.cd <= 0) this.strike(foe); return this.anim(false); }
      // walk at the goal (a producer to frost, then the Keep) in a straight line
      let tgt = this.goal;
      if (tgt && tgt.piece && (tgt.piece.frosted || !g.castle.pieces.includes(tgt.piece))) tgt = this.goal = g.keepGoal();
      const dx = tgt.x - a.x, dz = tgt.z - a.z, d = Math.hypot(dx, dz);
      const reach = tgt.piece ? g.pieceRadius(tgt.piece) + 0.4 : g.L.keep.r + 0.7;
      if (d <= reach) {
        if (tgt.piece) { if (g.castle.frost(tgt.piece)) g.onFrosted(tgt.piece); this.goal = g.keepGoal(); return this.anim(false); }
        this.face(tgt); if (this.cd <= 0) { this.cd = a.cd; a.view.setState('attack'); g.hurtKeep(a.atk); } return this.anim(false);
      }
      const step = a.speed * dt, nx = a.x + dx / d * step, nz = a.z + dz / d * step;
      const wall = g.blockingPiece(nx, nz, a.r);
      if (wall) { this.face(wall); if (this.cd <= 0) { this.cd = a.cd; a.view.setState('attack'); g.hurtPiece(wall, a.atk); } return this.anim(false); }
      for (const p of g.castle.producers()) if (!p.frosted && Math.hypot(p.x - nx, p.z - nz) < g.pieceRadius(p) + 0.3) { if (g.castle.frost(p)) g.onFrosted(p); }
      a.x = nx; a.z = nz; a.y = g.play.nav.y(a.x, a.z); a.view.setFacing(dx, dz); this.anim(true);
    }
    face(t) { this.a.view.setFacing(t.x - this.a.x, t.z - this.a.z); }
    strike(foe) { const a = this.a; this.cd = a.cd; if (foe === this.g.play.me) this.g.play.swing(a, foe); else { a.view.setState('attack'); this.g.hurtAlly(foe, a.atk); } }
    anim(moving) { const v = this.a.view; if (moving) { if (v.state !== 'attack' && v.state !== 'hurt' && v.state !== 'walk') v.setState(this.a.fast ? 'run' : 'walk'); } else if (v.state === 'walk' || v.state === 'run') v.setState('idle'); }
  }

  class KinBrain {
    constructor(game, a, id) { this.g = game; this.a = a; this.id = id; this.cd = 0; this.repathT = 0; this.downT = 0; this.offset = { pinewarden: [-1.4, 0.9], emberwright: [1.3, 1.1], rime_brute: [0.2, -1.5] }[id] || [1, 1]; }
    get joined() { return this.g.castle.kin.has(this.id); }
    update(dt) {
      const g = this.g, a = this.a, me = g.play.me;
      if (!this.joined) { if (a.view.state !== 'idle') a.view.setState('idle'); return; }
      if (!a.alive) { this.downT -= dt; if (this.downT <= 0) { a.alive = true; a.hp = a.hpMax; a.view.setState('idle'); g.play.float(a, 'Up again', 'heal'); } return; }
      this.cd -= dt;
      const st = g.kinStats(this.id); a.hpMax = st.hp;
      // dusk: the Pinewarden climbs a watchtower
      const tower = this.id === 'pinewarden' && g.isNightish() ? g.towerFor(a) : null;
      if (tower) {
        a.manning = tower; a.path = null; a.x = tower.x; a.z = tower.z; a.y = g.play.nav.y(tower.x, tower.z) + 3.2;
        const foe = g.nearestEnemy(a, 6.5); if (foe && this.cd <= 0) this.shoot(foe, st); else if (foe) a.view.setFacing(foe.x - a.x, foe.z - a.z);
        return;
      }
      if (a.manning) { a.manning = null; a.y = g.play.nav.y(a.x, a.z); }
      const range = st.ranged ? 4.5 : 1.2, foe = g.nearestEnemy(a, st.ranged ? 5 : 3.2);
      if (foe) {
        const d = Math.hypot(foe.x - a.x, foe.z - a.z);
        if (d <= range) { a.path = null; a.view.setFacing(foe.x - a.x, foe.z - a.z); if (this.cd <= 0) this.shoot(foe, st); return this.anim(false); }
        if ((this.repathT -= dt) <= 0) { this.repathT = 0.4; a.path = g.play.nav.find(a.x, a.z, foe.x, foe.z, { range: range * 0.9, maxNodes: 1500 }); }
        return this.anim(g.play.move(a, dt, a.speed * 1.2));
      }
      // follow the hero
      const tx = me.x + this.offset[0], tz = me.z + this.offset[1], d = Math.hypot(tx - a.x, tz - a.z);
      if (d > 3.4 || (a.path && d > 0.6)) {
        if ((this.repathT -= dt) <= 0 || !a.path) { this.repathT = 0.6; a.path = g.play.nav.find(a.x, a.z, tx, tz, { range: 0.5, maxNodes: 2500 }); }
        if (d > 14) { a.x = me.x - 1; a.z = me.z + 1; a.y = g.play.nav.y(a.x, a.z); a.path = null; }
        return this.anim(g.play.move(a, dt, a.speed * (d > 6 ? 1.8 : 1)));
      }
      a.path = null; this.anim(false);
    }
    shoot(foe, st) {
      const g = this.g, a = this.a; this.cd = st.cd; a.view.setState('attack'); a.view.setFacing(foe.x - a.x, foe.z - a.z);
      if (st.ranged) g.tracer(a, foe, st.color); g.hurtEnemy(foe, st.atk, this.id, true);
    }
    knock() { const a = this.a; a.alive = false; a.view.setState('dead'); this.downT = 5; a.path = null; }
    anim(moving) { const v = this.a.view; if (moving) { if (v.state !== 'attack' && v.state !== 'hurt') v.setState('walk'); } else if (v.state === 'walk' || v.state === 'run') v.setState('idle'); }
  }

  /* the Rime Troll at the bridge: a slow swing every 2 s, every third a ground slam with a 1 s ring telegraph */
  class TrollBrain {
    constructor(game, a) { this.g = game; this.a = a; this.cd = 1.5; this.swings = 0; this.slam = null; this.roared = false; this.home = { x: a.x, z: a.z }; }
    update(dt) {
      const g = this.g, a = this.a, me = g.play.me;
      if (!a.alive) { a.deadT += dt; if (a.deadT > 1.6 && a.view.visible) a.view.setVisible(false); return; }
      if (!g.castle.zoneOpen('troll_bridge')) return;
      if (this.slam) {
        this.slam.t += dt; const k = this.slam.t / 1.0; g.slamRing(this.slam, k);
        if (k >= 1) { g.slamHit(this.slam, a.atk * 1.6); this.slam = null; }
        return;
      }
      if (!this.roared && a.hp <= a.hpMax / 2) { this.roared = true; a.view.setState('attack'); g.play.float(a, 'ROAR!', 'hurt'); g.sound.play('roar'); g.shake(0.5); g.ui.toast('The troll roars. Frost wisps fall off its hide.'); }
      const dm = me.alive ? Math.hypot(me.x - a.x, me.z - a.z) : 99, dh = Math.hypot(this.home.x - a.x, this.home.z - a.z);
      const foe = dm < 7 && dh < 9 ? me : g.nearestAlly(a, 2.2);
      this.cd -= dt;
      if (!foe) { if (dh > 0.4) { a.path = a.path || g.play.nav.find(a.x, a.z, this.home.x, this.home.z, { range: 0.3 }); g.play.move(a, dt, a.speed); a.view.setState('walk'); } else if (a.view.state === 'walk') a.view.setState('idle'); return; }
      const d = Math.hypot(foe.x - a.x, foe.z - a.z), reach = a.reach + 0.4;
      if (d > reach) { a.path = g.play.nav.find(a.x, a.z, foe.x, foe.z, { range: reach * 0.8, maxNodes: 800 }); if (g.play.move(a, dt, a.speed)) { if (a.view.state !== 'attack') a.view.setState('walk'); } return; }
      a.path = null; a.view.setFacing(foe.x - a.x, foe.z - a.z);
      if (this.cd > 0) return;
      this.cd = 2; this.swings++;
      if (this.swings % 3 === 0) { this.slam = { x: foe.x, z: foe.z, r: 2.2, t: 0 }; a.view.setState('attack'); g.slamStart(this.slam); return; }
      if (foe === me) g.play.swing(a, me); else { a.view.setState('attack'); g.hurtAlly(foe, a.atk); }
    }
  }

  /* ---------- the game ---------- */
  class CastleGame {
    /* play: K.PlayMode; opts: { storage, resume } */
    constructor(play, opts = {}) {
      this.play = play; this.data = new K.CastleData(K.CASTLE_DATA); this.L = opts.layout || new K.HutLayout(); this.net = opts.net || null; this.survival = true; this.noRegen = true;
      this.slot = new K.CastleSave(opts.storage || K.CastleSave.defaultStorage()); this.resume = !!opts.resume; this.sound = new CastleSound();
      this.castle = new K.Castle(this.data); this.day = new K.DayCycle(this.data); this.calendar = new K.Calendar(this); this.playTime = 0;
      this.saved = this.resume ? this.slot.read() : null;
      if (opts.net && opts.net.welcome.save && this.resume) { try { this.saved = JSON.parse(opts.net.welcome.save); } catch (e) { console.warn('the saved game on the server could not be read', e); } }   // the server's copy wins: a refresh never loses progress
      if (!this.resume) this.slot.clear();
      if ((this.net && this.net.welcome.evicted) || (G.localStorage && G.localStorage.getItem('kinstead.evict'))) { try { G.localStorage.removeItem('kinstead.evict'); } catch (e) { /* ignore */ } this.saved = this.evictedSave(this.saved); }   // your castle was taken: you keep what you carry, not the land
      if (this.saved) { this.castle = K.Castle.fromJSON(this.data, this.saved.castle); const d = Object.assign({}, this.saved.day); if (this.day.phases[d.idx] && this.day.phases[d.idx].kind === 'night') d.t = 0; this.day = new K.DayCycle(this.data, d); this.playTime = this.saved.playTime || 0; }
      if (!this.saved) { this.castle.add('wood', 70); this.castle.add('stone', 35); this.castle.add('dirt', 4); this.castle.add('arrow', 12); this.castle.weapons.add('stoneblade'); this.freshStart = true; }   // you start with a little of everything and a blade
      this.day.phases = K.Calendar.PHASES;   // looping day and night
      this.noXp = true; this.swingSec = this.data.swingSec;
    }
    /** a saved game after your castle was taken: resources, strength and weapons stay; pieces, buildings, stores and ground do not */
    evictedSave(sv) { if (!sv) return null; const keep = sv.extras || {}; sv.castle.pieces = []; sv.hero = null; sv.nodes = {}; sv.extras = { weapons: keep.weapons, held: keep.held, xp: keep.xp }; return sv; }
    /** you hit another player: tell the server (it works out the damage) */
    pvpHit(a, b) {
      if (!this.mp) return;
      if (a === this.play.me) { if (b.mob) this.mp.mobHit(b); else this.mp.pvp(b.pid); this.xp.dealt(); this.sound.play('hit'); }   // you hit a player, or someone else's creature
      else if (!a.remote && !b.mob && b.pid) this.mp.mobBite(a, b);   // one of your creatures bit another player
    }
    playerMenu(e) { if (this.mp) this.mp.playerMenu(e); }
    /** your character wears your banner's colour */
    applyLook() { const me = this.play.me; if (me && me.view) { const c = K.BANNER_COLORS[this.banners.mine().color % 12]; if (me.view.setTeam) me.view.setTeam(c); else if (me.view.setTint) me.view.setTint(c); } }
    /** do you hold the key to this building? (your own house and workshop always; others' only through a key, yours or your team's) */
    keyFor(id) { if (id === 'home' || id === 'smithy' || id === 'market') return true; return this.mp ? this.mp.keyFor(id) : false; }
    /** where you slept last is where you wake (and where you come back after a fall) */
    setRespawn(buildingId, x, z) {
      const slot = this.mp ? this.mp.slotOf(buildingId) : buildingId === 'home' ? 0 : null; if (slot == null) return;   // only a house: not the workshop
      this.respawn = { x, z, id: buildingId }; this.play.spawn = { x, z }; if (this.mp) this.mp.setRespawn(slot, x, z); this.cui.toast('You will wake here.');
    }
    get app() { return this.play.app; }
    get R() { return this.play.R; }
    get ui() { return this.cui; }
    makePlayer() { this.xp = this.xp || new K.Experience(this); const p = new CastleHero(this.play.items, this.castle); p.xp = this.xp; p.addItem('ember_lantern', 1); if (this.freshStart) p.addItem('bread', 10); /* you arrive with food to last a while */ for (const w of this.castle.weapons) { p.addItem(w, 1); } this.equipBest(p); p.healFull(); return p; }
    equipBest(p) { const w = this.castle.bestWeapon(); if (w && p.count(w.id)) p.equip(w.id); }

    /* ---------- enter / exit ---------- */
    enter() {
      const play = this.play, R = this.R;
      document.body.classList.add('castle');
      this.art = new CastleArt(R.bmats); this.group = new THREE.Group(); this.group.name = 'castle'; R.scene.add(this.group);
      this.meshes = new Map(); this.tracers = []; this.shakeT = 0; this.flareT = 0; this.nightK = this.day.isNight ? 1 : 0; this.lastCl = this.castle.cl(); this.saveT = 0; this.prevBook = null;
      this.occ = new Uint8Array(play.nav.w * play.nav.h); this.gateTiles = new Set();
      // spawn by the Keep's door
      play.spawn = { x: this.L.start.x, z: this.L.start.z };
      { const rs = (this.net && this.net.welcome.respawn) || (this.saved && this.saved.extras && this.saved.extras.respawn);   // you always wake where you last slept
        if (rs) { play.spawn = { x: rs.x, z: rs.z }; this.respawn = rs; }
        play.me.x = play.spawn.x; play.me.z = play.spawn.z; play.me.y = play.nav.y(play.spawn.x, play.spawn.z); }
      // your hut: the fire, the furniture, the barrels. No keep, ruins, outcrop or zone barriers.
      this.walls = new K.WallDrawer(this);   // before any saved pieces come back: placing and blocking a piece asks it what it is
      this.gateTiles = new Set(); this.smithy = null; this.marketHall = null; this.forge = null; this.home = new K.Home(this); this.castle.extraHas = (t) => (t === 'blacksmith' && !!this.smithy) || (t === 'cottage' && this.home.built) || (t === 'market' && !!this.marketHall); this.keepMesh = null; this.ruinEnts = {}; this.outcropEnt = null;
      this.keepEnt = { id: 'c-home', type: 'c_keep', name: 'Your home', x: this.L.keep.x, z: this.L.keep.z, y: 0, r: 0.1, h: 2, goal: [this.home.doorPoint.x, this.home.doorPoint.z] };
      if (!this.castle.lit) this.castle.light();
      for (const p of this.castle.pieces) this.addPieceMesh(p);
      this.barriers = {};
      for (const [z, b] of Object.entries(this.L.barriers)) if (!this.castle.zoneOpen(z)) this.addBarrier(z, b);
      // glow, light, arrow
      this.glowMesh = this.art.glow(); this.group.add(this.glowMesh); this.glowR = this.castle.glowRadius();
      this.arrow = this.art.arrow(); this.group.add(this.arrow); this.ring = null;
      const pd = R.placeDynamics.bind(R); this.origPlace = pd; R.placeDynamics = () => { pd(); this.pushLights(); }; R.placeDynamics();
      this.hemi = R.scene.children.find((o) => o.isHemisphereLight); this.base = { sun: R.sun.intensity, hemi: this.hemi ? this.hemi.intensity : 1, bg: R.scene.background.clone(), fog: R.scene.fog.color.clone() };
      // thawed ground already earned (resume): melt it at once
      if (this.castle.lit) this.meltTo(this.castle.glowRadius(), 0);
      if (this.castle.hearthCap >= 5) this.thawAll(0);
      this.kinActors = {}; this.troll = null;
      this.restoreNodes();
      this.raid = null;
      this.cui = new K.CastleUI(this); this.vitals = new K.Vitals(this); this.wild = new K.Wild(this); this.calendar.on((ev) => this.onCalendar(ev)); this.tools = new K.CastleTools(this); this.minimap = new K.Minimap(this); this.xp = this.xp || new K.Experience(this); this.weather = new K.Weather(this); this.towers = new K.Towers(this); this.economy = new K.Economy(this); this.workers = new K.Workers(this); this.banners = new K.BannerBook(this, this.net); this.flags = new K.Flags(this); this.banners.on(() => this.applyLook()); this.applyLook(); this.forest = new K.Forest(this); this.brush = new K.GroundBrush(this); this.steer = new K.PieceSteer(this); this.purse = new K.Purse(this); this.stash = new K.Stash(this); this.site = new K.BuildingSite(this); this.sweep = new K.SweepAttack(this); this.demolisher = new K.Demolisher(this); this.play.refreshProps();
      if (this.day.isNight) this.startRaid();
      play.app.rig.set({ dist: 11, pitch: 0.78 }); play.app.rig.maxDist = 44;   // you can never zoom out far enough to see the edge of the world
      this.persist = new K.Persist(this); if (this.saved && this.saved.extras) { try { this.persist.restore(this.saved.extras); } catch (err) { console.warn('could not restore the homestead', err); } }
      if (this.net) { try { this.mp = new K.Multiplayer(this, this.net); this.calendar.sync = () => this.mp.cycleState(); this.mp.uploadMine(); } catch (err) { console.warn('multiplayer failed to start; playing alone', err); this.mp = null; } }   // after your own save is back, so the shared world wins
      this.cui.toast(this.saved ? 'Welcome back.' : 'You arrive with wood, stone and bread. Build your cottage first: hammer (5), then Buildings. Wolves hunt at night. Press E to eat.');
      G.castle = this;   // test hook (and the console's best friend)
    }
    exit() {
      this.play.app.rig.maxDist = null; if (this.minimap) this.minimap.dispose(); if (this.vitals) this.vitals.dispose(); if (this.home) this.home.dispose();
      this.save(); if (this.tools) this.tools.dispose(); if (this.sweep) this.sweep.dispose(); if (this.demolisher) this.demolisher.dispose(); if (this.site) this.site.dispose(); if (this.brush) this.brush.dispose(); if (this.mp) this.mp.dispose(); if (this.weather) this.weather.dispose(); if (this.towers) this.towers.dispose(); if (this.economy) this.economy.dispose(); if (this.workers) this.workers.dispose(); if (this.flags) this.flags.dispose(); if (this.purse) this.purse.dispose();
      if (this.origPlace) this.R.placeDynamics = this.origPlace;
      this.R.scene.remove(this.group); this.cui && this.cui.dispose(); document.body.classList.remove('castle');
    }
    place(obj, x, z, rot) { obj.position.set(x, this.play.nav.y(x, z) - 0.02, z); obj.rotation.y = rot || 0; this.group.add(obj); return obj; }
    /* see-through: any castle mesh between the camera and the hero fades, so the hero is never lost behind a wall */
    updateOcclusion(dt) {
      if ((this.occT = (this.occT || 0) - dt) > 0) return; this.occT = 0.1;
      const me = this.play.me, cam = this.app && this.app.camera; if (!me || !cam) return;
      const V = this.occV || (this.occV = { o: new THREE.Vector3(), h: new THREE.Vector3(), d: new THREE.Vector3(), hit: new THREE.Vector3(), ray: new THREE.Ray() });
      cam.getWorldPosition(V.o); V.h.set(me.x, this.play.nav.y(me.x, me.z) + 0.9, me.z);
      const far = V.o.distanceTo(V.h) - 0.4; V.ray.set(V.o, V.d.subVectors(V.h, V.o).normalize());
      for (const m of [...this.meshes.values(), this.keepMesh]) {
        if (!m || !m.parent) continue;
        if (!m.userData.box || m.userData.popT < 0.5) m.userData.box = new THREE.Box3().setFromObject(m);   // re-measure while a new piece pops up
        const hit = V.ray.intersectBox(m.userData.box, V.hit), fade = !!hit && V.o.distanceTo(V.hit) < far;
        if (fade !== !!m.userData.faded) this.setFaded(m, fade);
      }
    }
    setFaded(m, on) {
      m.userData.faded = on;
      m.traverse((o) => {
        if (!o.isMesh || o.userData.frost) return;
        if (on) { if (!o.userData.solidMat) { o.userData.solidMat = o.material; o.userData.fadeMat = (Array.isArray(o.material) ? o.material : [o.material]).map((x) => { const f = x.clone(); f.transparent = true; f.opacity = Math.min(x.opacity, 0.3); f.depthWrite = false; return f; }); if (!Array.isArray(o.material)) o.userData.fadeMat = o.userData.fadeMat[0]; } o.material = o.userData.fadeMat; }
        else if (o.userData.solidMat) o.material = o.userData.solidMat;
      });
    }
    redrawKeep() {
      if (this.survival) return;
      if (this.keepMesh) this.group.remove(this.keepMesh);
      this.keepMesh = this.art.piece('keep', { ruin: !this.castle.lit }); this.place(this.keepMesh, this.L.keep.x, this.L.keep.z, 0);
    }

    /* ---------- tiles: nav blocking + occupancy ---------- */
    rectTiles(x, z, w, d, rot, fn) {
      const nav = this.play.nav, c = Math.cos(rot), s = Math.sin(rot), R = Math.hypot(w, d) / 2 + TILE;
      const [i0, j0] = nav.tile(x - R, z - R), [i1, j1] = nav.tile(x + R, z + R);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (!nav.inside(i, j)) continue; const [px, pz] = nav.centre(i, j), dx = px - x, dz = pz - z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2) fn(i, j, lx, lz);
      }
    }
    blockRect(x, z, w, d, rot, gate) {
      const nav = this.play.nav;
      this.rectTiles(x, z, w, d, rot, (i, j, lx) => { const k = j * nav.w + i; this.occ[k] = 1; if (!gate || Math.abs(lx) > 0.75) nav.walk[k] = 0; });
      const me = this.play.me; if (me && !nav.standable(me.x, me.z)) { const q = nav.nearestOk(...nav.tile(me.x, me.z), 8); if (q) { [me.x, me.z] = nav.centre(...q); me.path = null; } }
    }
    unblockRect(x, z, w, d, rot) { const nav = this.play.nav; this.rectTiles(x, z, w, d, rot, (i, j) => { const k = j * nav.w + i; this.occ[k] = 0; nav.walk[k] = 1; }); }

    /* ---------- entities the player can click ---------- */
    entities() {
      const out = this.home ? this.home.entities() : [];
      for (const p of this.castle.pieces) out.push(this.pieceEnt(p));
      if (this.mp) for (const e of this.mp.world.entities().concat(this.mp.stores.entities())) out.push(e);   // other settlers' walls, gates and doors
      return out;
    }
    pieceEnt(p) {
      if (!p.ent) { const [w, d] = CastleArt.size(p.type); p.ent = { id: 'c-p' + p.uid, type: 'c_piece', piece: p, x: p.x, z: p.z, y: 0, r: K.Breacher.GATES.has(p.type) ? Math.max(w, d) / 2 : Math.max(0.5, Math.min(w, d) / 2 + 0.2), h: { watchtower: 4.6, great_hall: 2.8, gatehouse: 3, stone_gate: 3.2 }[p.type] || 1.8 }; }
      p.ent.name = this.data.piece(p.type).name + (p.level >= 2 ? ' · Level 2' : ''); return p.ent;
    }
    pieceRadius(p) { const [w, d] = CastleArt.size(p.type); return Math.max(w, d) / 2; }
    addPieceMesh(p) {
      const m = this.art.piece(p.type, { level: p.level }); this.place(m, p.x, p.z, p.rot); this.meshes.set('p' + p.uid, m);
      if (p.frosted || this.castle.isFrosted(p)) this.setFrost(p, true);
      if (K.Breacher.GATES.has(p.type) && !p.bridge) p.bridge = p.type === 'gate' ? new K.WoodGate(this, p) : new K.Drawbridge(this, p);
      if (K.Breacher.GATES.has(p.type) && this.flags) { const lx = p.type === 'gate' ? 1.05 : 2.25; this.flags.flag('g' + p.uid, p.x + lx * Math.cos(p.rot || 0), p.z - lx * Math.sin(p.rot || 0), this.banners.meId, p.type === 'gate' ? 2.6 : 3.8); }   // your colours on your gate
      this.blockPiece(p); return m;
    }
    /* a piece's footprint blocks the ground (walls a hair longer so a run of them has no gaps) */
    /* tiles wolves may never step on: the house, and every gate (you walk through a gate; a wolf does not) */
    /* where a gate goes for the pointer at p: it lines up with a fence run next to it, else follows R. Returns { x, z, rot }. */
    gateSpot(p) {
      const i = Math.floor(p.x / TILE), j = Math.floor(p.z / TILE), turned = Math.round((this.rotExtra || 0) / (Math.PI / 2)) % 2 === 1;
      const spotX = { x: (i + 1) * TILE, z: (j + 0.5) * TILE, rot: 0 }, spotZ = { x: (i + 0.5) * TILE, z: (j + 1) * TILE, rot: Math.PI / 2 };
      const wallAt = (x, z) => { const q = this.pieceAt(x, z, 0.05); return q && !K.Breacher.GATES.has(q.type); };
      if (!turned) { if (wallAt(spotX.x - 1.25, spotX.z) || wallAt(spotX.x + 1.25, spotX.z)) return spotX; if (wallAt(spotZ.x, spotZ.z - 1.25) || wallAt(spotZ.x, spotZ.z + 1.25)) return spotZ; return spotX; }
      return spotZ;
    }
    /* the blacksmith is placed by BuildingSite (104-castle-site.js) */
    /* any building of yours: wolves never go in */
    insideBuilding(x, z) { return !!this.R.buildings.at(Math.floor(x / TILE), Math.floor(z / TILE)); }
    gateTilesOf(p) { const out = [], [w, d] = CastleArt.size(p.type); this.rectTiles(p.x, p.z, w, d, p.rot, (i, j) => out.push(i + ',' + j)); return out; }
    isSanctuary(x, z) { return this.insideBuilding(x, z) || this.gateTiles.has(Math.floor(x / TILE) + ',' + Math.floor(z / TILE)); }
    blockPiece(p) {
      if (K.Breacher.GATES.has(p.type)) { if (p.bridge) p.bridge.apply(); return; }   // a gate's tiles follow its leaves or bridge: shut, nothing passes; open, you do
      if (p.type === 'gate_old') { const nav = this.play.nav; this.rectTiles(p.x, p.z, 2, 0.5, p.rot, (i, j) => { this.occ[j * nav.w + i] = 1; this.gateTiles.add(i + ',' + j); }); return; }   // occupied for building, but you can walk through
      const [w, d] = CastleArt.size(p.type); this.blockRect(p.x, p.z, this.walls.handles(p.type) ? w + 0.04 : w, d, p.rot, p.type === 'gatehouse'); }
    /* the piece standing on this ground point, or null */
    pieceAt(x, z, pad = 0.2) {
      for (const p of this.castle.pieces) {
        const [w, d] = CastleArt.size(p.type), c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.x, dz = z - p.z;
        if (Math.abs(dx * c - dz * s) <= w / 2 + pad && Math.abs(dx * s + dz * c) <= d / 2 + pad) return p;
      }
      return null;
    }
    /* take a piece down: it comes apart, the ground clears, and half its cost drops as pickups to collect */
    demolishPiece(p, opts = {}) {
      const c = this.castle; if (!c.canDemolish(p)) { this.cui.toast('Restored ruins stay standing.'); return false; }
      if (this.mp && !this.mp.quiet) this.mp.op({ k: 'piece-', id: this.mp.pieceId(p) });
      const r = c.demolish(p), m = this.meshes.get('p' + p.uid), [w, d] = CastleArt.size(p.type), fx = this.tools.effects, y = this.play.nav.y(p.x, p.z);
      if (m) { this.group.remove(m); this.meshes.delete('p' + p.uid); }
      if (p.bridge) { p.bridge.dispose(); p.bridge = null; }
      if (this.flags) this.flags.unflag('g' + p.uid);
      this.unblockRect(p.x, p.z, this.walls.handles(p.type) ? w + 0.04 : w, d, p.rot); if (K.Breacher.GATES.has(p.type)) this.gateTilesOf(p).forEach((k) => this.gateTiles.delete(k));
      for (const q of c.pieces) if (Math.hypot(q.x - p.x, q.z - p.z) < Math.max(w, d) + 6) this.blockPiece(q);   // a neighbour sharing a corner tile keeps it blocked
      this.sound.play('crack'); this.shake(0.12); this.puff(p.x, p.z); fx.burst(p.type === 'stone_wall' || p.type === 'stone_gate' ? 'stone' : 'wood', p.x, y + 0.6, p.z, 12, 3.2);
      if (opts.refund !== false) for (const [res, n] of Object.entries(r.refund)) { const k = Math.min(n, 6); for (let i = 0; i < k; i++) fx.spawnPickup(res, Math.floor(n / k) + (i < n % k ? 1 : 0), p.x + (Math.random() - 0.5) * w * 0.5, y + 0.6, p.z + (Math.random() - 0.5) * d, 2.6, true); }
      this.play.refreshProps(); this.changed(); return true;
    }
    redrawPiece(p) { const old = this.meshes.get('p' + p.uid); if (old) this.group.remove(old); const m = this.art.piece(p.type, { level: p.level }); this.place(m, p.x, p.z, p.rot); this.meshes.set('p' + p.uid, m); if (this.castle.isFrosted(p)) this.setFrost(p, true); return m; }
    setFrost(p, on) {
      const m = this.meshes.get('p' + p.uid); if (!m) return; const cur = m.children.find((c) => c.userData.frost);
      if (on && !cur) { const f = this.art.frostShell(p.type); f.userData.frost = true; m.add(f); } else if (!on && cur) m.remove(cur);
    }
    pop(obj, s0 = 0.2) { obj.scale.setScalar(s0); obj.userData.popT = 0; obj.userData.s0 = s0; (this.pops = this.pops || []).push(obj); }

    /* ---------- actions (the interaction registry asks these) ---------- */
    actionsFor(e) {
      const c = this.castle, out = [];
      const act = (id, label, icon, run, extra) => out.push(Object.assign({ id, label, icon, run: (gm, x) => { this.sound.unlock(); run(x); } }, extra || {}));
      if (e.type === 'c_keep') {
        if (!c.lit) act('light', 'Light the hearth', 'lantern', () => this.lightKeep(), { range: 0.6 });
        if (c.lit && c.amount('troll_heart') > 0 && c.hearthCap < 5) act('bind', `Bind the troll’s heart · ${fmtCost(this.data.keepUpgrade.cost)}`, 'heart', () => this.bindHeart(), { range: 0.6 });
        if (c.lit && !c.weapons.has('stoneblade')) act('craft', `Forge a Stoneblade · ${fmtCost(this.data.recipe('craft_stoneblade').inputs)}`, 'stoneblade', () => this.craft('craft_stoneblade'), { range: 0.6 });
        if (c.lit && this.day.kind === 'day' && this.day.length() != null && this.day.idx + 1 < this.day.phases.length) act('bell', 'Ring the bell (dusk now)', 'bell', () => this.ringBell());
        act('book', 'Open the Hearthbook', 'book', () => this.cui.toggleBook(true));
      } else if (e.type === 'c_ruin') {
        const t = e.ruinType, cost = c.buildCost(t, { ruin: true }), why = c.blocker(t, { ruin: true });
        act('repair', `Repair: ${fmtCost(cost)}${why ? ' (' + why + ')' : ''}`, 'hammer', () => this.repair(t), { range: e.r + 0.7 });
      } else if (e.type === 'c_site') {
        const why = c.blocker('mine');
        act('mine', `Build an Iron mine: ${fmtCost(c.buildCost('mine'))}${why ? ' (' + why + ')' : ''}`, 'pickaxe', () => this.buildAtSite(), { range: 1.6 });
      } else if (e.type === 'c_piece') {
        const p = e.piece, up = c.upgradeInfo(p);
        if (this.tools.tool.id === 'hammer' && c.canDemolish(p)) act('demolish', 'Take down…', 'hammer', () => this.demolisher.ask(p), { range: e.r + 0.8 });   // hammer only, and it asks
        if (p.type === 'coop' || p.type === 'barn') {
          const st = this.economy.stock, kind = p.type === 'coop' ? 'chicken' : 'cow', sp = K.LIVESTOCK[kind], n = st.herd(p).length;
          act('buy', `Buy a ${kind} · ${sp.price} wheat (${n}/${sp.max}, you have ${this.economy.wheatHeld()} wheat)`, 'bag', () => st.buy(p), { range: e.r + 1.2 });
          if (p.type === 'barn' && n) act('butcher', 'Butcher a cow for beef', 'sword', () => st.butcher(p), { range: e.r + 1.2 });
        }
        if (p.type === 'market') act('prices', 'Set the clerk’s prices', 'coin', () => this.workers.setPrices(), { range: e.r + 1.6 });
        if (p.type === 'market' || p.type === 'silo' || p.type === 'farm' || p.type === 'coop' || p.type === 'barn') { const nm = { market: 'Open the marketplace', silo: 'Look in the silo', farm: 'Look in the farm', coop: 'Collect eggs', barn: 'Look in the cattle barn' }[p.type]; act('store', nm, 'bag', () => this.purse.openLedger(p), { range: e.r + 1.2 }); }   // a building's store, as a second purse
        if (K.Breacher.GATES.has(p.type) && p.bridge) act('bridge', p.type === 'gate' ? (p.bridge.open ? 'Shut the gate' : 'Open the gate') : (p.bridge.open ? 'Raise the drawbridge' : 'Lower the drawbridge'), 'hand', () => p.bridge.toggle(), { range: p.type === 'gate' ? 2.6 : 3.4 });
        if (up) { const pb = c.upgradePayback(p), why = c.upgradeBlocker(p); act('upgrade', `Upgrade to Level 2: ${fmtCost(c.upgradeCost(p))}${pb != null ? ` · pays back in ${pb.toFixed(1)} min` : ''}${why ? ' (' + why + ')' : ''}`, 'hammer', () => this.upgrade(p), { range: e.r + 0.8 }); }
        const st = { smithy: 'craft_iron_sword', ember_forge: 'craft_ember_brand' }[p.type];
        if (st && !c.weapons.has(this.data.recipe(st).id.replace('craft_', ''))) act('craft', `Forge ${this.data.item(st.replace('craft_', '')).name} · ${fmtCost(this.data.recipe(st).inputs)}`, st === 'craft_iron_sword' ? 'sword' : 'brand', () => this.craft(st), { range: e.r + 0.8 });
      } else if (e.type === 'c_rstore') {
        const v = e.rec || {}; act('take', `Take from the ${e.name.toLowerCase()}`, 'hand', () => this.mp.takeFrom(e.sid), { range: e.r + 0.8 });
      } else if (e.type === 'c_rpiece') {
        const rec = e.rec, mp = this.mp, gate = K.Breacher.GATES.has(rec.p.type), mine = mp.mayUse(rec.p.owner);
        if (gate) act('open', rec.gate.open ? 'Shut the gate' : (mine ? 'Open the gate' : 'Try the gate (locked)'), 'hand', () => mp.requestGate(rec), { range: 2.8 });
        if (rec.p.type === 'market') act('trade', 'Trade with the clerk', 'coin', () => this.workers.trade(rec.p.owner), { range: 2.6 });
        if (!mine) act('break', 'Break it down', 'sword', () => mp.hit(rec), { range: 2.1 });
      } else if (e.type === 'c_rdoor') {
        const rec = e.rec, mp = this.mp, mine = mp.mayUse(rec.owner), d = rec.door;
        if (d.broken) { if (!mine) act('install', 'Hang your own door (3 wood): take the castle', 'hammer', () => mp.installDoor(rec), { range: 2.4 }); }
        else { act('open', d.open ? 'Shut the door' : (mine ? 'Open the door' : 'Try the door (locked)'), 'hand', () => mp.requestDoor(rec), { range: 2.4 }); if (!mine) act('break', 'Break the door down', 'sword', () => mp.hit(rec, true), { range: 2.1 }); }
      } else if (e.type === 'c_rack') {
        const rk = e.rack; act('bow', rk.owned ? 'Put the bow back' : 'Take the bow', 'sword', () => (rk.owned ? rk.putBack() : rk.take()), { range: 1.2 });
        act('fletch', 'Fletch 4 arrows (1 wood)', 'hand', () => rk.fletch(), { range: 1.2 });
      } else if (e.type === 'c_door') {
        const door = this.home.door; act('door', door.broken ? 'Repair the door (3 wood)' : door.open ? 'Shut the door' : 'Open the door', 'hand', () => door.toggle(), { range: 1.3 });
      } else if (e.type === 'c_barrel') {
        const rg = e.r + 0.8, st = e.store;
        if (st.pile) act('take', `Pick up the ${e.name.toLowerCase()} (${st.amount})`, 'hand', () => this.stash.take(st), { range: rg }); else
        if (e.res === 'bread') { act('eat', `Eat a loaf (+${K.BUILDING_DATA.FOOD.bread.hp} strength · ${st.amount} left)`, 'hand', () => this.home.eatBread(st), { range: rg }); act('take', 'Take a loaf', 'hand', () => this.home.takeBread(st), { range: rg }); }
        else if (e.res === 'food') act('take', `Take some raw food (${st.amount} left)`, 'hand', () => this.home.takeFood(st), { range: rg });
        else if (e.res === 'arrow') act('take', `Take arrows (${st.amount} left)`, 'hand', () => this.home.takeArrows(st), { range: rg });
        else act('look', `${e.name}: ${st.amount} ${K.CastleData.resName(e.res)}`, 'eye', () => this.cui.toast(`${st.amount} ${K.CastleData.resName(e.res)} stored here.`), { range: rg });
        if (!st.pile && st.stock != null && st.stock > 0) act('pickup', `Pick up everything (${st.stock})`, 'hand', () => this.stash.take(st), { range: rg });   // crates and barrels can be emptied into your purse and put down elsewhere
      } else if (e.type === 'c_kin') {
        const id = e.kinId;
        if (!c.kin.has(id) && id === 'emberwright') act('touch', 'Touch her with the lantern', 'lantern', () => this.touchEmberwright(), { range: 1.4 });
      }
      out.push({ id: 'inspect', label: 'Inspect', icon: 'eye', run: (gm, x) => gm.inspect(x) });
      return out;
    }
    inspect(e) {
      const c = this.castle;
      if (e.type === 'c_piece') {
        const p = e.piece, d = this.data.piece(p.type), pr = c.producesOf(p), rows = [['Level', p.level]];
        if (pr) rows.push(['Makes', Object.entries(pr).map(([r, n]) => `+${n} ${K.CastleData.resName(r)}/min`).join(', ')]);
        if (c.isFrosted(p)) rows.push(['State', 'FROSTED (no production)']); else if (pr && c.isFull(p)) rows.push(['State', 'FULL: build a Storehouse or spend']);
        if (d.category === 'defense') rows.push(['HP', `${Math.ceil(p.hp)} / ${this.pieceHpMax(p)}`]);
        return { title: d.name, sub: d.category, body: d.effect, rows };
      }
      if (e.type === 'c_barrel') return { title: e.name, sub: 'Outside your home', body: 'Your stores. A raider can walk off with some of it.', rows: [] };
      if (e.type === 'c_keep') return { title: 'The Keep', sub: `Castle Level ${c.cl()}`, body: c.lit ? 'Your castle’s heart. Raiders walk at it. Its workbench forges the Stoneblade.' : 'Cold and roofless. Your ember lantern could light its hearth.', rows: [['Keep HP', this.raid ? `${Math.ceil(this.raid.keepHp)} / ${c.keepHpMax()}` : c.keepHpMax()], ['Glow', c.glowRadius() + ' m']] };
      if (e.type === 'c_ruin') return { title: e.name, sub: 'Ruin', body: this.data.piece(e.ruinType).effect, rows: [['Repair', fmtCost(c.buildCost(e.ruinType, { ruin: true }))]] };
      if (e.type === 'c_site') return { title: 'Iron outcrop', sub: 'Iron Hills', body: 'Rust-red rock: the one place an Iron mine can stand. It is outside the walls, so raiders can frost it.', rows: [] };
      if (e.type === 'c_kin') { const h = this.data.hero(e.kinId); return { title: h.name, sub: h.role, body: c.kin.has(e.kinId) ? h.perk : h.found + '. Joins when ' + h.joinsWhen + '.', rows: [] }; }
      const n = this.nodeSpec(e); if (n) { const st = this.play.nodeState(e); return { title: e.name, sub: 'Resource', body: `Yields ${Object.entries(n.yields).map(([r, v]) => v + ' ' + r).join(', ')} per action (+${c.row().gatherBonus} from Castle Level).`, rows: [['Left', st.charges > 0 ? `${st.charges} / ${st.max}` : 'spent']] }; }
      return { title: e.name, body: '' };
    }

    /* ---------- gathering ---------- */
    nodeSpec(e) { return this.data.node({ c_tree: 'tree', c_boulder: 'boulder', c_rubble: 'rubble', c_iron: 'iron_rock' }[e.type]); }
    gather(e) {
      const play = this.play, n = this.nodeSpec(e), st = play.nodeState(e); this.sound.unlock();
      if (st.charges <= 0) { this.cui.toast(`This ${e.name.toLowerCase()} is spent. ${n.respawnSec ? 'It regrows soon.' : 'It is gone.'}`); return; }
      const [r, base] = Object.entries(n.yields)[0];
      if (this.castle.amount(r) >= this.castle.caps()[r]) { this.cui.toast(`Your ${K.CastleData.resName(r)} store is full (${this.castle.caps()[r]}). Spend it or build a Storehouse.`); this.cui.flashRes(r); return; }
      play.face(play.me, e);
      play.channel({ label: { c_tree: 'Chopping…', c_iron: 'Mining…' }[e.type] || 'Gathering…', time: 1.5, onDone: () => {
        const got = Math.round(this.castle.gather(r, base));
        if (got > 0) { play.float(play.me, `+${got}`, 'loot', K.CastleUI.ICON[r]); this.cui.bump(r); this.sound.play('gather'); }
        st.charges--;
        if (e.type === 'c_tree' && st.charges > 0) this.R.setPropState(e.id, 'cut' + Math.min(4, st.max - st.charges));   // the tree visibly shrinks with every swing
        if (st.charges <= 0) { st.respawnAt = n.respawnSec ? play.t + n.respawnSec : Infinity; this.R.setPropState(e.id, 'depleted'); this.forest.cleared(e); play.me.view.setState('idle'); }
        else if (this.castle.amount(r) < this.castle.caps()[r]) this.gather(e); else { play.me.view.setState('idle'); this.cui.toast(`${K.CastleData.resName(r)[0].toUpperCase() + K.CastleData.resName(r).slice(1)} is full.`); this.cui.flashRes(r); }
        this.changed();
      } });
    }

    /* ---------- building ---------- */
    lightKeep() {
      if (!this.castle.light()) return;
      const p = this.play; p.face(p.me, this.keepEnt); p.me.view.setState('action');
      p.player.removeItem('ember_lantern', 1);
      this.sound.play('whump'); this.redrawKeep(); this.pop(this.keepMesh, 0.6); this.flareT = 2.5; this.shake(0.25);
      this.meltTo(this.castle.glowRadius(), 1.4); this.glowR = 0.5;
      this.cui.banner('The hearth roars', 'CL 1 · the glow pushes the frost back 6 m', 'fire');
      this.changed();
    }
    repair(type) {
      const r = this.castle.build(type, this.L.ruins[type], { ruin: true });
      if (!r.ok) { this.cui.toast(`${this.data.piece(type).name}: ${r.why}.`); this.sound.play('clank'); return; }
      const at = this.L.ruins[type], old = this.meshes.get('ruin:' + type); if (old) { this.group.remove(old); this.meshes.delete('ruin:' + type); }
      r.piece.rot = at.rot; const m = this.addPieceMesh(r.piece); this.pop(m);
      this.sound.play(type === 'gatehouse' ? 'clank' : 'thunk'); this.puff(at.x, at.z);
      const done = Object.entries(this.castle.ruins).filter(([, v]) => v).length;
      this.cui.toast(`${this.data.piece(type).name} restored. Ruins ${done}/4.`); this.changed();
    }
    buildAtSite() {
      const at = this.L.outcrop, r = this.castle.build('mine', { x: at.x, z: at.z, rot: 0 });
      if (!r.ok) { this.cui.toast(`Iron mine: ${r.why}.`); this.sound.play('clank'); return; }
      const old = this.meshes.get('outcrop'); if (old) this.group.remove(old);
      this.pop(this.addPieceMesh(r.piece)); this.sound.play('thunk'); this.puff(at.x, at.z);
      this.cui.toast(`Iron mine: ${K.CastleUI.prodLine(this.castle, 'mine')}.`); this.changed();
    }
    /* free placement of a new piece (from the Build radial) */
    placementOk(type, x, z, rot) {
      const c = this.castle, [w, d] = CastleArt.size(type), nav = this.play.nav;
      let bad = null;
      if (type === 'dirt') return this.dirtOk(x, z);
      if (type === 'field') return this.economy.plantOk(x, z);
      if (type === 'blacksmith') return null;
      this.rectTiles(x, z, w + 0.2, d + 0.2, rot, (i, j) => { const k = j * nav.w + i; if (this.occ[k] || this.R.buildings.at(i, j)) bad = 'something is in the way'; else if (!nav.walk[k] || nav.deck[k]) bad = bad || 'the ground is not clear'; });
      const me = this.play.me; if (!bad && Math.hypot(me.x - x, me.z - z) < Math.min(w, d) / 2 + 0.2) bad = 'you are standing there';
      return bad;
    }
    /* a piece may never seal the Keep in: its approach must still reach the wilds (walls need the Gatehouse as the way in) */
    wouldWallOffKeep(type, x, z, rot) {
      const nav = this.play.nav, [w, d] = CastleArt.size(type), gate = type === 'gatehouse', saved = [];
      this.rectTiles(x, z, w, d, rot, (i, j, lx) => { if (gate && Math.abs(lx) <= 0.75) return; const k = j * nav.w + i; saved.push([k, nav.walk[k]]); nav.walk[k] = 0; });
      const a = this.keepEnt.goal || [this.L.keep.x, this.L.keep.z + this.L.keep.r + 1];
      const open = this.L.outside.some((o) => nav.find(a[0], a[1], o.x, o.z, { range: 1.5 }));
      for (const [k, v] of saved) nav.walk[k] = v;
      return !open;
    }
    autoRot(x, z) { return Math.atan2(-(x - this.L.keep.x), -(z - this.L.keep.z)) + (this.rotExtra || 0); }
    /* dirt goes on free ground, one cube per press; it stacks */
    dirtOk(x, z) {
      const [i, j] = this.play.doc.tileOf(x, z), T2 = TILE, cx = (i + 0.5) * T2, cz = (j + 0.5) * T2;
      for (const a of this.play.actors) { if (!a.alive && a !== this.play.me) continue; if (Math.abs(a.x - cx) < T2 / 2 + (a.r || 0.3) && Math.abs(a.z - cz) < T2 / 2 + (a.r || 0.3)) return a === this.play.me ? 'you are standing there' : 'something is standing there'; }   // never bury anyone
      return this.tools.editor.canRaise(i, j) ? null : 'the ground cannot take dirt here';
    }
    placeDirt(x, z, quiet) {
      const why = this.dirtOk(x, z), c = this.castle; if (why) { if (!quiet) { this.cui.toast(why[0].toUpperCase() + why.slice(1) + '.'); this.sound.play('clank'); } return false; }
      if (c.amount('dirt') < 1) { if (!quiet) this.cui.toast('You need dirt. Dig some with the shovel.'); return false; }
      c.spend({ dirt: 1 }); const [i, j] = this.play.doc.tileOf(x, z); this.tools.editor.raise(i, j); this.xp.built('dirt');
      this.tools.effects.burst('dirt', x, this.play.nav.y(x, z) + 0.2, z, 5, 2.2); this.sound.play('thunk'); this.changed(); return true;
    }
    /** a piece that comes with something already paid for (the marketplace's street stalls): no cost, no placement check */
    addFreePiece(type, x, z, rot) {
      const c = this.castle, d = this.data.piece(type), p = { uid: c.nextUid++, type, level: 1, x, z, rot, hp: (d && d.hp) || 100, ruin: false }; c.pieces.push(p);
      this.addPieceMesh(p); if (this.mp) this.mp.op({ k: 'piece+', id: this.mp.pieceId(p), type, x, z, rot }); this.changed(); return p;
    }
    buildAt(type, x, z, rot = this.autoRot(x, z), quiet = false) {
      if (type === 'dirt') return this.placeDirt(x, z, quiet);
      if (type === 'field') return this.economy.plant(x, z, quiet);   // a square of wheat field
      const why = this.placementOk(type, x, z, rot); if (why) { if (!quiet) { this.cui.toast(why[0].toUpperCase() + why.slice(1) + '.'); this.sound.play('clank'); } return false; }
      const r = this.castle.build(type, { x, z, rot }); if (!r.ok) { if (!quiet) this.cui.toast(`${this.data.piece(type).name}: ${r.why}.`); return false; }
      const m = this.addPieceMesh(r.piece); this.pop(m); this.sound.play('thunk'); this.puff(x, z); this.shake(0.08); if (type === 'fire_pot') this.R.placeDynamics();
      const pr = this.data.piece(type).produces;
      if (!quiet) this.cui.toast(pr ? `${this.data.piece(type).name}: ${K.CastleUI.prodLine(this.castle, type)}.` : `${this.data.piece(type).name} built.`);
      this.xp.built(type); if (this.mp) this.mp.op({ k: 'piece+', id: this.mp.pieceId(r.piece), type, x, z, rot }); this.changed(); return true;
    }
    upgrade(p) {
      const r = this.castle.upgrade(p); if (!r.ok) { this.cui.toast(`Upgrade: ${r.why}.`); this.sound.play('clank'); return; }
      this.pop(this.redrawPiece(p), 0.7); this.sound.play('fanfare'); this.puff(p.x, p.z);
      this.cui.toast(`${this.data.piece(p.type).name} is Level 2.`); this.changed();
    }
    craft(rid) {
      const r = this.castle.craft(rid); if (!r.ok) { this.cui.toast(`${this.data.item(rid.replace('craft_', '')).name}: ${r.why}.`); this.sound.play('clank'); return; }
      const id = r.items[0], pl = this.play.player; pl.addItem(id, 1); this.equipBest(pl);
      this.play.float(this.play.me, this.data.item(id).name + '!', 'heal', K.CastleUI.ICON[id]); this.play.me.view.flash('heal');
      this.sound.play('clank'); setTimeout(() => this.sound.play('chime'), 180);
      this.cui.banner(this.data.item(id).name, `Attack ${this.data.item(id).atk}${id === 'ember_brand' ? ' · frost creatures burn' : ''} · your kin’s weapons follow`, id);
      this.changed();
    }
    bindHeart() {
      const r = this.castle.build(this.data.keepUpgrade.id); if (!r.ok) { this.cui.toast(`Heartfire hearth: ${r.why}.`); return; }
      this.sound.play('whump'); this.flareT = 4; this.shake(0.6); this.changed(); this.ending();
    }
    ringBell() { const ev = this.day.ringBell(); if (ev) { this.sound.play('horn'); this.onDayEvent(ev); } }
    touchEmberwright() {
      const c = this.castle; c.flags.add('touched:emberwright');
      if (c.has('great_hall')) this.joinKin('emberwright', '“A seat at the table? Then I’ll keep your braziers burning.”');
      else { this.play.float(this.kinActors.emberwright, '…a seat at a table…', 'loot'); this.cui.toast('The ice cracks. She whispers: “Give me a seat at a table, and I’ll come.” (Restore the Great Hall.)'); this.sound.play('crack'); }
      this.changed();
    }

    /* ---------- kin ---------- */
    kinTier() { return this.castle.has('ember_forge') ? 3 : this.castle.has('smithy') ? 2 : 1; }
    kinStats(id) {
      const t = this.kinTier(), night = this.isNightish() && this.castle.has('barracks') ? 1.2 : 1;
      if (id === 'pinewarden') return { hp: 60 + 20 * t, atk: (4 + 2 * t) * night, cd: 1.3, ranged: true, color: 0xffe6a0 };
      if (id === 'emberwright') return { hp: 50 + 20 * t, atk: (5 + 2 * t) * night, cd: 1.5, ranged: true, color: 0xff8a3c };
      return { hp: 120 + 30 * t, atk: (8 + 3 * t) * night, cd: 1.6, ranged: false };
    }
    spawnKin(id) {
      const c = this.castle, at = this.L.kin[id], joined = c.kin.has(id);
      if (id === 'rime_brute' && !joined && !c.flags.has('brute:walking')) return;
      const v3 = !!(K.ActorViews && K.ActorViews.enabled);   // the 3D view has a hooded ranger; the 2D sprite set does not
      const sprite = { pinewarden: v3 ? 'ranger' : 'warden', emberwright: 'witch', rime_brute: 'troll' }[id], h = this.data.hero(id);
      const pos = joined ? { x: this.play.me.x + 1, z: this.play.me.z + 1 } : at;
      const a = this.addActor({ id: 'kin:' + id, role: 'npc', spriteId: sprite, name: h.name, x: pos.x, z: pos.z, hpMax: 80, atk: 6, def: 0, speed: id === 'rime_brute' ? 2.0 : 2.3, cd: 1.4, reach: 1, scale: id === 'rime_brute' ? (v3 ? 0.75 : 0.95) : 1, level: 1 });
      a.type = 'c_kin'; a.kinId = id; a.hostile = false;
      if (id === 'pinewarden' && !v3) a.view.setTint(0x9fdc8a); if (id === 'rime_brute' && !v3) a.view.setTint(0xa8d8ff);   // the voxel troll is already ice-blue: a tint only washes it out
      a.brain = new KinBrain(this, a, id); this.kinActors[id] = a;
      if (!joined && id !== 'rime_brute') { const ice = this.art.ice(1.1, 1.9, 0.9, id.length); this.place(ice, at.x, at.z, 0); a.ice = ice; }
      if (id === 'rime_brute' && !joined) a.walkIn = true;
      return a;
    }
    joinKin(id, line) {
      const c = this.castle; if (c.kin.has(id)) return; c.kin.add(id);
      const a = this.kinActors[id] || this.spawnKin(id);
      if (a.ice) { this.group.remove(a.ice); a.ice = null; this.sound.play('crack'); this.puff(a.x, a.z); }
      a.view.flash('heal'); this.play.float(a, 'Joins you!', 'heal'); this.sound.play('fanfare');
      this.cui.banner(this.data.hero(id).name + ' joins', line + ' · ' + this.data.hero(id).perk, 'kin');
      this.changed();
    }
    checkKin(dt) {
      const c = this.castle; if (this.survival) return;
      if (!c.kin.has('pinewarden') && c.cl() >= 2 && c.glowRadius() >= Math.hypot(this.L.kin.pinewarden.x - this.L.keep.x, this.L.kin.pinewarden.z - this.L.keep.z)) this.joinKin('pinewarden', '“You kept a fire lit? Then I’m staying.”');
      if (!c.kin.has('emberwright') && c.flags.has('touched:emberwright') && c.has('great_hall')) this.joinKin('emberwright', '“A seat at the table? Then I’ll keep your braziers burning.”');
      if (!c.kin.has('rime_brute') && c.flags.has('dawn:night2') && c.cl() >= 4 && !c.flags.has('brute:walking')) { c.flags.add('brute:walking'); this.spawnKin('rime_brute'); this.cui.toast('Something huge walks out of the frost… and kneels by your fire.'); }
      const b = this.kinActors.rime_brute;
      if (b && b.walkIn && !c.kin.has('rime_brute')) {
        const kx = this.L.hearth.x + 1.5, kz = this.L.hearth.z + 2.5;
        if (!b.path) b.path = this.play.nav.find(b.x, b.z, kx, kz, { range: 1.2 });
        if (!this.play.move(b, dt, 2.2) || Math.hypot(b.x - kx, b.z - kz) < 1.5) { b.walkIn = false; this.joinKin('rime_brute', '“Your fire is warmer than the frost. I’ll fight beside you.”'); }
        else b.view.setState('walk');
      }
    }
    addActor(cfg) {
      const play = this.play, a = new (play.me.constructor)(play, Object.assign({ info: { xp: 0, loot: [] }, flip: false }, cfg));
      play.actors.push(a); return a;
    }
    removeActor(a) { const play = this.play; const i = play.actors.indexOf(a); if (i >= 0) play.actors.splice(i, 1); a.view.dispose(); if (play.target === a) play.target = null; if (play.hover === a) play.hover = null; }

    /* ---------- the troll ---------- */
    spawnTroll() {
      const e = this.data.enemy('rime_troll'), at = this.L.troll;
      const a = this.addActor({ id: 'troll', role: 'enemy', spriteId: 'troll', name: e.name, x: at.x, z: at.z, hpMax: e.hp, atk: e.atk, def: e.defense, speed: 1.5, cd: 2, reach: 1.25, r: 0.7, scale: K.ActorViews && K.ActorViews.enabled ? 1.15 : 1.55,   /* the voxel troll is 2.9 m at scale 1 */ level: 4, flip: true, info: { xp: 0, loot: [], desc: 'Bridge-keeper. Every third swing is a ground slam: step out of the glowing ring.' } });
      a.enemy = e; a.boss = true; a.hostile = true; a.brain = new TrollBrain(this, a); this.troll = a;
    }
    slamStart(s) { this.ring = this.art.ring(); this.ring.scale.setScalar(s.r); this.place(this.ring, s.x, s.z, 0); this.ring.position.y += 0.08; this.cui.toast('Ground slam! Step out of the ring!'); }
    slamRing(s, k) { if (this.ring) { this.ring.material.opacity = 0.35 + 0.6 * k; this.ring.scale.setScalar(s.r * (0.6 + 0.4 * k)); } }
    slamHit(s, dmg) {
      if (this.ring) { this.group.remove(this.ring); this.ring.geometry.dispose(); this.ring = null; }
      this.sound.play('thunk'); this.shake(0.4); this.puff(s.x, s.z);
      const me = this.play.me; if (me.alive && Math.hypot(me.x - s.x, me.z - s.z) < s.r) { this.play.float(me, '-' + Math.round(dmg), 'hurt'); me.view.flash('hit'); if (this.play.player.hurt(Math.round(dmg))) this.play.defeat(); }
      else if (me.alive) this.play.float(me, 'dodged!', 'heal');
      for (const a of Object.values(this.kinActors)) if (a.alive && this.castle.kin.has(a.kinId) && Math.hypot(a.x - s.x, a.z - s.z) < s.r) this.hurtAlly(a, dmg * 0.5);
    }

    /* ---------- combat glue ---------- */
    damage(a, b) { return Math.max(1, Math.round((a.atk - (b.def || 0)) * (a.dmgScale || 1))); }   // a.dmgScale: the hero is weaker with a work tool than with a sword
    onHit(a, b) { if (a === this.play.me) { this.sound.play('hit'); this.xp.dealt(); } if (b.raider && b.brain && this.castle.weapons.has('ember_brand') && a === this.play.me) b.brain.burnT = 3; }
    wakeSec() { return this.castle.has('chapel') ? 2 : 5; }
    nearestEnemy(a, range) { let best = null, bd = range; for (const e of this.play.actors) if (e.alive && (e.raider || (e.boss && this.castle.zoneOpen('troll_bridge')))) { const d = Math.hypot(e.x - a.x, e.z - a.z); if (d < bd) { bd = d; best = e; } } return best; }
    /* the watchtower the Pinewarden climbs at dusk: the nearest one still standing and not frosted */
    towerFor(a) {
      let best = null, bd = Infinity;
      for (const p of this.castle.pieces) {
        if (p.type !== 'watchtower' || p.hp <= 0 || this.castle.isFrosted(p)) continue;
        const d = Math.hypot(p.x - a.x, p.z - a.z); if (d < bd) { bd = d; best = p; }
      }
      return best;
    }
    nearestAlly(a, range) {
      let best = null, bd = range; const me = this.play.me;
      if (me.alive) { const d = Math.hypot(me.x - a.x, me.z - a.z); if (d < bd) { bd = d; best = me; } }
      for (const k of Object.values(this.kinActors)) if (k.alive && this.castle.kin.has(k.kinId) && !k.manning) { const d = Math.hypot(k.x - a.x, k.z - a.z); if (d < bd) { bd = d; best = k; } }
      return best;
    }
    hurtAlly(k, n) { k.hp -= n; k.view.flash('hit'); this.play.float(k, '-' + Math.round(n), 'hurt'); if (k.hp <= 0 && k.brain && k.brain.knock) k.brain.knock(); }
    /* damage to a frost creature from anything that isn't the hero's own swing; fractions add up */
    hurtEnemy(a, n, src, show) {
      if (!a.alive) return; a.hp -= n; a.dmgAcc = (a.dmgAcc || 0) + n;
      if (show || a.dmgAcc >= 4) { this.play.float(a, String(Math.round(a.dmgAcc)), src === 'glow' || src === 'burn' ? 'loot' : 'dealt'); a.dmgAcc = 0; a.view.flash('hit'); }
      if (a.hp <= 0) this.play.kill(a);
    }
    onHurt(a) { this.xp.taken(); this.sweep.defend(a); }
    onKill(a) {
      const c = this.castle; this.wild.onKill(a); this.xp.killed(a);
      if (a.raider) {
        const drops = {};
        for (const [r, lo, hi, p] of a.enemy.drops) if (Math.random() < p) drops[r] = (drops[r] || 0) + lo + Math.floor(Math.random() * (hi - lo + 1));
        if (c.kin.has('emberwright')) drops.ember_shard = (drops.ember_shard || 0) + 1;
        let y = 0; for (const [r, n] of Object.entries(drops)) { const got = Math.round(c.add(r, n)); if (got > 0) { this.play.ui.float(a.x, a.y + 1.2 + y, a.z, `+${got}`, 'loot', K.CastleUI.ICON[r]); y += 0.35; this.cui.bump(r); if (this.raid) this.raid.drops[r] = (this.raid.drops[r] || 0) + got; } }
        if (this.raid) this.raid.killed++;
        this.sound.play('pop');
      }
      if (a.boss) {
        for (const [r, lo] of a.enemy.drops) c.add(r, lo);
        c.flags.add('killed:rime_troll'); this.sound.play('fanfare'); this.shake(0.5); this.puff(a.x, a.z); this.puff(a.x + 0.6, a.z - 0.3);
        this.cui.banner('The Rime Troll falls', 'It drops 10 gold, 4 iron and its warm heart. Carry the heart home to the Keep’s hearth.', 'heart');
      }
      this.changed();
    }
    tracer(a, b, color) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y + 1.1, a.z), new THREE.Vector3(b.x, b.y + 0.7, b.z)]);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: color || 0xffe6a0, transparent: true, opacity: 1 })); l.userData.t = 0; this.group.add(l); this.tracers.push(l);
    }

    /* ---------- raids ---------- */
    keepGoal() { return { x: this.L.keep.x, z: this.L.keep.z }; }
    isNightish() { return this.day.isNight || (this.day.kind === 'day' && this.day.warned); }
    startRaid() {
      if (this.survival) return;   // the wild (wolves, a thief) replaces raids
      const ph = this.day.phase, spec = this.data.raw.aiRaids[ph.raid]; if (!spec) return;
      const list = []; for (const [id, n] of Object.entries(spec.spawns)) for (let i = 0; i < n; i++) list.push(id);
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      const sides = spec.sides >= 2 ? ['north', 'south'] : ['north'];
      this.raid = { phase: ph.id, spec, queue: list.map((id, i) => ({ id, at: (i / Math.max(1, list.length - 1)) * spec.spawnWindowSec, side: sides[i % sides.length] })), t: 0, keepHp: this.castle.keepHpMax(), alive: 0, killed: 0, drops: {}, frosted: 0, lost: false, spawned: 0 };
      for (const p of this.castle.pieces) p.hp = this.pieceHpMax(p);
      this.cui.raidStart(this.raid);
    }
    spawnRaider(q) {
      const e = this.data.enemy(q.id), edge = this.L.frostEdges[q.side], x = edge.x0 + Math.random() * (edge.x1 - edge.x0), z = edge.z;
      const look = { frostling: ['ghoulB', 0.8, 1.4, 0xd8f0ff], frost_wolf: ['ghoulA', 0.75, 2.3, 0x9fc8ff], rime_ghoul: ['ghoulA', 1.05, 1.15, 0x7fb0ff] }[q.id];
      const a = this.addActor({ id: 'r' + Math.random().toString(36).slice(2, 8), role: 'enemy', spriteId: look[0], name: e.name, x, z, hpMax: e.hp, atk: e.atk, def: e.defense, speed: look[2], cd: 1.4, reach: 0.9, scale: look[1], level: 1, info: { xp: 0, loot: [], desc: 'A frost creature. It walks straight at the Keep and attacks whatever is in its way.' } });
      a.view.setTint(look[3]); a.enemy = e; a.raider = true; a.frost = true; a.hostile = true; a.fast = q.id === 'frost_wolf';
      // a third of them go for an exposed producer first
      const prods = this.castle.producers().filter((p) => !p.frosted);
      let goal = this.keepGoal();
      if (prods.length && Math.random() < 0.35) { prods.sort((p1, p2) => Math.hypot(p1.x - x, p1.z - z) - Math.hypot(p2.x - x, p2.z - z)); goal = { x: prods[0].x, z: prods[0].z, piece: prods[0] }; }
      a.brain = new RaiderBrain(this, a, goal); this.raid.alive++; this.raid.spawned++;
    }
    pieceHpMax(p) { const d = this.data.piece(p.type); return Math.round((typeof d.hp === 'number' ? d.hp : 100) * (d.category === 'defense' && this.castle.kin.has('rime_brute') ? 1.5 : 1)); }
    /* the first standing defense piece whose footprint the point (x,z) with radius r touches */
    blockingPiece(x, z, r) {
      for (const p of this.castle.pieces) {
        const d = this.data.piece(p.type); if (d.category !== 'defense' || p.broken || p.type === 'ember_brazier') continue;
        const [w, dd] = CastleArt.size(p.type), c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.x, dz = z - p.z;
        const lx = dx * c - dz * s, lz = dx * s + dz * c;
        if (Math.abs(lx) <= w / 2 + r && Math.abs(lz) <= dd / 2 + r) return p;
      }
      return null;
    }
    /* an armed enemy hits one of your structures (a gate, a wall, the door). Unarmed creatures never call this. */
    hurtStructure(s, n) {
      this.sound.play('hit'); this.shake(0.05);
      if (s.door) { s.door.hurt(n); return; }
      const p = s.piece, m = this.meshes.get('p' + p.uid); if (m) m.userData.shake = 0.25;
      p.hp -= n; this.play.float({ x: p.x, z: p.z, y: this.play.nav.y(p.x, p.z), h: 1 }, '-' + n, 'hurt');
      if (p.hp <= 0) { this.cui.toast(`Your ${this.data.piece(p.type).name.toLowerCase()} was broken down!`); this.demolishPiece(p, { refund: false }); }
    }
    hurtPiece(p, n) {
      p.hp -= n; this.sound.play('hit');
      const m = this.meshes.get('p' + p.uid); if (m) { m.userData.shake = 0.25; }
      this.play.ui.float(p.x, 1.6, p.z, '-' + n, 'hurt');
      if (p.hp <= 0 && !p.broken) { p.broken = true; if (m) m.visible = false; this.puff(p.x, p.z); this.cui.toast(`A ${this.data.piece(p.type).name.toLowerCase()} is broken! (It rebuilds free at dawn.)`); }
    }
    hurtKeep(n) {
      const r = this.raid; if (!r || r.lost) return; r.keepHp -= n; this.play.ui.float(this.L.keep.x, 4.5, this.L.keep.z, '-' + n, 'hurt'); this.sound.play('hit');
      if (r.keepHp <= 0) { r.keepHp = 0; this.endNight(true); }
    }
    onFrosted(p) { this.setFrost(p, true); if (this.raid) this.raid.frosted++; this.play.ui.float(p.x, 2.2, p.z, 'Frosted!', 'hurt'); this.sound.play('crack'); this.cui.toast(`Raiders frosted your ${this.data.piece(p.type).name}: no production until the morning. Walls protect income.`); }
    updateRaid(dt) {
      const r = this.raid; if (!r) return; r.t += dt;
      while (r.queue.length && r.queue[0].at <= r.t) this.spawnRaider(r.queue.shift());
      const raiders = this.play.actors.filter((a) => a.raider && a.alive); r.alive = raiders.length;
      const c = this.castle, keep = this.L.keep;
      // the glow burns frost creatures (at most 3 at once), towers shoot, braziers burn
      const inGlow = raiders.filter((a) => Math.hypot(a.x - keep.x, a.z - keep.z) <= c.glowRadius()).sort((a, b) => Math.hypot(a.x - keep.x, a.z - keep.z) - Math.hypot(b.x - keep.x, b.z - keep.z)).slice(0, this.data.raw.aiRaids.thawTargets);
      for (const a of inGlow) this.hurtEnemy(a, c.row().thawDps * dt, 'glow');
      for (const p of c.pieces) {
        if (p.broken) continue; const d = this.data.piece(p.type);
        if (p.type === 'watchtower' || p.type === 'ember_brazier') {
          p.shotT = (p.shotT || 0) - dt; if (p.shotT > 0) continue;
          const manned = p.type === 'watchtower' && Object.values(this.kinActors).some((k) => k.manning === p);
          const range = d.rangeM, dps = manned ? d.dpsManned : d.dps;
          let best = null, bd = range; for (const a of raiders) { if (!a.alive) continue; const dd = Math.hypot(a.x - p.x, a.z - p.z); if (dd < bd) { bd = dd; best = a; } }
          if (best) { p.shotT = 0.5; if (p.type === 'watchtower') this.tracer({ x: p.x, y: this.play.nav.y(p.x, p.z) + 2.6, z: p.z }, best, 0xfff0c0); this.hurtEnemy(best, dps * 0.5, 'tower', true); }
        }
      }
      // the hero swings at raiders in reach when idle
      const play = this.play, me = play.me;
      if (me.alive && !play.target && !play.ch && !me.path) { let best = null, bd = 2.4; for (const a of raiders) { const d = Math.hypot(a.x - me.x, a.z - me.z); if (d < bd) { bd = d; best = a; } } if (best) { play.target = best; } }
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
      this.cui.raidResult({ lost: !!lost, loss: lossTxt, drops: r ? r.drops : {}, killed: r ? r.killed : 0, frosted: r ? r.frosted : 0, night: ph, next: ev.phase });
      this.onDawn(ph);
      this.changed();
    }
    onDawn(night) {
      const c = this.castle; c.flags.add('dawn:' + night.id); c.thawAtDawn();
      for (const p of c.pieces) { p.hp = this.pieceHpMax(p); if (p.broken) { p.broken = false; const m = this.meshes.get('p' + p.uid); if (m) { m.visible = true; this.pop(m, 0.5); } } }
      for (const z of this.data.raw.zones) if (z.opensAfter === night.id && !c.zoneOpen(z.id)) { c.flags.add('zone:' + z.id); this.openBarrier(z.id); }
      for (const p of c.pieces) this.setFrost(p, c.isFrosted(p));
      this.play.refreshProps();
    }
    addBarrier(zone, b) {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2, m = this.art.ice(w, 2.4, d, zone.length * 5);
      const nav = this.play.nav, prev = [];   // remember each tile's walkability: bridge decks stand on chasm terrain
      this.rectTiles(x, z, w + 0.6, d + 0.6, 0, (i, j) => { const k = j * nav.w + i; prev.push([k, nav.walk[k]]); nav.walk[k] = 0; });
      this.place(m, x, z, 0); this.barriers[zone] = { m, x, z, w, d, prev };
    }
    openBarrier(zone) {
      const b = this.barriers[zone]; if (!b) return; this.group.remove(b.m); delete this.barriers[zone];
      const nav = this.play.nav; for (const [k, v] of b.prev) if (!this.occ[k]) nav.walk[k] = v;
      this.puff(b.x, b.z); this.sound.play('crack');
      this.cui.toast(zone === 'iron_hills' ? 'Dawn: a thaw wave opens the Iron Hills (north-east). Iron rocks, an outcrop for a mine… and a figure in the ice.' : 'Dawn: the frost on the bridge breaks. The Rime Troll waits on the far side.');
    }

    /* ---------- the day ---------- */
    /* the sun going down and coming up */
    onCalendar(ev) {
      if (ev.type === 'warn') { this.sound.play('horn'); this.cui.toast('The sun is going down. Get inside before the wolves come.'); }
      else if (ev.type === 'dusk') { this.sound.play('horn'); this.cui.toast(`Night ${this.calendar.n} falls. Stay inside to recover.`); }
      else if (ev.type === 'dawn') this.cui.toast(`Day ${this.calendar.n} begins.`);
    }
    onDayEvent(ev) {
      if (ev.type === 'warn') { this.sound.play('horn'); this.cui.warn(ev.phase); }
      else if (ev.type === 'dusk') { this.sound.play('horn'); this.startRaid(); }
      else if (ev.type === 'dawn') this.endNight(false, ev);
    }
    changed() { this.dirty = true; }

    /* ---------- effects ---------- */
    puff(x, z) { for (let i = 0; i < 6; i++) this.play.ui.float(x + (Math.random() - 0.5) * 1.2, this.play.nav.y(x, z) + 0.6 + Math.random() * 0.6, z + (Math.random() - 0.5) * 1.2, '❄', 'snow'); }
    shake(s) { this.shakeT = Math.max(this.shakeT, s); }
    pushLights() {
      const R = this.R, c = this.castle, L = this.L, f = this.flareT > 0 ? 1 + Math.min(1.5, this.flareT) : 1;
      if (c.lit && this.home.built) R.lightSrc.push({ x: this.home.center.x - 1.6, y: 1.4, z: this.home.center.z - 0.4, color: 0xff8a3c, base: 16 * f * (0.6 + 0.4 * this.nightK), dist: Math.max(8, this.glowR * 1.5), ph: 0.3, fire: true });
      for (const p of c.pieces) if (p.type === 'ember_brazier' || p.type === 'ember_forge' || p.type === 'smithy') R.lightSrc.push({ x: p.x, y: 1.3, z: p.z, color: 0xff8a3c, base: 6, dist: 5, ph: p.uid, fire: true });
      const pots = c.pieces.filter((p) => p.type === 'fire_pot').concat(this.mp ? [...this.mp.world.pieces.values()].filter((r) => r.p.type === 'fire_pot').map((r) => r.p) : []);
      for (const p of pots) R.lightSrc.push({ x: p.x, y: 1.1, z: p.z, color: 0xff9a4a, base: 5 + 9 * this.nightK, dist: 9, ph: (p.uid || 0) + p.x, fire: true });   // fire pots light the camp, brightest at night
    }
    /* thaw: snow tiles inside radius r become frozen earth / cobbles; animated as a wave over `dur` seconds */
    meltTo(r, dur) { /* the thawing ring around the hearth belonged to the old castle game: the snow stays snow */ }
    stepMelt(k) {
      const m = this.melt; if (!m) return; const r = lerp(m.from, m.to, clamp(k, 0, 1)), r0 = this.meltR || 0; if (r <= r0 + 0.01) { if (k >= 1) this.melt = null; return; }
      const doc = this.play.doc, L = this.L, T = K.T, [i0, j0] = doc.tileOf(L.keep.x - r, L.keep.z - r), [i1, j1] = doc.tileOf(L.keep.x + r, L.keep.z + r);
      let a = 1e9, b = 1e9, c = -1, d = -1;
      for (let j = Math.max(0, j0); j <= Math.min(doc.h - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(doc.w - 1, i1); i++) {
        const k2 = j * doc.w + i; if (doc.terrain[k2] !== T.SNOW) continue;
        const x = (i + 0.5) * TILE, z = (j + 0.5) * TILE, dd = Math.hypot(x - L.keep.x, z - L.keep.z); if (dd > r || dd <= r0 - 0.5) continue;
        doc.terrain[k2] = dd < 3.6 || K.hash2(i, j, 5) < 0.12 ? T.PATH : T.DIRT; a = Math.min(a, i); b = Math.min(b, j); c = Math.max(c, i); d = Math.max(d, j);
      }
      this.meltR = r; if (c >= 0) this.R.tilesChanged(a, b, c + 1, d + 1);
      if (k >= 1) this.melt = null;
    }
    thawAll(dur) { this.meltTo(80, dur); this.thawSnow = true; }
    ending() {
      this.thawAll(5); this.flareT = 5; this.sound.play('thaw'); this.endT = 0;
      for (const b of Object.keys(this.barriers)) this.openBarrier(b);
      this.cui.banner('Heartfire hearth · CL 5', 'The troll’s heart burns in the Keep. The glow races outward and the whole map thaws.', 'fire');
    }

    /* ---------- per frame ---------- */
    /** true once enter() has finished (events can arrive before that, or after it failed) */
    get ready() { return !!(this.cui && this.tools && this.brush && this.glowMesh); }
    update(dt) {
      if (!this.ready) return;
      const c = this.castle, play = this.play; this.playTime += dt;
      // economy
      const tk = c.tick(dt);
      for (const t of tk.ticks) { if (Math.random() < 0.6) this.play.ui.float(t.piece.x, 2, t.piece.z, `+${t.n}`, 'loot', K.CastleUI.ICON[t.r]); this.cui.bump(t.r, true); }
      // the clock (no dusk before the Keep is lit)
      this.calendar.update(dt);   // day and night loop forever
      if (this.raid) this.updateRaid(dt);
      // Castle Level up: flare, glow grows, snow melts, chime + card
      const cl = c.cl();
      if (cl !== this.lastCl) {
        if (cl > this.lastCl && this.lastCl > 0) { this.flareT = 2.5; this.sound.play('fanfare'); const row = c.row(); this.cui.banner(`Castle Level ${cl}`, `${row.heroMaxHP} HP · +${row.heroAtkBonus} attack · +${row.gatherBonus} gather · glow ${row.glowRadiusM} m${cl === 4 ? ' · ' + this.data.raw.castleLevel.capMessage : ''}`, 'cl'); }
        this.lastCl = cl; this.meltTo(c.glowRadius(), 1.6); play.player.healFull(); this.play.syncMe();
      }
      if (this.melt) { this.melt.t += dt; this.stepMeltT = (this.stepMeltT || 0) - dt; if (this.stepMeltT <= 0 || this.melt.t >= this.melt.dur) { this.stepMeltT = 0.35; this.stepMelt(this.melt.t / this.melt.dur); } }
      this.checkKin(dt);
      // visuals: glow, light, night, pops, tracers, arrow, shake
      const targetR = c.glowRadius(); this.glowR = lerp(this.glowR || 0, Math.min(targetR, 70), Math.min(1, dt * 1.6));
      this.glowMesh.visible = false; this.glowMesh.scale.setScalar(Math.max(0.01, this.glowR)); this.glowMesh.position.set(this.L.keep.x, 0.06, this.L.keep.z);
      this.glowMesh.material.opacity = (0.35 + 0.45 * this.nightK) * (1 + 0.15 * Math.sin(play.t * 2.2)) * (this.flareT > 0 ? 1.5 : 1);
      if (this.flareT > 0) this.flareT -= dt;
      this.lightT = (this.lightT || 0) - dt; if (this.lightT <= 0) { this.lightT = 0.25; this.R.placeDynamics(); }
      const tgtNight = this.day.isNight ? 1 : this.day.warned ? 0.45 : 0; this.nightK = lerp(this.nightK, c.hearthCap >= 5 ? 0 : tgtNight, Math.min(1, dt * 0.8)); this.applyNight();
      if (this.pops) this.pops = this.pops.filter((o) => { o.userData.popT += dt; const k = Math.min(1, o.userData.popT / 0.45), q = k - 1, back = 1 + 2.70158 * q * q * q + 1.70158 * q * q; o.scale.setScalar(o.userData.s0 + (1 - o.userData.s0) * back); return k < 1; });
      this.tracers = this.tracers.filter((l) => { l.userData.t += dt; l.material.opacity = 1 - l.userData.t / 0.25; if (l.userData.t > 0.25) { this.group.remove(l); l.geometry.dispose(); l.material.dispose(); return false; } return true; });
      for (const m of this.meshes.values()) if (m.userData.shake > 0) { m.userData.shake -= dt; m.position.x += (Math.random() - 0.5) * 0.04; }
      for (const m of this.meshes.values()) m.traverse((o) => { if (o.userData.flame) o.scale.y = 0.85 + 0.25 * Math.sin(play.t * 11 + o.id); });
      { const fog = this.R.scene.fog, dd = this.app.rig.cur.dist, ws = this.weather.fogScale; if (fog) { fog.near = dd + 8 * ws; fog.far = dd + 32 * ws; } }   // the far edge of the world always fades out, at any zoom
      this.updateArrow(dt); this.minimap.update(dt); this.weather.update(dt); this.flags.update(dt); this.towers.update(dt); this.economy.update(dt); this.workers.update(dt); this.forest.update(dt); if (this.mp) this.mp.update(dt); for (const p of this.castle.pieces) if (p.bridge) p.bridge.update(dt); this.tools.update(dt); this.sweep.update(dt); this.home.update(dt); this.vitals.update(dt); this.wild.update(dt);
      this.updateOcclusion(dt);
      if (this.shakeT > 0) { this.shakeT -= dt; const g = play.app.rig.goal; g.tx += (Math.random() - 0.5) * this.shakeT * 0.6; g.tz += (Math.random() - 0.5) * this.shakeT * 0.6; }
      if (this.thawSnow) { const s = this.R.snow.points; s.material.opacity = (s.material.opacity == null ? 1 : s.material.opacity); s.visible = this.endT == null || this.endT < 3; }
      // the ending: after the thaw, the end card
      if (this.endT != null) { this.endT += dt; if (this.endT > 5.5 && !this.endShown) { this.endShown = true; this.cui.endCard(); this.save(); } }
      // book ticks, HUD, save
      if (this.dirty) { this.dirty = false; this.cui.render(); this.play.refreshProps(); this.checkBook(); this.equipBest(play.player); }
      this.cui.frame(dt);
      this.saveT += dt; if (this.saveT > 10) { this.saveT = 0; this.save(); }
    }
    applyNight() {
      const R = this.R, k = this.nightK, b = this.base; if (!b) return;
      R.sun.intensity = b.sun * (1 - 0.72 * k); R.sun.color.setRGB(1, lerp(0.84, 0.6, k), lerp(0.66, 0.75, k));
      if (this.hemi) this.hemi.intensity = b.hemi * (1 - 0.45 * k);
      R.scene.background.copy(b.bg).lerp(new THREE.Color('#0b1020'), k * 0.8); R.scene.fog.color.copy(b.fog).lerp(new THREE.Color('#121a30'), k * 0.8);
      if (R.bmats && Math.abs((R.bmats.night || 0) - k) > 0.02) R.bmats.setNight(k);
    }
    goalTarget() {
      const c = this.castle, g = c.currentGoals(1)[0]; if (!g) return null;
      const L = this.L, keep = { x: L.hearth.x, z: L.hearth.z, h: 2.4 };
      switch (g.id) {
        case 'o1': return keep;
        case 'o2': return { x: L.ruins.gatehouse.x, z: L.ruins.gatehouse.z, h: 2 };
        case 'o3': return c.lit ? { x: L.keep.x + 4.2, z: L.keep.z - 1, h: 0.6, build: true } : keep;
        case 'o4': return keep;
        case 'o5': case 'o10': return this.raid ? null : keep;
        case 'o6': return c.zoneOpen('iron_hills') ? { x: L.outcrop.x, z: L.outcrop.z, h: 1.4 } : null;
        case 'o7': return { x: L.ruins.great_hall.x, z: L.ruins.great_hall.z, h: 2 };
        case 'o8': return { x: L.ruins.smithy.x, z: L.ruins.smithy.z, h: 2 };
        case 'o9': { const s = c.pieces.find((p) => p.type === 'smithy'); return s ? { x: s.x, z: s.z, h: 2.4 } : null; }
        case 'o11': return c.zoneOpen('troll_bridge') && this.troll && this.troll.alive ? { x: this.troll.x, z: this.troll.z, h: 3.4 } : null;
        case 'o12': return keep;
      }
      return null;
    }
    updateArrow() {
      if (this.survival) { this.arrow.visible = false; return; }   // no goal arrow: there are no goals
      const t = this.cui.placing ? null : this.goalTarget(), a = this.arrow; a.visible = !!t;
      if (!t) return; const y = this.play.nav.y(t.x, t.z) + t.h + 0.5 + Math.abs(Math.sin(this.play.t * 3)) * 0.35;
      a.position.set(t.x, y, t.z); a.rotation.y = this.play.t * 1.5;
    }
    checkBook() {
      const hb = this.castle.hearthbook(), now = new Set(); for (const s of hb.sections) for (const r of s.rows) if (r.done) now.add(s.section + ':' + r.id);
      if (this.prevBook) for (const k of now) if (!this.prevBook.has(k)) this.cui.bookTick(k, hb.pct);
      this.prevBook = now;
    }

    /* ---------- input ---------- */
    click(sx, sy) { if (!this.ready) return false; this.sound.unlock(); return this.tools.click(sx, sy); }
    pointerMove(sx, sy) { return this.ready ? this.cui.pointerMove(sx, sy) : false; }
    rightClick(sx, sy) { return this.ready ? this.stash.rightClick(sx, sy) : false; }
    pointerDown(sx, sy) { if (!this.ready) return false; return this.brush.down(sx, sy) || this.site.down(sx, sy) || this.steer.down(sx, sy) || this.walls.down(sx, sy) || this.demolisher.down(sx, sy); }
    pointerDrag(sx, sy) { if (!this.ready) return; this.brush.drag(sx, sy); this.site.drag(sx, sy); this.steer.drag(sx, sy); this.walls.drag(sx, sy); this.demolisher.drag(sx, sy); }
    pointerUp(sx, sy) { if (!this.ready) return; this.brush.up(sx, sy); this.site.up(sx, sy); this.steer.up(sx, sy); this.walls.up(sx, sy); this.demolisher.up(sx, sy); }
    key(e) {
      if (!this.ready) return false;
      this.sound.unlock();
      if (e.key === 'Escape') { if (!this.dismissTop()) { if (this.onLeave) this.onLeave(); } return true; }   // Esc closes what is open, else leaves the game
      if (this.mp && this.mp.key(e)) return true;
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) { this.vitals.eat(); return true; }   // eat from your bag
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) { this.purse.openTab('team'); return true; }   // T: your team
      if (e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.metaKey && !e.altKey) { this.purse.toggle(); return true; }
      return this.cui.key(e) || this.tools.key(e);
    }
    /* may the mouse hit this entity right now? Resources only answer to the tool that works them. */
    pickHeight(e) { return K.WorkTarget.TOOL_FOR[e.type] ? 4.5 : Infinity; }
    pickable(e) { return this.tools ? this.tools.canInteract(e) : true; }
    /* close the topmost thing; false when nothing was open */
    dismissTop() {
      const cui = this.cui, ui = this.play.ui;
      if (this.vitals && this.vitals.sleeping) { this.vitals.wake(); return true; }
      if (this.purse && this.purse.isOpen) { this.purse.close(); return true; }
      if (this.brush && this.brush.drawer.isOpen) { this.brush.drawer.close(); return true; }
      if (cui.placing) { cui.stopPlacing(); return true; }
      if (cui.bookOpen) { cui.toggleBook(false); return true; }
      if (ui.isOpen('ctx') || ui.isOpen('dlg') || ui.isOpen('card') || ui.isOpen('trade')) { ui.closeTop(); return true; }
      if (!cui.$('cModal').hidden) { cui.$('cModal').hidden = true; return true; }
      if (this.tools.arms.isOpen) { this.tools.arms.close(); return true; }
      if (this.tools.tool.id === 'hammer') { this.tools.belt.select('sword'); return true; }
      return false;
    }

    /* ---------- save ---------- */
    snapshot() {
      const me = this.play.me, nodes = {};
      for (const [id, n] of this.play.nodes || []) if (n.charges < n.max) nodes[id] = { charges: n.charges, max: n.max, respawnIn: n.respawnAt === Infinity ? -1 : Math.max(0, (n.respawnAt || 0) - this.play.t) };
      return { castle: this.castle.toJSON(), day: this.day.toJSON(), hero: me ? [+me.x.toFixed(2), +me.z.toFixed(2)] : null, nodes: this.mp ? {} : nodes, playTime: +this.playTime.toFixed(1), ended: !!this.endShown, extras: this.safeExtras() };
    }
    /** the homestead extras (piles, chests, terrain...); a problem here must never stop the main save */
    safeExtras() { try { return this.persist ? this.persist.capture() : null; } catch (err) { console.warn('could not capture the homestead', err); return null; } }
    save(force) { if (!this.castle.lit) return false; const snap = this.snapshot(); if (this.mp) this.mp.saveRemote(snap, !!force); return this.slot.write(snap); }   // to this browser, and (on a server) to the server
    restoreNodes() {
      const s = this.saved; if (!s || !s.nodes) return;
      for (const [id, n] of Object.entries(s.nodes)) { if (!this.play.doc.obj(id)) continue; this.play.nodes.set(id, { charges: n.charges, max: n.max, respawnAt: n.respawnIn < 0 ? Infinity : n.respawnIn ? this.play.t + n.respawnIn : 0 }); if (n.charges <= 0) this.R.setPropState(id, 'depleted'); }
    }

    /* ---------- test / demo hooks ---------- */
    debugSkip(sec) { this.day.t = Math.min(this.day.t + sec, (this.day.length() || 1e9) - 0.01); }
    debugGive(o) { for (const [r, n] of Object.entries(o)) this.castle.add(r, n); this.changed(); }
  }

  /* ---------- interaction types for castle entities ---------- */
  const reg = K.Interactions, castleOf = (game) => game.ext;
  const spec = (color, cursor) => ({ color, cursor: () => cursor, name: (e) => e.name, actions: (e, game) => castleOf(game).actionsFor(e), inspect: (e, game) => castleOf(game).inspect(e) });
  reg.register('c_keep', spec(0xffc070, 'hand'));
  reg.register('c_ruin', spec(0xffd27a, 'hammer'));
  reg.register('c_site', spec(0xffd27a, 'pickaxe'));
  reg.register('c_piece', spec(0x9fd8ff, 'hand'));
  reg.register('c_rpiece', spec(0xffb4a0, 'hand')); reg.register('c_rstore', spec(0xffd27a, 'hand')); reg.register('c_rdoor', spec(0xffb4a0, 'hand'));
  reg.register('c_barrel', spec(0xffd27a, 'hand'));
  reg.register('c_door', spec(0xffd27a, 'hand'));
  reg.register('c_rack', spec(0xffd27a, 'hand'));
  reg.register('c_kin', Object.assign(spec(0x8fe0a0, 'bubble'), { name: (e) => e.name }));
  const node = (verb, cursor, charges, respawn) => ({ color: 0x9fd8ff, cursor: (e, game) => (game.nodeState(e).charges > 0 ? cursor : 'no'), node: { charges, respawn },
    actions: (e) => [{ id: 'gather', label: verb, icon: cursor, range: e.r + 0.55, run: (game, x) => castleOf(game).tools.engage(x) }, { id: 'inspect', label: 'Inspect', icon: 'eye', run: (game, x) => game.inspect(x) }],
    inspect: (e, game) => castleOf(game).inspect(e) });
  const D = K.CASTLE_DATA, N = (id) => D.harvestNodes.find((n) => n.id === id);
  reg.register('c_tree', node('Chop', 'axe', N('tree').charges, N('tree').respawnSec));
  reg.register('c_boulder', node('Break', 'pickaxe', N('boulder').charges, N('boulder').respawnSec));
  reg.register('c_rubble', node('Clear', 'hand', N('rubble').charges, 1e9));
  reg.register('c_iron', node('Mine', 'pickaxe', N('iron_rock').charges, N('iron_rock').respawnSec));

  Object.assign(K, { CastleGame, CastleHero, CastleSound, RaiderBrain, KinBrain, TrollBrain });
})(typeof window !== 'undefined' ? window : globalThis);
