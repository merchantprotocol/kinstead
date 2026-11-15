/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the tools in your hand. What a click does depends on the tool:
     Sword   fighting only: trees, rocks and the ground are left alone
     Axe     chops pines          Pickaxe  mines boulders, iron and rocky hillsides
     Shovel  digs the ground
   Tool is the abstract base; each tool is a subclass that says what it works on. The Toolbelt owns the
   hotbar (DOM) and which tool is out. Nothing here knows about trees, tiles or pickups. */
(function (G) {
  const K = G.K;

  /** One tool. Subclasses override the few things that differ; the base class is "works on targets that require me". */
  class Tool {
    constructor(id, key, name, hint) { this.id = id; this.key = key; this.name = name; this.hint = hint; }
    /** can this tool work on that WorkTarget? */
    accepts(target) { return target.requires === this.id; }
    /** the WorkTarget this tool makes of a ground tile, or null (then a click just walks) */
    groundTarget(i, j, ctx) { return null; }
    /** a reason a click on this tile is refused (shown as a toast), or null */
    denyGround(i, j, ctx) { return null; }
    /** does this tool have modes (a drawer opened by clicking its slot again)? */
    get modes() { return false; }
    /** a ground click only starts work when it is a double-click (single clicks walk) */
    get doubleClick() { return false; }
    get verb() { return 'work'; }
    /** 'weapon' tools live in the weapon slot (and the weapon drawer); everything else is a work tool with its own slot */
    get kind() { return 'work'; }
    get art() { return this.id; }                  // which painting represents it (a weapon can reuse another's)
    get category() { return this.kind === 'weapon' ? 'Melee' : 'Tools'; }
    get ranged() { return false; }
    get blurb() { return ''; }
    /** how this tool fights when you are attacked: damage scale, seconds between swings, reach, arc. Only the sword is a real weapon. */
    get combat() { return { scale: 0.4, gap: 0.25, radius: 2.0, arc: Math.PI * 0.5 }; }
  }
  class SwordTool extends Tool {
    constructor() { super('sword', '1', 'Sword', 'Sword out: ready to fight.'); }
    accepts() { return false; }                      // fighting mode never touches the land
    get verb() { return 'fight'; }
    get kind() { return 'weapon'; }
    get blurb() { return 'A wide sweep hits everything in front of you.'; }
    get combat() { return { scale: 1, gap: 0.16, radius: 2.7, arc: Math.PI * 0.85 }; }
  }
  class AxeTool extends Tool {
    constructor() { super('axe', '2', 'Axe', 'Axe out. Click a tree.'); }
    get verb() { return 'chop'; }
    get combat() { return { scale: 0.55, gap: 0.22, radius: 2.3, arc: Math.PI * 0.6 }; }   // an axe still bites
  }
  class PickaxeTool extends Tool {
    constructor() { super('pickaxe', '3', 'Pickaxe', 'Pickaxe out. Click a boulder or a rocky hillside.'); }
    groundTarget(i, j, ctx) { return ctx.editor.isRockHill(i, j) ? new K.MineTarget(ctx, i, j) : null; }
    get verb() { return 'mine'; }
    get combat() { return { scale: 0.5, gap: 0.24, radius: 2.2, arc: Math.PI * 0.55 }; }
  }
  class ShovelTool extends Tool {
    get doubleClick() { return this.mode === 'dig'; }   // digging is deliberate: it never starts from an ordinary walking click
    constructor() { super('shovel', '4', 'Shovel', 'Shovel out. Click it again for its modes: dig, level, raise, lower.'); this.mode = 'dig'; }
    groundTarget(i, j, ctx) { return this.mode === 'dig' && ctx.editor.canDig(i, j) ? new K.DigTarget(ctx, i, j) : null; }   // the brush modes work through GroundBrush
    get modes() { return true; }
    get verb() { return 'dig'; }
  }

  class HammerTool extends Tool {
    constructor() { super('hammer', '5', 'Hammer', 'Hammer out. Pick what to build from the drawer on the left.'); }
    accepts() { return false; }                      // the hammer works through the build drawer, not on harvest targets
    get verb() { return 'build'; }
  }

  /** The hotbar plus the "which tool is out" state. Calls onSelect(tool) whenever the tool changes. */
  class Toolbelt {
    constructor(tools, onSelect, parent = document.body) {
      this.tools = tools; this.weapons = tools.filter((x) => x.kind === 'weapon'); this.current = tools[0]; this.onSelect = onSelect || (() => {}); this.onWeaponSlot = null; this.onWeaponsChanged = null;
      this.bar = document.createElement('div'); this.bar.id = 'cTools'; this.bar.className = 'cp';
      this.render();
      this.bar.addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]'); if (!b) return; const was = this.current && this.current.id === b.dataset.t; this.select(b.dataset.t);
        const t = this.byId(b.dataset.t); if (t && t.kind === 'weapon' && this.onWeaponSlot) this.onWeaponSlot(was);
        if (t && t.modes && this.onModeSlot) this.onModeSlot(t, was);   // the shovel's mode drawer   // clicking the weapon slot opens the weapon drawer
      });
      this.bar.addEventListener('pointerdown', (e) => e.stopPropagation());
      parent.appendChild(this.bar); this.paint();
    }
    /** (re)draw the hotbar buttons */
    render() {
      this.tools.forEach((x, i) => { x.key = String(i + 1); });   // keys follow the slots, so a weapon takes the weapon slot's key
      this.bar.innerHTML = this.tools.map((t) => `<button class="tl" data-t="${t.id}" title="${t.name} (${t.key})"><img src="${Toolbelt.artUrl(t.art)}" width="40" height="40" alt=""><kbd>${t.key}</kbd><i class="bd"></i><span>${t.name}</span></button>`).join(''); this.paint();
    }
    /** a small number on a slot (arrows left for a bow) */
    setBadge(id, text, icon) { const b = this.bar.querySelector(`[data-t="${id}"] .bd`); if (!b) return; if (b.textContent !== String(text)) b.textContent = text; if (icon && b.dataset.ic !== icon && K.GoodsArt) { b.dataset.ic = icon; b.style.setProperty('--ic', `url("${K.GoodsArt.url(icon)}")`); } }   // icon: a little picture of what the number counts
    /** you now own this weapon (it is offered in the weapon drawer; it is not equipped until you pick it) */
    addWeapon(w) { if (!this.weapons.some((x) => x.id === w.id)) { this.weapons.push(w); this.changed(); } }
    changed() { if (this.onWeaponsChanged) this.onWeaponsChanged(); }
    removeWeapon(id) { const w = this.weapons.find((x) => x.id === id); if (!w) return; this.weapons = this.weapons.filter((x) => x !== w); if (this.tools.includes(w)) this.equip(this.weapons[0]); this.changed(); }
    /** put this weapon in the weapon slot, replacing the one there, and take it in hand */
    equip(w) {
      if (!this.weapons.includes(w)) return; const i = this.tools.findIndex((x) => x.kind === 'weapon'); if (i < 0 || this.tools[i] === w) { this.select(w.id); return; }
      const wasInHand = this.current === this.tools[i]; this.tools[i] = w; this.render();
      if (wasInHand || this.current !== w) { this.current = w; this.paint(); this.onSelect(w); }
      this.changed();
    }
    static artUrl(id) { return 'data:image/svg+xml,' + encodeURIComponent(K.CursorArt.svg(K.CursorArt.has(id) ? id : 'pointer')); }
    byId(id) { return this.tools.find((t) => t.id === id) || null; }
    byKey(key) { return this.tools.find((t) => t.key === key) || null; }
    /** the tool that can work on this target, if any */
    toolFor(target) { return this.tools.find((t) => t.accepts(target)) || null; }
    select(id) {
      const t = this.byId(id); if (!t || t === this.current) return false;
      this.current = t; this.paint(); this.onSelect(t); return true;
    }
    paint() { for (const b of this.bar.querySelectorAll('.tl')) b.classList.toggle('on', b.dataset.t === this.current.id); }
    /** pulse a slot to say "this is the one you need" */
    flash(id) { const b = this.bar.querySelector(`[data-t="${id}"]`); if (!b) return; b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
    dispose() { if (this.bar.parentNode) this.bar.parentNode.removeChild(this.bar); }
  }

  Object.assign(K, { Tool, SwordTool, AxeTool, PickaxeTool, ShovelTool, HammerTool, Toolbelt });
})(typeof window !== 'undefined' ? window : globalThis);
