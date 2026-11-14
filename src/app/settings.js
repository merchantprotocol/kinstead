/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · player settings (render quality, depth of field, bloom), kept in localStorage and
   shared by the menu, the builder and play pages. */
(function (G) {
  const K = (G.K = G.K || {});

  class Settings {
    static KEY = 'kinstead-settings';
    static QUALITIES = [{ value: '2', label: 'Sharp' }, { value: '1', label: 'Balanced' }, { value: '0.7', label: 'Fast' }];
    static DEFAULTS = { quality: '1', dof: true, bloom: true };

    /* storage: anything with getItem/setItem (localStorage, or a stub in tests / blocked-storage pages) */
    constructor(storage) { this.storage = storage; this.values = this.load(); }
    static open() { let s = null; try { s = G.localStorage; s.getItem(Settings.KEY); } catch (e) { s = null; } return new Settings(s); }

    load() {
      let saved = {};
      try { saved = JSON.parse((this.storage && this.storage.getItem(Settings.KEY)) || '{}') || {}; } catch (e) { saved = {}; }
      const v = Object.assign({}, Settings.DEFAULTS, saved);
      if (!Settings.QUALITIES.some((q) => q.value === String(v.quality))) v.quality = Settings.DEFAULTS.quality;
      v.quality = String(v.quality); v.dof = v.dof !== false; v.bloom = v.bloom !== false;
      return v;
    }
    get quality() { return this.values.quality; }
    get dof() { return this.values.dof; }
    get bloom() { return this.values.bloom; }
    set(patch) {
      Object.assign(this.values, patch); this.values = Object.assign(this.values, this.normalise(this.values));
      try { if (this.storage) this.storage.setItem(Settings.KEY, JSON.stringify(this.values)); } catch (e) { /* storage blocked: settings last for this page */ }
      return this.values;
    }
    normalise(v) { return { quality: Settings.QUALITIES.some((q) => q.value === String(v.quality)) ? String(v.quality) : Settings.DEFAULTS.quality, dof: !!v.dof, bloom: !!v.bloom }; }

    /* before K.BuilderApp is constructed: its constructor reads the quality select */
    applyToControls(doc) {
      const q = doc.getElementById('qual'), d = doc.getElementById('tDof'), b = doc.getElementById('tBloom');
      if (q) q.value = this.quality; if (d) d.checked = this.dof; if (b) b.checked = this.bloom;
    }
    /* after start: the post pipeline reads the toggles only on change */
    applyToApp(app) { app.post.enabled.dof = this.dof; app.post.enabled.bloom = this.bloom; app.quality = +this.quality; app.resize(); }
  }

  K.Settings = Settings;
})(typeof window !== 'undefined' ? window : globalThis);
