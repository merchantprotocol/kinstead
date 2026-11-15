/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameInput extends K.CastleGameProgress {
    click(sx, sy) { if (!this.ready) return false; this.sound.unlock(); const e = this.play.pick(sx, sy);
    if (e && (e.type === 'c_piece' || e.type === 'c_rpiece')) { this.buildingPanel.piece(e); return true; } return this.tools.click(sx, sy); }
    pointerMove(sx, sy) { return this.ready ? this.cui.pointerMove(sx, sy) : false; }
    rightClick(sx, sy) { return this.ready ? this.stash.rightClick(sx, sy) : false; }
    pointerDown(sx, sy) { if (!this.ready) return false;
    return this.brush.down(sx, sy) || this.site.down(sx, sy) || this.steer.down(sx, sy) || this.walls.down(sx, sy) || this.demolisher.down(sx, sy); }
    pointerDrag(sx, sy) { if (!this.ready) return; this.brush.drag(sx, sy); this.site.drag(sx, sy); this.steer.drag(sx, sy); this.walls.drag(sx, sy);
    this.demolisher.drag(sx, sy); }
    pointerUp(sx, sy) { if (!this.ready) return; this.brush.up(sx, sy); this.site.up(sx, sy); this.steer.up(sx, sy); this.walls.up(sx, sy);
    this.demolisher.up(sx, sy); }
    key(e) {
      if (!this.ready) return false;
      this.sound.unlock();
      if (e.key === 'Escape') { if (!this.dismissTop()) { if (this.onLeave) this.onLeave(); } return true; }   // Esc closes what is open, else leaves the game
      if (this.mp && this.mp.key(e)) return true;
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) { this.vitals.eat(); return true; }   // eat from your bag
      if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) { this.purse.openTab('team'); return true; }   // T: your team
      if (e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.metaKey && !e.altKey) { this.purse.toggle(); return true; }
      return this.cui.key(e) || this.tools.key(e);
    }
    /* may the mouse hit this entity right now? Resources only answer to the tool that works them. */
    pickHeight(e) { return K.WorkTarget.TOOL_FOR[e.type] ? 4.5 : Infinity; }
    pickable(e) { return this.tools ? this.tools.canInteract(e) : true; }
    /* close the topmost thing; false when nothing was open */
    dismissTop() {
      const cui = this.cui, ui = this.play.ui;
      if (this.vitals && this.vitals.sleeping) { this.vitals.wake(); return true; }
      if (this.purse && this.purse.isOpen) { this.purse.close(); return true; }
      if (this.brush && this.brush.drawer.isOpen) { this.brush.drawer.close(); return true; }
      if (cui.placing) { cui.stopPlacing(); return true; }
      if (cui.bookOpen) { cui.toggleBook(false); return true; }
      if (ui.isOpen('ctx') || ui.isOpen('dlg') || ui.isOpen('card') || ui.isOpen('trade')) { ui.closeTop(); return true; }
      if (!cui.$('cModal').hidden) { cui.$('cModal').hidden = true; return true; }
      if (this.tools.arms.isOpen) { this.tools.arms.close(); return true; }
      if (this.tools.tool.id === 'hammer') { this.tools.belt.select('sword'); return true; }
      return false;
    }

    /* ---------- save ---------- */
  }
  K.CastleGameInput = CastleGameInput;
})(typeof window !== 'undefined' ? window : globalThis);
