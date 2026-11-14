/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · buildings: interaction registry entries for furniture, driven by a player-state API.
   Play mode owns the player and the registry; this module only supplies one entry per interaction type.

   Player-state API the play mode must pass in (required unless marked optional):
     count(itemId) -> n                 addItem(itemId, n) -> bool        removeItem(itemId, n) -> bool
     equip(itemId) -> bool              setOutfit(outfitId) -> bool        heal(amount | 'full') -> hp
     mount(horseId) -> bool             dismount?() -> bool                passTime?(hours)
     items?() -> { itemId: n }          unequip?(itemId) -> bool           restore?({ hp, stamina, warmth })
     state?: { hp, maxHp, mounted, outfit }
   ctx for every call: { player, furniture (the building's furniture object; its .state persists in the world file), building? (normalized spec), choice? } */
(function (G) {
  const K = G.K;

  const BOOKS = [
    'The Frostcliff Chronicle: the bridge was raised in a single winter, and the troll came with the first thaw.',
    'A Smith\'s Primer: two parts ore to one of wood for a blade; a hide lining keeps a helmet from ringing.',
    'Of Horses in Snow: a saddled horse doubles a traveler\'s pace, but never ride one that has not been watered.',
    'Rime Witch Ballads: she sings to the ice and the ice listens.',
  ];

  class BuildingInteractions {
    constructor(data = K.BUILDING_DATA, catalog = K.FURNITURE) { this.d = data; this.catalog = catalog; this.entries = this.build(); }
    /* the registry: one entry per interaction type -> register each with the play-mode interaction registry */
    registryEntries() { return Object.values(this.entries); }
    entry(type) { return this.entries[type] || null; }
    /* entry for a placed furniture item (by its catalog type) */
    forFurniture(f) { const def = this.catalog[f.type]; return def && def.interact ? { def, entry: this.entries[def.interact.type], interact: def.interact } : null; }

    /* ---- helpers ---- */
    item(id) { return this.d.ITEMS[id] || { name: id, kind: 'misc' }; }
    store(f, kind) {
      f.state = f.state || {};
      if (!f.state.items) f.state.items = Object.assign({}, this.d.LOOT[f.type] || {});
      return f.state.items;
    }
    has(player, req) { return Object.entries(req || {}).every(([id, n]) => player.count(id) >= n); }
    missing(player, req) { return Object.entries(req || {}).filter(([id, n]) => player.count(id) < n).map(([id, n]) => `${n - player.count(id)} × ${this.item(id).name}`); }
    passTime(p, h) { if (p.passTime && h) p.passTime(h); }
    move(from, to, id, n = 1) { if ((from[id] || 0) < n) return false; from[id] -= n; if (!from[id]) delete from[id]; to[id] = (to[id] || 0) + n; return true; }
    ok(message, extra) { return Object.assign({ ok: true, message }, extra || {}); }
    no(message) { return { ok: false, message }; }
    /* requires: { items:{id:n} } | { state:'saddled' } | { nearby:'forge' } */
    check(req, ctx) {
      if (!req) return null;
      if (req.items && !this.has(ctx.player, req.items)) return 'Needs ' + this.missing(ctx.player, req.items).join(', ') + '.';
      if (req.state && !(ctx.furniture.state && ctx.furniture.state[req.state])) return 'The horse is not ' + req.state + ' yet.';
      if (req.nearby && ctx.building && !ctx.building.furniture.some((f) => f.type === req.nearby)) return 'Needs a ' + req.nearby + ' in this building.';
      return null;
    }
    recipes(station) { return this.d.RECIPES.filter((r) => r.station === station); }
    craft(ctx, station) {
      const r = this.d.RECIPES.find((x) => x.id === ctx.choice && x.station === station);
      if (!r) return this.no('Pick something to make.');
      if (!this.has(ctx.player, r.in)) return this.no('Missing ' + this.missing(ctx.player, r.in).join(', ') + '.');
      for (const [id, n] of Object.entries(r.in)) ctx.player.removeItem(id, n);
      for (const [id, n] of Object.entries(r.out)) ctx.player.addItem(id, n);
      this.passTime(ctx.player, r.hours);
      return this.ok(`Made ${Object.entries(r.out).map(([id, n]) => (n > 1 ? n + ' × ' : '') + this.item(id).name).join(', ')}.`, { recipe: r.id });
    }
    recipeOptions(ctx, station) { return this.recipes(station).map((r) => ({ id: r.id, label: r.name, in: r.in, out: r.out, available: this.has(ctx.player, r.in), reason: this.has(ctx.player, r.in) ? '' : 'Missing ' + this.missing(ctx.player, r.in).join(', ') })); }
    kindOptions(items, kinds) { return Object.entries(items).filter(([id, n]) => n > 0 && kinds.includes(this.item(id).kind)).map(([id, n]) => ({ id, label: this.item(id).name, count: n, available: true })); }
    playerItems(p) { if (p.items) return p.items(); const out = {}; for (const id of Object.keys(this.d.ITEMS)) { const n = p.count(id); if (n) out[id] = n; } return out; }
    eat(ctx, src) {
      const id = ctx.choice, food = this.d.FOOD[id]; if (!food) return this.no('That is not food.');
      if (src) { if (!src[id]) return this.no('None left.'); src[id]--; if (!src[id]) delete src[id]; } else if (!ctx.player.removeItem(id, 1)) return this.no('You have no ' + this.item(id).name + '.');
      if (ctx.player.restore) ctx.player.restore({ hp: food.hp, stamina: food.stamina, warmth: food.warmth }); else ctx.player.heal(food.hp);
      return this.ok(`Ate ${this.item(id).name} (+${food.hp} HP).`, { food: id });
    }

    /* ---- the entries ---- */
    build() {
      const E = {}, self = this;
      const def = (type, label, actions, options, run) => (E[type] = { type, label, actions, options: options || (() => []), run, requires: undefined });
      def('bed', 'Bed', [{ id: 'sleep', label: 'Sleep' }, { id: 'rest', label: 'Rest 1 hour' }], null, (a, ctx) => {
        const p = ctx.player;
        if (a === 'sleep') { const hp = p.heal('full'); self.passTime(p, self.d.SLEEP_HOURS); return self.ok(`You sleep ${self.d.SLEEP_HOURS} hours and wake rested (HP ${hp}).`, { hours: self.d.SLEEP_HOURS }); }
        if (a === 'rest') { const hp = p.heal(15); self.passTime(p, 1); return self.ok(`You rest for an hour (HP ${hp}).`, { hours: 1 }); }
        return self.no('Unknown action.');
      });
      def('wardrobe', 'Wardrobe', [{ id: 'change_outfit', label: 'Change outfit' }],
        (a, ctx) => self.d.OUTFITS.map((o) => { const why = self.check(o.requires, ctx); return { id: o.id, label: o.name, desc: o.desc, available: !why, reason: why || '' }; }),
        (a, ctx) => {
          const o = self.d.OUTFITS.find((x) => x.id === ctx.choice); if (!o) return self.no('Pick an outfit.');
          const why = self.check(o.requires, ctx); if (why) return self.no(why);
          ctx.player.setOutfit(o.id); return self.ok(`You change into the ${o.name}.`, { outfit: o.id, sprite: o.sprite, tint: o.tint });
        });
      const rack = (type, label, kinds, takeId, storeId) => def(type, label, [{ id: takeId, label: 'Take' }, { id: storeId, label: 'Store' }],
        (a, ctx) => (a === takeId ? self.kindOptions(self.store(ctx.furniture), kinds) : self.kindOptions(self.playerItems(ctx.player), kinds)),
        (a, ctx) => {
          const box = self.store(ctx.furniture), id = ctx.choice; if (!id || !kinds.includes(self.item(id).kind)) return self.no('Pick an item.');
          if (a === takeId) { if (!box[id]) return self.no('Not on the rack.'); box[id]--; if (!box[id]) delete box[id]; ctx.player.addItem(id, 1); ctx.player.equip(id); return self.ok(`You take and equip the ${self.item(id).name}.`); }
          if (a === storeId) { if (!ctx.player.removeItem(id, 1)) return self.no('You have none.'); if (ctx.player.unequip) ctx.player.unequip(id); box[id] = (box[id] || 0) + 1; return self.ok(`You store the ${self.item(id).name}.`); }
          return self.no('Unknown action.');
        });
      rack('weapon_rack', 'Weapon rack', ['weapon', 'tool'], 'take_weapon', 'store_weapon');
      rack('armor_stand', 'Armor stand', ['armor'], 'take_armor', 'store_armor');
      def('storage', 'Storage', [{ id: 'open', label: 'Open storage' }],
        (a, ctx) => {
          const box = self.store(ctx.furniture), mine = self.playerItems(ctx.player);
          return [...Object.entries(box).map(([id, n]) => ({ id: 'take:' + id, label: 'Take ' + self.item(id).name, count: n, available: true })),
            ...Object.entries(mine).map(([id, n]) => ({ id: 'put:' + id, label: 'Put ' + self.item(id).name, count: n, available: true }))];
        },
        (a, ctx) => {
          const box = self.store(ctx.furniture);
          if (!ctx.choice) return self.ok('The chest holds: ' + (Object.entries(box).map(([id, n]) => n + ' × ' + self.item(id).name).join(', ') || 'nothing') + '.', { contents: Object.assign({}, box) });
          const [op, id] = ctx.choice.split(':'), n = ctx.count || 1;
          if (op === 'take') { if ((box[id] || 0) < n) return self.no('Not enough in the chest.'); box[id] -= n; if (!box[id]) delete box[id]; ctx.player.addItem(id, n); return self.ok(`Took ${n} × ${self.item(id).name}.`); }
          if (op === 'put') { if (!ctx.player.removeItem(id, n)) return self.no('You do not have that.'); box[id] = (box[id] || 0) + n; return self.ok(`Stored ${n} × ${self.item(id).name}.`); }
          return self.no('Unknown storage operation.');
        });
      def('cook', 'Hearth', [{ id: 'cook', label: 'Cook' }, { id: 'warm', label: 'Warm up' }],
        (a, ctx) => (a === 'cook' ? self.recipeOptions(ctx, 'hearth') : []),
        (a, ctx) => {
          if (a === 'cook') return self.craft(ctx, 'hearth');
          if (a === 'warm') { if (ctx.player.restore) ctx.player.restore({ warmth: 60 }); self.passTime(ctx.player, 0.25); return self.ok('You warm your hands by the fire.'); }
          return self.no('Unknown action.');
        });
      def('eat', 'Eat', [{ id: 'eat', label: 'Eat' }, { id: 'take_food', label: 'Take food' }],
        (a, ctx) => {
          const pantry = ctx.furniture.type === 'pantry' ? self.store(ctx.furniture) : null;
          const src = a === 'take_food' ? pantry || {} : Object.assign({}, self.playerItems(ctx.player));
          if (a === 'eat' && pantry) for (const [id, n] of Object.entries(pantry)) src[id] = (src[id] || 0) + n;
          return self.kindOptions(src, ['food']).map((o) => Object.assign(o, { hp: (self.d.FOOD[o.id] || {}).hp || 0 }));
        },
        (a, ctx) => {
          const pantry = ctx.furniture.type === 'pantry' ? self.store(ctx.furniture) : null;
          if (a === 'take_food') { if (!pantry || !pantry[ctx.choice]) return self.no('Nothing like that here.'); self.move(pantry, {}, ctx.choice, 1); ctx.player.addItem(ctx.choice, 1); return self.ok(`Took ${self.item(ctx.choice).name}.`); }
          if (a === 'eat') return self.eat(ctx, ctx.player.count(ctx.choice) > 0 ? null : pantry);
          return self.no('Unknown action.');
        });
      def('smith', 'Smith', [{ id: 'craft', label: 'Craft' }],
        (a, ctx) => self.recipeOptions(ctx, self.catalog[ctx.furniture.type].interact.station),
        (a, ctx) => {
          const it = self.catalog[ctx.furniture.type].interact, why = self.check(it.requires, ctx);
          if (why) return self.no(why);
          return self.craft(ctx, it.station);
        });
      def('stable', 'Stable stall', [{ id: 'stable_horse', label: 'Stable horse' }, { id: 'feed', label: 'Feed horse' }], null, (a, ctx) => {
        const p = ctx.player, st = (ctx.furniture.state = ctx.furniture.state || {});
        if (a === 'stable_horse') { if (!(p.state && p.state.mounted)) return self.no('You are not riding.'); st.horseId = p.state.mounted; if (p.dismount) p.dismount(); return self.ok('You lead your horse into the stall.', { horseId: st.horseId }); }
        if (a === 'feed') { st.fedAt = Date.now(); return self.ok('You fill the hay rack.'); }
        return self.no('Unknown action.');
      });
      def('mount', 'Horse', [{ id: 'saddle', label: 'Saddle horse' }, { id: 'mount', label: 'Mount horse' }], null, (a, ctx) => {
        const st = (ctx.furniture.state = ctx.furniture.state || {}), acts = self.catalog.horse.interact.actions, req = (acts.find((x) => x.id === a) || {}).requires;
        if (a === 'saddle' && st.saddled) return self.ok('Already saddled.');
        const why = self.check(req, ctx); if (why) return self.no(why);
        if (a === 'saddle') { ctx.player.removeItem('saddle', 1); st.saddled = true; return self.ok('You saddle the horse.'); }
        if (a === 'mount') { const id = st.horseId || ctx.furniture.id; ctx.player.mount(id); return self.ok('You mount up.', { horseId: id }); }
        return self.no('Unknown action.');
      });
      def('tack', 'Tack rack', [{ id: 'take_tack', label: 'Take tack' }, { id: 'craft', label: 'Make tack' }],
        (a, ctx) => (a === 'take_tack' ? self.kindOptions(self.store(ctx.furniture), ['tack']) : self.recipeOptions(ctx, 'tack')),
        (a, ctx) => {
          if (a === 'craft') return self.craft(ctx, 'tack');
          const box = self.store(ctx.furniture); if (!box[ctx.choice]) return self.no('Not on the rack.');
          box[ctx.choice]--; if (!box[ctx.choice]) delete box[ctx.choice]; ctx.player.addItem(ctx.choice, 1); return self.ok(`Took the ${self.item(ctx.choice).name}.`);
        });
      def('read', 'Bookshelf', [{ id: 'read', label: 'Read' }], null, (a, ctx) => {
        const st = (ctx.furniture.state = ctx.furniture.state || {}), i = (st.page = ((st.page | 0) + 1) % BOOKS.length);
        self.passTime(ctx.player, 0.5); return self.ok(BOOKS[i], { page: i });
      });
      def('sit', 'Sit', [{ id: 'sit', label: 'Sit' }], null, () => self.ok('You sit for a moment.', { pose: 'sit' }));
      def('water', 'Water trough', [{ id: 'water_horse', label: 'Water horse' }, { id: 'drink', label: 'Drink' }], null, (a, ctx) => {
        if (a === 'drink') { if (ctx.player.restore) ctx.player.restore({ stamina: 10 }); return self.ok('Icy, but it wakes you up.'); }
        ctx.furniture.state = Object.assign(ctx.furniture.state || {}, { wateredAt: Date.now() }); return self.ok('The horses drink.');
      });
      return E;
    }
  }

  /* reference player-state implementation (demo + tests); play mode passes its own object with the same methods */
  class SimplePlayerState {
    constructor(opts = {}) { this.inv = Object.assign({}, opts.items || {}); this.hp = opts.hp == null ? 100 : opts.hp; this.maxHp = opts.maxHp || 100; this.outfit = opts.outfit || 'traveler'; this.slots = {}; this.mounted = null; this.hours = 0; this.stamina = 50; this.warmth = 0; }
    get state() { return { hp: this.hp, maxHp: this.maxHp, mounted: this.mounted, outfit: this.outfit }; }
    count(id) { return this.inv[id] | 0; }
    items() { return Object.assign({}, this.inv); }
    addItem(id, n = 1) { this.inv[id] = this.count(id) + n; return true; }
    removeItem(id, n = 1) { if (this.count(id) < n) return false; this.inv[id] -= n; if (!this.inv[id]) delete this.inv[id]; return true; }
    equip(id) { const it = K.BUILDING_DATA.ITEMS[id]; if (!it || !it.slot || !this.count(id)) return false; this.slots[it.slot] = id; return true; }
    unequip(id) { for (const s in this.slots) if (this.slots[s] === id && !this.count(id)) delete this.slots[s]; return true; }
    setOutfit(id) { this.outfit = id; return true; }
    heal(n) { this.hp = n === 'full' ? this.maxHp : Math.min(this.maxHp, this.hp + n); return this.hp; }
    restore(r) { if (r.hp) this.heal(r.hp); this.stamina += r.stamina || 0; this.warmth += r.warmth || 0; }
    mount(id) { this.mounted = id; return true; }
    dismount() { this.mounted = null; return true; }
    passTime(h) { this.hours += h; }
  }

  Object.assign(K, { BuildingInteractions, SimplePlayerState, BUILDING_BOOKS: BOOKS });
})(typeof window !== 'undefined' ? window : globalThis);
