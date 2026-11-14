/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · items: pixel icons drawn in code (same ramps + dark outline as the sprites), the item
   catalogue, and PlayerState: the one API for inventory, equipment, purse, HP, XP and outfit. */
(function (G) {
  const K = G.K;
  const { PixelBuffer, ramp, PAL } = K;
  const OUT = K.hex('#10131c');
  const R = {
    green: ramp('#0e1a12', '#1f3a24', '#2f5a33', '#4a8044', '#74a85a', '#a8d27a'),
    blue: ramp('#0b1a2a', '#163450', '#28597e', '#3f82aa', '#7fb6d6', '#cfe8f5'),
    rust: ramp('#2a1006', '#5a240c', '#8c4418', '#c06a2a', '#e09a4a'),
    potion: ramp('#2a0a12', '#5c1424', '#9c2234', '#d84a4a', '#ff9a8a'),
    glass: ramp('#3a4458', '#8d9bb2', '#c4cfdd', '#f3f7fc'),
    bread: ramp('#2a1608', '#5a3414', '#8c5a26', '#b8823c', '#e0b06a'),
    bubble: ramp('#3a4458', '#c4cfdd', '#f3f7fc', '#ffffff'),
  };

  /* a 16x16 pixel canvas with a few primitives and an automatic dark outline */
  class IconCanvas {
    constructor(n = 16) { this.n = n; this.buf = new PixelBuffer(n, n); }
    px(x, y, c) { if (c) this.buf.set(x | 0, y | 0, c); return this; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); return this; }
    line(x0, y0, x1, y1, c, th = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n); this.rect(x - ((th - 1) >> 1), y - ((th - 1) >> 1), th, th, c); }
      return this;
    }
    disc(cx, cy, r, pal, light = true) {
      for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / r; if (d > 1) continue;
        const l = light ? Math.max(0, Math.min(0.999, 0.62 - (dx + dy) / (r * 2.6) - d * 0.18)) : 0.5;
        this.px(x, y, pal[Math.max(1, Math.floor(l * pal.length))]);
      }
      return this;
    }
    /* shaded polygon: pts [[x,y]...], lit from the upper left like the sprites */
    poly(pts, pal) {
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
        if (!IconCanvas.inside(pts, x + 0.5, y + 0.5)) continue;
        const t = 1 - ((x - x0) / (x1 - x0 + 1) * 0.5 + (y - y0) / (y1 - y0 + 1) * 0.5);
        this.px(x, y, pal[Math.max(1, Math.min(pal.length - 1, Math.floor(t * (pal.length - 1) + 0.6 + (K.bayer(x, y) - 0.5) * 0.5)))]);
      }
      return this;
    }
    static inside(pts, x, y) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
    outline() {
      const b = this.buf, n = this.n, add = [];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!b.alpha(x, y) && (b.alpha(x - 1, y) || b.alpha(x + 1, y) || b.alpha(x, y - 1) || b.alpha(x, y + 1))) add.push([x, y]);
      add.forEach(([x, y]) => b.set(x, y, OUT));
      return this;
    }
  }

  /* every icon is a tiny drawing; ids double as cursor names */
  const DRAW = {
    sword(c) { c.line(3, 12, 11, 4, PAL.steel[5], 2).line(4, 12, 12, 4, PAL.steel[3]).px(12, 3, PAL.steel[6]).line(2, 9, 6, 13, PAL.gold[3], 1).line(3, 9, 7, 13, PAL.gold[2]).line(1, 14, 3, 12, PAL.leather[3], 2).px(1, 15, PAL.gold[3]); },
    axe(c) { c.line(3, 14, 11, 4, PAL.wood[4], 2).line(4, 14, 12, 4, PAL.wood[2]); c.poly([[8, 2], [13, 1], [15, 5], [13, 8], [11, 6]], PAL.steel).px(14, 3, PAL.steel[6]); },
    pickaxe(c) { c.line(4, 14, 10, 5, PAL.wood[4], 2).line(5, 14, 11, 5, PAL.wood[2]); c.line(3, 4, 7, 2, PAL.steel[5], 2).line(7, 2, 11, 3, PAL.steel[4], 2).line(11, 3, 14, 7, PAL.steel[3], 2).px(3, 5, PAL.steel[2]).px(14, 8, PAL.steel[2]); },
    rod(c) { c.line(2, 14, 12, 2, PAL.wood[4]).line(3, 14, 12, 3, PAL.wood[2]).line(12, 2, 13, 11, PAL.snow[3]).px(13, 12, PAL.steel[5]).px(12, 13, PAL.steel[4]).px(3, 12, PAL.red[3]).px(4, 11, PAL.red[4]); },
    shield(c) { c.disc(8, 8, 6.5, PAL.wood).line(8, 2, 8, 14, PAL.steel[2]).line(2, 8, 14, 8, PAL.steel[2]).disc(8, 8, 1.8, PAL.gold); },
    hood(c) { c.poly([[3, 14], [3, 7], [6, 3], [10, 3], [13, 7], [13, 14], [10, 12], [6, 12]], PAL.whiteFur).poly([[6, 12], [6, 8], [8, 6], [10, 8], [10, 12]], PAL.hoodIn.concat(PAL.hoodIn)); },
    helm(c) { c.poly([[3, 13], [3, 7], [5, 3], [11, 3], [13, 7], [13, 13]], PAL.steel).rect(4, 8, 8, 1, PAL.steel[0]).rect(7, 9, 2, 4, PAL.steel[1]).px(6, 4, PAL.steel[6]); },
    dress(c) { c.poly([[6, 2], [10, 2], [11, 6], [14, 14], [2, 14], [5, 6]], PAL.red).rect(5, 6, 6, 1, PAL.gold[3]).px(8, 3, PAL.red[1]); },
    mail(c) { c.poly([[4, 3], [12, 3], [15, 7], [12, 8], [12, 14], [4, 14], [4, 8], [1, 7]], PAL.mail); for (let y = 4; y < 14; y += 2) for (let x = 3 + (y % 4 ? 1 : 0); x < 14; x += 2) if (c.buf.alpha(x, y)) c.px(x, y, PAL.steel[4]); },
    cloak(c) { c.poly([[5, 2], [11, 2], [13, 6], [14, 14], [9, 13], [7, 14], [2, 14], [3, 6]], PAL.fur).rect(5, 2, 6, 2, PAL.whiteFur[4]).px(8, 4, PAL.gold[3]); },
    boots(c) { c.poly([[2, 6], [6, 6], [6, 12], [8, 13], [8, 15], [2, 15]], PAL.leather).poly([[9, 4], [13, 4], [13, 10], [15, 11], [15, 13], [9, 13]], PAL.leather).rect(2, 5, 4, 2, PAL.whiteFur[4]).rect(9, 3, 4, 2, PAL.whiteFur[4]); },
    charm(c) { c.line(4, 1, 8, 5, PAL.gold[3]).line(12, 1, 8, 5, PAL.gold[3]).poly([[8, 5], [12, 9], [8, 15], [4, 9]], PAL.crystal).px(7, 8, PAL.crystal[6]); },
    ore(c) { c.poly([[2, 13], [3, 7], [7, 3], [12, 4], [14, 9], [13, 14]], PAL.mail.concat([PAL.steel[4]])); [[6, 7], [10, 9], [8, 11], [11, 6], [5, 11]].forEach(([x, y]) => c.px(x, y, R.rust[3]).px(x + 1, y, R.rust[2])); c.px(9, 6, R.rust[4]); },
    log(c) { c.poly([[2, 6], [12, 3], [14, 9], [4, 13]], PAL.bark).disc(13, 6, 3.2, PAL.wood, false).px(13, 6, PAL.wood[2]).px(12, 5, PAL.wood[5]); },
    herb(c) { c.line(8, 15, 8, 6, R.green[2]); c.poly([[8, 6], [4, 2], [3, 6]], R.green).poly([[8, 8], [13, 4], [13, 9]], R.green).poly([[8, 11], [3, 9], [5, 13]], R.green).px(4, 3, R.green[5]).px(12, 5, R.green[5]).px(8, 4, R.blue[5]); },
    fish(c) { c.poly([[1, 8], [5, 4], [10, 4], [13, 7], [13, 9], [10, 12], [5, 12]], R.blue).poly([[12, 8], [15, 4], [15, 12]], R.blue).px(4, 7, OUT).px(7, 5, R.blue[5]); },
    potion(c) { c.rect(6, 1, 4, 2, PAL.wood[3]).rect(7, 3, 2, 2, R.glass[2]).disc(8, 10, 5, R.potion).px(6, 8, R.glass[3]).px(6, 9, R.glass[3]); },
    bread(c) { c.poly([[1, 11], [3, 6], [8, 4], [13, 6], [15, 11], [13, 13], [3, 13]], R.bread).line(5, 6, 6, 9, R.bread[1]).line(8, 5, 9, 8, R.bread[1]).line(11, 6, 12, 9, R.bread[1]); },
    bone(c) { c.line(3, 12, 12, 3, PAL.bone[3], 2).disc(3, 13, 1.8, PAL.bone).disc(2, 11, 1.6, PAL.bone).disc(13, 3, 1.8, PAL.bone).disc(11, 2, 1.6, PAL.bone); },
    dust(c) { c.poly([[2, 14], [5, 8], [8, 6], [11, 8], [14, 14]], R.blue.slice(2)).px(7, 9, PAL.crystal[6]).px(10, 11, PAL.crystal[5]).px(5, 12, PAL.crystal[6]); },
    tusk(c) { c.poly([[3, 14], [2, 9], [4, 4], [8, 1], [7, 4], [6, 9], [7, 14]], PAL.bone).px(4, 6, PAL.bone[4]); },
    coin(c) { c.disc(8, 8, 6, PAL.gold).rect(7, 5, 2, 6, PAL.gold[1]).px(6, 5, PAL.gold[4]); },
    bag(c) { c.poly([[3, 15], [2, 10], [5, 6], [11, 6], [14, 10], [13, 15]], PAL.leather).rect(6, 3, 4, 3, PAL.leather[3]).rect(5, 6, 6, 1, PAL.gold[2]).px(8, 10, PAL.gold[4]); },
    boot(c) { c.poly([[4, 2], [9, 2], [9, 10], [14, 11], [14, 15], [4, 15]], PAL.leather).rect(4, 2, 5, 2, PAL.whiteFur[4]); },
    bubble(c) { c.poly([[1, 3], [15, 3], [15, 11], [7, 11], [3, 15], [4, 11], [1, 11]], R.bubble).rect(4, 6, 2, 2, PAL.steel[1]).rect(7, 6, 2, 2, PAL.steel[1]).rect(10, 6, 2, 2, PAL.steel[1]); },
    hand(c) { c.poly([[4, 15], [3, 8], [5, 7], [6, 9], [6, 2], [8, 2], [8, 7], [10, 6], [12, 7], [13, 9], [12, 15]], PAL.skinPale); },
    no(c) { c.line(3, 3, 12, 12, PAL.red[4], 3).line(12, 3, 3, 12, PAL.red[4], 3); },
    eye(c) { c.poly([[1, 8], [5, 4], [11, 4], [15, 8], [11, 12], [5, 12]], R.bubble).disc(8, 8, 2.8, R.blue).px(8, 8, OUT); },
  };

  class Icons {
    static base(id) {
      if (Icons.cache.has(id)) return Icons.cache.get(id);
      const c = new IconCanvas(16); (DRAW[id] || DRAW.bag)(c); c.outline();
      const cv = document.createElement('canvas'); cv.width = cv.height = 16;
      cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(c.buf.data), 16, 16), 0, 0);
      Icons.cache.set(id, cv); return cv;
    }
    static canvas(id, scale = 2) {
      const b = Icons.base(id), c = document.createElement('canvas'); c.width = c.height = 16 * scale;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(b, 0, 0, c.width, c.height); return c;
    }
    static url(id, scale = 2) { const k = id + '@' + scale; if (!Icons.urls.has(k)) Icons.urls.set(k, Icons.canvas(id, scale).toDataURL()); return Icons.urls.get(k); }
    static img(id, scale = 2, cls = '') { return `<img class="ico ${cls}" src="${Icons.url(id, scale)}" width="${16 * scale}" height="${16 * scale}" alt="">`; }
    static cursor(id, fallback = 'pointer') { return `url(${Icons.url(id, 2)}) 4 4, ${fallback}`; }
    static has(id) { return !!DRAW[id]; }
  }
  Icons.cache = new Map(); Icons.urls = new Map(); Icons.DRAW = DRAW;

  /* ---------- item catalogue ---------- */
  const SLOTS = ['main', 'off', 'head', 'body', 'cloak', 'boots', 'trinket'];
  const SLOT_NAMES = { main: 'Main hand', off: 'Off hand', head: 'Head', body: 'Body / dress', cloak: 'Cloak', boots: 'Boots', trinket: 'Trinket' };
  const ITEMS = {
    sword: { name: 'Iron sword', slot: 'main', atk: 6, value: 40, desc: 'A plain, honest blade.' },
    axe: { name: "Woodcutter's axe", slot: 'main', atk: 3, tool: 'chop', value: 20, desc: 'Fells pines. Fells ghouls, slowly.' },
    pickaxe: { name: 'Pickaxe', slot: 'main', atk: 2, tool: 'mine', value: 22, desc: 'For ore veins in the rime-rock.' },
    rod: { name: 'Fishing rod', slot: 'main', atk: 0, tool: 'fish', value: 15, desc: 'Line, hook and patience.' },
    shield: { name: 'Round shield', slot: 'off', def: 3, value: 30, desc: 'Oak planks and an iron boss.' },
    hood: { name: 'Fur hood', slot: 'head', def: 1, value: 12, desc: 'Keeps the frost off your ears.' },
    helm: { name: 'Iron helm', slot: 'head', def: 3, value: 45, desc: 'Dented, but it holds.' },
    dress: { name: 'Wool dress', slot: 'body', def: 1, hp: 5, value: 18, desc: 'Red wool, gold hem. Warm.' },
    mail: { name: 'Mail shirt', slot: 'body', def: 4, value: 60, desc: 'Riveted rings over quilted wool.' },
    cloak: { name: 'Wolf-fur cloak', slot: 'cloak', def: 1, hp: 5, value: 25, desc: 'Heavy, warm, smells of wolf.' },
    boots: { name: 'Fur boots', slot: 'boots', def: 1, speed: 0.08, value: 10, desc: 'Sure-footed on ice.' },
    charm: { name: 'Frost charm', slot: 'trinket', hp: 15, value: 50, desc: 'A rime crystal on a gold chain. +15 max HP.' },
    ore: { name: 'Iron ore', stack: 50, value: 6, desc: 'Raw ore. A blacksmith could use it.' },
    log: { name: 'Pine log', stack: 50, value: 3, desc: 'Resinous pine. Burns hot.' },
    herb: { name: 'Frostleaf', stack: 50, value: 4, heal: 6, desc: 'Bitter leaf. Eat to heal 6 HP.' },
    fish: { name: 'Ice fish', stack: 20, value: 5, heal: 12, desc: 'Pale and oily. Eat to heal 12 HP.' },
    potion: { name: 'Healing draught', stack: 10, value: 20, heal: 35, desc: 'Drink to heal 35 HP.' },
    bread: { name: 'Rye bread', stack: 20, value: 4, heal: 10, desc: 'Dense and filling. Heals 10 HP.' },
    bone: { name: 'Old bone', stack: 50, value: 2, desc: 'Gnawed. Not by you.' },
    dust: { name: 'Rime dust', stack: 50, value: 8, desc: 'What is left of a frost ghoul.' },
    tusk: { name: 'Troll tusk', stack: 10, value: 40, desc: 'A trophy. Merchants pay well.' },
  };
  for (const [id, d] of Object.entries(ITEMS)) { d.id = id; d.icon = d.icon || id; d.stack = d.stack || 1; }

  class ItemCatalog {
    constructor(defs = ITEMS) { this.defs = defs; }
    get(id) { return this.defs[id] || null; }
    all() { return Object.values(this.defs); }
    register(id, def) { def.id = id; def.icon = def.icon || id; def.stack = def.stack || 1; this.defs[id] = def; return def; }
    describe(id) {
      const d = this.get(id); if (!d) return '';
      const s = []; if (d.atk) s.push('+' + d.atk + ' attack'); if (d.def) s.push('+' + d.def + ' defence'); if (d.hp) s.push('+' + d.hp + ' max HP'); if (d.speed) s.push('+' + Math.round(d.speed * 100) + '% speed'); if (d.tool) s.push('tool: ' + d.tool);
      return s.join(' · ');
    }
  }

  /* ---------- player state: the single API the play mode (and future furniture) talks to ---------- */
  class PlayerState {
    constructor(catalog, opts = {}) {
      this.items = catalog; this.bagSize = opts.bagSize || 24;
      this.bag = new Array(this.bagSize).fill(null);
      this.equipment = {}; SLOTS.forEach((s) => (this.equipment[s] = null));
      this.coins = 0; this.level = 1; this.xp = 0; this.outfitId = opts.outfit || 'warden'; this.name = opts.name || 'You';
      this.listeners = new Set(); this.hp = this.stats().hpMax;
    }
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit(what, data) { for (const f of this.listeners) { try { f(what, data); } catch (e) { console.error(e); } } }
    /* stats derive from level + equipment */
    stats() {
      let atk = 3 + this.level, def = 0, hp = 0, speed = 1;
      for (const s of SLOTS) { const it = this.equipment[s] && this.items.get(this.equipment[s]); if (!it) continue; atk += it.atk || 0; def += it.def || 0; hp += it.hp || 0; speed += it.speed || 0; }
      return { atk, def, hpMax: 50 + (this.level - 1) * 10 + hp, speed, level: this.level };
    }
    xpNext() { return 30 + (this.level - 1) * 25; }
    gainXp(n) {
      this.xp += n; let up = false;
      while (this.xp >= this.xpNext()) { this.xp -= this.xpNext(); this.level++; up = true; }
      if (up) { this.hp = this.stats().hpMax; this.emit('level', this.level); }
      this.emit('xp', n); return up;
    }
    /* ---- bag ---- */
    count(id) { let n = 0; for (const s of this.bag) if (s && s.id === id) n += s.n; return n; }
    freeSlots() { return this.bag.filter((s) => !s).length; }
    /* returns how many could NOT be added (bag full) */
    addItem(id, n = 1) {
      const d = this.items.get(id); if (!d || n <= 0) return n;
      let left = n;
      for (const s of this.bag) { if (!left) break; if (s && s.id === id && s.n < d.stack) { const k = Math.min(left, d.stack - s.n); s.n += k; left -= k; } }
      for (let i = 0; i < this.bag.length && left; i++) if (!this.bag[i]) { const k = Math.min(left, d.stack); this.bag[i] = { id, n: k }; left -= k; }
      if (left < n) this.emit('bag', { id, n: n - left });
      return left;
    }
    canAdd(id, n = 1) { const d = this.items.get(id); if (!d) return false; let room = 0; for (const s of this.bag) room += !s ? d.stack : s.id === id ? d.stack - s.n : 0; return room >= n; }
    removeItem(id, n = 1) {
      if (this.count(id) < n) return false;
      for (let i = this.bag.length - 1; i >= 0 && n; i--) { const s = this.bag[i]; if (!s || s.id !== id) continue; const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) this.bag[i] = null; }
      this.emit('bag'); return true;
    }
    takeFromBag(index, n = 1) { const s = this.bag[index]; if (!s) return null; const k = Math.min(n, s.n); s.n -= k; const id = s.id; if (!s.n) this.bag[index] = null; this.emit('bag'); return { id, n: k }; }
    moveBag(from, to) {
      if (from === to) return;
      const a = this.bag[from], b = this.bag[to];
      if (a && b && a.id === b.id) { const d = this.items.get(a.id), k = Math.min(a.n, d.stack - b.n); b.n += k; a.n -= k; if (!a.n) this.bag[from] = null; }
      else { this.bag[from] = b; this.bag[to] = a; }
      this.emit('bag');
    }
    hasTool(tool) {
      for (const s of SLOTS) { const it = this.equipment[s] && this.items.get(this.equipment[s]); if (it && it.tool === tool) return true; }
      return this.bag.some((s) => s && (this.items.get(s.id) || {}).tool === tool);
    }
    /* ---- equipment ---- */
    canEquip(id) { const d = this.items.get(id); return !!(d && d.slot); }
    equipFromBag(index) {
      const s = this.bag[index]; if (!s) return false; const d = this.items.get(s.id); if (!d || !d.slot) return false;
      const prev = this.equipment[d.slot];
      this.equipment[d.slot] = s.id; s.n -= 1; if (!s.n) this.bag[index] = null;
      if (prev) { if (!this.bag[index]) this.bag[index] = { id: prev, n: 1 }; else if (this.addItem(prev, 1)) { this.bag[index] = s; s.n++; this.equipment[d.slot] = prev; return false; } }
      this.clampHp(); this.emit('equip', { slot: d.slot, id: s.id }); return true;
    }
    equip(id) { const i = this.bag.findIndex((s) => s && s.id === id); return i >= 0 && this.equipFromBag(i); }
    unequip(slot, toIndex) {
      const id = this.equipment[slot]; if (!id) return false;
      if (toIndex != null && !this.bag[toIndex]) this.bag[toIndex] = { id, n: 1 };
      else if (this.addItem(id, 1)) return false;
      this.equipment[slot] = null; this.clampHp(); this.emit('equip', { slot, id: null }); return true;
    }
    /* ---- consumables / health ---- */
    useFromBag(index) {
      const s = this.bag[index]; if (!s) return null; const d = this.items.get(s.id);
      if (d.slot) return this.equipFromBag(index) ? 'equipped' : null;
      if (d.heal) { if (this.hp >= this.stats().hpMax) return 'full'; this.takeFromBag(index, 1); const h = this.heal(d.heal); this.emit('use', { id: d.id, heal: h }); return 'healed'; }
      return null;
    }
    heal(n) { const m = this.stats().hpMax, before = this.hp; this.hp = Math.min(m, this.hp + n); if (this.hp !== before) this.emit('hp', this.hp - before); return this.hp - before; }
    hurt(n) { const before = this.hp; this.hp = Math.max(0, this.hp - n); this.emit('hp', this.hp - before); return this.hp <= 0; }
    healFull() { return this.heal(this.stats().hpMax); }
    clampHp() { this.hp = Math.min(this.hp, this.stats().hpMax); }
    get alive() { return this.hp > 0; }
    /* ---- purse ---- */
    addCoins(n) { this.coins += n; this.emit('coins', n); }
    spendCoins(n) { if (this.coins < n) return false; this.coins -= n; this.emit('coins', -n); return true; }
    /* ---- outfit (the sprite the player is drawn with; a wardrobe can change it) ---- */
    get outfit() { return this.outfitId; }
    setOutfit(spriteId) { if (spriteId === this.outfitId) return; this.outfitId = spriteId; this.emit('outfit', spriteId); }
    toJSON() { return { bag: this.bag, equipment: this.equipment, coins: this.coins, level: this.level, xp: this.xp, hp: this.hp, outfit: this.outfitId }; }
    load(o) { if (!o) return this; Object.assign(this, { bag: o.bag || this.bag, equipment: Object.assign(this.equipment, o.equipment), coins: o.coins | 0, level: o.level || 1, xp: o.xp | 0, outfitId: o.outfit || this.outfitId }); this.hp = Math.min(o.hp || 1, this.stats().hpMax); this.emit('load'); return this; }
  }

  Object.assign(K, { Icons, IconCanvas, ItemCatalog, PlayerState, ITEMS, SLOTS, SLOT_NAMES });
})(typeof window !== 'undefined' ? window : globalThis);
