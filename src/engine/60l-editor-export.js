/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;

  /* files out of the editor: the world JSON download, PNG export and the save thumbnail */
  class EditorExport {
    constructor(app) { this.app = app; }
    get doc() { return this.app.doc; }
    get canvas() { return this.app.renderer3.domElement; }
    slug() {
      return (this.doc.name || 'world').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'world';
    }
    download(blob, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    saveJSON(noDownload) {
      const text = JSON.stringify(this.app.serialize());
      if (!noDownload) this.download(new Blob([text], { type: 'application/json' }), this.slug() + '.world.json');
      this.app.toast(`Downloaded ${this.slug()}.world.json · ${(text.length / 1024).toFixed(0)} KB`);
      this.app.dirtySince = false;
      this.app.updateDirty();
      return text;
    }
    async exportPNG(noDownload) {
      const overlay = this.app.overlay.scene;
      overlay.visible = false;
      this.app.viewport.renderFrame();
      overlay.visible = true;
      const blob = await new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
      if (!blob) { this.app.toast('PNG export failed.'); return null; }
      if (!noDownload) this.download(blob, this.slug() + '.png');
      this.app.toast(`Exported ${this.slug()}.png · ${(blob.size / 1024).toFixed(0)} KB`);
      return blob;
    }
    thumb() {
      try {
        const src = this.canvas, c = document.createElement('canvas');
        c.width = 224;
        c.height = 126;
        const sw = src.width, sh = src.height, ar = 224 / 126;
        let w = sw, h = sw / ar;
        if (h > sh) { h = sh; w = sh * ar; }
        c.getContext('2d').drawImage(src, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, 224, 126);
        return c.toDataURL('image/jpeg', 0.72);
      } catch (e) { return null; }
    }
  }
  K.EditorExport = EditorExport;
})(typeof window !== 'undefined' ? window : globalThis);
