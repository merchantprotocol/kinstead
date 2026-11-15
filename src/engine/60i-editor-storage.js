/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  const U = K.BuilderAppUtils;
  const AUTOSAVE_KEY = 'kinstead-world3d-autosave';

  /* saving: My worlds (IndexedDB) with an in-memory fallback, autosave, and the dirty marker */
  class EditorStorage {
    constructor(app) { this.app = app; this.autosaveTimer = null; }
    get doc() { return this.app.doc; }
    get store() { return this.app.store; }
    autosave() {
      this.app.dirtySince = true;
      this.updateDirty();
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = setTimeout(() => this.writeAutosave(), 1500);
    }
    writeAutosave() {
      const json = JSON.stringify(this.app.serialize());
      if (this.store) this.store.autosave(json).catch((e) => console.warn('autosave failed', e));
      try { localStorage.setItem(AUTOSAVE_KEY, json); } catch (e) { /* blocked (data: URL) or full: the "Not stored" note is already showing */ }
    }
    async initStore() {
      let force = null;
      try {
        if (/[?&]memstore\b/.test(location.search) || G.KINSTEAD_MEMSTORE) force = 'Storage turned off for this page.';
      } catch (e) { /* opaque origin */ }
      const store = (this.app.store = await K.WorldStore.create(force ? { forceMemory: force } : {}));
      const note = U.byId('storeNote');
      if (!store.persistent) {
        U.byId('storeWhy').textContent = store.reason;
        note.classList.add('show');
        note.title = store.reason;
      }
      store.onUpgrade = () => {
        note.classList.remove('show');
        this.updateDirty();
        this.app.toast('Storage is ready: worlds now save in this browser.');
      };
      const saved = await this.readRecovery();
      if (saved) {
        const button = U.byId('bRecover');
        button.style.display = '';
        button.onclick = () => { if (this.app.loadText(saved)) button.style.display = 'none'; };
      }
      this.updateDirty();
      return store;
    }
    async readRecovery() {
      let saved = null;
      try { const a = await this.store.readAutosave(); if (a && a.json) saved = a.json; } catch (e) { /* none */ }
      if (!saved) try { saved = localStorage.getItem(AUTOSAVE_KEY); } catch (e) { /* blocked */ }
      return saved;
    }
    updateDirty() {
      const app = this.app, e = U.byId('sDirty');
      if (!e) return;
      const where = this.store && this.store.persistent ? '✓ Saved in My worlds' : '✓ Saved for this session';
      e.textContent = app.dirtySince ? '● Unsaved changes' : app.savedId ? where : '';
      e.className = app.dirtySince ? '' : 'ok';
      document.title = (app.dirtySince ? '● ' : '') + (this.doc ? this.doc.name + ' · ' : '') + 'Kinstead World Builder';
    }
    whereHtml(saving) {
      if (!this.store) return 'Storage is starting…';
      if (!this.store.persistent) {
        const reason = U.escapeHtml(this.store.reason);
        return `<span class="warn">⚠ <b>Not stored.</b> ${reason} Worlds here last only until this page closes. `
          + 'Use <b>Download</b> to keep a copy.</span>';
      }
      if (!saving) return 'Saved in this browser. Use Download for a file you can share or back up.';
      if (this.app.savedId) return 'Updates the saved copy in <b>My worlds</b> (kept in this browser).';
      return 'Kept in <b>My worlds</b> in this browser. Use Download for a file you can share.';
    }
    async openSave() {
      await this.app.storeReady;
      U.byId('svName').value = this.doc.name;
      U.byId('svCopy').style.display = this.app.savedId ? '' : 'none';
      U.byId('svWhere').innerHTML = this.whereHtml(true);
      U.byId('saveModal').classList.add('show');
      setTimeout(() => { U.byId('svName').focus(); U.byId('svName').select(); }, 20);
    }
    async saveWorld(name, asNew) {
      const app = this.app;
      await app.storeReady;
      name = (name || this.doc.name || 'Untitled world').trim() || 'Untitled world';
      this.doc.name = name;
      const json = app.serialize();
      try {
        const meta = await this.store.save({ id: asNew ? null : app.savedId, name, json, thumb: app.files.thumb() });
        app.savedId = meta.id;
        app.dirtySince = false;
        this.updateDirty();
        this.refreshWorldPanel();
        const kept = this.store.persistent ? `Saved "${name}" to My worlds.` : `Saved "${name}" for this session only. Download it to keep it.`;
        app.toast(kept);
        return meta;
      } catch (e) {
        console.warn('save failed', e);
        app.toast('Could not save to My worlds (' + e.message + '). Downloading a copy instead.');
        app.files.saveJSON();
        return null;
      }
    }
    refreshWorldPanel() { if (this.app.toolName === 'select' && !this.app.sel) this.app.panel(); }
    quickSave() {
      if (this.app.savedId && this.store) return this.saveWorld(this.doc.name);
      return this.openSave();
    }
    async openWorlds() {
      await this.app.storeReady;
      U.byId('worldsModal').classList.add('show');
      await this.renderWorlds();
    }
    async renderWorlds(mode = {}) {
      const list = await this.store.list();
      const count = `${list.length} world${list.length === 1 ? '' : 's'} saved in this browser. `;
      U.byId('wlWhere').innerHTML = (this.store.persistent ? count : '') + this.whereHtml(false).replace(/^Saved in this browser\. /, '');
      const empty = '<div class="none">No saved worlds yet. Use <b>Save world</b> (Ctrl+S) to keep the one you are building.</div>';
      U.byId('wlList').innerHTML = list.length ? list.map((m) => new K.EditorWorldRow(m, this.app.savedId, mode).html()).join('') : empty;
      const input = U.byId('wlList').querySelector('[data-k=nm]');
      if (input) this.bindRename(input);
    }
    bindRename(input) {
      input.focus();
      input.select();
      input.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') U.byId('wlList').querySelector('[data-a=rn-ok]').click();
        if (e.key === 'Escape') this.renderWorlds();
      };
    }
    async worldsAction(id, action) {
      try {
        if (action === 'open') await this.openSaved(id);
        else if (action === 'rename') this.renderWorlds({ rename: id });
        else if (action === 'rn-x' || action === 'del-x') this.renderWorlds();
        else if (action === 'rn-ok') await this.renameSaved(id);
        else if (action === 'dup') await this.duplicateSaved(id);
        else if (action === 'del') this.renderWorlds({ del: id });
        else if (action === 'del-ok') await this.deleteSaved(id);
      } catch (e) { console.warn(e); this.app.toast('That did not work: ' + e.message); }
    }
    async openSaved(id) {
      const app = this.app;
      const warning = 'The world you are editing has unsaved changes. They will be lost unless you save it first.';
      if (app.dirtySince && id !== app.savedId && !(await app.ask('Open this world?', warning, 'Open anyway', true))) return;
      const text = await this.store.load(id);
      if (!app.loadText(text)) return;
      app.savedId = id;
      app.dirtySince = false;
      this.updateDirty();
      U.byId('worldsModal').classList.remove('show');
    }
    async renameSaved(id) {
      const name = (U.byId('wlList').querySelector('[data-k=nm]').value || '').trim();
      if (!name) return;
      await this.store.rename(id, name);
      if (id === this.app.savedId) {
        this.doc.name = name;
        this.updateDirty();
        this.refreshWorldPanel();
      }
      this.app.toast(`Renamed to "${name}".`);
      this.renderWorlds();
    }
    async duplicateSaved(id) {
      const meta = await this.store.duplicate(id);
      this.app.toast(`Duplicated as "${meta.name}".`);
      this.renderWorlds();
    }
    async deleteSaved(id) {
      const meta = await this.store.meta(id);
      await this.store.remove(id);
      if (id === this.app.savedId) {
        this.app.savedId = null;
        this.app.dirtySince = true;
        this.updateDirty();
      }
      this.app.toast(`Deleted "${meta ? meta.name : 'world'}".`);
      this.renderWorlds();
    }
  }
  K.EditorStorage = EditorStorage;
})(typeof window !== 'undefined' ? window : globalThis);
