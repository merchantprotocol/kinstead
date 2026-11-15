/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;

  /* one saved world in the My worlds list, with its rename or delete-confirm state */
  class EditorWorldRow {
    constructor(meta, openId, mode) { this.meta = meta; this.open = meta.id === openId; this.mode = mode; }
    when() {
      return new Date(this.meta.updated).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    title() {
      const m = this.meta, name = U.escapeHtml(m.name);
      if (this.mode.rename !== m.id) return `<b data-a="open" title="Open">${name}</b>`;
      return `<div class="row" style="margin:0"><input type="text" data-k="nm" value="${name}" maxlength="80">`
        + '<button class="b pri" data-a="rn-ok">Save</button><button class="b" data-a="rn-x">Cancel</button></div>';
    }
    details() {
      const m = this.meta, now = this.open ? ' · <b style="display:inline;color:#2f5f86">open now</b>' : '';
      return `<small>${m.w} × ${m.h} tiles · ${m.objects} objects · ${(m.bytes / 1024).toFixed(0)} KB · saved ${this.when()}${now}</small>`;
    }
    actions() {
      const m = this.meta;
      if (this.mode.del === m.id) {
        return `<span class="conf">Delete "${U.escapeHtml(m.name)}" for good?`
          + '<button class="b" data-a="del-x">Keep</button><button class="b danger" data-a="del-ok">Delete</button></span>';
      }
      return '<button class="b pri" data-a="open">Open</button><button class="b" data-a="rename">Rename</button>'
        + '<button class="b" data-a="dup">Duplicate</button><button class="b" data-a="del">Delete</button>';
    }
    html() {
      const m = this.meta, thumb = m.thumb ? `<img src="${m.thumb}" alt="">` : '<div class="nothumb"></div>';
      return `<div class="wr ${this.open ? 'cur' : ''}" data-id="${m.id}">${thumb}`
        + `<div class="inf">${this.title()}${this.details()}</div><div class="ba">${this.actions()}</div></div>`;
    }
  }
  K.EditorWorldRow = EditorWorldRow;
})(typeof window !== 'undefined' ? window : globalThis);
