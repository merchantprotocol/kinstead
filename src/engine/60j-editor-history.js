/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;

  /* the editor's undoable edits: recording operations, replaying them and keeping Undo/Redo buttons current */
  class EditorHistory {
    constructor(app) { this.app = app; }
    get doc() { return this.app.doc; }
    pushOp(op) {
      this.app.history.push(op);
      this.updateButtons();
      this.app.dirtySince = true;
      this.app.storage.autosave();
    }
    commitObjects(label, fn) {
      const before = JSON.stringify(this.doc.objects);
      fn(this.doc);
      const after = JSON.stringify(this.doc.objects);
      if (before === after) return;
      this.pushOp({ label, objs: [before, after] });
      this.app.renderer.objectsChanged();
      this.app.overlay.selection();
    }
    applyOp(op, which) {
      const doc = this.doc, app = this.app;
      if (op.tiles) {
        K.TileStroke.apply(doc, op.tiles, which);
        app.renderer.tilesChanged(...op.tiles.box);
      }
      if (op.objs) {
        doc.objects = JSON.parse(which === 'old' ? op.objs[0] : op.objs[1]);
        if (app.sel && !doc.obj(app.sel)) app.sel = null;
        app.renderer.objectsChanged();
      }
      app.overlay.selection();
      app.panel();
      this.updateButtons();
    }
    undo() {
      this.app.tool.cancel();
      const op = this.app.history.undo();
      if (!op) return;
      this.applyOp(op, 'old');
      this.app.toast('Undid ' + op.label);
    }
    redo() {
      this.app.tool.cancel();
      const op = this.app.history.redo();
      if (!op) return;
      this.applyOp(op, 'new');
      this.app.toast('Redid ' + op.label);
    }
    updateButtons() {
      U.byId('bUndo').disabled = !this.app.history.canUndo();
      U.byId('bRedo').disabled = !this.app.history.canRedo();
    }
  }
  K.EditorHistory = EditorHistory;
})(typeof window !== 'undefined' ? window : globalThis);
