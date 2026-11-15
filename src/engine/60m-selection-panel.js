/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;
  const FIELD = 'flex:1;border:1px solid #c9d1dd;border-radius:7px;padding:4px 6px';

  /* the inspector for the Select tool: world details, or the selected object's live-edit controls */
  class SelectionPanel {
    constructor(app) { this.app = app; }
    get doc() { return this.app.doc; }
    get selected() { return this.app.sel && this.doc.obj(this.app.sel); }
    help() {
      return '<p class="help">Click an object to select it; drag to move (hold <kbd>Shift</kbd> for free placement). '
        + 'Yellow handles move wall corners and bridge ends. <kbd>Q</kbd>/<kbd>E</kbd> rotate, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates, '
        + '<kbd>Del</kbd> deletes. Dragging empty ground pans.</p>';
    }
    worldHtml() {
      const doc = this.doc;
      const facts = `${doc.w} × ${doc.h} tiles · ${doc.wu} × ${doc.hu} units · ${doc.objects.length} objects · seed ${doc.seed}`;
      return `<h2>Select</h2>${this.help()}<h3>World</h3><div class="row"><span>Name</span>`
        + `<input type="text" data-k="name" value="${U.escapeHtml(doc.name)}" style="${FIELD}"></div><p class="help">${facts}</p>`;
    }
    render() {
      const o = this.selected;
      if (!o) return this.worldHtml();
      let h = `<h2>${U.escapeHtml(U.describe(o))}</h2>`;
      if (o.kind === 'prop') h += new K.PropInspector(this.app, o).html();
      else if (o.kind === 'wall') h += this.wallHtml(o);
      else if (o.kind === 'bridge') h += this.bridgeHtml(o);
      h += '<div class="row" style="margin-top:10px"><button class="b" data-a="dup">Duplicate</button>'
        + '<button class="b" data-a="del" style="background:#f2d7d7;color:#7a1f1f">Delete</button></div>';
      if (this.app.interiors) h += this.app.interiors.panelHtml(o);
      return h + this.help();
    }
    wallHtml(o) {
      return K.EditorWallControls.wallRows(o)
        + `<div class="row"><span>Closed loop</span><input type="checkbox" data-o="closed" ${o.closed ? 'checked' : ''}></div>`
        + '<div class="row"><span>Variation</span><button class="b" data-a="reseed">Reroll</button></div>'
        + `<p class="help"><kbd>Alt</kbd>+click on this wall toggles a door gap. ${(o.gaps || []).length} gap(s).</p>`;
    }
    bridgeHtml(o) {
      const w = o.w || 1.6, length = Math.hypot(o.b[0] - o.a[0], o.b[1] - o.a[1]).toFixed(1);
      return `<div class="row"><span>Width</span><input type="range" min="1" max="3" step="0.1" value="${w}" data-o="w">`
        + `<span class="val">${w.toFixed(1)}</span></div>`
        + '<div class="row"><span>Variation</span><button class="b" data-a="reseed">Reroll</button></div>'
        + `<p class="help">Length ${length} units. Drag the yellow end handles to re-land it.</p>`;
    }
    bind(root) {
      const app = this.app, o = this.selected;
      const name = root.querySelector('[data-k=name]');
      if (name) name.onchange = () => { this.doc.name = name.value || 'Untitled world'; app.storage.autosave(); };
      if (!o) return;
      const edit = new K.SelectionLiveEdit(app, o);
      root.querySelectorAll('[data-o]').forEach((el) => edit.bindField(el));
      K.EditorWallControls.bindRows(root, o, () => edit.done(), (k, v) => edit.live(k, v));
      root.querySelectorAll('[data-a]').forEach((button) => (button.onclick = () => this.action(button.dataset.a, o)));
      if (app.interiors) app.interiors.bindPanel(root);
    }
    action(name, o) {
      const app = this.app;
      if (name === 'del') app.selection.deleteSel();
      else if (name === 'dup') app.selection.duplicateSel();
      else if (name === 'reseed') app.commitObjects('reroll', (d) => { d.obj(o.id).seed = (Math.random() * 99999) | 0; });
    }
  }
  K.SelectionPanel = SelectionPanel;
})(typeof window !== 'undefined' ? window : globalThis);
