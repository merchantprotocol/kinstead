/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · start menu: Continue, Play a world (prebuilt + My worlds), World Builder, Settings. */
(function (G) {
  const K = (G.K = G.K || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  class MainMenu {
    /* doc: the page document; router: K.Router; catalog: K.WorldCatalog; slot: K.ContinueSlot; settings: K.Settings;
       onSettings(values): called after a setting changes (the title scene re-applies them) */
    constructor({ doc, router, catalog, slot, settings, onSettings }) {
      Object.assign(this, { doc, router, catalog, slot, settings, onSettings: onSettings || (() => {}) });
      this.panels = ['mainPanel', 'worldsPanel', 'settingsPanel'];
    }
    $(id) { return this.doc.getElementById(id); }

    init() {
      this.$('mCastle').onclick = () => this.router.go('play', { mode: 'castle', new: 1 });   // only this starts over; a refresh keeps your progress
      this.$('mCastleCont').onclick = () => this.router.go('play', { mode: 'castle', resume: 1 });
      this.$('mContinue').onclick = () => this.router.go('play', { world: 'continue' });
      this.$('mPlay').onclick = () => this.openWorlds();
      this.$('mBuilder').onclick = () => this.router.go('builder');
      this.$('mSettings').onclick = () => this.openSettings();
      this.doc.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => this.show('mainPanel')));
      const pick = (e) => { const c = e.target.closest('[data-world]'); if (c) this.router.go('play', { world: c.dataset.world }); };
      this.$('wPrebuilt').addEventListener('click', pick); this.$('wMine').addEventListener('click', pick);
      this.doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.show('mainPanel'); });
      this.show('mainPanel');
      return this.refreshContinue();
    }
    show(id) { for (const p of this.panels) this.$(p).hidden = p !== id; this.current = id; }

    /* the castle story's save (localStorage) */
    refreshCastle() {
      const s = K.CastleSave ? new K.CastleSave(K.CastleSave.defaultStorage()).read() : null, b = this.$('mCastleCont'); b.hidden = !s;
      if (s && s.castle) this.$('mCastleContName').textContent = `Castle Level ${K.Castle.fromJSON(new K.CastleData(K.CASTLE_DATA), s.castle).cl()} · ${new Date(s.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      return s;
    }
    async refreshContinue() {
      try { this.refreshCastle(); } catch (e) { console.warn('castle save unreadable', e); }
      let s = null; try { s = await this.slot.read(); } catch (e) { s = null; }
      const b = this.$('mContinue'); b.hidden = !s;
      if (s) this.$('mContinueName').textContent = `${s.name || 'Your world'} · ${new Date(s.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
      return s;
    }

    card(w) {
      const thumb = w.thumbnail ? `<img src="${esc(w.thumbnail)}" alt="" loading="lazy">` : '<div class="nothumb"></div>';
      return `<button class="wcard" data-world="${esc(w.id)}" title="Play ${esc(w.name)}">${thumb}<span class="winf"><b>${esc(w.name)}</b><small>${esc(w.description || '')}</small></span></button>`;
    }
    async openWorlds() {
      this.show('worldsPanel');
      const pre = this.$('wPrebuilt'), mine = this.$('wMine');
      pre.innerHTML = mine.innerHTML = '<p class="empty">Loading…</p>';
      const [a, b] = await Promise.allSettled([this.catalog.prebuilt(), this.catalog.mine()]);
      pre.innerHTML = a.status === 'fulfilled' ? (a.value.length ? a.value.map((w) => this.card(w)).join('') : '<p class="empty">No prebuilt worlds.</p>') : `<p class="empty">Could not load the prebuilt worlds (${esc(a.reason && a.reason.message)}).</p>`;
      mine.innerHTML = b.status === 'fulfilled' ? (b.value.length ? b.value.map((w) => this.card(w)).join('') : '<p class="empty">No saved worlds yet. Build one in the World Builder and use <b>Save world</b>.</p>') : `<p class="empty">My worlds are not available here (${esc(b.reason && b.reason.message)}).</p>`;
    }

    openSettings() {
      this.show('settingsPanel');
      const v = this.settings.values;
      this.$('sQuality').innerHTML = K.Settings.QUALITIES.map((q) => `<button class="seg ${q.value === v.quality ? 'on' : ''}" data-q="${q.value}">${q.label}</button>`).join('');
      this.$('sQuality').onclick = (e) => { const b = e.target.closest('[data-q]'); if (b) { this.change({ quality: b.dataset.q }); this.openSettings(); } };
      this.$('sDof').checked = v.dof; this.$('sBloom').checked = v.bloom;
      this.$('sDof').onchange = (e) => this.change({ dof: e.target.checked });
      this.$('sBloom').onchange = (e) => this.change({ bloom: e.target.checked });
    }
    change(patch) { this.onSettings(this.settings.set(patch)); }
  }

  K.MainMenu = MainMenu;
})(typeof window !== 'undefined' ? window : globalThis);
