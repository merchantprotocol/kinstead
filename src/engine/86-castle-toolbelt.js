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
    get verb() { return 'work'; }
  }
  class SwordTool extends Tool {
    constructor() { super('sword', '1', 'Sword', 'Sword out: ready to fight.'); }
    accepts() { return false; }                      // fighting mode never touches the land
    get verb() { return 'fight'; }
  }
  class AxeTool extends Tool {
    constructor() { super('axe', '2', 'Axe', 'Axe out. Click a tree.'); }
    get verb() { return 'chop'; }
  }
  class PickaxeTool extends Tool {
    constructor() { super('pickaxe', '3', 'Pickaxe', 'Pickaxe out. Click a boulder or a rocky hillside.'); }
    groundTarget(i, j, ctx) { return ctx.editor.isRockHill(i, j) ? new K.MineTarget(ctx, i, j) : null; }
    get verb() { return 'mine'; }
  }
  class ShovelTool extends Tool {
    constructor() { super('shovel', '4', 'Shovel', 'Shovel out. Click the ground to dig.'); }
    groundTarget(i, j, ctx) { return ctx.editor.canDig(i, j) ? new K.DigTarget(ctx, i, j) : null; }
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
      this.tools = tools; this.current = tools[0]; this.onSelect = onSelect || (() => {});
      this.bar = document.createElement('div'); this.bar.id = 'cTools'; this.bar.className = 'cp';
      this.bar.innerHTML = tools.map((t) => `<button class="tl" data-t="${t.id}" title="${t.name} (${t.key})"><img src="${Toolbelt.artUrl(t.id)}" width="40" height="40" alt=""><kbd>${t.key}</kbd><span>${t.name}</span></button>`).join('');
      this.bar.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) this.select(b.dataset.t); });
      this.bar.addEventListener('pointerdown', (e) => e.stopPropagation());
      parent.appendChild(this.bar); this.paint();
    }
    static artUrl(id) { return 'data:image/svg+xml,' + encodeURIComponent(K.CursorArt.svg(id)); }
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
