/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the town economy, part one (see docs/ECONOMY.md). Buildings make goods, carts haul them to where they
   are kept, and you see the stores grow.
     Ledger     what one building holds
     Fields     the wheat squares you draw around a farm: they grow sprout, green, gold, then give a wheat
     (the handcarts are K.Cart, 119a-castle-cart.js: a worker always pulls them)
     Economy    the whole thing: planting, growing, sending carts, the market's piles and the silo's fill level, saving */
(function (G) {
  const K = G.K, THREE = G.THREE, TILE = K.TILE;
  const GROW = 180, FIELD_REACH = 14, FARM_CAP = 40, SILO_CAP = 200, MARKET_CAP = 999, CART_LOAD = 10;
  const STAGE_COLOR = [0x9fe070, 0x55b844, 0xf6c845], STAGE_H = [0.12, 0.32, 0.5];
  /** one wheat square as a single geometry of unit height: 4 rows of stalks with fat ears on top, shaded dark at the root and
      bright at the tip (vertex colours), so the per-square stage colour reads as sprouts, green wheat, then golden wheat */
  const WHEAT_GEO = (() => {
    const pos = [], nor = [], col = [];
    const add = (x, z, w, y0, y1, c0, c1) => {
      const g = new THREE.BoxGeometry(w, y1 - y0, w).toNonIndexed(); g.translate(x, (y0 + y1) / 2, z); const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); const c = c0 + (c1 - c0) * (p.getY(i) - y0) / (y1 - y0); col.push(c, c, c); }
      g.dispose();
    };
    let q = 0;
    for (const x of [-0.15, -0.05, 0.05, 0.15]) for (const z of [-0.16, -0.08, 0, 0.08, 0.16]) {
      const r = (q++ * 37 % 11) / 11, top = 0.82 + r * 0.18, jx = x + (q % 2 ? 0.012 : -0.012);
      add(jx, z, 0.035, 0, top * 0.72, 0.5, 0.85);               // stalk
      add(jx, z, 0.07, top * 0.68, top, 0.95, 1.12);            // ear
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  })();

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
      this.mesh = new THREE.InstancedMesh(WHEAT_GEO.clone(), new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), this.max);
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

  /* ---------- livestock ---------- */
  const KINDS = {
    chicken: { home: 'coop', price: 5, max: 12, roam: 4, speed: 1.1, every: 60, good: 'egg', name: 'chicken' },
    cow: { home: 'barn', price: 10, max: 8, roam: 7, speed: 0.8, every: 120, good: 'milk', name: 'cow', eats: 120 },
  };
  const LIVE_MATS = {};
  const mat = (hex) => LIVE_MATS[hex] || (LIVE_MATS[hex] = new THREE.MeshLambertMaterial({ color: hex }));
  const BOX = new THREE.BoxGeometry(1, 1, 1);

  /** one animal: a little voxel body that wanders near its building */
  class Beast {
    constructor(stock, kind, home, x, z) {
      this.stock = stock; this.kind = kind; this.home = home; this.spec = KINDS[kind]; this.t = Math.random() * this.spec.every; this.hunger = 0; this.fed = true; this.exposed = false;
      const g = stock.g, P = g.play; this.a = { x, z, y: P.nav.y(x, z), view: { setFacing() {} }, path: null }; this.wait = Math.random() * 4;
      const grp = this.mesh = new THREE.Group(), part = (hex, x, y, z, w, h, d) => { const m = new THREE.Mesh(BOX, mat(hex)); m.position.set(x, y + h / 2, z); m.scale.set(w, h, d); m.castShadow = true; grp.add(m); };
      if (kind === 'chicken') {   // a white hen: red comb and wattle, yellow beak and legs, grey-tipped wings, a raised tail
        const W = 0xfbf8f0, Wg = 0xe2ddd2, R = 0xe0302a, Y = 0xf2a81e, E = 0x15130f;
        part(Y, -0.05, 0, 0.01, 0.03, 0.1, 0.03); part(Y, 0.05, 0, 0.01, 0.03, 0.1, 0.03); part(Y, -0.05, 0, 0.04, 0.05, 0.015, 0.06); part(Y, 0.05, 0, 0.04, 0.05, 0.015, 0.06);
        part(W, 0, 0.1, 0, 0.22, 0.2, 0.3); part(Wg, -0.115, 0.13, -0.02, 0.02, 0.13, 0.2); part(Wg, 0.115, 0.13, -0.02, 0.02, 0.13, 0.2);
        part(W, 0, 0.2, -0.15, 0.16, 0.18, 0.08); part(Wg, 0, 0.33, -0.17, 0.1, 0.07, 0.05);
        part(W, 0, 0.24, 0.12, 0.14, 0.15, 0.13); part(R, 0, 0.39, 0.11, 0.04, 0.06, 0.1); part(R, 0, 0.21, 0.19, 0.04, 0.05, 0.03);
        part(Y, 0, 0.29, 0.19, 0.05, 0.04, 0.06); part(E, -0.071, 0.32, 0.15, 0.01, 0.03, 0.03); part(E, 0.071, 0.32, 0.15, 0.01, 0.03, 0.03);
      } else {   // a black-and-white milk cow: pink nose and udder, little horns, ears, a bell and a tufted tail
        const W = 0xf7f5ef, B = 0x1e1c1a, P = 0xf0a8a0, H = 0xeee2c4, E = 0x15130f;
        part(W, 0, 0.42, 0, 0.5, 0.42, 0.95); part(B, 0.12, 0.6, 0.1, 0.27, 0.25, 0.4); part(B, -0.1, 0.55, -0.25, 0.3, 0.28, 0.3); part(B, -0.15, 0.45, 0.25, 0.22, 0.22, 0.2);
        part(W, 0, 0.62, 0.55, 0.3, 0.3, 0.32); part(B, 0.06, 0.74, 0.58, 0.19, 0.18, 0.28); part(P, 0, 0.62, 0.72, 0.26, 0.15, 0.07); part(E, -0.06, 0.69, 0.756, 0.04, 0.03, 0.01); part(E, 0.06, 0.69, 0.756, 0.04, 0.03, 0.01);
        part(E, -0.151, 0.8, 0.62, 0.01, 0.05, 0.05); part(E, 0.151, 0.8, 0.62, 0.01, 0.05, 0.05);
        part(H, -0.13, 0.92, 0.55, 0.06, 0.08, 0.05); part(H, 0.13, 0.92, 0.55, 0.06, 0.08, 0.05); part(W, -0.21, 0.82, 0.52, 0.12, 0.06, 0.08); part(W, 0.21, 0.82, 0.52, 0.12, 0.06, 0.08);
        part(0xe8b830, 0, 0.5, 0.48, 0.09, 0.1, 0.07);
        part(P, 0, 0.32, -0.22, 0.24, 0.12, 0.22); for (const [tx, tz] of [[-0.06, -0.16], [0.06, -0.16], [-0.06, -0.28], [0.06, -0.28]]) part(P, tx, 0.27, tz, 0.035, 0.06, 0.035);
        part(W, 0, 0.4, -0.49, 0.04, 0.4, 0.04); part(B, 0, 0.34, -0.5, 0.07, 0.1, 0.07);
        for (const [lx, lz] of [[-0.17, 0.32], [0.17, 0.32], [-0.17, -0.32], [0.17, -0.32]]) { part(W, lx, 0.09, lz, 0.1, 0.34, 0.1); part(B, lx, 0, lz, 0.11, 0.09, 0.11); }
      }
      grp.position.set(x, this.a.y, z); g.group.add(grp);
    }
    get x() { return this.a.x; } get z() { return this.a.z; }
    /** wander: wait a moment, then walk to a nearby spot it can reach (a pen keeps it in) */
    update(dt) {
      const P = this.stock.g.play, a = this.a, px = a.x, pz = a.z;
      if (a.path && a.path.length) P.move(a, dt, this.spec.speed);
      else if ((this.wait -= dt) <= 0) {
        this.wait = 2 + Math.random() * 6; const h = this.home, ang = Math.random() * 6.283, r = 1.2 + Math.random() * this.spec.roam, x = h.x + Math.cos(ang) * r, z = h.z + Math.sin(ang) * r;
        if (P.nav.standable(x, z)) a.path = P.nav.find(a.x, a.z, x, z, { range: 0.4, maxNodes: 1500, blocked: this.stock.blocker() }) || null;
      }
      a.y = P.nav.y(a.x, a.z); this.mesh.position.set(a.x, a.y, a.z);
      if (Math.hypot(a.x - px, a.z - pz) > 1e-4) this.mesh.rotation.y = Math.atan2(a.x - px, a.z - pz);
      this.mesh.position.y += (a.path && a.path.length) ? Math.abs(Math.sin(this.stock.clock * (this.kind === 'chicken' ? 18 : 8))) * 0.03 : 0;
    }
    dispose() { this.stock.g.group.remove(this.mesh); }
  }

  /** every animal you own, what they make, what they eat, and what hunts them */
  class Livestock {
    constructor(eco) { this.eco = eco; this.g = eco.g; this.herds = new Map(); this.clock = 0; this.scanT = 0; }
    get all() { const out = []; for (const h of this.herds.values()) out.push(...h); return out; }
    herd(p) { let h = this.herds.get(p.uid); if (!h) this.herds.set(p.uid, (h = [])); return h; }
    blocker() { const g = this.g, T = K.TILE; return (i, j) => g.gateTiles.has(i + ',' + j) || g.insideBuilding((i + 0.5) * T, (j + 0.5) * T); }
    spawn(kind, p) {
      const nav = this.g.play.nav; for (let q = 0; q < 12; q++) { const ang = Math.random() * 6.283, r = 1.6 + Math.random() * 1.5, x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r; if (nav.standable(x, z)) { const b = new Beast(this, kind, p, x, z); this.herd(p).push(b); return b; } }
      return null;
    }
    /** buy an animal for its building, paid in wheat */
    buy(p) {
      const g = this.g, kind = p.type === 'coop' ? 'chicken' : 'cow', s = KINDS[kind], h = this.herd(p);
      if (h.length >= s.max) { g.cui.toast(`This ${p.type === 'coop' ? 'coop' : 'barn'} is full (${s.max} ${kind}s).`); return false; }
      if (!this.eco.takeWheat(s.price)) { g.cui.toast(`A ${kind} costs ${s.price} wheat. Grow more wheat first.`); g.sound.play('clank'); return false; }
      if (!this.spawn(kind, p)) { this.eco.ledger(p).add('wheat', s.price); g.cui.toast('There is no room around the building for it.'); return false; }
      g.sound.play('thunk'); g.cui.toast(`You bought a ${kind} (${h.length} now).`); g.changed(); return true;
    }
    butcher(p) {
      const h = this.herd(p), b = h[h.length - 1], g = this.g; if (!b) return false;
      const got = this.eco.ledger(p).add('beef', 6); if (!got) { g.cui.toast('The barn has no room for the beef.'); return false; }
      this.remove(b); g.cui.toast(`You butchered a cow: ${got} beef in the barn.`); g.changed(); return true;
    }
    remove(b) { const h = this.herds.get(b.home.uid); if (h) { const i = h.indexOf(b); if (i >= 0) h.splice(i, 1); } b.dispose(); }
    /** once a second: lay, milk, eat */
    tick(dt) {
      for (const b of this.all) {
        const s = b.spec, l = this.eco.ledger(b.home);
        if (s.eats) { b.hunger += dt; if (b.hunger >= s.eats) { b.fed = this.eco.takeWheat(1, false); b.hunger = 0; } }
        if (!b.fed) continue; b.t += dt; if (b.t >= s.every) { b.t = 0; l.add(s.good, 1); }
      }
      if ((this.scanT -= dt) <= 0) { this.scanT = 5; this.scan(); }
    }
    update(dt) { this.clock += dt; for (const b of this.all) b.update(dt); }
    /** which animals stand where a wolf could walk up to them: a flood from their spot that never runs into a wall within 25 m */
    scan() {
      const nav = this.g.play.nav, blk = this.blocker(), seen = new Map();
      for (const b of this.all) {
        const [i0, j0] = nav.tile(b.x, b.z), key = i0 + ',' + j0; if (seen.has(key)) { b.exposed = seen.get(key); continue; }
        const vis = new Set([j0 * nav.w + i0]), q = [[i0, j0]]; let open = false;
        while (q.length && !open) {
          const [i, j] = q.pop();
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + di, nj = j + dj, k = nj * nav.w + ni; if (vis.has(k) || !nav.inside(ni, nj) || blk(ni, nj) || !nav.orth(i, j, di, dj)) continue;
            vis.add(k); if (Math.abs(ni - i0) > 50 || Math.abs(nj - j0) > 50 || vis.size > 6000) { open = true; break; } q.push([ni, nj]);
          }
        }
        b.exposed = open; seen.set(key, open);
      }
    }
    anyExposed() { return this.all.some((b) => b.exposed); }
    /** the nearest animal outside your walls, for a hungry wolf or bear */
    preyNear(a, range) { let best = null, bd = range; for (const b of this.all) { if (!b.exposed) continue; const d = Math.hypot(b.x - a.x, b.z - a.z); if (d < bd) { bd = d; best = b; } } return best; }
    /** taken by a predator */
    eaten(b, by) {
      const g = this.g, fx = g.tools.effects; this.remove(b); if (fx) fx.burst('blood', b.x, b.a.y + 0.3, b.z, 8, 1.4);
      g.cui.toast(`${by && by.bear ? 'A bear' : 'A wolf'} took one of your ${b.kind}s! Keep your animals inside walls.`); g.sound.play('hit'); g.changed();
    }
    tidy(live) { for (const [uid, h] of this.herds) if (!live.has(uid)) { for (const b of h) b.dispose(); this.herds.delete(uid); } }
    toJSON() { const o = {}; for (const [uid, h] of this.herds) if (h.length) o[uid] = h.map((b) => [b.kind, +b.x.toFixed(2), +b.z.toFixed(2)]); return o; }
    restore(o) { for (const [uid, list] of Object.entries(o || {})) { const p = this.g.castle.pieces.find((q) => q.uid === +uid); if (!p) continue; for (const [kind, x, z] of list) this.herd(p).push(new Beast(this, kind, p, x, z)); } }
    dispose() { for (const b of this.all) b.dispose(); this.herds.clear(); }
  }

  class Economy {
    constructor(game) { this.g = game; this.ledgers = new Map(); this.carts = []; this.piles = new Map(); this.fields = new Fields(this); this.t = 0; this.drawT = 0; this.vaults = new Map(); this.stock = new K.Livestock(this); }
    get pieces() { return this.g.castle.pieces; }
    of(type) { return this.pieces.filter((p) => p.type === type); }
    ledger(p) {
      let l = this.ledgers.get(p.uid);
      if (!l) { l = p.type === 'silo' ? new Ledger(SILO_CAP, ['wheat']) : p.type === 'market' ? new Ledger(MARKET_CAP) : p.type === 'coop' ? new Ledger(60, ['egg']) : p.type === 'barn' ? new Ledger(80, ['milk', 'beef', 'wheat']) : new Ledger(FARM_CAP); this.ledgers.set(p.uid, l); }
      return l;
    }
    nearestFarm(x, z) { let best = null, bd = FIELD_REACH + 1; for (const p of this.of('farm')) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } } return best; }
    /** wheat you have anywhere: your purse, the silo, the market, the farms */
    wheatHeld() { let n = this.g.castle.amount('wheat'); for (const t of ['silo', 'market', 'farm', 'barn']) for (const p of this.of(t)) n += this.ledger(p).amount('wheat'); return n; }
    takeWheat(n, purse = true) {
      if (this.wheatHeld() - (purse ? 0 : this.g.castle.amount('wheat')) < n) return false; const c = this.g.castle;
      if (purse) { const k = Math.min(n, c.amount('wheat')); c.stores.wheat -= k; n -= k; }
      for (const t of ['barn', 'silo', 'market', 'farm']) for (const p of this.of(t)) if (n > 0) n -= this.ledger(p).take('wheat', n);
      return true;
    }
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
      if (this.t <= 0) { this.t = 1; this.fields.grow(1); this.stock.tick(1); this.dispatch(); this.tidy(); }
      this.stock.update(dt);
      if (this.drawT <= 0) { this.drawT = 1; this.fields.draw(); this.dress(); }
    }
    /** send a cart from any farm with a load waiting (to a silo with room, else the market) */
    dispatch() {
      for (const f of this.of('farm')) {
        const l = this.ledger(f), w = l.amount('wheat'); if (w < CART_LOAD || this.carts.some((c) => c.from === f)) continue;
        const dest = this.of('silo').filter((s) => this.ledger(s).room('wheat') >= CART_LOAD).concat(this.of('market'))[0]; if (!dest) continue;
        this.carts.push(new K.Cart(this, f, dest, 'wheat', l.take('wheat', CART_LOAD)));
      }
      const mk = this.of('market')[0];
      if (mk) for (const b of this.of('coop').concat(this.of('barn'))) {   // eggs, milk and beef go to the market by the cartload
        if (this.carts.some((c) => c.from === b)) continue; const l = this.ledger(b);
        for (const good of ['egg', 'milk', 'beef']) if (l.amount(good) >= CART_LOAD) { this.carts.push(new K.Cart(this, b, mk, good, l.take(good, CART_LOAD))); break; }
      }
      for (const s of this.of('silo')) {   // a nearly full silo sends its surplus to the market
        const l = this.ledger(s), m = this.of('market')[0]; if (!m || l.amount('wheat') < SILO_CAP - CART_LOAD || this.carts.some((c) => c.from === s)) continue;
        this.carts.push(new K.Cart(this, s, m, 'wheat', l.take('wheat', CART_LOAD)));
      }
    }
    /** a building that was taken down: its stock spills as pickups, its ledger goes */
    tidy() {
      const live = new Set(this.pieces.map((p) => p.uid));
      this.stock.tidy(live);
      for (const [uid, l] of this.ledgers) if (!live.has(uid)) { this.ledgers.delete(uid); const v = this.piles.get(uid); if (v) { this.g.group.remove(v.grp); this.piles.delete(uid); } }
    }
    /* ---------- seeing it ---------- */
    /** the market's piles and the silo's gauge follow what is in them */
    dress() {
      for (const p of this.of('market').concat(this.of('silo'))) {
        const l = this.ledger(p), sig = JSON.stringify(l.goods); let v = this.piles.get(p.uid); if (v && v.sig === sig) continue;
        if (v) this.g.group.remove(v.grp); const k = new K.VoxKit(), grp = new THREE.Group();
        if (p.type === 'silo') { const f = Math.min(1, l.amount('wheat') / SILO_CAP); k.box('hay', 0, 0.1, 0.78, 0.18, Math.max(0.05, 3.0 * f), 0.04); k.box('iron', 0, 0.1, 0.8, 0.24, 3.0, 0.02); }
        else {   // each stall's goods heap up on its counter and spill onto the street as the stock grows
          const SECT = [[-4.0, ['wheat', 'bread']], [-1.0, ['beef', 'egg', 'milk', 'food']], [1.0, ['arrow', 'gold']], [4.0, ['wood', 'stone', 'iron', 'dirt']]];
          const MAT = { wheat: 'hay', bread: 'bread', beef: 'food', egg: 'linen', milk: 'plaster', food: 'food', arrow: 'wood', gold: 'brass', wood: 'bark', stone: 'ashlar', iron: 'iron', dirt: 'soot' };
          for (const [cx, goods] of SECT) {
            let slot = 0; for (const good of goods) {
              const n = l.amount(good); if (n <= 0) continue; const stacks = Math.min(9, Math.ceil(n / 12));
              for (let q = 0; q < stacks; q++, slot++) { const on = slot < 6, x = cx - 0.55 + (slot % 3) * 0.55, z = on ? -0.2 + Math.floor(slot / 3) * 0.32 : 0.65 + Math.floor((slot - 6) / 3) * 0.3, y = on ? 0.78 : 0; k.box(MAT[good] || 'crate', x, y, z, 0.26, 0.2, 0.24, q * 0.4); }
            }
          }
        }
        for (const m of k.meshes(this.g.R.bmats)) grp.add(m); grp.position.set(p.x, this.g.play.nav.y(p.x, p.z), p.z); grp.rotation.y = p.rot || 0; this.g.group.add(grp);
        this.piles.set(p.uid, { grp, sig });
      }
    }
    /** a two-purse view of a building's store (the purse screen works on it like a chest) */
    vaultFor(p) { const l = this.ledger(p); let v = this.vaults.get(p.uid); if (!v) { v = { res: l.goods, items: {}, weapons: [] }; this.vaults.set(p.uid, v); } v.res = l.goods; return v; }
    /* ---------- saving ---------- */
    toJSON() { const led = {}; for (const [uid, l] of this.ledgers) led[uid] = l.goods; return { ledgers: led, herds: this.stock.toJSON(), fields: [...this.fields.tiles.values()].map((t) => [t.i, t.j, Math.round(t.age)]) }; }
    restore(x) {
      if (!x) return; for (const [uid, goods] of Object.entries(x.ledgers || {})) { const p = this.pieces.find((q) => q.uid === +uid); if (p) Object.assign(this.ledger(p).goods, goods); }
      if (x.herds) this.stock.restore(x.herds);
      const d = this.g.play.doc; for (const [i, j, age] of x.fields || []) { this.fields.add(i, j, age); const k = j * d.w + i; d.terrain[k] = K.T.DIRT; }
      if ((x.fields || []).length) this.g.R.tilesChanged(0, 0, d.w, d.h);
    }
    dispose() { this.stock.dispose(); this.fields.dispose(); for (const c of this.carts) c.dispose(); for (const v of this.piles.values()) this.g.group.remove(v.grp); }
  }

  Object.assign(K, { Ledger, Fields, Economy, Livestock, Beast, LIVESTOCK: KINDS });
})(typeof window !== 'undefined' ? window : globalThis);
