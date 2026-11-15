/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;

  /* live edits from inspector fields: applied as you drag, recorded as one undo step when the field commits */
  class SelectionLiveEdit {
    constructor(app, object) { this.app = app; this.object = object; this.before = null; }
    get doc() { return this.app.doc; }
    live(key, value) {
      if (this.before == null) this.before = JSON.stringify(this.doc.objects);
      const target = this.doc.obj(this.object.id);
      target[key] = typeof value === 'number' ? U.round3(value) : value;
      if (key === 'h' && target.hs) delete target.hs;
      if (value === '' && key === 'name') delete target[key];
      this.app.renderer.objectsChanged();
      this.app.overlay.selection();
    }
    done() {
      if (this.before == null) return;
      this.app.pushOp({ label: 'edit ' + U.describe(this.object), objs: [this.before, JSON.stringify(this.doc.objects)] });
      this.before = null;
    }
    bindField(el) {
      const key = el.dataset.o;
      el.oninput = () => {
        const value = el.type === 'checkbox' ? el.checked : el.dataset.str ? el.value.trim() : +el.value;
        this.live(key, value);
        if (el.type === 'range' && el.nextElementSibling) el.nextElementSibling.textContent = this.rangeLabel(key, value);
      };
      el.onchange = () => { el.oninput(); this.done(); };
    }
    rangeLabel(key, value) {
      if (key === 'rot') return Math.round(value * 57.3) + '°';
      return (+value).toFixed(key === 's' ? 2 : 1);
    }
  }
  K.SelectionLiveEdit = SelectionLiveEdit;
})(typeof window !== 'undefined' ? window : globalThis);
