/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the armory. Weapons you can forge at the blacksmith, and the forge menu itself.
   Weapons are tools like the sword and bow, so they live in your weapon drawer, grouped by category:
     Melee    sword (you start with it), iron sword, spear, war hammer
     Ranged   bow (from the rack in your house), longbow
   Arrows are a resource: one wood makes four, and you can find crates of them by your house.

     MeleeWeapon   a hand weapon with its own damage, speed, reach and sweep
     Armory        the catalogue of what the blacksmith can make, and what it costs
     Forge         the menu at the blacksmith's anvil (also hooks the building system's "smith" furniture to it) */
(function (G) {
  const K = G.K;
  const PI = Math.PI;

  class MeleeWeapon extends K.Tool {
    constructor(cfg) { super(cfg.id, '1', cfg.name, `${cfg.name} out.`); this.cfg = cfg; }
    accepts() { return false; }
    get art() { return this.cfg.art || this.id; }
    get kind() { return 'weapon'; }
    get category() { return 'Melee'; }
    get verb() { return 'fight'; }
    get blurb() { return this.cfg.blurb; }
    get combat() { return this.cfg.combat; }
  }

  /** What the blacksmith can make. cost is in castle resources; make() returns the weapon (or null for ammunition). */
  class Armory {
    /** a fresh weapon by id (the bow, or anything the blacksmith makes); null if unknown */
    static make(id) { if (id === 'bow') return new K.BowTool(); const r = Armory.CATALOG.find((x) => x.id === id); return r ? r.make() : null; }
    static get CATALOG() {
      return [
        { id: 'ironsword', name: 'Iron sword', cost: { iron: 4, wood: 2 }, blurb: 'Keen iron. Hits half again as hard as your sword.', make: () => new MeleeWeapon({ id: 'ironsword', name: 'Iron sword', art: 'sword', blurb: 'Keen iron. Hits half again as hard as your sword.', combat: { scale: 1.5, gap: 0.16, radius: 2.8, arc: PI * 0.85 } }) },
        { id: 'spear', name: 'Spear', cost: { iron: 2, wood: 3 }, blurb: 'Long reach, a narrow thrust. Keeps wolves at a distance.', make: () => new MeleeWeapon({ id: 'spear', name: 'Spear', blurb: 'Long reach, a narrow thrust. Keeps wolves at a distance.', combat: { scale: 1.15, gap: 0.22, radius: 3.8, arc: PI * 0.22 } }) },
        { id: 'warhammer', name: 'War hammer', cost: { iron: 6, wood: 3, stone: 4 }, blurb: 'Slow and brutal. One swing clears a crowd.', make: () => new MeleeWeapon({ id: 'warhammer', name: 'War hammer', blurb: 'Slow and brutal. One swing clears a crowd.', combat: { scale: 2.4, gap: 0.55, radius: 2.4, arc: PI * 0.75 } }) },
        { id: 'longbow', name: 'Longbow', cost: { wood: 8, iron: 1 }, blurb: 'Shoots farther and harder, and faster.', make: () => new K.BowTool({ id: 'longbow', name: 'Longbow', art: 'bow', damage: 1.3, gap: 0.45, range: 34, blurb: 'Shoots farther and harder, and faster than the bow.' }) },
      ];
    }
  }

  /** The menu at the anvil. Each press crafts one thing; arrows are made here too. */
  class Forge {
    constructor(game) { this.g = game; this.hook(); }
    get belt() { return this.g.tools.belt; }
    owned(id) { return this.belt.weapons.some((w) => w.id === id); }
    costText(cost) { return Object.entries(cost).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', '); }
    get title() { return 'Blacksmith'; }
    get icon() { return 'iron'; }
    get verb() { return 'Make'; }
    get busy() { return 'hammering…'; }
    has(res) { return this.g.castle.amount(res); }
    glyph(res) { return K.GoodsArt.url(res); }
    /** the forge's own purse: what it has made, waiting for you */
    get tray() { return this._tray || (this._tray = []); }
    set tray(v) { this._tray = v; }
    restoreTray(list) { this.tray = list.map((t) => { if (t.weapon) { const w = Armory.make(t.weapon); return w ? { kind: 'weapon', id: t.weapon, n: 1, name: w.name, art: K.Toolbelt.artUrl(w.art), weapon: w } : null; } return { kind: 'res', id: t.res, n: t.n, name: 'Arrows', art: K.GoodsArt.url(t.res) }; }).filter(Boolean); }
    /** what can be made: every weapon (with a picture) and arrows */
    recipes() {
      const out = Armory.CATALOG.map((r) => { const w = r.make(); return { id: r.id, name: r.name, cost: r.cost, art: K.Toolbelt.artUrl(w.art), have: this.owned(r.id) || this.tray.some((t) => t.id === r.id) }; });
      out.push({ id: 'arrows', name: 'Arrows ×4', cost: { wood: 1 }, art: K.GoodsArt.url('arrow'), have: false });
      return out;
    }
    open() { this.g.purse.openForge(this); }
    /** click a recipe: the materials go into the forge, it hammers, and the finished piece waits in its purse */
    make(id) {
      const g = this.g, c = g.castle, r = id === 'arrows' ? { id, name: 'Arrows', cost: { wood: 1 } } : Armory.CATALOG.find((x) => x.id === id); if (!r || this.pending) return;
      if (id !== 'arrows' && (this.owned(id) || this.tray.some((t) => t.id === id))) { g.cui.toast('You already have that.'); return; }
      if (!c.spend(r.cost)) { g.cui.toast('Not enough materials.'); g.sound.play('clank'); return; }
      this.pending = r.cost; g.changed(); g.sound.play('clank'); g.purse.update();
      setTimeout(() => {
        this.pending = null;
        if (id === 'arrows') this.tray.push({ kind: 'res', id: 'arrow', n: 4, name: 'Arrows', art: K.GoodsArt.url('arrow') });
        else { const w = r.make(); this.tray.push({ kind: 'weapon', id, n: 1, name: r.name, art: K.Toolbelt.artUrl(w.art), weapon: w }); }
        g.sound.play('fanfare'); g.purse.update();
      }, 550);
    }
    arrows() { const g = this.g, c = g.castle; if (c.amount('wood') < 1) return; c.spend({ wood: 1 }); c.add('arrow', 4); g.sound.play('clank'); g.changed(); }
    craft(r) {
      const g = this.g, c = g.castle; if (!c.spend(r.cost)) { g.cui.toast('Not enough materials.'); return; }
      this.belt.addWeapon(r.make()); g.sound.play('fanfare'); g.cui.toast(`You forged the ${r.name.toLowerCase()}. Click your weapon slot to equip it.`); g.changed(); this.open();
    }
    /** the building system's own forge, anvil, grindstone and workbench all open this menu instead of its item crafting */
    hook() {
      const reg = K.Interactions, orig = reg.get('smith') || {}, forge = this;
      reg.register('smith', Object.assign({}, orig, { actions: (e) => [{ id: 'forge', label: 'Forge weapons…', icon: 'hammer', range: e.range, run: () => forge.open() }, { id: 'inspect', label: 'Inspect', icon: 'eye', run: (gm, x) => gm.inspect(x) }] }));
    }
  }

  Object.assign(K, { MeleeWeapon, Armory, Forge });
})(typeof window !== 'undefined' ? window : globalThis);
