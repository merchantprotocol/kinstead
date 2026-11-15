/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the town economy, part one (see docs/ECONOMY.md). Buildings make goods, carts haul them to where they
   are kept, and you see the stores grow.
     Ledger     what one building holds
     Fields     the wheat squares you draw around a farm: they grow sprout, green, gold, then give a wheat
     Cart       a handcart carrying goods from one building to another, along the ground
     Economy    the whole thing: planting, growing, sending carts, the market's piles and the silo's fill level, saving */
(function (G) {
  const K = G.K, THREE = G.THREE, TILE = K.TILE;
  const GROW = 180, FIELD_REACH = 14, FARM_CAP = 40, SILO_CAP = 200, MARKET_CAP = 999, CART_LOAD = 10, CART_SPEED = 2.2;
  const STAGE_COLOR = [0x8bcf63, 0x3f9a3a, 0xe0b84a], STAGE_H = [0.12, 0.32, 0.5];

  class Ledger {
    constructor(cap, only) { this.goods = {}; this.cap = cap; this.only = only || null; }
    amount(g) { return this.goods[g] || 0; }
    total() { let t = 0; for (const v of Object.values(this.goods)) t += v; return t; }
    room(g) { if (this.only && !this.only.includes(g)) return 0; return Math.max(0, this.cap - this.total()); }
    add(g, n) { const k = Math.min(n, this.room(g)); if (k > 0) this.goods[g] = this.amount(g) + k; return k; }
    take(g, n) { const k = Math.min(n, this.amount(g)); if (k > 0) this.goods[g] -= k; return k; }
  }

  class Fields {
    constructor(eco) {
      this.eco = eco; this.tiles = new Map(); this.max = 4000; const g = eco.g;
      this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 1, 0.42), new THREE.MeshLambertMaterial({ color: 0xffffff }), this.max);
      this.mesh.count = 0; this.mesh.frustumCulled = false; this.m = new THREE.Matrix4(); this.c = new THREE.Color(); g.group.add(this.mesh); this.dirty = true;
    }
    key(i, j) { return i + ',' + j; }
    has(i, j) { return this.tiles.has(this.key(i, j)); }
    add(i, j, age = 0) { if (this.tiles.size >= this.max) return false; this.tiles.set(this.key(i, j), { i, j, age }); this.dirty = true; return true; }
    remove(i, j) { this.tiles.delete(this.key(i, j)); this.dirty = true; }
    stage(t) { return Math.min(2, Math.floor(t.age / (GROW / 3))); }
    /** grow everything; a square that turns ripe gives its wheat to the nearest farm with room */
    grow(dt) {
      for (const t of this.tiles.values()) {
        const s0 = this.stage(t); t.age += dt;
        if (t.age >= GROW) { const x = (t.i + 0.5) * TILE, z = (t.j + 0.5) * TILE, farm = this.eco.nearestFarm(x, z); if (farm && this.eco.ledger(farm).add('wheat', 1)) { t.age = 0; this.dirty = true; } else t.age = GROW; continue; }   // a full barn: it waits ripe
        if (this.stage(t) !== s0) this.dirty = true;
      }
    }
    draw() {
      if (!this.dirty) return; this.dirty = false; const nav = this.eco.g.play.nav; let n = 0;
      for (const t of this.tiles.values()) {
        const st = this.stage(t), h = STAGE_H[st], x = (t.i + 0.5) * TILE, z = (t.j + 0.5) * TILE, y = nav.y(x, z);
        this.m.makeScale(1, h, 1).setPosition(x, y + h / 2, z); this.mesh.setMatrixAt(n, this.m); this.mesh.setColorAt(n, this.c.setHex(STAGE_COLOR[st])); n++;
      }
      this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
    dispose() { this.eco.g.group.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
  }

  class Cart {
    constructor(eco, from, to, good, n) {
      this.eco = eco; this.from = from; this.to = to; this.good = good; this.n = n; const g = eco.g, P = g.play;
      const k = new K.VoxKit(); k.box('planks', 0, 0.28, 0, 0.6, 0.3, 0.9); k.box('timber', 0, 0.58, -0.6, 0.06, 0.06, 0.6, 0, 0.5); k.box(good === 'wheat' ? 'hay' : 'wood', 0, 0.58, 0, 0.5, 0.18, 0.7);
      for (const [x, z] of [[-0.34, 0.2], [0.34, 0.2]]) k.geo('wood', K.VoxKit.CYL, x, 0.24, z, 0, 0, Math.PI / 2, 0.5, 0.06, 0.5);
      this.mesh = new THREE.Group(); for (const m of k.meshes(g.R.bmats)) this.mesh.add(m); g.group.add(this.mesh);
      this.a = { x: from.x, z: from.z, y: P.nav.y(from.x, from.z), view: { setFacing() {} }, path: null };
      this.a.path = P.nav.find(from.x, from.z, to.x, to.z, { range: 2.4, maxNodes: 20000 }) || [[to.x, to.z]];
    }
    /** false once delivered */
    update(dt) {
      const P = this.eco.g.play, a = this.a, p0x = a.x, p0z = a.z;
      if (a.path && a.path.length) P.move(a, dt, CART_SPEED); a.y = P.nav.y(a.x, a.z);
      this.mesh.position.set(a.x, a.y, a.z); if (Math.hypot(a.x - p0x, a.z - p0z) > 1e-4) this.mesh.rotation.y = Math.atan2(a.x - p0x, a.z - p0z);
      if (a.path && a.path.length) return true;
      const left = this.eco.ledger(this.to).add(this.good, this.n); if (left < this.n) this.eco.ledger(this.from).add(this.good, this.n - left);   // what does not fit goes back
      this.dispose(); return false;
    }
    dispose() { this.eco.g.group.remove(this.mesh); }
  }

  class Economy {
    constructor(game) { this.g = game; this.ledgers = new Map(); this.carts = []; this.piles = new Map(); this.fields = new Fields(this); this.t = 0; this.drawT = 0; this.vaults = new Map(); }
    get pieces() { return this.g.castle.pieces; }
    of(type) { return this.pieces.filter((p) => p.type === type); }
    ledger(p) {
      let l = this.ledgers.get(p.uid);
      if (!l) { l = p.type === 'silo' ? new Ledger(SILO_CAP, ['wheat']) : p.type === 'market' ? new Ledger(MARKET_CAP) : new Ledger(FARM_CAP); this.ledgers.set(p.uid, l); }
      return l;
    }
    nearestFarm(x, z) { let best = null, bd = FIELD_REACH + 1; for (const p of this.of('farm')) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } } return best; }
    /* ---------- fields ---------- */
    plantOk(x, z) {
      const g = this.g, d = g.play.doc, nav = g.play.nav, [i, j] = d.tileOf(x, z), k = j * d.w + i, cx = (i + 0.5) * TILE, cz = (j + 0.5) * TILE;
      if (!this.nearestFarm(cx, cz)) return 'a wheat field has to be within 14 m of one of your farms';
      if (this.fields.has(i, j)) return 'that square is already a field';
      const t = d.terrain[k]; if (t === K.T.ROCK || t === K.T.CHASM || t === K.T.WATER || !nav.walk[k] || g.occ[k] || g.R.buildings.at(i, j)) return 'the ground there cannot be ploughed';
      return null;
    }
    plant(x, z, quiet) {
      const g = this.g, why = this.plantOk(x, z), c = g.castle; if (why) { if (!quiet) { g.cui.toast(why[0].toUpperCase() + why.slice(1) + '.'); g.sound.play('clank'); } return false; }
      const blk = c.blocker('field'); if (blk) { if (!quiet) g.cui.toast(blk[0].toUpperCase() + blk.slice(1) + '.'); return false; }
      if (!c.spend(c.buildCost('field'))) { if (!quiet) g.cui.toast('You need wood to plough a field.'); return false; }
      const d = g.play.doc, [i, j] = d.tileOf(x, z), k = j * d.w + i; d.terrain[k] = K.T.DIRT; g.R.tilesChanged(i, j, i + 1, j + 1); if (g.tools.editor) g.tools.editor.version++;
      this.fields.add(i, j, Math.random() * 20); g.xp.built('field'); g.sound.play('thunk'); g.changed(); return true;
    }
    /* ---------- the day's work ---------- */
    update(dt) {
      this.t -= dt; this.drawT -= dt;
      this.carts = this.carts.filter((c) => c.update(dt));
      if (this.t <= 0) { this.t = 1; this.fields.grow(1); this.dispatch(); this.tidy(); }
      if (this.drawT <= 0) { this.drawT = 1; this.fields.draw(); this.dress(); }
    }
    /** send a cart from any farm with a load waiting (to a silo with room, else the market) */
    dispatch() {
      for (const f of this.of('farm')) {
        const l = this.ledger(f), w = l.amount('wheat'); if (w < CART_LOAD || this.carts.some((c) => c.from === f)) continue;
        const dest = this.of('silo').filter((s) => this.ledger(s).room('wheat') >= CART_LOAD).concat(this.of('market'))[0]; if (!dest) continue;
        this.carts.push(new Cart(this, f, dest, 'wheat', l.take('wheat', CART_LOAD)));
      }
      for (const s of this.of('silo')) {   // a nearly full silo sends its surplus to the market
        const l = this.ledger(s), m = this.of('market')[0]; if (!m || l.amount('wheat') < SILO_CAP - CART_LOAD || this.carts.some((c) => c.from === s)) continue;
        this.carts.push(new Cart(this, s, m, 'wheat', l.take('wheat', CART_LOAD)));
      }
    }
    /** a building that was taken down: its stock spills as pickups, its ledger goes */
    tidy() {
      const live = new Set(this.pieces.map((p) => p.uid));
      for (const [uid, l] of this.ledgers) if (!live.has(uid)) { this.ledgers.delete(uid); const v = this.piles.get(uid); if (v) { this.g.group.remove(v.grp); this.piles.delete(uid); } }
    }
    /* ---------- seeing it ---------- */
    /** the market's piles and the silo's gauge follow what is in them */
    dress() {
      for (const p of this.of('market').concat(this.of('silo'))) {
        const l = this.ledger(p), sig = JSON.stringify(l.goods); let v = this.piles.get(p.uid); if (v && v.sig === sig) continue;
        if (v) this.g.group.remove(v.grp); const k = new K.VoxKit(), grp = new THREE.Group();
        if (p.type === 'silo') { const f = Math.min(1, l.amount('wheat') / SILO_CAP); k.box('hay', 0, 0.1, 0.78, 0.18, Math.max(0.05, 3.0 * f), 0.04); k.box('iron', 0, 0.1, 0.8, 0.24, 3.0, 0.02); }
        else {
          let slot = 0; for (const [good, n] of Object.entries(l.goods)) {
            if (n <= 0) continue; const stacks = Math.min(6, Math.ceil(n / 15)), mat = good === 'wheat' ? 'hay' : good === 'stone' ? 'ashlar' : good === 'iron' ? 'iron' : 'wood';
            for (let q = 0; q < stacks; q++) { const x = -1.5 + (slot % 7) * 0.5, z = -0.4 + Math.floor(slot / 7) * 0.5, y = (q % 3) * 0.42; k.box(mat, x + (q > 2 ? 0.0 : 0), y, z + (q > 2 ? -0.48 : 0), 0.42, 0.4, 0.42); }
            slot++;
          }
        }
        for (const m of k.meshes(this.g.R.bmats)) grp.add(m); grp.position.set(p.x, this.g.play.nav.y(p.x, p.z), p.z); grp.rotation.y = p.rot || 0; this.g.group.add(grp);
        this.piles.set(p.uid, { grp, sig });
      }
    }
    /** a two-purse view of a building's store (the purse screen works on it like a chest) */
    vaultFor(p) { const l = this.ledger(p); let v = this.vaults.get(p.uid); if (!v) { v = { res: l.goods, items: {}, weapons: [] }; this.vaults.set(p.uid, v); } v.res = l.goods; return v; }
    /* ---------- saving ---------- */
    toJSON() { const led = {}; for (const [uid, l] of this.ledgers) led[uid] = l.goods; return { ledgers: led, fields: [...this.fields.tiles.values()].map((t) => [t.i, t.j, Math.round(t.age)]) }; }
    restore(x) {
      if (!x) return; for (const [uid, goods] of Object.entries(x.ledgers || {})) { const p = this.pieces.find((q) => q.uid === +uid); if (p) Object.assign(this.ledger(p).goods, goods); }
      const d = this.g.play.doc; for (const [i, j, age] of x.fields || []) { this.fields.add(i, j, age); const k = j * d.w + i; d.terrain[k] = K.T.DIRT; }
      if ((x.fields || []).length) this.g.R.tilesChanged(0, 0, d.w, d.h);
    }
    dispose() { this.fields.dispose(); for (const c of this.carts) c.dispose(); for (const v of this.piles.values()) this.g.group.remove(v.grp); }
  }

  Object.assign(K, { Ledger, Fields, Cart, Economy });
})(typeof window !== 'undefined' ? window : globalThis);
