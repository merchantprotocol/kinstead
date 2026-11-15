/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE, V3 = THREE.Vector3;
  const { TILE, HQ, T, TERRAINS, PRESETS, WorldDoc, PropBuilder } = K;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r3 = (v) => Math.round(v * 1000) / 1000;
  class BuilderAppStorage extends K.BuilderAppSession {
    autosave() {
      this.dirtySince = true; this.updateDirty(); clearTimeout(this.asT);
      this.asT = setTimeout(() => {
        const json = JSON.stringify(this.serialize());
        if (this.store) this.store.autosave(json).catch((e) => console.warn('autosave failed', e));
        try { localStorage.setItem('kinstead-world3d-autosave', json); } catch (e) { /* blocked (data: URL) or full: the "Not stored" note is already showing */ }
      }, 1500);
    }
    /* ---- saving: My worlds (IndexedDB), with an in-memory fallback ---- */
    async initStore() {
      let force = null; try { if (/[?&]memstore\b/.test(location.search) || G.KINSTEAD_MEMSTORE) force = 'Storage turned off for this page.'; } catch (e) { /* opaque origin */ }
      this.store = await K.WorldStore.create(force ? { forceMemory: force } : {});
      const note = $('storeNote');
      if (!this.store.persistent) { $('storeWhy').textContent = this.store.reason; note.classList.add('show'); note.title = this.store.reason; }
      this.store.onUpgrade = () => { note.classList.remove('show'); this.updateDirty(); this.toast('Storage is ready: worlds now save in this browser.'); };
      let saved = null;
      try { const a = await this.store.readAutosave(); if (a && a.json) saved = a.json; } catch (e) { /* none */ }
      if (!saved) try { saved = localStorage.getItem('kinstead-world3d-autosave'); } catch (e) { /* blocked */ }
      if (saved) { const b = $('bRecover'); b.style.display = ''; b.onclick = () => { if (this.loadText(saved)) b.style.display = 'none'; }; }
      this.updateDirty(); return this.store;
    }
    updateDirty() {
      const e = $('sDirty'); if (!e) return;
      e.textContent = this.dirtySince ? '● Unsaved changes' : this.savedId ? (this.store && this.store.persistent ? '✓ Saved in My worlds' : '✓ Saved for this session') : '';
      e.className = this.dirtySince ? '' : 'ok';
      document.title = (this.dirtySince ? '● ' : '') + (this.doc ? this.doc.name + ' · ' : '') + 'Kinstead World Builder';
    }
    thumb() {
      try {
        const src = this.renderer3.domElement, c = document.createElement('canvas'); c.width = 224; c.height = 126;
        const sw = src.width, sh = src.height, ar = 224 / 126; let w = sw, h = sw / ar; if (h > sh) { h = sh; w = sh * ar; }
        c.getContext('2d').drawImage(src, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, 224, 126); return c.toDataURL('image/jpeg', 0.72);
      } catch (e) { return null; }
    }
    whereHtml(saving) {
      if (!this.store) return 'Storage is starting…';
      if (!this.store.persistent) return `<span class="warn">⚠ <b>Not stored.</b> ${K.BuilderAppUtils.escapeHtml(this.store.reason)} Worlds here last only until this page closes. Use <b>Download</b> to keep a copy.</span>`;
      return saving ? (this.savedId ? 'Updates the saved copy in <b>My worlds</b> (kept in this browser).' : 'Kept in <b>My worlds</b> in this browser. Use Download for a file you can share.') : 'Saved in this browser. Use Download for a file you can share or back up.';
    }
    async openSave() {
      await this.storeReady;
      $('svName').value = this.doc.name; $('svCopy').style.display = this.savedId ? '' : 'none'; $('svWhere').innerHTML = this.whereHtml(true);
      $('saveModal').classList.add('show'); setTimeout(() => { $('svName').focus(); $('svName').select(); }, 20);
    }
    async saveWorld(name, asNew) {
      await this.storeReady; name = (name || this.doc.name || 'Untitled world').trim() || 'Untitled world';
      this.doc.name = name; const json = this.serialize();
      try {
        const meta = await this.store.save({ id: asNew ? null : this.savedId, name, json, thumb: this.thumb() });
        this.savedId = meta.id; this.dirtySince = false; this.updateDirty(); if (this.toolName === 'select' && !this.sel) this.panel();
        this.toast(this.store.persistent ? `Saved "${name}" to My worlds.` : `Saved "${name}" for this session only. Download it to keep it.`);
        return meta;
      } catch (e) {
        console.warn('save failed', e); this.toast('Could not save to My worlds (' + e.message + '). Downloading a copy instead.'); this.saveJSON(); return null;
      }
    }
    quickSave() { if (this.savedId && this.store) return this.saveWorld(this.doc.name); return this.openSave(); }
    ask(title, text, ok = 'OK', danger = false) {
      return new Promise((res) => {
        $('askTitle').textContent = title; $('askText').textContent = text; const y = $('askYes'); y.textContent = ok; y.className = 'b ' + (danger ? 'danger' : 'pri');
        const m = $('askModal'); m.classList.add('show');
        const done = (v) => { m.classList.remove('show'); this.askDone = null; res(v); };
        this.askDone = done; y.onclick = () => done(true); $('askNo').onclick = () => done(false);
      });
    }
    async openWorlds() { await this.storeReady; $('worldsModal').classList.add('show'); await this.renderWorlds(); }
    async renderWorlds(mode = {}) {
      const list = await this.store.list(), when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      $('wlWhere').innerHTML = (this.store.persistent ? `${list.length} world${list.length === 1 ? '' : 's'} saved in this browser. ` : '') + this.whereHtml(false).replace(/^Saved in this browser\. /, '');
      $('wlList').innerHTML = list.length ? list.map((m) => `<div class="wr ${m.id === this.savedId ? 'cur' : ''}" data-id="${m.id}">${m.thumb ? `<img src="${m.thumb}" alt="">` : '<div class="nothumb"></div>'}
        <div class="inf">${mode.rename === m.id ? `<div class="row" style="margin:0"><input type="text" data-k="nm" value="${K.BuilderAppUtils.escapeHtml(m.name)}" maxlength="80"><button class="b pri" data-a="rn-ok">Save</button><button class="b" data-a="rn-x">Cancel</button></div>` : `<b data-a="open" title="Open">${K.BuilderAppUtils.escapeHtml(m.name)}</b>`}
          <small>${m.w} × ${m.h} tiles · ${m.objects} objects · ${(m.bytes / 1024).toFixed(0)} KB · saved ${when(m.updated)}${m.id === this.savedId ? ' · <b style="display:inline;color:#2f5f86">open now</b>' : ''}</small></div>
        <div class="ba">${mode.del === m.id ? `<span class="conf">Delete "${K.BuilderAppUtils.escapeHtml(m.name)}" for good?<button class="b" data-a="del-x">Keep</button><button class="b danger" data-a="del-ok">Delete</button></span>` : `<button class="b pri" data-a="open">Open</button><button class="b" data-a="rename">Rename</button><button class="b" data-a="dup">Duplicate</button><button class="b" data-a="del">Delete</button>`}</div></div>`).join('')
        : '<div class="none">No saved worlds yet. Use <b>Save world</b> (Ctrl+S) to keep the one you are building.</div>';
      const inp = $('wlList').querySelector('[data-k=nm]'); if (inp) { inp.focus(); inp.select(); inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') $('wlList').querySelector('[data-a=rn-ok]').click(); if (e.key === 'Escape') this.renderWorlds(); }; }
    }
    async worldsAction(id, a) {
      const st = this.store;
      try {
        if (a === 'open') {
          if (this.dirtySince && id !== this.savedId && !(await this.ask('Open this world?', 'The world you are editing has unsaved changes. They will be lost unless you save it first.', 'Open anyway', true))) return;
          const txt = await st.load(id); if (this.loadText(txt)) { this.savedId = id; this.dirtySince = false; this.updateDirty(); $('worldsModal').classList.remove('show'); }
        } else if (a === 'rename') this.renderWorlds({ rename: id });
        else if (a === 'rn-x' || a === 'del-x') this.renderWorlds();
        else if (a === 'rn-ok') {
          const nm = ($('wlList').querySelector('[data-k=nm]').value || '').trim(); if (!nm) return;
          await st.rename(id, nm); if (id === this.savedId) { this.doc.name = nm; this.updateDirty(); if (this.toolName === 'select' && !this.sel) this.panel(); }
          this.toast(`Renamed to "${nm}".`); this.renderWorlds();
        } else if (a === 'dup') { const m = await st.duplicate(id); this.toast(`Duplicated as "${m.name}".`); this.renderWorlds(); }
        else if (a === 'del') this.renderWorlds({ del: id });
        else if (a === 'del-ok') {
          const m = await st.meta(id); await st.remove(id);
          if (id === this.savedId) { this.savedId = null; this.dirtySince = true; this.updateDirty(); }
          this.toast(`Deleted "${m ? m.name : 'world'}".`); this.renderWorlds();
        }
      } catch (e) { console.warn(e); this.toast('That did not work: ' + e.message); }
    }
  }
  K.BuilderAppStorage = BuilderAppStorage;
})(typeof window !== 'undefined' ? window : globalThis);
