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
  class BuildingColor {
    static isColor(value) {
      return typeof value === 'string' && /^(#[0-9a-fA-F]{6}|[a-zA-Z]+)$/.test(value);
    }
  }
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
      for (const k of ['wallColor', 'trim', 'doorColor', 'shutterColor']) { const v = o[k] !== undefined ? o[k] : look[k]; if (BuildingColor.isColor(v)) o[k] = v; else delete o[k]; }
      const sg = o.sign !== undefined ? o.sign : look.sign;
      if (sg && typeof sg === 'object' && SIGN_ICONS.includes(sg.icon)) o.sign = { icon: sg.icon, board: BuildingColor.isColor(sg.board) ? sg.board : 'signBoard', emblemIcon: SIGN_ICONS.includes(sg.emblemIcon) ? sg.emblemIcon : undefined, text: typeof sg.text === 'string' ? sg.text.slice(0, 14) : undefined, textColor: BuildingColor.isColor(sg.textColor) ? sg.textColor : undefined, emblem: sg.emblem !== false };
      else if (sg === false) o.sign = false; else delete o.sign;
      const pr = o.props !== undefined ? o.props : look.props;
      if (Array.isArray(pr) && pr.length) o.props = pr.filter((p) => p && typeof p.type === 'string').slice(0, 8).map((p) => ({ type: p.type, side: p.side === 'l' ? 'l' : 'r', at: Math.max(0, Math.min(12, p.at | 0)), out: Math.max(0, Math.min(3, p.out | 0)), rot: ((p.rot | 0) % 4 + 4) % 4 }));
      else if (Array.isArray(pr)) o.props = []; else delete o.props;
      const bt = o.bunting !== undefined ? o.bunting : look.bunting;
      if (Array.isArray(bt) && bt.filter(BuildingColor.isColor).length) o.bunting = bt.filter(BuildingColor.isColor).slice(0, 8); else delete o.bunting;
      const aw = o.awning !== undefined ? o.awning : look.awning;
      if (Array.isArray(aw) && aw.length === 2 && aw.every(BuildingColor.isColor)) o.awning = aw.slice(); else delete o.awning;
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

  /* creates a fresh building from a prefab at world tile (x,z) */
  class BuildingFactory {
    static make(key, x, z, id, seed) {
      const prefab = K.BuildingPrefabs.DATA[key];
      if (!prefab) throw new Error('Unknown building prefab ' + key);
      return BuildingSpec.normalize(Object.assign(prefab.make(), {
        id: id || 'b_' + key, prefab: key, x, z, seed: seed || 11,
      }));
    }
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
  };

  /* world-space helpers for a building object */
  const BuildingGeo = {
    origin(b) { return [b.x * TILE, b.z * TILE]; },
    worldBox(b) { return [b.x * TILE, b.z * TILE, (b.x + b.footprint.w) * TILE, (b.z + b.footprint.h) * TILE]; },
    /* world tile -> local tile */
    local(b, i, j) { return [i - b.x, j - b.z]; },
    contains(b, i, j) { return Footprint.inside(b.footprint, i - b.x, j - b.z); },
  };

  Object.assign(K, { BUILDING_LOOKS: LOOKS, SIGN_ICONS, WALLS, ROOF_STYLES, ROOF_MATERIALS, FLOORS, ROOM_TYPES,
    Footprint, BuildingSpec, FurnitureFootprint, BUILDING_PREFABS: K.BuildingPrefabs.DATA,
    makeBuilding: BuildingFactory.make, BuildingFactory, WorldV2, BuildingGeo });
})(typeof window !== 'undefined' ? window : globalThis);
