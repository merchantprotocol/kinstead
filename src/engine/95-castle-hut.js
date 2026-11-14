/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · your home. It is a real building from the building system (the same thatched cottage the World
   Builder makes: roof that cuts away when you step in, rooms, a hearth with a fire, furniture you can use), so
   it looks and works like every other house in the game. These classes are the survival game's layer over it:

     Home     where it is, whether you are inside, its furniture as stealable slots, the door and the stores
     Door     click it to open or shut it; shut, nothing (you, wolves, raiders) can pass; open, anyone can
     Store    something by the door that holds supplies and can be raided; a raider mines it swing by swing
       Barrel   Crate
   The building itself is never damaged: nothing targets it and the ground around it cannot be dug or built on. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const TILE = K.TILE;
  const STEAL = new Set(['chest', 'pantry', 'bed', 'table', 'shelf', 'bookshelf', 'wardrobe']);   // furniture a raider will carry off (if the door is open)
  /* what stands outside. own: a stock of its own (turnips); otherwise it shows your stores of that resource */
  const STORES = (() => {
    const out = [
      { id: 'wood', kind: 'barrel', name: 'Wood barrel', res: 'wood', dx: 2.5, dz: 2.9 }, { id: 'stone', kind: 'barrel', name: 'Stone barrel', res: 'stone', dx: 3.25, dz: 2.5 },
      { id: 'food', kind: 'barrel', name: 'Food barrel', res: 'food', dx: 2.05, dz: 3.6, own: 6 }, { id: 'dirt', kind: 'crate', name: 'Dirt crate', res: 'dirt', dx: 1.15, dz: 4.0 },
      { id: 'larder', kind: 'crate', name: 'Food crate', res: 'food', dx: 0.45, dz: 3.8, own: 5 },
    ];
    /* piled against the walls of the house: barrels and stacked crates, nearly all food. dx/dz are metres from the house centre. */
    const pile = (tag, spots) => spots.forEach(([dx, dz], i) => out.push(i % 3 === 1
      ? { id: `${tag}${i}`, kind: 'crate', stack: 2, name: 'Stacked crates of food', res: 'food', dx, dz, own: 10 }
      : { id: `${tag}${i}`, kind: i % 3 === 0 ? 'barrel' : 'crate', name: i % 3 === 0 ? 'Barrel of food' : 'Crate of food', res: 'food', dx, dz, own: i % 3 === 0 ? 8 : 5 }));
    pile('w', [[-3.1, -1.2], [-3.1, -0.4], [-3.1, 0.4], [-3.1, 1.2], [-3.75, -0.8], [-3.75, 0], [-3.75, 0.8]]);          // west wall, two deep
    pile('e', [[3.1, -1.2], [3.1, -0.4], [3.1, 0.4], [3.1, 1.2], [3.75, -0.8], [3.75, 0], [3.75, 0.8]]);                 // east wall, two deep
    pile('n', [[-2, -2.2], [-1.2, -2.2], [-0.4, -2.2], [0.4, -2.2], [1.2, -2.2], [2, -2.2], [-1.6, -2.85], [-0.4, -2.85], [0.8, -2.85], [1.9, -2.85]]);   // behind the house, two deep
    return out;
  })();

  /** Something by the door that holds supplies. A raider "mines" it: each swing takes one unit out. */
  class Store {
    constructor(home, def) {
      this.home = home; this.id = def.id; this.res = def.res; this.name = def.name; this.stock = def.own != null ? def.own : null; this.kind = def.kind; this.stack = def.stack || 1;
      const g = home.g, c = home.center, x = c.x + def.dx, z = c.z + def.dz;
      this.mesh = new THREE.Group(); for (const m of this.draw(def).meshes(g.R.bmats)) this.mesh.add(m);
      this.mesh.position.set(x, g.play.nav.y(x, z), z); this.mesh.rotation.y = x * 3; g.group.add(this.mesh);
      this.ent = { id: 'store:' + def.id, type: 'c_barrel', store: this, res: def.res, name: def.name, x, z, y: this.mesh.position.y, r: 0.42, h: 0.7 };
      g.blockRect(x, z, 0.5, 0.5, 0, false);
    }
    /** the voxel model: subclasses build the container, this adds what is in it */
    draw(def) { throw new Error('Store.draw'); }
    contents(k, res, top = 0.5) {
      if (res === 'food') { k.box('bread', -0.08, top, 0.02, 0.16, 0.08, 0.1, 0.4); k.box('bread', 0.08, top, -0.05, 0.14, 0.08, 0.1, -0.3); k.box('food', 0, top, 0.09, 0.1, 0.06, 0.08); }
      else if (res === 'wood') for (const [bx, bz, r] of [[-0.07, 0, 0.2], [0.07, 0.02, -0.2], [0, -0.07, 0.6]]) k.box('wood', bx, top, bz, 0.05, 0.28, 0.05, r, 0.5, 0.2);
      else if (res === 'stone') { k.box('boulder', -0.07, top, 0, 0.14, 0.1, 0.12, 0.3); k.box('boulder', 0.07, top, 0.04, 0.12, 0.09, 0.1, -0.4); }
      else { k.box('bark', -0.07, top, 0, 0.12, 0.1, 0.12, 0.3); k.box('bark', 0.08, top, 0.04, 0.11, 0.09, 0.1, -0.4); }   // dirt
    }
    /** how much is in it */
    get amount() { return this.stock != null ? this.stock : this.home.g.castle.amount(this.res); }
    /** take up to n units out (a raider's swing, or you taking food); returns how many came out */
    rob(n) {
      const take = Math.min(this.amount, n); if (take <= 0) return 0;
      if (this.stock != null) this.stock -= take; else this.home.g.castle.spend({ [this.res]: take });
      this.home.g.changed(); return take;
    }
    put(n) { if (this.stock != null) this.stock += n; else this.home.g.castle.add(this.res, n); }
    dispose() { this.home.g.group.remove(this.mesh); }
  }
  class Barrel extends Store {
    draw(def) { const k = new K.VoxKit(), d = K.FURNITURE.barrel; d.build(k, {}, d); this.contents(k, def.res); return k; }
  }
  class Crate extends Store {
    draw(def) {
      const k = new K.VoxKit(), d = K.FURNITURE.crate; d.build(k, {}, d);
      for (let i = 1; i < this.stack; i++) { k.push(new THREE.Matrix4().makeTranslation(0.02 * i, 0.42 * i, 0.01)); d.build(k, {}, d); k.pop(); }   // crates stacked on crates
      this.contents(k, def.res, 0.42 * this.stack - 0.0); return k;
    }
  }
  const STORE_CLASS = { barrel: Barrel, crate: Crate };

  /** The weapon rack on the north wall inside the house. The bow hangs on it: take it to add it to your hotbar, put it back to remove it. */
  class Rack {
    constructor(home) {
      this.home = home; const g = home.g, b = home.spec, building = home.building, x = (b.x + 4.5) * TILE, z = (b.z + 0.42) * TILE, y = building.y0 + K.BUILDING_FLOOR_Y;
      const k = new K.VoxKit(), def = K.FURNITURE.weapon_rack; def.build(k, {}, def);
      this.mesh = new THREE.Group(); for (const m of k.meshes(g.R.bmats)) this.mesh.add(m); this.mesh.position.set(x, y, z); g.group.add(this.mesh);
      const bk = new K.VoxKit(); bk.box('wood', 0, 0.78, 0.12, 0.05, 0.2, 0.05); bk.box('wood', 0.04, 0.95, 0.12, 0.04, 0.2, 0.04, 0, 0, -0.35); bk.box('wood', 0.04, 0.61, 0.12, 0.04, 0.2, 0.04, 0, 0, 0.35); bk.box('cloth', -0.015, 0.62, 0.12, 0.01, 0.62, 0.01);
      this.bow = new THREE.Group(); for (const m of bk.meshes(g.R.bmats)) this.bow.add(m); this.mesh.add(this.bow);
      this.ent = { id: 'rack', type: 'c_rack', name: 'Weapon rack', rack: this, x, z: z + 0.3, y, r: 0.6, h: 1.4 };
      this.owned = false;
    }
    /** take the bow off the wall: it joins your hotbar */
    take() { const g = this.home.g; if (this.owned) return; this.owned = true; this.bow.visible = false; g.tools.belt.add(new K.BowTool()); g.cui.toast('You take the bow. Press 6 to draw it. Arrows fly over walls.'); g.sound.play('clank'); }
    putBack() { const g = this.home.g; if (!this.owned) return; this.owned = false; this.bow.visible = true; g.tools.belt.remove('bow'); g.cui.toast('Bow back on the wall.'); g.sound.play('thunk'); }
    dispose() { this.home.g.group.remove(this.mesh); }
  }

  /** The front door. Shut it and nothing can walk through the doorway; open it and anyone can. */
  class Door {
    static HP = 60; static REPAIR_WOOD = 3;
    constructor(home) {
      this.home = home; this.open = false; this.hp = Door.HP; this.broken = false; const g = home.g, b = home.spec, d = b.doors.find((q) => q.kind === 'exterior');
      this.tiles = []; for (let k = 0; k < d.w; k++) this.tiles.push([b.x + d.x + k, b.z + d.z]);   // the doorway tiles (the row just inside the door)
      const cx = (b.x + d.x + d.w / 2) * TILE, cz = (b.z + d.z + 0.5) * TILE, fy = g.play.nav.y(cx, cz);
      const k = new K.VoxKit(), w = d.w * TILE - 0.06;
      k.box('planks', 0, 0, 0, w, 1.55, 0.1); k.box('timber', 0, 0.25, 0.06, w, 0.1, 0.04); k.box('timber', 0, 1.1, 0.06, w, 0.1, 0.04); k.box('iron', w / 2 - 0.12, 0.8, 0.07, 0.06, 0.06, 0.04);
      this.leaf = new THREE.Group(); for (const m of k.meshes(g.R.bmats)) this.leaf.add(m);
      this.leaf.position.set(cx, fy, (b.z + d.z + 1) * TILE - 0.08); g.group.add(this.leaf);
      this.ent = { id: 'door', type: 'c_door', name: 'Door', x: cx, z: cz + 0.35, y: fy, r: 0.7, h: 1.7 };
      this.apply();
    }
    get blocked() { return !this.open && !this.broken; }
    /** an armed enemy hits the door; at 0 it is broken (open for good until you repair it) */
    hurt(n) {
      if (this.broken) return; this.hp -= n; const g = this.home.g; g.play.float(this.ent, '-' + n, 'hurt');
      if (this.hp <= 0) { this.broken = true; this.open = true; g.cui.toast('Your door was broken down!'); g.sound.play('crack'); this.apply(); }
    }
    repair() {
      const g = this.home.g, c = g.castle; if (!this.broken) return;
      if (c.amount('wood') < Door.REPAIR_WOOD) { g.cui.toast(`You need ${Door.REPAIR_WOOD} wood to repair the door.`); g.sound.play('clank'); return; }
      c.spend({ wood: Door.REPAIR_WOOD }); this.broken = false; this.hp = Door.HP; this.open = false; this.apply(); g.cui.toast('Door repaired.'); g.sound.play('thunk'); g.changed();
    }
    /** write the door into the ground: shut = the doorway tiles cannot be walked */
    apply() {
      const nav = this.home.g.play.nav; for (const [i, j] of this.tiles) nav.walk[j * nav.w + i] = this.open ? 1 : 0;
      this.leaf.visible = !this.open && !this.broken;
    }
    /** something (you or a creature) is standing in the doorway */
    occupied() {
      const P = this.home.g.play, r = 0.55;
      return P.actors.some((a) => a.alive && this.tiles.some(([i, j]) => Math.hypot(a.x - (i + 0.5) * TILE, a.z - (j + 0.5) * TILE) < r + (a.r || 0.3) * 0.5));
    }
    toggle() {
      const g = this.home.g;
      if (this.broken) { this.repair(); return; }
      if (!this.open) { this.open = true; g.sound.play('clank'); g.cui.toast('The door is open. Anyone can walk in.'); }
      else { if (this.occupied()) { g.cui.toast('Something is in the way.'); g.sound.play('clank'); return; } this.open = false; g.sound.play('thunk'); g.cui.toast('Door shut.'); }
      this.apply();
    }
  }

  class Home {
    constructor(game) {
      this.g = game; this.id = 'home';
      this.spec = game.play.doc.obj(this.id); this.center = { x: game.L.keep.x, z: game.L.keep.z };
      this.stores = STORES.map((d) => new STORE_CLASS[d.kind](this, d));
      this.door = new Door(this); this.rack = new Rack(this);
    }
    get building() { return this.g.R.buildings.get(this.id); }
    get doorPoint() { const b = this.spec, d = b.doors.find((q) => q.kind === 'exterior'); return { x: (b.x + d.x + d.w / 2) * TILE, z: (b.z + d.z + 1.8) * TILE }; }   // just outside the front door
    /** are you (or a creature) standing inside the house? */
    inside(x, z) { const i = Math.floor(x / TILE), j = Math.floor(z / TILE); return K.Footprint.inside(this.spec.footprint, i - this.spec.x, j - this.spec.z); }
    /** within `m` metres of the house (its footprint grown by m)? The ground there is never touched. */
    near(x, z, m) { const b = this.spec, x0 = b.x * TILE - m, z0 = b.z * TILE - m, x1 = (b.x + b.footprint.w) * TILE + m, z1 = (b.z + b.footprint.h) * TILE + m; return x > x0 && x < x1 && z > z0 && z < z1; }
    /** a spot outside the house for a wolf to prowl around while it cannot get to you */
    prowlPoint() {
      const b = this.spec, cx = (b.x + b.footprint.w / 2) * TILE, cz = (b.z + b.footprint.h / 2) * TILE, nav = this.g.play.nav;
      for (let k = 0; k < 12; k++) { const a = Math.random() * 6.283, r = 4.5 + Math.random() * 3, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * (r * 0.8); if (nav.standable(x, z) && !this.inside(x, z)) return { x, z }; }
      return { x: cx + 6, z: cz + 5 };
    }

    /* ---------- furniture a raider can take (only if the door is open) ---------- */
    get stealable() {
      const b = this.building, spec = this.spec; if (!b || !this.door.open) return [];
      return spec.furniture.filter((f) => STEAL.has(f.type) && !(f.state && f.state.away)).map((f) => this.slot(b, f));
    }
    slot(b, f) {
      const def = b.catalog[f.type], [fi, fj] = K.FurnitureFootprint.front(def, f), spec = this.spec;
      return { f, def: { name: def.name }, ent: { x: (spec.x + fi + 0.5) * TILE, z: (spec.z + fj + 0.5) * TILE }, get present() { return spec.furniture.includes(f); } };
    }
    take(slot) { const arr = this.spec.furniture, i = arr.indexOf(slot.f); if (i >= 0) { arr.splice(i, 1); this.resync(); } }
    putBack(slot) { if (!this.spec.furniture.includes(slot.f)) { this.spec.furniture.push(slot.f); this.resync(); } }
    /** the building re-meshes (the item vanishes or returns), the ground under it is re-read, the door is written back */
    resync() {
      const g = this.g, R = g.R, play = g.play; R.syncBuildings(true); play.nav.applyBuildings(R.buildings); this.door.apply(); play.bplay.dirty(); play.refreshProps();
    }

    /* ---------- the stores and the world's view of the home ---------- */
    takeFood(store) {
      const g = this.g, p = g.play.player; if (!store || store.amount <= 0) { g.cui.toast('Nothing left to take.'); return; }
      if (!p.canAdd('turnip', 1)) { g.cui.toast('Your bag is full.'); return; }
      store.rob(1); p.addItem('turnip', 1); g.play.float(g.play.me, '+1 turnip', 'loot'); g.sound.play('gather');
    }
    entities() { return this.stores.map((s) => s.ent).concat([this.door.ent, this.rack.ent]); }
    update() { this.door.apply(); }   // the building re-reads the ground now and then; the door is written back every frame
    dispose() { this.stores.forEach((s) => s.dispose()); this.rack.dispose(); this.g.group.remove(this.door.leaf); }
  }

  Object.assign(K, { Home, Door, Rack, Store, Barrel, Crate });
})(typeof window !== 'undefined' ? window : globalThis);
