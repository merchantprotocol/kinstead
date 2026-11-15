/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · CastleInput: the mouse and keyboard in castle mode. Clicks open a building's panel or go to the tool in
   hand, drags go to whichever tool claims them, hotkeys eat / open the team / open the bag, and Esc closes the top thing. */
(function (G) {
  const K = G.K;

  class CastleInput {
    /* plain-letter hotkeys -> method */
    static HOTKEYS = { e: 'eat', t: 'team', i: 'bag' };

    constructor(game) { this.g = game; }
    get ready() { return this.g.ready; }
    /** the tools that may take a drag, in the order they get the first chance */
    draggers() { const g = this.g; return [g.brush, g.site, g.steer, g.walls, g.demolisher]; }
    click(sx, sy) {
      const g = this.g;
      if (!this.ready) return false;
      g.sound.unlock();
      const e = g.play.pick(sx, sy);
      if (e && (e.type === 'c_piece' || e.type === 'c_rpiece')) { g.buildingPanel.piece(e); return true; }
      return g.tools.click(sx, sy);
    }
    pointerMove(sx, sy) { return this.ready ? this.g.cui.pointerMove(sx, sy) : false; }
    rightClick(sx, sy) { return this.ready ? this.g.stash.rightClick(sx, sy) : false; }
    pointerDown(sx, sy) {
      if (!this.ready) return false;
      return this.draggers().some((d) => d.down(sx, sy));
    }
    pointerDrag(sx, sy) {
      if (!this.ready) return;
      for (const d of this.draggers()) d.drag(sx, sy);
    }
    pointerUp(sx, sy) {
      if (!this.ready) return;
      for (const d of this.draggers()) d.up(sx, sy);
    }
    key(e) {
      const g = this.g;
      if (!this.ready) return false;
      g.sound.unlock();
      if (e.key === 'Escape') {   // Esc closes what is open, else leaves the game
        if (!this.dismissTop() && g.onLeave) g.onLeave();
        return true;
      }
      if (g.mp && g.mp.key(e)) return true;
      const hot = !e.ctrlKey && !e.metaKey && !e.altKey && CastleInput.HOTKEYS[e.key.toLowerCase()];
      if (hot) { this[hot](); return true; }
      return g.cui.key(e) || g.tools.key(e);
    }
    eat() { this.g.vitals.eat(); }
    team() { this.g.purse.openTab('team'); }
    bag() { this.g.purse.toggle(); }
    /** may the mouse hit this entity right now? Resources only answer to the tool that works them. */
    pickHeight(e) { return K.WorkTarget.TOOL_FOR[e.type] ? 4.5 : Infinity; }
    pickable(e) { return this.g.tools ? this.g.tools.canInteract(e) : true; }
    /** close the topmost thing; false when nothing was open */
    dismissTop() {
      const g = this.g, cui = g.cui, ui = g.play.ui;
      if (g.vitals && g.vitals.sleeping) { g.vitals.wake(); return true; }
      if (g.purse && g.purse.isOpen) { g.purse.close(); return true; }
      if (g.brush && g.brush.drawer.isOpen) { g.brush.drawer.close(); return true; }
      if (cui.placing) { cui.stopPlacing(); return true; }
      if (cui.bookOpen) { cui.toggleBook(false); return true; }
      if (['ctx', 'dlg', 'card', 'trade'].some((n) => ui.isOpen(n))) { ui.closeTop(); return true; }
      if (!cui.$('cModal').hidden) { cui.$('cModal').hidden = true; return true; }
      if (g.tools.arms.isOpen) { g.tools.arms.close(); return true; }
      if (g.tools.tool.id === 'hammer') { g.tools.belt.select('sword'); return true; }
      return false;
    }
  }

  K.CastleInput = CastleInput;
})(typeof window !== 'undefined' ? window : globalThis);
