/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead World Builder · buildings: world format v2 (buildings as objects of kind 'building'),
   footprint/room layout, wall edges with doors and windows, walkability, and the four prefabs.
   Everything here is plain data + logic (no THREE), so play mode and tests can use it headless. */
(function (G) {
  const K = G.K;
  const TILE = K.TILE || 0.5;

  const WALLS = { timber: 'Timber frame', stone: 'Stone', plaster: 'Plaster' };
  const ROOF_STYLES = { gable: 'Gable', hip: 'Hip' };
  const ROOF_MATERIALS = { thatch: 'Thatch', slate: 'Slate', shingle: 'Shingle', tiles: 'Clay tiles' };
  /* sign icons a building can hang by its door (drawn by K.SignIcons in 73-furniture.js) */
  const SIGN_ICONS = ['bread', 'anvil', 'horse', 'horseshoe', 'cleaver', 'ham', 'potion', 'book', 'scales', 'coins', 'wheat', 'egg', 'sword', 'shield', 'logs', 'home'];
  /* the look of each prefab: colours, sign and props by the door. Filled in by BuildingSpec.normalize when a spec
     of that prefab leaves a field out, so saved worlds and the player's cottage (98-hut-world.js) pick it up too.
       wallColor  tint of the wall infill (hex or a BuildingMaterials palette key)   trim  timber framing / corners
       doorColor, shutterColor   roof.color tints the roof (tiles take any colour)  roof.snow true | 'light' | false
       sign   { icon, board, text, textColor, emblem }   a hanging sign by the main door (+ a big emblem on the ridge)
       props  [{ type, side:'l'|'r', at, out, rot }]  furniture types drawn outside the main door (decor only: not walkable data)
       bunting [colours]  pennants along the front eave   awning [colourA, colourB]  striped awning over the main door
       flowerBoxes  window boxes with flowers   fill  interior fill light strength (0 = none) */
  const LOOKS = {
    cottage: { wallColor: '#c9bfa8', trim: '#3e2a1a', doorColor: 'paintRed', shutterColor: 'paintGreen', roof: { snow: 'light' }, flowerBoxes: true, fill: 1,
      props: [{ type: 'woodpile', side: 'l', at: 0 }, { type: 'bench', side: 'r', at: 0 }] },
    smithy: { wallColor: '#8a847b', trim: '#2c2a2a', doorColor: 'ironDark', shutterColor: 'ironDark', roof: { snow: 'light' }, fill: 1,
      sign: { icon: 'anvil', board: 'signBoard', emblem: true }, props: [{ type: 'forge', side: 'l', at: 0 }, { type: 'anvil', side: 'r', at: 1 }, { type: 'quench_tub', side: 'r', at: 2 }] },
    stable: { wallColor: '#6e4c33', trim: '#3a2818', doorColor: 'paintRed', shutterColor: 'paintRed', roof: { snow: 'light' }, fill: 1,
      sign: { icon: 'horse', emblemIcon: 'horseshoe', board: 'paintWhite', emblem: true }, props: [{ type: 'hay_bale', side: 'l', at: 0 }, { type: 'hay_bale', side: 'l', at: 1 }, { type: 'trough', side: 'r', at: 0 }] },
    market_hall: { wallColor: '#b8ab8c', trim: '#3e2a1a', doorColor: 'paintBlue', shutterColor: 'paintBlue', roof: { snow: 'light' }, fill: 1.2,
      sign: { icon: 'scales', board: 'paintBlue', text: 'MARKET', textColor: '#d8b45a', emblem: true }, bunting: ['#7c2f27', '#b08d3e', '#35496b', '#7c2f27', '#b08d3e'], awning: ['#7c2f27', '#cbc2ae'] },
    bakery: { wallColor: '#c6baa0', trim: '#4a3220', doorColor: 'woodLight', shutterColor: 'paintOrange', roof: { snow: 'light' }, flowerBoxes: true, fill: 1,
      sign: { icon: 'bread', board: 'canvas', emblem: true }, awning: ['#94552c', '#cbc2ae'], props: [{ type: 'flour_sack', side: 'l', at: 0 }, { type: 'flour_sack', side: 'l', at: 1 }, { type: 'bread_rack', side: 'r', at: 0 }] },
    butcher: { wallColor: '#c2b9a6', trim: '#3e2a1a', doorColor: 'paintRed', shutterColor: 'paintRed', roof: { snow: 'light' }, fill: 1,
      sign: { icon: 'cleaver', board: 'paintWhite', emblem: true }, awning: ['#7c2f27', '#cbc2ae'], props: [{ type: 'chopping_block', side: 'r', at: 0 }, { type: 'barrel', side: 'l', at: 0 }, { type: 'crate', side: 'l', at: 1 }] },
    library: { wallColor: '#9a958a', trim: '#2e2420', doorColor: 'paintPurple', shutterColor: 'paintPurple', roof: { snow: 'light' }, fill: 1.1,
      sign: { icon: 'potion', board: 'paintPurple', emblem: true }, props: [{ type: 'potion_crate', side: 'l', at: 0 }, { type: 'cauldron_small', side: 'r', at: 0 }] },
    bunkhouse: { wallColor: '#b9a888', trim: '#3e2a1a', doorColor: 'paintGreen', shutterColor: 'paintGreen', roof: { snow: 'light' }, fill: 1,
      sign: { icon: 'home', board: 'signBoard', emblem: false }, props: [{ type: 'woodpile', side: 'l', at: 0 }, { type: 'bench', side: 'r', at: 0 }] },
    keep: { trim: '#3a2a1c', roof: { snow: true }, fill: 1 },
  };
  const isColor = (v) => typeof v === 'string' && /^(#[0-9a-fA-F]{6}|[a-zA-Z]+)$/.test(v);
  const FLOORS = { planks: 'Floorboards', flagstone: 'Flagstones', straw: 'Straw' };
  const ROOM_TYPES = {
    hall: { name: 'Hall', floor: 'flagstone' },
    bedroom: { name: 'Bedroom', floor: 'planks' },
    armory: { name: 'Armory', floor: 'flagstone' },
    kitchen: { name: 'Kitchen', floor: 'flagstone', chimney: true },
    stable: { name: 'Stable', floor: 'straw' },
    smithy: { name: 'Smithy', floor: 'flagstone', chimney: true },
    storage: { name: 'Storage', floor: 'planks' },
    wardrobe: { name: 'Wardrobe room', floor: 'planks' },
    tack: { name: 'Tack room', floor: 'planks' },
    bakery: { name: 'Bakehouse', floor: 'flagstone', chimney: true },
    butcher: { name: 'Butchery', floor: 'flagstone' },
    shop: { name: 'Shop', floor: 'planks' },
    library: { name: 'Library', floor: 'planks' },
    lab: { name: 'Alchemy lab', floor: 'flagstone' },
  };
  const SIDES = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
  const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };

  /* ---------- footprint ---------- */
  class Footprint {
    /* fp: { shape:'rect', w, h } | { shape:'L', w, h, notch:{ corner:'ne'|'nw'|'se'|'sw', w, h } } (tiles) */
    static inside(fp, i, j) {
      if (i < 0 || j < 0 || i >= fp.w || j >= fp.h) return false;
      if (fp.shape !== 'L' || !fp.notch) return true;
      const n = fp.notch, east = n.corner[1] === 'e', south = n.corner[0] === 's';
      const inX = east ? i >= fp.w - n.w : i < n.w, inZ = south ? j >= fp.h - n.h : j < n.h;
      return !(inX && inZ);
    }
    /* the footprint as 1-2 rects [{x,z,w,h}] (main first: the larger part spanning the full depth or width) */
    static rects(fp) {
      if (fp.shape !== 'L' || !fp.notch) return [{ x: 0, z: 0, w: fp.w, h: fp.h }];
      const n = fp.notch, east = n.corner[1] === 'e', south = n.corner[0] === 's';
      const full = { x: east ? 0 : n.w, z: 0, w: fp.w - n.w, h: fp.h };          // full-depth part
      const wing = { x: east ? fp.w - n.w : 0, z: south ? 0 : n.h, w: n.w, h: fp.h - n.h };
      return [full, wing];
    }
    static tiles(fp) { const out = []; for (let j = 0; j < fp.h; j++) for (let i = 0; i < fp.w; i++) if (Footprint.inside(fp, i, j)) out.push([i, j]); return out; }
  }

  /* ---------- building spec (format v2) ---------- */
  class BuildingSpec {
    /* fills defaults, clamps values, accepts shorthand (roof: 'thatch' etc.). Returns a new plain object. */
    static normalize(b) {
      const o = JSON.parse(JSON.stringify(b || {}));
      o.kind = 'building';
      o.x = o.x | 0; o.z = o.z | 0; o.floors = 1; o.seed = (o.seed >>> 0) || 1;
      const fp = o.footprint || { shape: 'rect', w: 8, h: 6 };
      o.footprint = { shape: fp.shape === 'L' ? 'L' : 'rect', w: Math.max(4, Math.min(48, fp.w | 0)), h: Math.max(4, Math.min(48, fp.h | 0)) };
      if (o.footprint.shape === 'L') {
        const n = fp.notch || {};
        o.footprint.notch = { corner: ['ne', 'nw', 'se', 'sw'].includes(n.corner) ? n.corner : 'ne', w: Math.max(2, Math.min(o.footprint.w - 3, n.w | 0 || 3)), h: Math.max(2, Math.min(o.footprint.h - 3, n.h | 0 || 3)) };
      }
      o.walls = WALLS[o.walls] ? o.walls : 'timber';
      let r = o.roof;
      if (typeof r === 'string') r = ROOF_MATERIALS[r] ? { material: r } : { style: r };
      r = r || {};
      const look = LOOKS[o.prefab] || {}, lr = look.roof || {};
      const snow = r.snow !== undefined ? r.snow : lr.snow !== undefined ? lr.snow : true;
      o.roof = { style: ROOF_STYLES[r.style] ? r.style : 'gable', material: 'slate',   /* every roof in the castle is the same slate */ snow: snow === 'light' ? 'light' : snow !== false, pitch: Math.max(0.45, Math.min(0.9, +r.pitch || 0.72)) };
      /* roof colour is fixed: one slate for every building */
      // look (all optional): explicit fields win, then the prefab's look
      for (const k of ['wallColor', 'trim', 'doorColor', 'shutterColor']) { const v = o[k] !== undefined ? o[k] : look[k]; if (isColor(v)) o[k] = v; else delete o[k]; }
      const sg = o.sign !== undefined ? o.sign : look.sign;
      if (sg && typeof sg === 'object' && SIGN_ICONS.includes(sg.icon)) o.sign = { icon: sg.icon, board: isColor(sg.board) ? sg.board : 'signBoard', emblemIcon: SIGN_ICONS.includes(sg.emblemIcon) ? sg.emblemIcon : undefined, text: typeof sg.text === 'string' ? sg.text.slice(0, 14) : undefined, textColor: isColor(sg.textColor) ? sg.textColor : undefined, emblem: sg.emblem !== false };
      else if (sg === false) o.sign = false; else delete o.sign;
      const pr = o.props !== undefined ? o.props : look.props;
      if (Array.isArray(pr) && pr.length) o.props = pr.filter((p) => p && typeof p.type === 'string').slice(0, 8).map((p) => ({ type: p.type, side: p.side === 'l' ? 'l' : 'r', at: Math.max(0, Math.min(12, p.at | 0)), out: Math.max(0, Math.min(3, p.out | 0)), rot: ((p.rot | 0) % 4 + 4) % 4 }));
      else if (Array.isArray(pr)) o.props = []; else delete o.props;
      const bt = o.bunting !== undefined ? o.bunting : look.bunting; if (Array.isArray(bt) && bt.filter(isColor).length) o.bunting = bt.filter(isColor).slice(0, 8); else delete o.bunting;
      const aw = o.awning !== undefined ? o.awning : look.awning; if (Array.isArray(aw) && aw.length === 2 && aw.every(isColor)) o.awning = aw.slice(); else delete o.awning;
      const fb = o.flowerBoxes !== undefined ? o.flowerBoxes : look.flowerBoxes; if (fb) o.flowerBoxes = true; else delete o.flowerBoxes;
      const fl = o.fill !== undefined ? o.fill : look.fill; o.fill = Math.max(0, Math.min(3, fl === undefined ? 1 : +fl || 0));
      o.wallH = Math.max(1.8, Math.min(3.2, +o.wallH || 2.1));
      o.interiorFloor = FLOORS[o.interiorFloor] ? o.interiorFloor : 'planks';
      o.rooms = (o.rooms || []).filter((rm) => rm && ROOM_TYPES[rm.type]).map((rm, k) => ({ id: rm.id || 'r' + k, type: rm.type, x: rm.x | 0, z: rm.z | 0, w: Math.max(1, rm.w | 0), h: Math.max(1, rm.h | 0), floor: FLOORS[rm.floor] ? rm.floor : undefined, name: rm.name }));
      o.doors = (o.doors || []).filter((d) => d && SIDES[d.side]).map((d) => ({ x: d.x | 0, z: d.z | 0, side: d.side, w: Math.max(1, Math.min(4, d.w | 0 || 2)), kind: d.kind === 'interior' ? 'interior' : 'exterior' }));
      o.windows = (o.windows || []).filter((d) => d && SIDES[d.side]).map((d) => ({ x: d.x | 0, z: d.z | 0, side: d.side, w: Math.max(1, Math.min(3, d.w | 0 || 1)) }));
      o.furniture = (o.furniture || []).filter((f) => f && f.type).map((f, k) => ({ id: f.id || 'f' + k, type: f.type, x: f.x | 0, z: f.z | 0, rot: ((f.rot | 0) % 4 + 4) % 4, state: f.state || undefined }));
      return o;
    }
    /* problems a builder UI should show; [] when the building is valid */
    static validate(b, catalog) {
      const errs = [], fp = b.footprint;
      for (const rm of b.rooms) for (let j = rm.z; j < rm.z + rm.h; j++) for (let i = rm.x; i < rm.x + rm.w; i++) if (!Footprint.inside(fp, i, j)) { errs.push(`Room ${rm.id} leaves the footprint at ${i},${j}.`); j = 1e9; break; }
      for (const d of b.doors) if (!Footprint.inside(fp, d.x, d.z)) errs.push(`Door at ${d.x},${d.z} is outside the footprint.`);
      if (!b.doors.some((d) => d.kind === 'exterior')) errs.push('The building has no exterior door.');
      if (catalog) {
        const occ = new Map();
        for (const f of b.furniture) {
          const def = catalog[f.type]; if (!def) { errs.push(`Unknown furniture type ${f.type}.`); continue; }
          for (const [i, j] of FurnitureFootprint.tiles(def, f)) {
            if (!Footprint.inside(fp, i, j)) errs.push(`${def.name} ${f.id} sticks out of the building at ${i},${j}.`);
            else if (def.solid !== false && def.layer !== 'floor') { const k = i + ',' + j; if (occ.has(k)) errs.push(`${def.name} ${f.id} overlaps ${occ.get(k)} at ${i},${j}.`); occ.set(k, f.id); }
          }
        }
      }
      return errs;
    }
  }

  /* a furniture item's tile footprint inside its building: size [w,d] rotated by quarter turns; origin = NW tile */
  class FurnitureFootprint {
    static size(def, rot) { const [w, d] = def.size || [1, 1]; return rot % 2 ? [d, w] : [w, d]; }
    static tiles(def, f) { const [w, d] = FurnitureFootprint.size(def, f.rot | 0), out = []; for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) out.push([f.x + i, f.z + j]); return out; }
    /* tile in front of the item (where the player stands to use it) */
    static front(def, f) {
      const [w, d] = FurnitureFootprint.size(def, f.rot | 0), r = f.rot | 0;
      const cx = f.x + Math.floor((w - 1) / 2), cz = f.z + Math.floor((d - 1) / 2);
      if (r === 0) return [cx, f.z + d]; if (r === 1) return [f.x + w, cz]; if (r === 2) return [cx, f.z - 1]; return [f.x - 1, cz];
    }
  }

  /* ---------- layout: rooms per tile, wall edges, openings, walkability ---------- */
  class BuildingLayout {
    constructor(b, catalog) {
      this.b = b; this.W = b.footprint.w; this.H = b.footprint.h; this.catalog = catalog || K.FURNITURE || {};
      const W = this.W, H = this.H;
      this.cell = new Int16Array(W * H).fill(-1);
      this.rooms = b.rooms.slice();
      let open = -1;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        if (!Footprint.inside(b.footprint, i, j)) continue;
        let r = -1; for (let k = this.rooms.length - 1; k >= 0; k--) { const rm = this.rooms[k]; if (i >= rm.x && i < rm.x + rm.w && j >= rm.z && j < rm.z + rm.h) { r = k; break; } }
        if (r < 0) { if (open < 0) { open = this.rooms.length; this.rooms.push({ id: 'open', type: 'hall', x: 0, z: 0, w: 0, h: 0, implicit: true }); } r = open; }
        this.cell[j * W + i] = r;
      }
      // edges: v[(j)*(W+1)+i] = west edge of tile (i,j); hz[j*W+i] = north edge of tile (i,j). 0 none, 1 exterior, 2 interior
      this.v = new Uint8Array((W + 1) * H); this.hz = new Uint8Array(W * (H + 1));
      this.vOpen = new Uint8Array(this.v.length); this.hOpen = new Uint8Array(this.hz.length);   // 0 none, 1 door, 2 window
      for (let j = 0; j < H; j++) for (let i = 0; i <= W; i++) { const a = this.room(i - 1, j), c = this.room(i, j); this.v[j * (W + 1) + i] = a === c ? 0 : a < 0 || c < 0 ? 1 : 2; }
      for (let j = 0; j <= H; j++) for (let i = 0; i < W; i++) { const a = this.room(i, j - 1), c = this.room(i, j); this.hz[j * W + i] = a === c ? 0 : a < 0 || c < 0 ? 1 : 2; }
      this.doors = []; this.windows = [];
      const interior = b.doors.filter((d) => d.kind === 'interior');
      for (const d of b.doors) this.openEdges(d, 1);
      for (const w of b.windows) this.openEdges(w, 2);
      if (!interior.length) this.autoDoorways();
      this.solid = new Uint8Array(W * H); this.items = new Array(W * H).fill(null);
      for (const f of b.furniture) {
        const def = this.catalog[f.type]; if (!def) continue;
        for (const [i, j] of FurnitureFootprint.tiles(def, f)) {
          if (i < 0 || j < 0 || i >= W || j >= H) continue;
          if (def.solid !== false && def.layer !== 'floor') this.solid[j * W + i] = 1;
          if (def.interact || !this.items[j * W + i]) this.items[j * W + i] = f;
        }
      }
    }
    room(i, j) { return i < 0 || j < 0 || i >= this.W || j >= this.H ? -1 : this.cell[j * this.W + i]; }
    roomAt(i, j) { const r = this.room(i, j); return r < 0 ? null : this.rooms[r]; }
    /* edge between tile (i,j) and its neighbour on `side`: { kind, open, arr, idx } */
    edge(i, j, side) {
      const W = this.W;
      if (side === 'w') return this.edgeRef('v', j * (W + 1) + i);
      if (side === 'e') return this.edgeRef('v', j * (W + 1) + i + 1);
      if (side === 'n') return this.edgeRef('h', j * W + i);
      return this.edgeRef('h', (j + 1) * W + i);
    }
    edgeRef(axis, idx) { const k = axis === 'v' ? this.v : this.hz, o = axis === 'v' ? this.vOpen : this.hOpen; if (idx < 0 || idx >= k.length) return null; return { kind: k[idx], open: o[idx], axis, idx }; }
    setOpen(e, val) { if (!e || !e.kind) return false; (e.axis === 'v' ? this.vOpen : this.hOpen)[e.idx] = val; return true; }
    openEdges(d, val) {
      const along = d.side === 'n' || d.side === 's' ? [1, 0] : [0, 1], rec = { x: d.x, z: d.z, side: d.side, w: d.w, kind: d.kind, tiles: [] };
      for (let k = 0; k < d.w; k++) {
        const i = d.x + along[0] * k, j = d.z + along[1] * k;
        if (this.setOpen(this.edge(i, j, d.side), val)) rec.tiles.push([i, j]);
      }
      if (!rec.tiles.length) return;
      (val === 1 ? this.doors : this.windows).push(rec);
    }
    /* one 2-wide doorway in the middle of the longest shared wall between each pair of rooms */
    autoDoorways() {
      const runs = new Map(), W = this.W, H = this.H;
      const note = (a, c, axis, line, s) => { const key = Math.min(a, c) + ':' + Math.max(a, c); if (!runs.has(key)) runs.set(key, []); runs.get(key).push([axis, line, s]); };
      for (let j = 0; j < H; j++) for (let i = 1; i < W; i++) { const a = this.room(i - 1, j), c = this.room(i, j); if (a >= 0 && c >= 0 && a !== c) note(a, c, 'v', i, j); }
      for (let j = 1; j < H; j++) for (let i = 0; i < W; i++) { const a = this.room(i, j - 1), c = this.room(i, j); if (a >= 0 && c >= 0 && a !== c) note(a, c, 'h', j, i); }
      for (const list of runs.values()) {
        let best = null, cur = null;
        list.sort((p, q) => (p[0] + p[1]).localeCompare(q[0] + q[1]) || p[1] - q[1] || p[2] - q[2]);
        for (const e of list) {
          if (cur && cur.axis === e[0] && cur.line === e[1] && cur.s1 === e[2]) cur.s1++;
          else { cur = { axis: e[0], line: e[1], s0: e[2], s1: e[2] + 1 }; }
          if (!best || cur.s1 - cur.s0 > best.s1 - best.s0) best = Object.assign({}, cur);
        }
        if (!best || best.s1 - best.s0 < 2) continue;
        const mid = Math.floor((best.s0 + best.s1) / 2) - 1;
        const d = best.axis === 'v' ? { x: best.line, z: mid, side: 'w', w: 2, kind: 'interior' } : { x: mid, z: best.line, side: 'n', w: 2, kind: 'interior' };
        this.openEdges(d, 1);
      }
    }
    /* walls as straight runs: { axis:'v'|'h', line, s0, s1, kind:1|2, normal:[nx,nz] (exterior: outward), openings:[{s0,s1,type:'door'|'window'}] } */
    segments() {
      const out = [], W = this.W, H = this.H;
      const scan = (axis, nLines, nSteps, kindAt, openAt, normalAt) => {
        for (let line = 0; line <= nLines; line++) {
          let seg = null;
          for (let s = 0; s <= nSteps; s++) {
            const k = s < nSteps ? kindAt(line, s) : 0, nm = k === 1 ? normalAt(line, s) : [0, 0];
            if (seg && (k !== seg.kind || nm[0] !== seg.normal[0] || nm[1] !== seg.normal[1])) { out.push(seg); seg = null; }
            if (!k) continue;
            if (!seg) seg = { axis, line, s0: s, s1: s, kind: k, normal: nm, openings: [] };
            seg.s1 = s + 1;
            const op = openAt(line, s);
            if (op) { const t = op === 1 ? 'door' : 'window', last = seg.openings[seg.openings.length - 1]; if (last && last.type === t && last.s1 === s) last.s1 = s + 1; else seg.openings.push({ s0: s, s1: s + 1, type: t }); }
          }
        }
      };
      scan('v', W, H, (i, j) => this.v[j * (W + 1) + i], (i, j) => this.vOpen[j * (W + 1) + i], (i, j) => (this.room(i - 1, j) < 0 ? [-1, 0] : [1, 0]));
      scan('h', H, W, (j, i) => this.hz[j * W + i], (j, i) => this.hOpen[j * W + i], (j, i) => (this.room(i, j - 1) < 0 ? [0, -1] : [0, 1]));
      return out;
    }
    /* can an actor step between 4-neighbour local tiles (either may be outside the footprint)? */
    canStep(i0, j0, i1, j1) {
      const di = i1 - i0, dj = j1 - j0; if (Math.abs(di) + Math.abs(dj) !== 1) return false;
      const side = di === 1 ? 'e' : di === -1 ? 'w' : dj === 1 ? 's' : 'n';
      const inA = this.room(i0, j0) >= 0, inB = this.room(i1, j1) >= 0;
      if (!inA && !inB) return true;
      if (inB && this.solid[j1 * this.W + i1]) return false;
      const e = inA ? this.edge(i0, j0, side) : this.edge(i1, j1, OPPOSITE[side]);
      return !e || !e.kind || e.open === 1;
    }
    walkable(i, j) { const r = this.room(i, j); return r < 0 || !this.solid[j * this.W + i]; }
  }

  /* ---------- prefabs (local tile coords; x,z of the building = its NW tile in the world) ---------- */
  const PREFABS = {
    cottage: {
      name: 'Cottage', desc: 'Timber-framed thatched cottage: kitchen + bedroom',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 9 }, walls: 'timber', roof: { style: 'gable', material: 'thatch' }, interiorFloor: 'planks', wallH: 2.1,
        rooms: [{ id: 'kitchen', type: 'kitchen', x: 0, z: 0, w: 5, h: 9 }, { id: 'bed', type: 'bedroom', x: 5, z: 0, w: 7, h: 9 }],
        doors: [{ x: 2, z: 8, side: 's', w: 2 }, { x: 5, z: 5, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 8, z: 8, side: 's', w: 2 }, { x: 11, z: 4, side: 'e', w: 1 }, { x: 7, z: 0, side: 'n', w: 1 }, { x: 0, z: 6, side: 'w', w: 1 }],
        furniture: [
          { type: 'hearth', x: 0, z: 1, rot: 1 }, { type: 'pantry', x: 2, z: 0, rot: 0 }, { type: 'table', x: 2, z: 3, rot: 0 },
          { type: 'chair', x: 1, z: 4, rot: 1 }, { type: 'barrel', x: 4, z: 0 }, { type: 'sack', x: 0, z: 8 }, { type: 'sack', x: 4, z: 8 }, { type: 'shelf', x: 1, z: 7, rot: 0 },
          { type: 'bed', x: 9, z: 0, rot: 0 }, { type: 'chest', x: 9, z: 3, rot: 0 }, { type: 'wardrobe', x: 6, z: 0, rot: 0 }, { type: 'rug', x: 6, z: 4, rot: 0 },
          { type: 'bookshelf', x: 11, z: 5, rot: 3 }, { type: 'candle', x: 8, z: 0 }, { type: 'chair', x: 10, z: 7, rot: 2 },
        ],
      }),
    },
    smithy: {
      name: 'Smithy', desc: 'Stone forge workshop with a storage room',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 9 }, walls: 'stone', roof: { style: 'gable', material: 'slate' }, interiorFloor: 'flagstone', wallH: 2.2,
        rooms: [{ id: 'forge', type: 'smithy', x: 0, z: 0, w: 8, h: 9 }, { id: 'store', type: 'storage', x: 8, z: 0, w: 4, h: 9 }],
        doors: [{ x: 3, z: 8, side: 's', w: 2 }, { x: 8, z: 4, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 6, z: 8, side: 's', w: 1 }, { x: 0, z: 5, side: 'w', w: 1 }, { x: 11, z: 3, side: 'e', w: 1 }, { x: 5, z: 0, side: 'n', w: 1 }],
        furniture: [
          { type: 'forge', x: 1, z: 0, rot: 0 }, { type: 'anvil', x: 2, z: 3 }, { type: 'grindstone', x: 6, z: 1 }, { type: 'workbench', x: 4, z: 0, rot: 0 },
          { type: 'weapon_rack', x: 0, z: 6, rot: 1 }, { type: 'barrel', x: 6, z: 7 }, { type: 'sack', x: 7, z: 7 },
          { type: 'chest', x: 10, z: 0, rot: 0 }, { type: 'shelf', x: 8, z: 0, rot: 0 }, { type: 'barrel', x: 11, z: 7 }, { type: 'barrel', x: 10, z: 7 },
          { type: 'sack', x: 11, z: 5 }, { type: 'crate', x: 8, z: 7 }, { type: 'armor_stand', x: 11, z: 2 },
          { type: 'quench_tub', x: 1, z: 3 }, { type: 'shield_rack', x: 0, z: 4, rot: 1 }, { type: 'weapon_rack', x: 7, z: 2, rot: 3 }, { type: 'material_pile', x: 9, z: 3, state: { kind: 'ore' } },
        ],
      }),
    },
    stable: {
      name: 'Stable', desc: 'Timber stable with three stalls and a tack room',
      make: () => ({
        footprint: { shape: 'rect', w: 14, h: 10 }, walls: 'timber', roof: { style: 'gable', material: 'shingle' }, interiorFloor: 'straw', wallH: 2.3,
        rooms: [{ id: 'stalls', type: 'stable', x: 0, z: 0, w: 10, h: 10 }, { id: 'tack', type: 'tack', x: 10, z: 0, w: 4, h: 10 }],
        doors: [{ x: 4, z: 9, side: 's', w: 2 }, { x: 10, z: 6, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 1, z: 9, side: 's', w: 2 }, { x: 7, z: 9, side: 's', w: 2 }, { x: 13, z: 4, side: 'e', w: 1 }, { x: 0, z: 6, side: 'w', w: 1 }],
        furniture: [
          { type: 'stall', x: 0, z: 0, rot: 0 }, { type: 'stall', x: 3, z: 0, rot: 0 }, { type: 'stall', x: 6, z: 0, rot: 0 },
          { type: 'horse', x: 1, z: 0, rot: 0, state: { horseId: 'bramble', coat: 'bay' } }, { type: 'horse', x: 7, z: 0, rot: 0, state: { horseId: 'ash', coat: 'grey' } },
          { type: 'trough', x: 4, z: 5, rot: 0 }, { type: 'hay_bale', x: 0, z: 8 }, { type: 'hay_bale', x: 9, z: 8 }, { type: 'hay_bale', x: 9, z: 7 },
          { type: 'tack_rack', x: 11, z: 0, rot: 0 }, { type: 'chest', x: 12, z: 9, rot: 2 }, { type: 'barrel', x: 13, z: 0 }, { type: 'bench', x: 13, z: 7, rot: 3 },
        ],
      }),
    },
    market_hall: {
      name: 'Market hall', desc: 'A big painted market hall in four sections: wheat and bread, meat and eggs, weapons, raw materials',
      make: () => ({
        footprint: { shape: 'rect', w: 20, h: 14 }, walls: 'plaster', roof: { style: 'gable', material: 'tiles' }, interiorFloor: 'planks', wallH: 2.4,
        rooms: [{ id: 'grain', type: 'storage', name: 'Wheat & bread', x: 0, z: 0, w: 10, h: 6 }, { id: 'meat', type: 'kitchen', name: 'Meat & eggs', floor: 'flagstone', x: 10, z: 0, w: 10, h: 6 }, { id: 'arms', type: 'armory', name: 'Weapons', x: 0, z: 6, w: 10, h: 8 }, { id: 'goods', type: 'storage', name: 'Raw materials', floor: 'flagstone', x: 10, z: 6, w: 10, h: 8 }],
        doors: [{ x: 4, z: 13, side: 's', w: 2 }, { x: 14, z: 13, side: 's', w: 2 }, { x: 4, z: 6, side: 'n', w: 2, kind: 'interior' }, { x: 14, z: 6, side: 'n', w: 2, kind: 'interior' }, { x: 10, z: 9, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 1, z: 13, side: 's', w: 2 }, { x: 8, z: 13, side: 's', w: 1 }, { x: 17, z: 13, side: 's', w: 2 }, { x: 0, z: 3, side: 'w', w: 1 }, { x: 0, z: 10, side: 'w', w: 1 }, { x: 19, z: 3, side: 'e', w: 1 }, { x: 19, z: 10, side: 'e', w: 1 }, { x: 7, z: 0, side: 'n', w: 1 }, { x: 13, z: 0, side: 'n', w: 1 }],
        furniture: [
          // wheat & bread
          { type: 'wheat_sheaf', x: 0, z: 0 }, { type: 'wheat_sheaf', x: 1, z: 0 }, { type: 'wheat_sheaf', x: 0, z: 1 }, { type: 'bread_rack', x: 2, z: 0, rot: 0 }, { type: 'bread_rack', x: 4, z: 0, rot: 0 },
          { type: 'flour_sack', x: 0, z: 4 }, { type: 'flour_sack', x: 0, z: 5 }, { type: 'flour_sack', x: 1, z: 5 }, { type: 'hay_bale', x: 8, z: 0 }, { type: 'hay_bale', x: 9, z: 0 }, { type: 'wheat_sheaf', x: 9, z: 1 },
          { type: 'counter', x: 2, z: 3, rot: 0, state: { goods: 'bread' } }, { type: 'counter', x: 6, z: 3, rot: 0, state: { goods: 'wheat' } }, { type: 'hanging_sign', x: 3, z: 2, state: { icon: 'bread' } }, { type: 'hanging_sign', x: 7, z: 2, state: { icon: 'wheat' } },
          // meat & eggs
          { type: 'meat_hooks', x: 11, z: 0, rot: 0 }, { type: 'meat_hooks', x: 13, z: 0, rot: 0 }, { type: 'chopping_block', x: 15, z: 0 }, { type: 'egg_basket', x: 18, z: 0 }, { type: 'egg_basket', x: 19, z: 0 }, { type: 'egg_basket', x: 19, z: 1 }, { type: 'barrel', x: 10, z: 0 },
          { type: 'counter', x: 11, z: 3, rot: 0, state: { goods: 'meat' } }, { type: 'counter', x: 16, z: 3, rot: 0, state: { goods: 'eggs' } }, { type: 'hanging_sign', x: 12, z: 2, state: { icon: 'ham' } }, { type: 'hanging_sign', x: 17, z: 2, state: { icon: 'egg' } },
          // weapons
          { type: 'weapon_rack', x: 0, z: 7, rot: 1 }, { type: 'weapon_rack', x: 0, z: 11, rot: 1 }, { type: 'shield_rack', x: 1, z: 6, rot: 0 }, { type: 'shield_rack', x: 7, z: 6, rot: 0 }, { type: 'armor_stand', x: 3, z: 8 }, { type: 'armor_stand', x: 6, z: 8 },
          { type: 'counter', x: 3, z: 10, rot: 0, state: { goods: 'weapons' } }, { type: 'grindstone', x: 8, z: 9 }, { type: 'chest', x: 8, z: 12, rot: 2 }, { type: 'hanging_sign', x: 4, z: 9, state: { icon: 'sword' } }, { type: 'rug', x: 2, z: 11, rot: 0, state: { color: 'red' } },
          // raw materials
          { type: 'material_pile', x: 18, z: 7, rot: 3, state: { kind: 'wood' } }, { type: 'material_pile', x: 18, z: 9, rot: 3, state: { kind: 'stone' } }, { type: 'material_pile', x: 18, z: 11, rot: 3, state: { kind: 'ore' } },
          { type: 'crate', x: 11, z: 7 }, { type: 'crate', x: 12, z: 7 }, { type: 'barrel', x: 11, z: 8 }, { type: 'counter', x: 12, z: 10, rot: 0, state: { goods: 'ore' } }, { type: 'sack', x: 11, z: 12 }, { type: 'crate', x: 12, z: 12 }, { type: 'hanging_sign', x: 13, z: 9, state: { icon: 'logs' } },
        ],
      }),
    },
    bakery: {
      name: 'Bakery', desc: 'Whitewashed bakery with an orange tile roof: bread ovens, flour, a shop with bread racks',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 9 }, walls: 'timber', roof: { style: 'gable', material: 'tiles' }, interiorFloor: 'planks', wallH: 2.2,
        rooms: [{ id: 'bake', type: 'bakery', x: 0, z: 0, w: 7, h: 9 }, { id: 'shop', type: 'shop', name: 'Bread shop', x: 7, z: 0, w: 5, h: 9 }],
        doors: [{ x: 8, z: 8, side: 's', w: 2 }, { x: 7, z: 4, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 2, z: 8, side: 's', w: 2 }, { x: 11, z: 8, side: 's', w: 1 }, { x: 0, z: 5, side: 'w', w: 1 }, { x: 9, z: 0, side: 'n', w: 1 }, { x: 11, z: 3, side: 'e', w: 1 }],
        furniture: [
          { type: 'oven', x: 0, z: 0, rot: 0 }, { type: 'oven', x: 3, z: 0, rot: 0 }, { type: 'barrel', x: 6, z: 0 }, { type: 'kneading_table', x: 2, z: 4, rot: 0 }, { type: 'bread_rack', x: 6, z: 6, rot: 3 },
          { type: 'flour_sack', x: 0, z: 7 }, { type: 'flour_sack', x: 0, z: 8 }, { type: 'flour_sack', x: 1, z: 8 }, { type: 'wheat_sheaf', x: 5, z: 8 }, { type: 'sack', x: 4, z: 8 },
          { type: 'bread_rack', x: 7, z: 0, rot: 0 }, { type: 'bread_rack', x: 10, z: 0, rot: 0 }, { type: 'counter', x: 8, z: 3, rot: 0, state: { goods: 'bread' } }, { type: 'hanging_sign', x: 9, z: 5, state: { icon: 'bread' } }, { type: 'bench', x: 10, z: 6, rot: 3 },
        ],
      }),
    },
    butcher: {
      name: 'Butcher', desc: 'Butcher shop with a red tile roof: hanging meat, chopping blocks and a meat counter',
      make: () => ({
        footprint: { shape: 'rect', w: 10, h: 8 }, walls: 'timber', roof: { style: 'gable', material: 'tiles' }, interiorFloor: 'flagstone', wallH: 2.2,
        rooms: [{ id: 'cut', type: 'butcher', x: 0, z: 0, w: 5, h: 8 }, { id: 'shop', type: 'shop', name: 'Meat counter', floor: 'flagstone', x: 5, z: 0, w: 5, h: 8 }],
        doors: [{ x: 6, z: 7, side: 's', w: 2 }, { x: 5, z: 3, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 2, z: 7, side: 's', w: 2 }, { x: 9, z: 3, side: 'e', w: 1 }, { x: 7, z: 0, side: 'n', w: 1 }, { x: 0, z: 4, side: 'w', w: 1 }],
        furniture: [
          { type: 'meat_hooks', x: 0, z: 0, rot: 0 }, { type: 'meat_hooks', x: 2, z: 0, rot: 0 }, { type: 'crate', x: 4, z: 0 }, { type: 'chopping_block', x: 1, z: 3 }, { type: 'chopping_block', x: 3, z: 3 },
          { type: 'barrel', x: 0, z: 6 }, { type: 'flour_sack', x: 0, z: 7 }, { type: 'barrel', x: 4, z: 7 },
          { type: 'meat_hooks', x: 5, z: 0, rot: 0 }, { type: 'meat_hooks', x: 8, z: 0, rot: 0 }, { type: 'counter', x: 6, z: 3, rot: 0, state: { goods: 'meat' } }, { type: 'egg_basket', x: 9, z: 5 }, { type: 'barrel', x: 5, z: 6 }, { type: 'hanging_sign', x: 7, z: 5, state: { icon: 'cleaver' } },
        ],
      }),
    },
    library: {
      name: 'Alchemist library', desc: 'Pale stone library with a purple roof: shelves of books, potion shelves, a bubbling cauldron',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 10 }, walls: 'stone', roof: { style: 'gable', material: 'tiles' }, interiorFloor: 'planks', wallH: 2.4,
        rooms: [{ id: 'books', type: 'library', x: 0, z: 0, w: 7, h: 10 }, { id: 'lab', type: 'lab', x: 7, z: 0, w: 5, h: 10 }],
        doors: [{ x: 3, z: 9, side: 's', w: 2 }, { x: 7, z: 5, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 1, z: 9, side: 's', w: 1 }, { x: 9, z: 9, side: 's', w: 2 }, { x: 0, z: 3, side: 'w', w: 1 }, { x: 0, z: 6, side: 'w', w: 1 }, { x: 6, z: 0, side: 'n', w: 1 }, { x: 11, z: 4, side: 'e', w: 1 }],
        furniture: [
          { type: 'bookshelf', x: 0, z: 0, rot: 0 }, { type: 'bookshelf', x: 2, z: 0, rot: 0 }, { type: 'bookshelf', x: 4, z: 0, rot: 0 }, { type: 'bookshelf', x: 0, z: 1, rot: 1 }, { type: 'bookshelf', x: 0, z: 4, rot: 1 }, { type: 'bookshelf', x: 0, z: 7, rot: 1 },
          { type: 'rug', x: 2, z: 4, rot: 0, state: { color: 'blue' } }, { type: 'table', x: 3, z: 4, rot: 0 }, { type: 'chair', x: 2, z: 5, rot: 1 }, { type: 'chair', x: 5, z: 4, rot: 3 }, { type: 'candle', x: 6, z: 1 },
          { type: 'book_pile', x: 5, z: 7 }, { type: 'book_pile', x: 1, z: 8 }, { type: 'globe', x: 6, z: 8 },
          { type: 'cauldron', x: 8, z: 2, rot: 0 }, { type: 'potion_shelf', x: 7, z: 0, rot: 0 }, { type: 'potion_shelf', x: 10, z: 0, rot: 0 }, { type: 'potion_shelf', x: 11, z: 6, rot: 3 },
          { type: 'alchemy_table', x: 9, z: 7, rot: 0 }, { type: 'potion_crate', x: 7, z: 9 }, { type: 'candle', x: 11, z: 2 }, { type: 'book_pile', x: 10, z: 4 },
        ],
      }),
    },
    bunkhouse: {
      name: 'Bunkhouse', desc: 'Long timber bunkhouse with a thatched roof: bunks for your workers and a stove',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 8 }, walls: 'timber', roof: { style: 'gable', material: 'thatch' }, interiorFloor: 'planks', wallH: 2.1,
        rooms: [{ id: 'bunks', type: 'bedroom', name: 'Bunk room', x: 0, z: 0, w: 12, h: 8 }],
        doors: [{ x: 5, z: 7, side: 's', w: 2 }],
        windows: [{ x: 1, z: 7, side: 's', w: 2 }, { x: 9, z: 7, side: 's', w: 2 }, { x: 0, z: 3, side: 'w', w: 1 }, { x: 11, z: 3, side: 'e', w: 1 }, { x: 5, z: 0, side: 'n', w: 2 }],
        furniture: [
          { type: 'bunk', x: 0, z: 0, rot: 0 }, { type: 'bunk', x: 2, z: 0, rot: 0 }, { type: 'bunk', x: 8, z: 0, rot: 0 }, { type: 'bunk', x: 10, z: 0, rot: 0 },
          { type: 'bunk', x: 0, z: 4, rot: 0 }, { type: 'bunk', x: 10, z: 4, rot: 0 },
          { type: 'hearth', x: 5, z: 0, rot: 0 }, { type: 'table', x: 5, z: 3, rot: 0 }, { type: 'bench', x: 4, z: 3, rot: 1 }, { type: 'bench', x: 7, z: 3, rot: 3 },
          { type: 'chest', x: 3, z: 6, rot: 2 }, { type: 'chest', x: 8, z: 6, rot: 2 }, { type: 'candle', x: 4, z: 0 },
        ],
      }),
    },
    keep: {
      name: 'Keep', desc: 'Stone manor (L-shaped): great hall, armory, kitchen, bedroom, wardrobe room',
      make: () => ({
        footprint: { shape: 'L', w: 18, h: 16, notch: { corner: 'ne', w: 7, h: 7 } }, walls: 'stone', roof: { style: 'hip', material: 'slate' }, interiorFloor: 'flagstone', wallH: 2.6,
        rooms: [
          { id: 'hall', type: 'hall', x: 0, z: 0, w: 11, h: 7 }, { id: 'armory', type: 'armory', x: 0, z: 7, w: 6, h: 9 },
          { id: 'kitchen', type: 'kitchen', x: 6, z: 7, w: 5, h: 9 }, { id: 'bed', type: 'bedroom', x: 11, z: 7, w: 7, h: 5 }, { id: 'robes', type: 'wardrobe', x: 11, z: 12, w: 7, h: 4 },
        ],
        doors: [
          { x: 10, z: 3, side: 'e', w: 2 }, { x: 8, z: 15, side: 's', w: 2 },
          { x: 2, z: 7, side: 'n', w: 2, kind: 'interior' }, { x: 7, z: 7, side: 'n', w: 2, kind: 'interior' }, { x: 11, z: 9, side: 'w', w: 2, kind: 'interior' }, { x: 14, z: 12, side: 'n', w: 2, kind: 'interior' },
        ],
        windows: [{ x: 3, z: 0, side: 'n', w: 1 }, { x: 7, z: 0, side: 'n', w: 1 }, { x: 0, z: 3, side: 'w', w: 1 }, { x: 0, z: 11, side: 'w', w: 1 }, { x: 3, z: 15, side: 's', w: 1 }, { x: 13, z: 15, side: 's', w: 2 }, { x: 17, z: 9, side: 'e', w: 1 }, { x: 14, z: 7, side: 'n', w: 1 }],
        furniture: [
          { type: 'hearth', x: 4, z: 0, rot: 0 }, { type: 'long_table', x: 2, z: 3, rot: 0 }, { type: 'bench', x: 2, z: 2, rot: 2 }, { type: 'bench', x: 5, z: 2, rot: 2 }, { type: 'chair', x: 7, z: 3, rot: 3 },
          { type: 'banner', x: 1, z: 0, rot: 0 }, { type: 'banner', x: 9, z: 0, rot: 0 }, { type: 'rug', x: 3, z: 5, rot: 1 }, { type: 'candle', x: 0, z: 6 }, { type: 'bookshelf', x: 0, z: 1, rot: 1 },
          { type: 'weapon_rack', x: 0, z: 8, rot: 1 }, { type: 'weapon_rack', x: 0, z: 12, rot: 1 }, { type: 'armor_stand', x: 4, z: 9 }, { type: 'armor_stand', x: 4, z: 12 }, { type: 'chest', x: 2, z: 15, rot: 2 }, { type: 'grindstone', x: 3, z: 11 },
          { type: 'hearth', x: 6, z: 8, rot: 1 }, { type: 'pantry', x: 9, z: 15, rot: 2 }, { type: 'table', x: 8, z: 11, rot: 0 }, { type: 'barrel', x: 10, z: 8 }, { type: 'sack', x: 10, z: 13 },
          { type: 'bed', x: 15, z: 7, rot: 0 }, { type: 'chest', x: 15, z: 10, rot: 0 }, { type: 'candle', x: 17, z: 7 }, { type: 'rug', x: 12, z: 9, rot: 1 },
          { type: 'wardrobe', x: 16, z: 12, rot: 3 }, { type: 'wardrobe', x: 11, z: 14, rot: 1 }, { type: 'armor_stand', x: 13, z: 15 }, { type: 'shelf', x: 16, z: 15, rot: 2 },
        ],
      }),
    },
  };
  /* a fresh building from a prefab at world tile (x,z) */
  function makeBuilding(key, x, z, id, seed) {
    const p = PREFABS[key]; if (!p) throw new Error('Unknown building prefab ' + key);
    return BuildingSpec.normalize(Object.assign(p.make(), { id: id || 'b_' + key, prefab: key, x, z, seed: seed || 11 }));
  }

  /* ---------- world format v2 (backward compatible with v1) ----------
     v2 = v1 + objects of kind 'building'. v1 files load unchanged; a v2 file with no buildings is saved as v1. */
  const WorldV2 = {
    VERSION: 2,
    upgrade(json) {
      if (!json || json.format !== (K.WORLD_FORMAT || 'kinstead-world-3d')) throw new Error('Not a Kinstead 3D world file.');
      if (json.version > 2) throw new Error('This world was saved by a newer builder (v' + json.version + '). This builder reads v2.');
      const objs = Array.isArray(json.objects) ? json.objects : [];
      return Object.assign({}, json, { version: 2, objects: objs.map((o) => (o && o.kind === 'building' ? BuildingSpec.normalize(o) : o)) });
    },
    /* save: version 1 unless a building is present (older builders keep opening building-free worlds) */
    versionFor(objects) { return (objects || []).some((o) => o && o.kind === 'building') ? 2 : 1; },
    /* runtime install for the standalone demo; the builder should merge this into 20-world.js instead (see INTEGRATION.md) */
    install() {
      const WD = K.WorldDoc; if (!WD || WD.__v2) return; WD.__v2 = true;
      const fromJSON = WD.fromJSON, toJSON = WD.prototype.toJSON;
      WD.fromJSON = (o) => { const up = WorldV2.upgrade(o); return fromJSON(Object.assign({}, up, { version: 1 })); };
      WD.prototype.toJSON = function () { const j = toJSON.call(this); j.version = WorldV2.versionFor(j.objects); return j; };
      WD.prototype.buildings = function () { return this.objects.filter((o) => o.kind === 'building'); };
    },
  };

  /* world-space helpers for a building object */
  const BuildingGeo = {
    origin(b) { return [b.x * TILE, b.z * TILE]; },
    worldBox(b) { return [b.x * TILE, b.z * TILE, (b.x + b.footprint.w) * TILE, (b.z + b.footprint.h) * TILE]; },
    /* world tile -> local tile */
    local(b, i, j) { return [i - b.x, j - b.z]; },
    contains(b, i, j) { return Footprint.inside(b.footprint, i - b.x, j - b.z); },
  };

  Object.assign(K, { BUILDING_LOOKS: LOOKS, SIGN_ICONS, WALLS, ROOF_STYLES, ROOF_MATERIALS, FLOORS, ROOM_TYPES, Footprint, BuildingSpec, FurnitureFootprint, BuildingLayout, BUILDING_PREFABS: PREFABS, makeBuilding, WorldV2, BuildingGeo });
})(typeof window !== 'undefined' ? window : globalThis);
