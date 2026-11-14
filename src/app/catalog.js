/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · where playable worlds come from: the prebuilt worlds shipped in worlds/ (index.json
   manifest) and "My worlds" saved by the builder in IndexedDB (K.WorldStore).
   World ids: "<prebuilt-id>", "my:<store id>", or "continue" (the last play session, see K.ContinueSlot). */
(function (G) {
  const K = (G.K = G.K || {});

  class WorldCatalog {
    static MANIFEST = 'worlds/index.json';
    static PREBUILT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

    /* fetchFn: window.fetch (or a stub); store: Promise<K.WorldStore>; slot: K.ContinueSlot */
    constructor({ fetchFn, store, slot }) { this.fetchFn = fetchFn; this.store = store; this.slot = slot; this.manifest = null; }

    async fetchText(url) {
      const r = await this.fetchFn(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.text();
    }
    async prebuilt() {
      if (!this.manifest) {
        const m = JSON.parse(await this.fetchText(WorldCatalog.MANIFEST));
        this.manifest = (m.worlds || []).filter((w) => WorldCatalog.PREBUILT_ID.test(w.id));
      }
      return this.manifest.map((w) => Object.assign({ kind: 'prebuilt' }, w));
    }
    async mine() {
      const st = await this.store; if (!st) return [];
      const list = await st.list();
      return list.map((m) => ({ kind: 'mine', id: 'my:' + m.id, name: m.name, description: `${m.w} × ${m.h} tiles · ${m.objects} objects`, thumbnail: m.thumb || null, updated: m.updated }));
    }
    /* -> { id, name, text } for a world id; throws with a readable message if it cannot be found */
    async open(id) {
      id = String(id || '');
      if (id === 'continue') {
        const s = this.slot && (await this.slot.read()); if (!s) throw new Error('There is no saved game to continue.');
        return { id: s.worldId, name: s.name, text: s.json, resumed: true };
      }
      if (id.startsWith('my:')) {
        const st = await this.store, sid = id.slice(3); if (!st) throw new Error('My worlds storage is not available.');
        const meta = await st.meta(sid); const text = await st.load(sid);
        return { id, name: meta ? meta.name : 'My world', text };
      }
      if (!WorldCatalog.PREBUILT_ID.test(id)) throw new Error('Unknown world: ' + id);
      const entry = (await this.prebuilt()).find((w) => w.id === id); if (!entry) throw new Error('Unknown world: ' + id);
      return { id, name: entry.name, text: await this.fetchText(entry.file) };
    }
  }

  /* the last play session (world + character progress), so the menu can offer Continue */
  class ContinueSlot {
    static KEY = 'continue';
    constructor(store) { this.store = store; }
    async read() {
      const st = await this.store; if (!st) return null;
      const v = await st.backend.getKV(ContinueSlot.KEY);
      return v && v.json && v.worldId ? v : null;
    }
    async save({ worldId, name, json }) {
      const st = await this.store; if (!st) return null;
      const v = { at: Date.now(), worldId, name, json: typeof json === 'string' ? json : JSON.stringify(json) };
      await st.backend.setKV(ContinueSlot.KEY, v); return v;
    }
  }

  Object.assign(K, { WorldCatalog, ContinueSlot });
})(typeof window !== 'undefined' ? window : globalThis);
