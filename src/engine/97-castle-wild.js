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
    /** the first three wolves are pups; after that wolves grow with the days */
    nextWolf() {
      const d = this.day, pup = this.wolvesSpawned++ < 3;
      return pup ? { name: 'Wolf pup', hp: 10, atk: 2, speed: 2.3, cd: 1.6, scale: 0.8 } : { name: 'Wolf', hp: 18 + d * 3, atk: 3 + Math.floor(d / 2), speed: 2.8 + Math.min(0.5, d * 0.05), cd: 1.15, scale: 1 };
    }
    get packSize() { return Math.min(5, 1 + Math.ceil(this.day / 2) + (this.day > 2 ? 1 : 0)); }   // night 1: 2, night 2: 2, night 3: 3 ... up to 5
    get dayCap() { return 1; }
    get nightCap() { return this.packSize + 1; }
    get thievesAllowed() { return this.day >= 5; }
    dayInterval() { return rnd(70, 110); }
    nightInterval() { return rnd(35, 55); }
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
      if (this.repath <= 0 || !a.path) { this.repath = 0.5; a.path = P.nav.find(a.x, a.z, x, z, { range, maxNodes: 4000 }) || null; }
      this.noWay = !a.path; const moved = a.path ? P.move(a, dt, speed) : false; this.anim(moved, speed); return moved;   // noWay: the ground does not connect (a shut door)
    }
    face(t) { this.a.view.setFacing(t.x - this.a.x, t.z - this.a.z); }
    anim(moving, speed = 3) {
      const v = this.a.view; if (v.state === 'attack' || v.state === 'hurt' || v.state === 'action') return;
      const want = moving ? (speed > 2.2 ? 'run' : 'walk') : 'idle'; if (v.state !== want) v.setState(want);
    }
    bite(foe) { this.cd = this.a.cd; this.P.swing(this.a, foe); }
  }

  class WolfBrain extends Brain {
    constructor(game, actor) { super(game, actor); this.mode = 'hunt'; this.spot = null; this.spotT = 0; this.leave = null; }
    /** dawn: go back to the dark */
    retreat() { this.mode = 'retreat'; this.leave = this.g.L.outside.slice().sort((p, q) => dist(q, this.a) - dist(p, this.a))[0]; this.a.path = null; }
    update(dt) {
      const g = this.g, P = this.P, a = this.a, me = P.me; if (!this.tickDead(dt)) return;
      this.cd -= dt; const d = dist(a, me);
      if (d > 80 && this.mode !== 'retreat') { g.removeActor(a); return; }
      if (this.mode === 'retreat') { if (dist(a, this.leave) < 4) { g.removeActor(a); return; } this.goTo(this.leave.x, this.leave.z, a.speed, 1.5, dt); return; }
      if (!me.alive || (g.home.inside(me.x, me.z) && !g.home.door.open)) { this.prowl(dt); return; }   // you are inside with the door shut: they can only circle outside
      this.hunt(dt, d);
      if (this.noWay) this.prowl(dt);          // no way to you (the door is shut): they can only circle outside
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
        if (this.noWay) { this.target = null; this.repath = 0; }   // the way is shut: pick something else
      } else if (this.mode === 'taking') {
        this.steal += dt; if (a.view.state !== 'action') a.view.setState('action');
        if (this.steal >= 1.6) this.take();
      } else if (this.mode === 'raiding') {
        this.raid(dt);
      } else {
        if (!this.fleeTo) this.fleeTo = this.edgeFar();
        if (dist(a, this.fleeTo) < 3 || dist(a, g.home.center) > 60) { this.escape(); return; }
        this.goTo(this.fleeTo.x, this.fleeTo.z, a.speed * 1.2, 1.5, dt);
      }
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
    edgeFar() { const a = this.a; return this.g.L.outside.slice().sort((p, q) => dist(q, a) - dist(p, a))[0]; }
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
      this.nextDayWolf = 55; this.nextNightWolf = 0; this.nextThief = 300;
      game.calendar.on((ev) => this.onCalendar(ev));
    }
    get P() { return this.g.play; }
    get cal() { return this.g.calendar; }
    alive(pred) { return this.P.actors.filter((a) => a.alive && pred(a)); }
    wolves() { return this.alive((a) => a.wolf); }

    onCalendar(ev) {
      if (ev.type === 'dusk') { this.spawnPack(this.difficulty.packSize); this.nextNightWolf = this.t + this.difficulty.nightInterval(); }
      else if (ev.type === 'dawn') { for (const w of this.wolves()) w.brain.retreat(); this.nextDayWolf = this.t + this.difficulty.dayInterval(); }
    }
    update(dt) {
      const me = this.P.me; if (!me.alive) return; this.t += dt; const df = this.difficulty;
      if (this.cal.isNight) {
        if (this.t >= this.nextNightWolf && this.wolves().length < df.nightCap) { this.spawnPack(1); this.nextNightWolf = this.t + df.nightInterval(); }
      } else if (this.t >= this.nextDayWolf) {
        if (this.wolves().length < df.dayCap) this.spawnPack(1);
        this.nextDayWolf = this.t + df.dayInterval();
      }
      if (df.thievesAllowed && this.t >= this.nextThief) { if (!this.alive((a) => a.thief).length) this.spawnThief(); this.nextThief = this.t + df.thiefInterval(); }
    }
    /** a spot on the map's rim (inside the fog) that you can walk to */
    edgePoint() {
      const L = this.g.L, nav = this.P.nav, keys = Object.keys(L.frostEdges);
      for (let k = 0; k < 20; k++) {
        const e = L.frostEdges[keys[Math.floor(Math.random() * keys.length)]];
        const x = e.x != null ? e.x : rnd(e.x0, e.x1), z = e.z != null ? e.z : rnd(e.z0, e.z1);
        if (nav.standable(x, z)) return { x, z };
      }
      return null;
    }
    spawnPack(n) {
      const base = this.edgePoint(); if (!base) return;
      for (let i = 0; i < n; i++) this.spawnWolf(base.x + rnd(-2, 2), base.z + rnd(-2, 2));
      if (this.cal.isNight) this.g.cui.toast(n > 1 ? 'Wolves are howling out in the dark…' : 'A wolf is howling nearby…');
    }
    spawnWolf(x, z) {
      const g = this.g, s = this.difficulty.nextWolf();
      const a = g.addActor({ id: 'w' + Math.random().toString(36).slice(2, 7), role: 'enemy', spriteId: 'wolf', name: s.name, x, z, hpMax: s.hp, atk: s.atk, def: 0, speed: s.speed, cd: s.cd, reach: 0.95, r: 0.45, scale: s.scale, level: 1, info: { xp: 0, loot: [] } });
      a.hostile = true; a.aggro = true; a.wolf = true; a.enemy = { drops: [] }; a.brain = new WolfBrain(g, a); return a;
    }
    spawnThief() {
      const g = this.g, at = this.edgePoint(); if (!at) return;
      const a = g.addActor({ id: 't' + Math.random().toString(36).slice(2, 7), role: 'enemy', spriteId: 'ranger', name: 'Raider', x: at.x, z: at.z, hpMax: 42, atk: 6, def: 0, speed: 2.7, cd: 1.3, reach: 0.9, r: 0.4, scale: 1, level: 1, info: { xp: 0, loot: [] } });
      a.view.setTint(0x6e4a42); a.hostile = true; a.aggro = false; a.thief = true; a.enemy = { drops: [] }; a.brain = new ThiefBrain(g, a);
    }
    /** a wolf or a thief died */
    onKill(a) {
      const P = this.P, y = P.nav.y(a.x, a.z) + 0.5;
      if (a.wolf) { const n = 1 + Math.floor(Math.random() * 2); if (P.player.canAdd('raw_meat', n)) { P.player.addItem('raw_meat', n); P.float(P.me, `+${n} raw meat`, 'loot'); } this.g.sound.play('pop'); }   // cook it at the hearth
      if (a.thief && a.brain) a.brain.onDeath();
    }
  }

  Object.assign(K, { Difficulty, Brain, WolfBrain, Loot, ThiefBrain, Wild });
})(typeof window !== 'undefined' ? window : globalThis);
