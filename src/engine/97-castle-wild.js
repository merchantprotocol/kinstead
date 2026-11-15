/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · what is out there. The wild teaches you the game gently and then leans on you:
     - the first wolves are pups: weak, slow and few, so you learn to fight
     - by day there is at most one wolf; at night they come in packs, so you go inside and recover
     - inside your home you are safe: wolves cannot enter and prowl outside
     - a human raider that walks in and carries off your furniture only comes after the first few days
   Classes, each with one job:
     Difficulty   how strong, how many and when, from the day number
     Brain        shared walking and "is this body gone" logic
       WolfBrain    hunt you outside, prowl around the house when you are inside, retreat at dawn
       ThiefBrain   choose something to steal, walk in, take it, run; drops it if killed
     Loot         what a thief carries, drawn over his head
     Wild         the director: spawns by the calendar, using Difficulty */
(function (G) {
  const K = G.K;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  /** Everything numeric about how hard the wild is, in one place. */
  class Difficulty {
    constructor(calendar) { this.cal = calendar; this.wolvesSpawned = 0; }
    get day() { return this.cal.n; }
    /** wolves are deadly: one can kill a new player in a handful of bites, and at night they come in a big pack */
    nextWolf(night = true) {
      const d = this.day; this.wolvesSpawned++;
      return { name: 'Wolf', hp: 26 + d * 3, atk: (night ? 10 : 7) + Math.floor(d / 2), speed: 3.0 + Math.min(0.6, d * 0.05), cd: 0.9, scale: 1 };
    }
    get packSize() { return 10 + Math.min(5, Math.max(0, this.day - 1)); }   // 10 on the first night, up to 15
    get smell() { return 38; }   // how far away a wolf notices you at night, and comes for you before it goes for the food
    /** how many bites of your food a wolf takes before it is full: a few at first, more as the days go on */
    get appetite() { return Math.min(20, 3 + this.day * 2); }
    get dayCap() { return 1; }
    get nightCap() { return this.packSize + 3; }
    get thievesAllowed() { return this.day >= 5; }
    get armedAllowed() { return this.day >= 8; }       // armed raiders (they break gates and the door) come late
    armedInterval() { return rnd(300, 420); }
    dayInterval() { return rnd(70, 110); }
    nightInterval() { return rnd(90, 150); }
    thiefInterval() { return rnd(240, 360); }
  }

  /** Shared by creatures that walk the nav grid. */
  class Brain {
    constructor(game, actor) { this.g = game; this.a = actor; this.cd = 0; this.repath = 0; }
    get P() { return this.g.play; }
    /** false once the body has been cleared away */
    tickDead(dt) {
      const a = this.a, g = this.g;
      if (a.alive) return true;
      a.deadT += dt; if (a.deadT > 0.8 && a.view.visible) a.view.setVisible(false); if (a.deadT > 1.2) g.removeActor(a);
      return false;
    }
    /** walk toward (x, z) around obstacles; returns true while moving */
    goTo(x, z, speed, range, dt) {
      const a = this.a, P = this.P; this.repath -= dt;
      if (this.repath <= 0 || !a.path) { this.repath = 0.5; a.path = P.nav.find(a.x, a.z, x, z, { range, maxNodes: 4000, blocked: this.blocker() }) || null; }
      this.noWay = !a.path; const moved = a.path ? P.move(a, dt, speed) : false; this.anim(moved, speed); return moved;   // noWay: the ground does not connect (a shut door)
    }
    /** tiles this creature may never path through: every gate. (You walk through your own gate; nothing else does.) */
    blocker() { const g = this.g; return (i, j) => g.gateTiles.has(i + ',' + j) || g.home.door.shutFor(i, j); }
    face(t) { this.a.view.setFacing(t.x - this.a.x, t.z - this.a.z); }
    anim(moving, speed = 3) {
      const v = this.a.view; if (v.state === 'attack' || v.state === 'hurt' || v.state === 'action') return;
      const want = moving ? (speed > 2.2 ? 'run' : 'walk') : 'idle'; if (v.state !== want) v.setState(want);
    }
    bite(foe) { this.cd = this.a.cd; this.P.swing(this.a, foe); }
  }

  class WolfBrain extends Brain {
    constructor(game, actor) { super(game, actor); this.mode = 'hunt'; this.spot = null; this.spotT = 0; this.leave = null; this.pace = 0; this.plunder = null; this.food = null; this.badStore = null; this.breach = new K.Breacher(game, actor, 'wolf'); this.idle = 0; this.roamTo = null; }
    /** wolves also never plan a route through the house */
    blocker() { const g = this.g, T = K.TILE; return (i, j) => g.gateTiles.has(i + ',' + j) || g.insideBuilding((i + 0.5) * T, (j + 0.5) * T); }
    /** dawn: go back to the dark */
    retreat() { this.mode = 'retreat'; this.leave = this.g.wild.leavePoint(this.a); this.a.path = null; }
    update(dt) {
      const g = this.g, P = this.P, a = this.a, me = P.me; if (!this.tickDead(dt)) return;
      this.cd -= dt; const d = dist(a, me);
      if (d > 80 && this.mode !== 'retreat') { if (this.plunder) this.plunder.release(); g.removeActor(a); return; }
      if (this.plunder) this.plunder.follow();
      if (this.mode === 'retreat') { if (dist(a, g.home.center) > 66) { if (this.plunder) this.plunder.escape(); g.removeActor(a); return; } const lp = g.wild.leavePoint(a); this.goTo(lp.x, lp.z, a.speed, 1.5, dt); return; }   // it walks away a stretch at a time
      if (this.nothingHere(d)) { this.idle += dt; if (this.idle > 25) { this.retreat(); return; } this.roam(dt); return; }   // a pack that finds nothing roams on, then leaves
      this.idle = 0;
      if (g.calendar.isNight && this.forage(dt, d)) return;   // at night the smell of your food is what they came for
      if (!me.alive || g.isSanctuary(me.x, me.z) || this.pace > 0) { this.pace -= dt; this.prowl(dt); this.keepOut(); return; }   // you are in your house or at a gate: they circle outside
      this.hunt(dt, d); this.keepOut();
      if (this.noWay) this.prowl(dt);          // no way to you: they can only circle
    }
    /** nothing to eat and no one to hunt within its reach: no food outside, and you are in your house or too far to smell */
    nothingHere(d) {
      const g = this.g, me = this.P.me, night = g.calendar.isNight, smell = night ? g.wild.difficulty.smell : 18;
      const prey = me.alive && !g.isSanctuary(me.x, me.z) && d < smell; if (prey || this.a.hp < this.a.hpMax - 0.01 || (this.plunder && this.plunder.carrying)) return false;
      return !(night && this.pickFood());
    }
    /** wander across the snow looking for something */
    roam(dt) {
      const a = this.a, g = this.g, L = g.L, wu = L.size.w * K.TILE, hu = L.size.h * K.TILE;
      if (!this.roamTo || dist(a, this.roamTo) < 2 || (this.roamT = (this.roamT || 0) - dt) < 0) { const ang = rnd(0, 6.283), r = rnd(14, 26); this.roamTo = { x: Math.max(6, Math.min(wu - 6, a.x + Math.cos(ang) * r)), z: Math.max(6, Math.min(hu - 6, a.z + Math.sin(ang) * r)) }; this.roamT = 8; a.path = null; }
      this.goTo(this.roamTo.x, this.roamTo.z, a.speed * 0.7, 1.2, dt); this.keepOut();
    }
    /** go for your food stores and gnaw them (until full, then slink off with it). false = do something else (you are near, or it is hurt). */
    forage(dt, d) {
      const g = this.g, a = this.a, me = this.P.me, pl = this.plunder || (this.plunder = new K.Plunder(g, a, g.wild.difficulty.appetite));
      if ((a.hp != null && a.hp < a.hpMax - 0.01) || (me.alive && d < g.wild.difficulty.smell && !g.isSanctuary(me.x, me.z) && !pl.done)) return false;   // hurt, or it smells you: it comes for you before the food
      if (pl.done) { this.retreat(); return true; }
      let st = this.food; if (!st || !st.present || st.amount < 1) { st = this.food = this.pickFood(); if (!st) { if (pl.carrying) this.retreat(); return false; } }
      const tx = st.ent.x, tz = st.ent.z;
      if (dist(a, { x: tx, z: tz }) <= 1.5) { a.path = null; this.face({ x: tx, z: tz }); if (!pl.gnaw(dt, st) && pl.done) this.retreat(); this.anim(false); this.keepOut(); return true; }
      this.goTo(tx, tz, a.speed, 1.2, dt);
      if (this.noWay) { const r = this.breach.advance(tx, tz, 1.2, dt); if (r === 'stuck') { this.badStore = st; this.food = null; } }   // a dirt wall in the way: dig through it; anything else: try another store
      this.keepOut(); return true;
    }
    pickFood() { const a = this.a; return this.g.home.stores.filter((s) => s.res === 'food' && s.present && s.amount >= 1 && s !== this.badStore).sort((p, q) => dist(p.ent, a) - dist(q.ent, a))[0] || null; }
    /** killed: what it took falls out */
    onDeath() { if (this.plunder) this.plunder.drop(); }
    /** wolves never step into the house or onto a gate, whether the door is open or not */
    keepOut() {
      const a = this.a, g = this.g; if (!g.isSanctuary(a.x, a.z)) { this.px = a.x; this.pz = a.z; return; }
      if (this.px != null) { a.x = this.px; a.z = this.pz; } a.path = null; this.repath = 0; this.pace = 2.5;   // pushed back; they pace outside for a moment
    }
    hunt(dt, d) {
      const a = this.a, me = this.P.me, reach = a.reach + (me.r || 0.3) + 0.35; this.spot = null;
      if (d <= reach) { a.path = null; this.face(me); if (this.cd <= 0) this.bite(me); this.anim(false); return; }
      this.goTo(me.x, me.z, a.speed * (d > 10 ? 1.3 : 1), reach * 0.8, dt);
    }
    prowl(dt) {
      const a = this.a, g = this.g; this.spotT -= dt;
      if (!this.spot || this.spotT <= 0 || dist(a, this.spot) < 1) { this.spot = g.home.prowlPoint(); this.spotT = rnd(5, 9); a.path = null; }
      this.goTo(this.spot.x, this.spot.z, a.speed * 0.55, 0.8, dt);   // a slow, restless walk
    }
  }

  /** What a thief is carrying, drawn above his head. */
  class Loot {
    constructor(group, mats, kind) { this.group = group; this.mesh = mats.mesh(kind, kind === 'wood' ? 0.4 : 0.34); group.add(this.mesh); }
    follow(actor) { this.mesh.position.set(actor.x, actor.y + 1.25, actor.z); this.mesh.rotation.y += 0.03; }
    dispose() { this.group.remove(this.mesh); }
  }

  class ThiefBrain extends Brain {
    constructor(game, actor) { super(game, actor); this.mode = 'seek'; this.target = null; this.carry = null; this.steal = 0; this.loot = null; this.told = false; this.fleeTo = null; }
    /** with the door open he goes for furniture; otherwise (or by choice) he raids the stores by the door */
    choose() {
      const home = this.g.home, pieces = home.stealable, stores = home.stores.filter((b) => b.amount >= 1);
      if (pieces.length && (!stores.length || Math.random() < 0.55)) { const s = pieces[Math.floor(Math.random() * pieces.length)]; return { kind: 'slot', slot: s, x: s.ent.x, z: s.ent.z, name: s.def.name.toLowerCase() }; }
      if (stores.length) { const b = stores[Math.floor(Math.random() * stores.length)]; return { kind: 'store', store: b, x: b.ent.x, z: b.ent.z, name: b.name.toLowerCase() }; }
      return null;
    }
    update(dt) {
      const g = this.g, P = this.P, a = this.a, me = P.me; if (!this.tickDead(dt)) return;
      this.cd -= dt; if (this.loot) this.loot.follow(a);
      if (dist(a, me) < 1.5 && me.alive && a.aggro) { this.face(me); if (this.cd <= 0) this.bite(me); return; }            // cornered or hurt: he fights back
      if (this.mode === 'seek') {
        if (!this.target || !this.stillThere(this.target)) { this.target = this.choose(); if (!this.target) { this.mode = 'flee'; return; } }
        if (!this.told && dist(a, g.home.doorPoint) < 16) { this.told = true; g.cui.toast('A raider is sneaking toward your house!'); }
        const store = this.target.kind === 'store', near = store ? 1.4 : 0.9;   // a store blocks a few tiles, so he stands a little further off
        if (dist(a, this.target) <= near) { this.mode = store ? 'raiding' : 'taking'; this.steal = 0; this.swings = 0; a.path = null; this.face(this.target); a.view.setState('action'); return; }
        this.goTo(this.target.x, this.target.z, a.speed, store ? 1.2 : 0.7, dt);
        if (this.noWay) { if (a.armed) { this.mode = 'siege'; return; } this.target = null; this.repath = 0; }   // the way is shut: an unarmed raider picks something else; an armed one breaks in
      } else if (this.mode === 'taking') {
        this.steal += dt; if (a.view.state !== 'action') a.view.setState('action');
        if (this.steal >= 1.6) this.take();
      } else if (this.mode === 'siege') {
        this.siege(dt);
      } else if (this.mode === 'raiding') {
        this.raid(dt);
      } else {
        this.fleeTo = this.edgeFar();
        if (dist(a, g.home.center) > 62) { this.escape(); return; }
        this.goTo(this.fleeTo.x, this.fleeTo.z, a.speed * 1.2, 1.5, dt);
      }
    }
    /** ARMED raiders only: when the way is shut they break the nearest gate (else wall, else the door) until it falls.
        Wolves and ordinary raiders carry no weapon and never do this. */
    nearestStructure() {
      const g = this.g, a = this.a, c = g.castle, near = (o) => Math.hypot(o.x - a.x, o.z - a.z);
      const pieces = c.pieces.filter((p) => ['gate', 'palisade', 'stone_wall'].includes(p.type) && near(p) < 14).sort((p, q) => (q.type === 'gate') - (p.type === 'gate') || near(p) - near(q));
      if (pieces.length) return { x: pieces[0].x, z: pieces[0].z, piece: pieces[0] };
      const d = g.home.door; return !d.open && !d.broken && near(d.ent) < 14 ? { x: d.ent.x, z: d.ent.z, door: d } : null;
    }
    siege(dt) {
      const g = this.g, a = this.a; let s = this.struct;
      if (!s || (s.piece && !g.castle.pieces.includes(s.piece)) || (s.door && (s.door.broken || s.door.open))) { s = this.struct = this.nearestStructure(); if (!s) { this.mode = 'seek'; this.target = null; this.repath = 0; return; } }
      const rg = s.piece && s.piece.type === 'gate' ? 1.55 : 1.0;   // a gate is two metres wide: he stands at its face, not its middle
      if (Math.hypot(s.x - a.x, s.z - a.z) > rg) { this.goTo(s.x, s.z, a.speed, rg - 0.1, dt); return; }
      this.face(s); a.path = null; if (this.cd <= 0) { this.cd = 0.9; a.view.setState('attack'); g.hurtStructure(s, a.atk); if (s.piece && !g.castle.pieces.includes(s.piece)) { this.struct = null; this.mode = 'seek'; this.repath = 0; } if (s.door && s.door.broken) { this.struct = null; this.mode = 'seek'; this.repath = 0; } }
    }
    stillThere(t) { return t.kind === 'store' ? t.store.amount >= 1 : t.slot.present; }
    /** mine a store: every swing knocks one unit out, a little cube of it flies to him and he pockets it */
    raid(dt) {
      const g = this.g, a = this.a, st = this.target.store; this.steal += dt; this.face(this.target); if (a.view.state !== 'action') a.view.setState('action');
      if (this.steal < 0.55) return; this.steal = 0;
      if (this.swings >= 8 || st.amount < 1) { this.mode = 'flee'; a.view.setState('idle'); if (this.carry) { this.announce(); } return; }
      this.swings++; if (st.rob(1) < 1) return;
      g.sound.play('gather'); const res = st.res, fx = g.tools.effects, y = g.play.nav.y(st.ent.x, st.ent.z) + 0.5;
      if (!this.carry) { this.carry = { kind: res, res, amount: 0, label: res === 'food' ? 'food' : K.CastleData.resName(res) }; this.loot = new K.Loot(fx.group, fx.materials, res); }
      fx.burst(res, st.ent.x, y, st.ent.z, 3, 2);
      fx.courier(res, { x: st.ent.x, y, z: st.ent.z }, a, () => { if (this.carry) this.carry.amount++; });   // the food flies out to him
    }
    announce() { const g = this.g; g.cui.toast(`A raider is running off with your ${this.carry.label}! Stop him!`); g.sound.play('horn'); }
    take() {
      const g = this.g, t = this.target; this.mode = 'flee'; this.a.view.setState('idle');
      if (!this.stillThere(t)) return;
      g.home.take(t.slot); this.carry = { kind: 'furn', slot: t.slot, label: t.slot.def.name.toLowerCase() };
      this.loot = new K.Loot(g.tools.effects.group, g.tools.effects.materials, 'furn'); this.announce();
    }
    edgeFar() { return this.g.wild.leavePoint(this.a); }
    escape() { if (this.carry) this.g.cui.toast(`The raider got away with your ${this.carry.label}.`); if (this.loot) this.loot.dispose(); this.g.removeActor(this.a); }
    /** killed: whatever he carried drops where he fell */
    onDeath() {
      const g = this.g, a = this.a, c = this.carry, fx = g.tools.effects, y = g.play.nav.y(a.x, a.z) + 0.6; if (this.loot) { this.loot.dispose(); this.loot = null; }
      if (!c) return;
      if (c.kind === 'furn') fx.spawnPickup('furn', 1, a.x, y, a.z, 1.6, true, { restore: () => { g.home.putBack(c.slot); g.cui.toast(`Your ${c.label} is back where it belongs.`); } });
      else { for (let i = 0; i < c.amount; i++) fx.spawnPickup(c.res, 1, a.x + rnd(-0.3, 0.3), y, a.z + rnd(-0.3, 0.3), 2.4, true); }   // every cube he took falls out; walk over them to get your supplies back
      this.carry = null;
    }
  }

  /** When and where the wild shows up. Driven by the calendar and the difficulty. */
  class Wild {
    constructor(game) {
      this.g = game; this.t = 0; this.difficulty = new Difficulty(game.calendar);
      this.nextDayWolf = 55; this.nextNightWolf = 0; this.nextThief = 300; this.nextMarauder = 480;
      game.calendar.on((ev) => this.onCalendar(ev)); this.bearDirector = null;
    }
    get P() { return this.g.play; }
    get cal() { return this.g.calendar; }
    alive(pred) { return this.P.actors.filter((a) => a.alive && pred(a)); }
    wolves() { return this.alive((a) => a.wolf); }

    onCalendar(ev) {
      if (ev.type === 'dusk') { this.spawnPack(this.difficulty.packSize); this.nextNightWolf = this.t + this.difficulty.nightInterval(); }
      else if (ev.type === 'dawn') { for (const w of this.wolves()) w.brain.retreat(); for (const b of this.alive((x) => x.bear)) b.brain.retreat(); this.nextDayWolf = this.t + this.difficulty.dayInterval(); }
    }
    update(dt) {
      const me = this.P.me; if (!me.alive) return; this.t += dt; const df = this.difficulty;
      (this.bearDirector || (this.bearDirector = new K.BearDirector(this.g))).update(dt);
      if (this.cal.isNight) {
        if (this.t >= this.nextNightWolf && this.wolves().length === 0) { this.spawnPack(df.packSize); this.nextNightWolf = this.t + df.nightInterval(); }   // a pack roams and leaves; a new one wanders in later
      } else if (this.t >= this.nextDayWolf) {
        if (this.wolves().length < df.dayCap) this.spawnPack(1);
        this.nextDayWolf = this.t + df.dayInterval();
      }
      if (df.armedAllowed && this.t >= this.nextMarauder) { if (!this.alive((a) => a.armed).length) this.spawnMarauder(); this.nextMarauder = this.t + df.armedInterval(); }
      if (df.thievesAllowed && this.t >= this.nextThief) { if (!this.alive((a) => a.thief).length) this.spawnThief(); this.nextThief = this.t + df.thiefInterval(); }
    }
    /** a spot on the map's rim (inside the fog) that you can walk to */
    edgePoint() {
      const L = this.g.L, nav = this.P.nav, k0 = this.g.home.built ? this.g.home.center : this.P.me, wu = L.size.w * K.TILE, hu = L.size.h * K.TILE;   // out in the dark around where you live (or stand)
      for (let k = 0; k < 30; k++) {
        const a = rnd(0, 6.283), r = rnd(46, 58), x = k0.x + Math.cos(a) * r, z = k0.z + Math.sin(a) * r;   // out in the dark, a good way from your homestead
        if (x < 6 || z < 6 || x > wu - 6 || z > hu - 6) continue;
        if (nav.standable(x, z)) return { x, z };
      }
      return null;
    }
    /** where a creature heads when it gives up and goes home: away from your homestead */
    leavePoint(a) {
      const L = this.g.L, k = this.g.home.center, dx = a.x - k.x, dz = a.z - k.z, d = Math.hypot(dx, dz) || 1, wu = L.size.w * K.TILE, hu = L.size.h * K.TILE;
      return { x: Math.max(6, Math.min(wu - 6, a.x + dx / d * 22)), z: Math.max(6, Math.min(hu - 6, a.z + dz / d * 22)) };   // always a short hop ahead, so the pathfinder can reach it
    }
    /** do the animals have a reason to come? Food left outside, you outside, or a way in to you. Walls up and nothing outside: they stop coming. */
    attracted() {
      const now = this.t; if (this.attrAt != null && now < this.attrAt) return this.attrVal; this.attrAt = now + 10;
      const g = this.g, me = this.P.me, food = g.home.stores.some((s) => s.res === 'food' && s.present && s.amount >= 1);
      let yes = food || !g.home.inside(me.x, me.z);
      if (!yes) { const from = this.edgePoint(); if (from) { const probe = { x: from.x, z: from.z, speed: 2.8, view: { setState() {}, setFacing() {}, state: '' }, atk: 0 }, d = g.home.doorPoint; yes = !new K.Breacher(g, probe, 'wolf').makePlan(d.x, d.z, 1.3).stuck; } }   // can a wolf get to the door (or dig to it)?
      return (this.attrVal = yes);
    }
    spawnPack(n) {
      if (!this.attracted()) return;   // nothing out there for them
      const base = this.edgePoint(); if (!base) return;
      for (let i = 0; i < n; i++) this.spawnWolf(base.x + rnd(-2, 2), base.z + rnd(-2, 2));
      if (this.cal.isNight) this.g.cui.toast(n > 1 ? 'Wolves are howling out in the dark…' : 'A wolf is howling nearby…');
    }
    spawnWolf(x, z) {
      const g = this.g, s = this.difficulty.nextWolf(this.cal.isNight);
      const a = g.addActor({ id: 'w' + Math.random().toString(36).slice(2, 7), role: 'enemy', spriteId: 'wolf', name: s.name, x, z, hpMax: s.hp, atk: s.atk, def: 0, speed: s.speed, cd: s.cd, reach: 0.95, r: 0.45, scale: s.scale, level: 1, info: { xp: 0, loot: [] } });
      a.hostile = true; a.aggro = true; a.wolf = true; a.enemy = { drops: [] }; a.brain = new WolfBrain(g, a); return a;
    }
    spawnThief() {
      const g = this.g, at = this.edgePoint(); if (!at) return;
      const a = g.addActor({ id: 't' + Math.random().toString(36).slice(2, 7), role: 'enemy', spriteId: 'ranger', name: 'Raider', x: at.x, z: at.z, hpMax: 42, atk: 6, def: 0, speed: 2.7, cd: 1.3, reach: 0.9, r: 0.4, scale: 1, level: 1, info: { xp: 0, loot: [] } });
      a.view.setTint(0x6e4a42); a.hostile = true; a.aggro = false; a.thief = true; a.enemy = { drops: [] }; a.brain = new ThiefBrain(g, a);
    }
    /** an armed raider: like a thief, but carries a weapon, so a shut gate or door only slows him down */
    spawnMarauder() {
      const g = this.g, at = this.edgePoint(); if (!at) return;
      const a = g.addActor({ id: 'm' + Math.random().toString(36).slice(2, 7), role: 'enemy', spriteId: 'ranger', name: 'Armed raider', x: at.x, z: at.z, hpMax: 70, atk: 8, def: 0, speed: 2.4, cd: 1.3, reach: 0.9, r: 0.4, scale: 1.05, level: 1, info: { xp: 0, loot: [] } });
      a.view.setTint(0x8a3a34); a.hostile = true; a.aggro = false; a.thief = true; a.armed = true; a.enemy = { drops: [] }; a.brain = new ThiefBrain(g, a);
      g.cui.toast('Armed raiders are coming. A gate will not stop them.');
    }
    /** a wolf or a thief died */
    onKill(a) {
      const P = this.P, y = P.nav.y(a.x, a.z) + 0.5;
      if (a.wolf) { const n = 1 + Math.floor(Math.random() * 2); if (P.player.canAdd('raw_meat', n)) { P.player.addItem('raw_meat', n); P.float(P.me, `+${n} raw meat`, 'loot'); } this.g.sound.play('pop'); }   // cook it at the hearth
      if ((a.thief || a.wolf) && a.brain && a.brain.onDeath) a.brain.onDeath();
      if (a.bear) { P.player.canAdd('raw_meat', 4) && P.player.addItem('raw_meat', 4); P.float(P.me, '+4 raw meat', 'loot'); this.g.sound.play('pop'); }
    }
  }

  Object.assign(K, { Difficulty, Brain, WolfBrain, Loot, ThiefBrain, Wild });
})(typeof window !== 'undefined' ? window : globalThis);
