/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · buildings in play mode: the glue between the building module and the game.
     ItemBridge       one item vocabulary: building ids (iron_ore, wood, iron_sword…) map onto the game's
                      (ore, log, sword…), and every other building item is registered in K.ITEMS with an icon.
     BuildingPlayer   the player-state API K.BuildingInteractions expects, backed by the real K.PlayerState.
     BuildingPlay     owned by PlayMode: furniture entities, the station window model, sleeping, outfits,
                      mounting, the roof cut-away + camera zoom, the game clock, and saving progress into the world.
   Every furniture interaction type is registered in K.Interactions (bed, wardrobe, weapon_rack, …). */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const TILE = K.TILE || 0.5;
  const { FurnitureFootprint } = K;

  /* ---------- one item vocabulary ---------- */
  const ALIAS = { wood: 'log', iron_ore: 'ore', raw_fish: 'fish', iron_sword: 'sword', mail_shirt: 'mail', iron_helmet: 'helm', wooden_shield: 'shield', wood_axe: 'axe', pickaxe: 'pickaxe', bread: 'bread' };
  const ICON_OF = { coal: 'coal', hide: 'hide', leather: 'hide', iron_ingot: 'ingot', raw_meat: 'meat', cooked_meat: 'roast', turnip: 'turnip', flour: 'bag', cooked_fish: 'fish', stew: 'stew', cheese: 'cheese', apple: 'apple',
    keen_iron_sword: 'sword', iron_axe: 'axe', spear: 'spear', hunting_bow: 'bow', leather_armor: 'jerkin', horseshoes: 'shoe', saddle: 'saddle', bridle: 'saddle' };
  const DESC = { coal: 'Black and dusty. A forge needs it to smelt.', hide: 'A rough hide. Tan it at a workbench.', leather: 'Tanned leather, for armor and saddles.', iron_ingot: 'Smelted iron, ready for the anvil.',
    raw_meat: 'Cook it at a hearth before you eat it.', cooked_meat: 'Hot and filling. Heals 25 HP.', turnip: 'A hard winter turnip.', flour: 'Bake it at a hearth.', cooked_fish: 'Grilled ice fish. Heals 18 HP.',
    stew: 'Meat and turnips. Heals 40 HP.', cheese: 'Sharp hard cheese. Heals 8 HP.', apple: 'A wrinkled winter apple. Heals 5 HP.', keen_iron_sword: 'An iron sword with a keen edge.', iron_axe: 'A heavy iron war axe.',
    spear: 'Ash shaft, iron head. Long reach.', hunting_bow: 'Yew and sinew.', leather_armor: 'A stiff leather jerkin.', horseshoes: 'Four iron shoes for a horse.', saddle: 'A riding saddle. Saddle a horse with it.', bridle: 'Leather bridle and reins.' };
  const SLOT_OF = { mainHand: 'main', offHand: 'off', head: 'head', body: 'body' };

  class ItemBridge {
    static id(x) { return ALIAS[x] || x; }
    static mapCounts(o) { const out = {}; for (const [id, n] of Object.entries(o || {})) out[ItemBridge.id(id)] = (out[ItemBridge.id(id)] || 0) + n; return out; }
    /* kind used by racks / chests: weapon, tool, armor, food, tack, material */
    static kindOf(d) {
      if (!d) return 'misc';
      if (d.kind) return d.kind;
      if (d.slot === 'main') return d.tool ? 'tool' : 'weapon';
      if (d.slot && d.slot !== 'trinket') return 'armor';
      if (d.heal) return 'food';
      return d.slot ? 'misc' : 'material';
    }
    /* run once: remap the building data onto game ids and register the extra items */
    static install() {
      const D = K.BUILDING_DATA; if (!D || D.__bridged) return; D.__bridged = true;
      const ITEMS = K.ITEMS, BI = D.ITEMS;
      D.RECIPES.forEach((r) => { r.in = ItemBridge.mapCounts(r.in); r.out = ItemBridge.mapCounts(r.out); });
      for (const k of Object.keys(D.LOOT)) D.LOOT[k] = ItemBridge.mapCounts(D.LOOT[k]);
      D.OUTFITS.forEach((o) => { if (o.requires && o.requires.items) o.requires.items = ItemBridge.mapCounts(o.requires.items); });
      const food = {};
      for (const [id, f] of Object.entries(D.FOOD)) food[ItemBridge.id(id)] = f;
      food.fish = Object.assign({}, food.fish, { hp: 12 }); food.herb = { hp: 6, stamina: 2, warmth: 0 }; food.bread = Object.assign({}, food.bread, { hp: 10 });
      D.FOOD = food;
      // new items -> the game catalogue (same object PlayMode's ItemCatalog reads)
      for (const [id, b] of Object.entries(BI)) {
        if (ALIAS[id]) continue;
        const d = { name: b.name, stack: b.stack || 1, value: { material: 4, food: 6, weapon: 45, tool: 20, armor: 40, tack: 30 }[b.kind] || 5, desc: DESC[id] || '', icon: ICON_OF[id] || 'bag', kind: b.kind };
        if (b.slot) d.slot = SLOT_OF[b.slot] || b.slot;
        if (b.damage) d.atk = Math.max(1, b.damage - 2);
        if (b.armor) d.def = b.armor;
        if (food[id]) d.heal = food[id].hp;
        if (id === 'hunting_bow') d.desc += ' (+' + d.atk + ' attack)';
        d.id = id; ITEMS[id] = d;
      }
      // kinds for the game's own items, and the building ITEMS view (names + kinds) the interactions read
      for (const [id, d] of Object.entries(ITEMS)) { d.kind = ItemBridge.kindOf(d); if (food[id] && !d.heal) d.heal = food[id].hp; }
      D.ITEMS = new Proxy({}, { get: (t, id) => ITEMS[id], has: (t, id) => id in ITEMS, ownKeys: () => Reflect.ownKeys(ITEMS), getOwnPropertyDescriptor: (t, id) => (id in ITEMS ? { enumerable: true, configurable: true, value: ITEMS[id] } : undefined) });
      // hides drop from the beasts you fight; coal sometimes turns up in ore veins (see BuildingPlay.onGather)
      const add = (b, row) => { if (K.BESTIARY[b] && !K.BESTIARY[b].loot.some((r) => r[0] === row[0])) K.BESTIARY[b].loot.push(row); };
      add('ghoulA', ['hide', 1, 1, 0.55]); add('ghoulB', ['hide', 1, 2, 0.6]); add('troll', ['hide', 2, 3, 1]); add('troll', ['raw_meat', 1, 2, 1]); add('ghoulB', ['raw_meat', 1, 1, 0.4]);
      ItemBridge.icons();
    }
    static icons() {
      const D = K.Icons && K.Icons.DRAW; if (!D) return;
      const P = K.PAL || {}, r = K.ramp;
      const coal = r('#07080b', '#15171d', '#262a33', '#3d424e', '#5c6270'), meat = r('#2a070a', '#5c1018', '#8c2028', '#c04848', '#ec8a7a'), roast = r('#1e0c05', '#4a220c', '#7a3e16', '#a8642a', '#d89a52');
      const green = r('#0e1a12', '#1f3a24', '#2f5a33', '#4a8044', '#74a85a'), cheese = r('#3a2a06', '#7a5a12', '#c09a2a', '#ecd060', '#fff2a8'), purple = r('#1a0a1e', '#3a1a42', '#6a3478', '#9a5aa8', '#d8a8e0');
      const hide = r('#1e120a', '#3e2614', '#62401f', '#8a5e30', '#b08250'), stew = r('#2a1406', '#5a3010', '#8c5020', '#b8783a', '#e0aa60');
      const steel = P.steel, leather = P.leather, wood = P.wood, gold = P.gold, red = P.red;
      Object.assign(D, {
        coal(c) { c.poly([[2, 12], [4, 6], [8, 3], [12, 5], [14, 11], [9, 14]], coal).px(6, 7, coal[4]).px(10, 6, coal[4]); },
        hide(c) { c.poly([[2, 4], [6, 2], [10, 3], [14, 2], [13, 8], [14, 14], [9, 12], [5, 14], [2, 13], [3, 8]], hide).px(7, 6, hide[1]).px(10, 9, hide[1]); },
        ingot(c) { c.poly([[1, 11], [4, 6], [15, 6], [12, 11]], steel).rect(4, 7, 9, 1, steel[5]); },
        meat(c) { c.disc(7, 8, 5.5, meat).line(11, 11, 14, 14, P.bone ? P.bone[3] : 0xffffffff, 2).disc(9, 6, 1.5, r('#e0b0a0', '#fff0e6')); },
        roast(c) { c.disc(7, 8, 5.5, roast).line(11, 11, 14, 14, P.bone ? P.bone[3] : 0xffffffff, 2).px(5, 6, roast[4]).px(8, 5, roast[4]); },
        turnip(c) { c.disc(8, 10, 4.5, purple).line(8, 5, 6, 1, green[3], 2).line(8, 5, 11, 1, green[3], 2).px(8, 14, purple[1]); },
        stew(c) { c.poly([[1, 8], [15, 8], [13, 14], [3, 14]], wood).disc(8, 8, 5.5, stew, false).px(6, 7, meat[3]).px(10, 8, purple[3]).px(8, 6, stew[4]); },
        cheese(c) { c.poly([[1, 12], [9, 4], [15, 9], [15, 13], [1, 14]], cheese).px(6, 11, cheese[1]).px(11, 10, cheese[1]).px(9, 12, cheese[1]); },
        apple(c) { c.disc(8, 9, 5.5, red).line(8, 4, 9, 1, wood[3]).px(10, 3, green[3]).px(11, 3, green[4]).px(6, 7, red[5]); },
        spear(c) { c.line(2, 14, 12, 4, wood[4], 2).poly([[11, 5], [12, 1], [15, 0], [14, 3], [15, 6]], steel); },
        bow(c) { c.line(4, 2, 2, 8, wood[4], 2).line(2, 8, 4, 14, wood[4], 2).line(4, 2, 4, 14, P.snow ? P.snow[3] : steel[5]).line(4, 8, 14, 8, wood[3]).poly([[13, 7], [15, 8], [13, 9]], steel); },
        jerkin(c) { c.poly([[4, 3], [12, 3], [15, 7], [12, 8], [12, 14], [4, 14], [4, 8], [1, 7]], leather).line(8, 4, 8, 13, leather[1]).px(7, 6, gold[3]).px(7, 9, gold[3]); },
        shoe(c) { c.disc(8, 8, 6, steel).disc(8, 9, 3.2, r('#000000', '#000000')).px(4, 6, steel[1]).px(12, 6, steel[1]).px(4, 10, steel[1]).px(12, 10, steel[1]); },
        saddle(c) { c.poly([[1, 7], [4, 4], [8, 6], [12, 3], [15, 6], [13, 10], [3, 10]], leather).rect(7, 10, 2, 4, leather[2]).rect(6, 13, 4, 2, steel[4]).px(12, 4, gold[3]); },
      });
      if (K.Icons.cache) { K.Icons.cache.clear(); K.Icons.urls.clear(); }
    }
  }

  /* ---------- the player-state API for the building interactions, backed by K.PlayerState ---------- */
  class BuildingPlayer {
    constructor(play) { this.bp = play; }
    get p() { return this.bp.game.player; }
    /* bag + worn gear count (a mail shirt you wear still lets you into Warden plate) */
    count(id) { const p = this.p; let n = p.count(id); for (const s of K.SLOTS) if (p.equipment[s] === id) n++; return n; }
    items() { const p = this.p, out = {}; for (const s of p.bag) if (s) out[s.id] = (out[s.id] || 0) + s.n; for (const s of K.SLOTS) if (p.equipment[s]) out[p.equipment[s]] = (out[p.equipment[s]] || 0) + 1; return out; }
    addItem(id, n = 1) { return this.p.addItem(id, n) === 0; }
    /* takes from the bag first, then from worn gear */
    removeItem(id, n = 1) {
      const p = this.p; if (this.count(id) < n) return false;
      const fromBag = Math.min(n, p.count(id)); if (fromBag) p.removeItem(id, fromBag);
      let left = n - fromBag;
      for (const s of K.SLOTS) if (left > 0 && p.equipment[s] === id) { p.equipment[s] = null; left--; p.clampHp(); p.emit('equip', { slot: s, id: null }); }
      return true;
    }
    equip(id) { return this.p.equip(id); }
    unequip() { return true; }
    setOutfit(id) { this.bp.setLook(id); return true; }
    heal(n) { const p = this.p; if (n === 'full') p.healFull(); else p.heal(n); return p.hp; }
    restore(r) { if (r && r.hp) this.p.heal(r.hp); }
    mount(horseId) { return this.bp.mount(horseId); }
    dismount() { return this.bp.dismount({ toStall: this.bp.using }); }
    passTime(h) { this.bp.passTime(h); }
    get state() { const p = this.p; return { hp: p.hp, maxHp: p.stats().hpMax, mounted: this.bp.mounted ? this.bp.mounted.horseId : null, outfit: this.bp.look }; }
  }

  /* actions that need a choice open the station window; the rest run straight from the context menu */
  const CHOICE = new Set(['change_outfit', 'take_weapon', 'store_weapon', 'take_armor', 'store_armor', 'open', 'cook', 'eat', 'take_food', 'craft', 'take_tack']);
  const ACT_ICON = { sleep: 'hand', rest: 'hand', change_outfit: 'cloak', take_weapon: 'sword', store_weapon: 'sword', take_armor: 'helm', store_armor: 'helm', open: 'bag', cook: 'roast', warm: 'hand',
    eat: 'bread', take_food: 'bag', craft: 'ingot', stable_horse: 'saddle', feed: 'hand', saddle: 'saddle', mount: 'saddle', take_tack: 'saddle', read: 'eye', sit: 'hand', water_horse: 'hand', drink: 'hand' };
  const TYPE_ICON = { bed: 'hand', wardrobe: 'cloak', weapon_rack: 'sword', armor_stand: 'helm', storage: 'bag', cook: 'roast', eat: 'bread', smith: 'ingot', stable: 'saddle', mount: 'saddle', tack: 'saddle', read: 'eye', sit: 'hand', water: 'hand' };
  const TINTS = { red: 0xffffff, steel: 0xc6d2ea, leather: 0xd8b48c, fur: 0xe6d8c0, blue: 0x9fbaff, linen: 0xfff6e2 };

  /* ---------- building gameplay inside PlayMode ---------- */
  class BuildingPlay {
    constructor(game) { this.game = game; this.BI = null; this.player = new BuildingPlayer(this); this.look = 'traveler'; this.hours = 8; this.mounted = null; this.tile = null; this.using = null; this.horse = null; }
    get set() { return this.game.R.buildings; }
    get doc() { return this.game.doc; }
    get ui() { return this.game.ui; }
    /* ---- lifecycle ---- */
    enter(saved) {
      this.BI = new K.BuildingInteractions();
      this.tile = null; this.using = null; this.camOut = null;
      if (this.set.inside) { this.set.inside.setInterior(false, { snap: true }); this.set.inside = null; }
      this.look = (saved && saved.look) || 'traveler'; this.hours = saved && saved.hours != null ? +saved.hours : 8; this.mounted = null;
      this.applyLook();
      if (saved && saved.mounted) this.mount(saved.mounted.horseId, saved.mounted, true);
      this.setNight();
    }
    exit() {
      this.ui && this.ui.close('stn');
      if (this.set.inside) { this.set.inside.setInterior(false, { snap: true }); this.set.inside = null; }
      this.removeHorse(); this.tile = null;
    }
    /* ---- furniture as play-mode entities (picked, hovered and used like props) ---- */
    entities() {
      const out = [];
      for (const b of this.set.list) {
        for (const f of b.spec.furniture) {
          const def = b.catalog[f.type]; if (!def || !def.interact || !K.Interactions.has(def.interact.type)) continue;
          if (f.state && f.state.away) continue;
          const [w, d] = FurnitureFootprint.size(def, f.rot | 0), x = b.ox + (f.x + w / 2) * TILE, z = b.oz + (f.z + d / 2) * TILE;
          const [fi, fj] = FurnitureFootprint.front(def, f), gi = b.spec.x + fi, gj = b.spec.z + fj;
          const goal = this.set.at(gi, gj) === b && this.set.walkable(gi, gj) ? [(gi + 0.5) * TILE, (gj + 0.5) * TILE] : null;
          out.push({ id: 'f:' + b.spec.id + ':' + f.id, type: def.interact.type, name: def.name, x, z, y: b.y0 + K.BUILDING_FLOOR_Y, r: Math.max(w, d) * TILE * 0.5, h: def.type === 'rug' ? 0.2 : 1.0,
            furniture: true, buildingId: b.spec.id, furnitureId: f.id, def, goal, range: Math.max(w, d) * TILE * 0.5 + 0.6 });
        }
      }
      return out;
    }
    /* the live (saved) objects behind an entity: the doc's building and furniture */
    ref(e) {
      const b = this.doc.obj(e.buildingId), f = b && b.furniture.find((x) => x.id === e.furnitureId);
      return b && f ? { b, f } : null;
    }
    ctx(e, extra) { const r = this.ref(e); return Object.assign({ player: this.player, furniture: r.f, building: r.b }, extra || {}); }
    entry(e) { return this.BI.entry(e.type); }
    /* standing next to it already (or on its front tile)? */
    near(e) { const me = this.game.me, [i, j] = [Math.floor(me.x / TILE), Math.floor(me.z / TILE)]; const b=this.set.get(e.buildingId),ref=this.ref(e); if(!b||!ref)return false; const a=b.layout.roomAt(i-b.spec.x,j-b.spec.z),r=b.layout.roomAt(ref.f.x,ref.f.z); if(!a||!r||a.id!==r.id)return false; return this.set.interactablesNear(i, j).some((h) => h.building === e.buildingId && h.furniture.id === e.furnitureId); }
    approach(e) {
      const g=this.game, b=this.set.get(e.buildingId), ref=this.ref(e); if(!b||!ref)return null;
      const room=b.layout.roomAt(ref.f.x,ref.f.z), candidates=[];
      for(const [li,lj] of K.Footprint.tiles(b.spec.footprint)) {
        const i=b.spec.x+li,j=b.spec.z+lj, r=b.layout.roomAt(li,lj);
        if(room&&r&&room.id!==r.id)continue;
        if(!g.nav.ok(i,j)||!this.set.interactablesNear(i,j).some(h=>h.furniture.id===e.furnitureId))continue;
        const x=(i+.5)*TILE,z=(j+.5)*TILE;
        candidates.push({x,z,d:Math.hypot(g.me.x-x,g.me.z-z)});
      }
      candidates.sort((a,b)=>a.d-b.d);
      for(const tgt of candidates){const path=g.nav.find(g.me.x,g.me.z,tgt.x,tgt.z);if(path)return {tgt,path};}
      return null;
    }
    actionsFor(e) {
      const r = this.ref(e); if (!r) return [];
      const list = (e.def.interact.actions || this.entry(e).actions).filter((a) => this.entry(e).actions.some((x) => x.id === a.id));
      return list.filter((a) => {
        if (e.type === 'mount') { const st = r.f.state || {}; if (a.id === 'saddle') return !st.saddled; if (a.id === 'mount') return !this.mounted; }
        if (e.type === 'stable' && a.id === 'stable_horse') return !!this.mounted;
        return true;
      }).map((a) => ({ id: a.id, label: a.label, icon: ACT_ICON[a.id] || 'hand', range: e.range, run: (game, x) => this.use(x, a.id) }));
    }
    inspect(e) {
      const r = this.ref(e), b = r && this.set.get(e.buildingId), room = b && b.layout.roomAt(r.f.x, r.f.z), st = (r && r.f.state) || {};
      const rows = [['Room', room ? (room.name || (K.ROOM_TYPES[room.type] || {}).name || room.type) : '—']];
      if (st.items) rows.push(['Holds', Object.entries(st.items).map(([id, n]) => n + ' × ' + this.game.items.get(id).name).join(', ') || 'nothing']);
      if (e.type === 'mount') rows.push(['Saddled', st.saddled ? 'yes' : 'no']);
      return { title: e.name, sub: 'Furniture', body: (e.def.interact.actions || []).map((a) => a.label).join(' · '), icon: TYPE_ICON[e.type] || 'hand', rows };
    }

    /* ---- using furniture ---- */
    use(e, actionId) {
      const g = this.game; this.using = e;
      if (!this.ref(e)) return;
      if (CHOICE.has(actionId)) { this.openStation(e, actionId); return; }
      if (e.type === 'bed' && actionId === 'sleep') { this.sleep(e); return; }
      this.run(e, actionId, null);
      g.face(g.me, e);
    }
    /* checks the game rules the building module leaves to the player API (a full bag) */
    blocked(e, actionId, choice) {
      const p = this.game.player, room = (id, n = 1) => p.canAdd(id, n);
      let out = null;
      if (actionId === 'craft' || actionId === 'cook') { const r = K.BUILDING_DATA.RECIPES.find((x) => x.id === choice); if (r) out = r.out; }
      else if (/^take_/.test(actionId)) out = { [choice]: 1 };
      else if (actionId === 'open' && choice && choice.startsWith('take:')) out = { [choice.slice(5)]: 1 };
      if (out) for (const [id, n] of Object.entries(out)) if (!room(id, n)) return 'Your bag is full.';
      return null;
    }
    run(e, actionId, choice) {
      const g = this.game, entry = this.entry(e); if (!entry || !this.ref(e)) return null;
      const why = this.blocked(e, actionId, choice);
      if (why) { g.toast(why); g.float(g.me, why, 'miss'); return { ok: false, message: why }; }
      let res;
      try { res = entry.run(actionId, this.ctx(e, { choice })); } catch (err) { console.error(err); res = { ok: false, message: 'That did not work.' }; }
      if (!res) return null;
      if (res.ok && actionId === 'read') g.ui.openCard(e, { title: 'From the bookshelf', sub: e.name, body: res.message, icon: 'eye', rows: [] }, ...g.toScreen(e.x, e.y + 1, e.z));
      else g.toast(res.message);
      if (res.ok) {
        if (res.food) g.float(g.me, '+' + ((K.BUILDING_DATA.FOOD[res.food] || {}).hp || 0) + ' HP', 'heal', g.items.get(res.food).icon);
        else if (res.recipe) { const r = K.BUILDING_DATA.RECIPES.find((x) => x.id === res.recipe); const [id] = Object.keys(r.out); g.float(g.me, '+' + g.items.get(id).name, 'loot', g.items.get(id).icon); g.gainXp(4); }
        if (actionId === 'saddle' || actionId === 'stable_horse' || actionId === 'mount') this.refreshBuildings();
        this.dirty();
      } else g.float(g.me, res.message.length > 34 ? 'Can\'t' : res.message, 'miss');
      if (g.ui.isOpen('stn')) this.renderStation();
      return res;
    }
    sleep(e) {
      const g = this.game;
      g.channel({ label: 'Sleeping…', time: 2.4, anim: 'idle', fade: true, onDone: () => { const res = this.run(e, 'sleep', null); if (res && res.ok) { g.me.view.flash('heal'); g.float(g.me, 'Rested', 'heal'); } } });
    }
    /* ---- the station window: one tab per choice action ---- */
    openStation(e, actionId) { this.station = { e, action: actionId }; this.game.ui.openStation(); this.renderStation(); }
    stationModel() {
      const s = this.station; if (!s) return null;
      const e = s.e, entry = this.entry(e), g = this.game, it = (id) => g.items.get(id) || { name: id, icon: 'bag' };
      const ctx = this.ctx(e), acts = this.actionsFor(e).filter((a) => CHOICE.has(a.id));
      const opts = entry.options(s.action, ctx) || [];
      const why = e.def.interact.requires ? this.BI.check(e.def.interact.requires, ctx) : null;
      const b = this.set.get(e.buildingId), r = this.ref(e), room = b && b.layout.roomAt(r.f.x, r.f.z);
      const verb = { craft: 'Make', cook: 'Cook', change_outfit: 'Wear', take_weapon: 'Take', take_armor: 'Take', take_tack: 'Take', store_weapon: 'Store', store_armor: 'Store', eat: 'Eat', take_food: 'Take' }[s.action] || 'Use';
      const rows = opts.map((o) => {
        const row = { id: o.id, label: o.label, available: o.available !== false && !why, reason: why || o.reason || '', count: o.count, desc: o.desc || '' };
        if (o.in) { row.chips = Object.entries(o.in).map(([id, n]) => ({ id, name: it(id).name, icon: it(id).icon, need: n, have: this.player.count(id) })); row.out = Object.entries(o.out).map(([id, n]) => ({ id, name: it(id).name, icon: it(id).icon, n })); row.icon = it(Object.keys(o.out)[0]).icon; }
        else if (s.action === 'change_outfit') { row.icon = 'cloak'; row.current = this.look === o.id; row.tint = TINTS[(K.BUILDING_DATA.OUTFITS.find((x) => x.id === o.id) || {}).tint]; }
        else { const id = o.id.includes(':') ? o.id.split(':')[1] : o.id; row.icon = it(id).icon; if (o.hp) row.desc = '+' + o.hp + ' HP'; }
        row.verb = s.action === 'open' ? (o.id.startsWith('take:') ? 'Take' : 'Put') : verb;
        row.group = s.action === 'open' ? (o.id.startsWith('take:') ? 'In the chest' : 'Your bag') : null;
        return row;
      });
      const empty = { take_weapon: 'The rack is empty.', take_armor: 'The stand is empty.', take_tack: 'Nothing on the rack.', store_weapon: 'You carry no weapons or tools.', store_armor: 'You carry no armor.', eat: 'You have nothing to eat.', take_food: 'The pantry is bare.', open: 'The chest is empty and so is your bag.' }[s.action] || 'Nothing here.';
      return { title: e.name, sub: room ? (room.name || (K.ROOM_TYPES[room.type] || {}).name || '') : '', tabs: acts.map((a) => ({ id: a.id, label: a.label, on: a.id === s.action })), rows, empty, warn: why,
        note: s.action === 'craft' || s.action === 'cook' ? 'Ingredients come from your bag: mine ore, chop pine, hunt for hides.' : s.action === 'change_outfit' ? 'Your outfit changes how you look in the world.' : '' };
    }
    renderStation() { if (this.game.ui.isOpen('stn')) this.game.ui.renderStation(this.stationModel()); }
    stationTab(id) { if (this.station) { this.station.action = id; this.renderStation(); } }
    stationPick(optId) { const s = this.station; if (!s) return; this.run(s.e, s.action, optId); }

    /* ---- outfit (wardrobe): sprite + tint through the ActorView ---- */
    setLook(id) { this.look = id; this.applyLook(); this.dirty(); }
    applyLook() {
      const o = K.BUILDING_DATA.OUTFITS.find((x) => x.id === this.look), g = this.game; if (!o || !g.player) return;
      g.player.setOutfit(o.sprite);
      if (g.me) { g.me.view.setSprite(o.sprite); if (g.me.view.setTint) g.me.view.setTint(TINTS[o.tint] != null ? TINTS[o.tint] : 0xffffff); }
    }
    /* ---- horses ---- */
    mount(horseId, where, silent) {
      const g = this.game, u = where || (this.using && { building: this.using.buildingId, furniture: this.using.furnitureId });
      if (!u) return false;
      const b = this.doc.obj(u.building), f = b && b.furniture.find((x) => x.id === u.furniture);
      if (!f) return false;
      f.state = Object.assign(f.state || {}, { away: true });
      this.mounted = { horseId, building: u.building, furniture: u.furniture, coat: (f.state && f.state.coat) || 'bay' };
      this.refreshBuildings(); this.makeHorse();
      if (!silent) { g.float(g.me, 'Mounted', 'heal'); g.toast('You ride. Faster on open ground. Dismount from the bar or press M.'); }
      g.ui.bar(); return true;
    }
    /* dismount: the horse goes back to its stall (or the stall you are using) */
    dismount(opts = {}) {
      const g = this.game, m = this.mounted; if (!m) return false;
      const b = this.doc.obj(m.building), f = b && b.furniture.find((x) => x.id === m.furniture);
      if (f && f.state) { delete f.state.away; }
      this.mounted = null; this.removeHorse(); this.refreshBuildings(); g.ui.bar(); this.dirty();
      if (!opts.quiet) g.toast(opts.toStall ? 'You lead your horse into the stall.' : 'You dismount. Your horse trots back to its stall.');
      return true;
    }
    makeHorse() {
      this.removeHorse(); const R = this.game.R, def = K.FURNITURE.horse; if (!def || !R.bmats) return;
      const k = new K.VoxKit(); try { def.build(k, { state: { coat: this.mounted.coat } }, def); } catch (e) { console.warn(e); return; }
      const grp = new THREE.Group(); k.meshes(R.bmats).forEach((m) => grp.add(m)); grp.name = 'ridden-horse';
      R.scene.add(grp); this.horse = grp;
    }
    removeHorse() { if (!this.horse) return; this.game.R.scene.remove(this.horse); this.horse.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); this.horse = null; }
    get speedMul() { return this.mounted ? 1.85 : 1; }
    get riderLift() { return this.mounted ? 0.62 : 0; }
    /* ---- time ---- */
    passTime(h) { this.hours += h; this.setNight(); this.game.ui && this.game.ui.bar(); }
    get clock() { const d = Math.floor(this.hours / 24) + 1, h = this.hours % 24, hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return { day: d, text: `Day ${d} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }; }
    setNight() { const h = this.hours % 24, n = h < 6 ? 1 : h < 8 ? (8 - h) / 2 : h < 18 ? 0 : h < 20 ? (h - 18) / 2 : 1; if (this.set && this.set.ctx.mats) this.set.setNight(n); }
    /* ---- per frame: roof cut-away + camera zoom when the player's tile is inside a building ---- */
    update(dt) {
      const g = this.game, me = g.me, i = Math.floor(me.x / TILE), j = Math.floor(me.z / TILE), key = i + ',' + j;
      if (key !== this.tile) {
        this.tile = key;
        const r = this.set.actorTile(i, j, g.app.camera);
        if (r.changed) {
          const rig = g.app.rig.goal;
          if (r.building) {
            if (!this.camOut) this.camOut = { dist: rig.dist, pitch: rig.pitch };
            g.app.rig.set({ dist: Math.min(r.hint.dist, 9.5), pitch: Math.max(rig.pitch, r.hint.pitch) });   // zoom in and look down into the room
            const room = r.room; g.toast('You step inside' + (room ? ' · ' + (room.name || (K.ROOM_TYPES[room.type] || {}).name || room.type) : '') + '.');
          } else if (this.camOut) { g.app.rig.set(this.camOut); this.camOut = null; }
        }
        if (r.building) { const room = r.room, rn = room ? (room.name || (K.ROOM_TYPES[room.type] || {}).name || room.type) : ''; if (rn !== this.roomName) { this.roomName = rn; g.ui.bar(); } }
        else if (this.roomName) { this.roomName = ''; g.ui.bar(); }
      }
      if (this.horse) {
        const v = me.view, a = Math.atan2(v.dir.x, v.dir.z);
        this.horse.position.set(me.x, me.y, me.z); this.horse.rotation.y = a;
      }
      if (this.station && g.ui.isOpen('stn') && Math.hypot(me.x - this.station.e.x, me.z - this.station.e.z) > 3.2) g.ui.close('stn');
    }
    get inside() { return this.set.inside ? this.set.inside.spec.id : null; }
    refreshBuildings() { this.game.R.syncBuildings(); if (this.game.props) this.game.refreshProps(); }
    dirty() { const app = this.game.app; app.dirtySince = true; app.updateDirty(); }

    /* ---- progress saved into the world (doc.game) ---- */
    snapshot() {
      const g = this.game, nodes = {};
      for (const [id, n] of g.nodes || []) if (n.charges < n.max || n.respawnAt) nodes[id] = { charges: n.charges, max: n.max, respawnIn: n.respawnAt ? Math.max(0, +(n.respawnAt - g.t).toFixed(1)) : 0 };
      return { v: 1, player: g.player.toJSON(), look: this.look, hours: +this.hours.toFixed(3), mounted: this.mounted ? { horseId: this.mounted.horseId, building: this.mounted.building, furniture: this.mounted.furniture } : null,
        nodes, flags: [...g.flags], pos: g.me ? [+g.me.x.toFixed(3), +g.me.z.toFixed(3)] : null };
    }
    restoreNodes(saved) {
      const g = this.game;
      for (const [id, n] of Object.entries((saved && saved.nodes) || {})) {
        if (!g.doc.obj(id)) continue;
        g.nodes.set(id, { charges: n.charges | 0, max: n.max || 3, respawnAt: n.respawnIn ? g.t + n.respawnIn : 0 });
        if ((n.charges | 0) <= 0) g.R.setPropState(id, 'depleted');
      }
    }
  }

  /* every furniture interaction type -> the play-mode interaction registry */
  function registerAll() {
    const BI = new K.BuildingInteractions();
    for (const e of BI.registryEntries()) {
      K.Interactions.register(e.type, {
        furniture: true, color: 0xffd9a0, name: (x) => x.name,
        cursor: () => TYPE_ICON[e.type] || 'hand',
        actions: (x, game) => game.bplay.actionsFor(x).concat([{ id: 'inspect', label: 'Inspect', icon: 'eye', run: (gm, y) => gm.inspect(y) }]),
        inspect: (x, game) => game.bplay.inspect(x),
      });
    }
  }

  ItemBridge.install();
  registerAll();
  Object.assign(K, { ItemBridge, BuildingPlayer, BuildingPlay, BUILDING_ITEM_ALIAS: ALIAS, OUTFIT_TINTS: TINTS });
})(typeof window !== 'undefined' ? window : globalThis);
