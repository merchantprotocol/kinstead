/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · your home. It is a real building from the building system (the same thatched cottage the World
   Builder makes: roof that cuts away when you step in, rooms, a hearth with a fire, furniture you can use), so it
   looks and works like every other house in the game. This class is the survival game's adapter over that
   building; it adds nothing the building does not already do, and takes nothing away:

     - the building can never be damaged (nothing in the game targets it; the ground under it cannot be dug)
     - it is the safe place: wolves never come in and never attack you inside
     - raiders can carry off its furniture; the barrels by the door hold your stores and can be raided too

   Home       adapter: where it is, whether you are inside it, its furniture as stealable slots, the barrels
   Barrel     one stores barrel by the door (wood, stone or food) */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const TILE = K.TILE;
  const STEAL = new Set(['chest', 'pantry', 'bed', 'table', 'shelf', 'bookshelf', 'wardrobe']);   // what a raider will carry off
  const BARRELS = [{ res: 'wood', name: 'Wood barrel', dx: 2.5, dz: 2.9 }, { res: 'stone', name: 'Stone barrel', dx: 3.25, dz: 2.5 }, { res: 'food', name: 'Food barrel', dx: 2.05, dz: 3.6 }];

  /** One barrel by the door; the contents are shown on top. */
  class Barrel {
    constructor(home, def) {
      this.home = home; this.res = def.res; this.name = def.name; const g = home.g, c = home.center;
      const x = c.x + def.dx, z = c.z + def.dz, k = new K.VoxKit(), bd = K.FURNITURE.barrel; bd.build(k, {}, bd);
      if (def.res === 'food') { k.box('bread', -0.08, 0.56, 0.02, 0.16, 0.08, 0.1, 0.4); k.box('bread', 0.08, 0.56, -0.05, 0.14, 0.08, 0.1, -0.3); k.box('food', 0, 0.56, 0.09, 0.1, 0.06, 0.08); }
      else if (def.res === 'wood') for (const [bx, bz, r] of [[-0.07, 0, 0.2], [0.07, 0.02, -0.2], [0, -0.07, 0.6]]) k.box('wood', bx, 0.56, bz, 0.05, 0.28, 0.05, r, 0.5, 0.2);
      else { k.box('boulder', -0.07, 0.56, 0, 0.14, 0.1, 0.12, 0.3); k.box('boulder', 0.07, 0.56, 0.04, 0.12, 0.09, 0.1, -0.4); }
      this.mesh = new THREE.Group(); for (const m of k.meshes(g.R.bmats)) this.mesh.add(m);
      this.mesh.position.set(x, g.play.nav.y(x, z), z); this.mesh.rotation.y = x * 3; g.group.add(this.mesh);
      this.ent = { id: 'barrel:' + def.res, type: 'c_barrel', res: def.res, name: def.name, x, z, y: this.mesh.position.y, r: 0.42, h: 0.7 };
      g.blockRect(x, z, 0.5, 0.5, 0, false);
    }
    /** how much is in it (wood and stone are your stores; food is the barrel's own stock of turnips) */
    get amount() { return this.res === 'food' ? this.home.foodStock : this.home.g.castle.amount(this.res); }
    /** a raider takes a share; returns how much */
    rob(n) { const take = Math.min(this.amount, n); if (take <= 0) return 0; if (this.res === 'food') this.home.foodStock -= take; else this.home.g.castle.spend({ [this.res]: take }); this.home.g.changed(); return take; }
    dispose() { this.home.g.group.remove(this.mesh); }
  }

  class Home {
    constructor(game) {
      this.g = game; this.id = 'home'; this.foodStock = 5;
      this.spec = game.play.doc.obj(this.id); this.center = { x: game.L.keep.x, z: game.L.keep.z };
      this.barrels = BARRELS.map((d) => new Barrel(this, d));
    }
    get building() { return this.g.R.buildings.get(this.id); }
    get doorPoint() { const b = this.spec, d = b.doors.find((q) => q.kind === 'exterior'); return { x: (b.x + d.x + d.w / 2) * TILE, z: (b.z + d.z + 1.8) * TILE }; }   // just outside the front door
    /** are you (or a wolf) standing inside the house? */
    inside(x, z) { const i = Math.floor(x / TILE), j = Math.floor(z / TILE); return K.Footprint.inside(this.spec.footprint, i - this.spec.x, j - this.spec.z); }
    /** within `m` metres of the house (its footprint grown by m)? The ground there is never touched. */
    near(x, z, m) { const b = this.spec, x0 = b.x * TILE - m, z0 = b.z * TILE - m, x1 = (b.x + b.footprint.w) * TILE + m, z1 = (b.z + b.footprint.h) * TILE + m; return x > x0 && x < x1 && z > z0 && z < z1; }
    /** a spot outside the house for a wolf to prowl around while you are safe inside */
    prowlPoint() {
      const b = this.spec, cx = (b.x + b.footprint.w / 2) * TILE, cz = (b.z + b.footprint.h / 2) * TILE, nav = this.g.play.nav;
      for (let k = 0; k < 12; k++) { const a = Math.random() * 6.283, r = 4.5 + Math.random() * 3, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * (r * 0.8); if (nav.standable(x, z) && !this.inside(x, z)) return { x, z }; }
      return { x: cx + 6, z: cz + 5 };
    }

    /* ---------- furniture a raider can take ---------- */
    get stealable() {
      const b = this.building, spec = this.spec; if (!b) return [];
      return spec.furniture.filter((f) => STEAL.has(f.type) && !(f.state && f.state.away)).map((f) => this.slot(b, f));
    }
    slot(b, f) {
      const def = b.catalog[f.type], [w, d] = K.FurnitureFootprint.size(def, f.rot | 0), [fi, fj] = K.FurnitureFootprint.front(def, f), spec = this.spec;
      return { f, def: { name: def.name }, ent: { x: (spec.x + fi + 0.5) * TILE, z: (spec.z + fj + 0.5) * TILE }, get present() { return spec.furniture.includes(f); } };
    }
    take(slot) { const arr = this.spec.furniture, i = arr.indexOf(slot.f); if (i >= 0) { arr.splice(i, 1); this.resync(); } }
    putBack(slot) { if (!this.spec.furniture.includes(slot.f)) { this.spec.furniture.push(slot.f); this.resync(); } }
    /** the building re-meshes (the item vanishes or returns) and the ground under it is re-read */
    resync() {
      const g = this.g, R = g.R, play = g.play; R.syncBuildings(true); play.nav.applyBuildings(R.buildings); play.bplay.dirty(); play.refreshProps();
    }

    /* ---------- the barrels and the world's view of the home ---------- */
    takeFood() {
      const g = this.g, p = g.play.player; if (this.foodStock <= 0) { g.cui.toast('The barrel is empty.'); return; }
      if (!p.canAdd('turnip', 1)) { g.cui.toast('Your bag is full.'); return; }
      this.foodStock--; p.addItem('turnip', 1); g.play.float(g.play.me, '+1 turnip', 'loot'); g.sound.play('gather');
    }
    entities() { return this.barrels.map((b) => b.ent); }
    barrelFor(res) { return this.barrels.find((b) => b.res === res); }
    update() {}
    dispose() { this.barrels.forEach((b) => b.dispose()); }
  }

  Object.assign(K, { Home, Barrel });
})(typeof window !== 'undefined' ? window : globalThis);
