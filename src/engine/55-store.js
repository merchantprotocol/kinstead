/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead World Builder 3D · world storage: "My worlds" in IndexedDB, with an in-memory fallback
   for pages that cannot store anything (data: URLs, sandboxed frames, blocked storage). */
(function (G) {
  const K = G.K;
  const DB_NAME = 'kinstead-worlds', DB_VERSION = 1;

  /* same API as IdbBackend, but nothing survives a reload */
  class MemoryBackend {
    constructor(reason) { this.kind = 'memory'; this.reason = reason || 'Storage is not available on this page.'; this.meta = new Map(); this.data = new Map(); this.kv = new Map(); }
    async list() { return [...this.meta.values()].map((m) => Object.assign({}, m)); }
    async getMeta(id) { const m = this.meta.get(id); return m ? Object.assign({}, m) : null; }
    async getData(id) { return this.data.has(id) ? this.data.get(id) : null; }
    async put(meta, json) { this.meta.set(meta.id, Object.assign({}, meta)); if (json != null) this.data.set(meta.id, json); }
    async remove(id) { this.meta.delete(id); this.data.delete(id); }
    async getKV(k) { return this.kv.has(k) ? this.kv.get(k) : null; }
    async setKV(k, v) { this.kv.set(k, v); }
  }

  class IdbBackend {
    constructor(db) { this.kind = 'indexeddb'; this.db = db; }
    /* resolves to a backend, or rejects with the reason storage is unavailable */
    static open(timeoutMs = 2500) {
      return new Promise((resolve, reject) => {
        let done = false;
        const fail = (why) => { if (!done) { done = true; reject(new Error(why)); } };
        const timer = setTimeout(() => fail('IndexedDB did not answer (blocked or very slow).'), timeoutMs);
        let req;
        try {
          const f = G.indexedDB; if (!f) { clearTimeout(timer); fail('This browser has no IndexedDB.'); return; }
          req = f.open(DB_NAME, DB_VERSION);
        } catch (e) { clearTimeout(timer); fail(IdbBackend.why(e)); return; }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('data')) db.createObjectStore('data');
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        };
        req.onerror = () => { clearTimeout(timer); fail(IdbBackend.why(req.error)); };
        req.onblocked = () => { clearTimeout(timer); fail('The world database is open in an older tab. Close other builder tabs and reload.'); };
        req.onsuccess = () => { clearTimeout(timer); if (done) { req.result.close(); return; } done = true; resolve(new IdbBackend(req.result)); };
      });
    }
    static why(e) {
      const m = (e && (e.name + ': ' + e.message)) || String(e);
      return /Security|denied|opaque|insecure/i.test(m) ? 'This page was opened from a data: URL or sandbox, where the browser blocks storage.' : 'Storage failed: ' + m;
    }
    tx(stores, mode, fn) {
      return new Promise((resolve, reject) => {
        let out; const t = this.db.transaction(stores, mode);
        t.oncomplete = () => resolve(out); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error || new Error('Storage transaction aborted (disk full?).'));
        const r = fn(...stores.map((s) => t.objectStore(s)));
        if (r && 'onsuccess' in r) r.onsuccess = () => (out = r.result);
      });
    }
    list() { return this.tx(['meta'], 'readonly', (m) => m.getAll()); }
    getMeta(id) { return this.tx(['meta'], 'readonly', (m) => m.get(id)).then((r) => r || null); }
    getData(id) { return this.tx(['data'], 'readonly', (d) => d.get(id)).then((r) => (r == null ? null : r)); }
    put(meta, json) { return this.tx(['meta', 'data'], 'readwrite', (m, d) => { m.put(meta); if (json != null) d.put(json, meta.id); }); }
    remove(id) { return this.tx(['meta', 'data'], 'readwrite', (m, d) => { m.delete(id); d.delete(id); }); }
    getKV(k) { return this.tx(['kv'], 'readonly', (s) => s.get(k)).then((r) => (r == null ? null : r)); }
    setKV(k, v) { return this.tx(['kv'], 'readwrite', (s) => s.put(v, k)); }
  }

  /* the "My worlds" list: one meta record (name, sizes, thumbnail) + one JSON blob per world */
  class WorldStore {
    constructor(backend) { this.backend = backend; }
    /* IndexedDB if the page can store, otherwise memory. A busy page can make IndexedDB answer late:
       after the timeout we fall back to memory, but switch to IndexedDB if it opens later and nothing
       was saved to memory yet (onUpgrade is called so the UI can drop its "not stored" note). */
    static async create(opts = {}) {
      if (opts.forceMemory) return new WorldStore(new MemoryBackend(opts.forceMemory));
      const opening = IdbBackend.open(1e9);
      let timer; const late = new Promise((_, rej) => (timer = setTimeout(() => rej(new Error('IndexedDB did not answer in time (the page may be busy).')), opts.timeoutMs || 12000)));
      try { const b = await Promise.race([opening, late]); clearTimeout(timer); return new WorldStore(b); }
      catch (e) {
        clearTimeout(timer); const st = new WorldStore(new MemoryBackend(e.message));
        opening.then(async (b) => { if (st.backend.kind === 'memory' && !st.backend.meta.size) { st.backend = b; if (st.onUpgrade) st.onUpgrade(); } else b.db.close(); }).catch(() => {});
        return st;
      }
    }
    get persistent() { return this.backend.kind !== 'memory'; }
    get reason() { return this.backend.reason || ''; }
    static newId() { return 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
    static metaOf(id, name, json, thumb, created) {
      const o = typeof json === 'string' ? JSON.parse(json) : json;
      return { id, name: name || o.name || 'Untitled world', w: o.size.w, h: o.size.h, objects: (o.objects || []).length, bytes: (typeof json === 'string' ? json : JSON.stringify(json)).length, thumb: thumb || null, created: created || Date.now(), updated: Date.now() };
    }
    async list() { const l = await this.backend.list(); return l.sort((a, b) => b.updated - a.updated); }
    /* save a world; id given = overwrite that entry. The stored JSON carries the entry's name. */
    async save({ id, name, json, thumb }) {
      const old = id ? await this.backend.getMeta(id) : null;
      const o = typeof json === 'string' ? JSON.parse(json) : JSON.parse(JSON.stringify(json));
      o.name = name || o.name; const txt = JSON.stringify(o);
      const meta = WorldStore.metaOf(old ? old.id : WorldStore.newId(), o.name, txt, thumb || (old && old.thumb), old && old.created);
      await this.backend.put(meta, txt);
      return meta;
    }
    async load(id) { const t = await this.backend.getData(id); if (t == null) throw new Error('That world is missing from storage.'); return t; }
    async meta(id) { return this.backend.getMeta(id); }
    async rename(id, name) {
      const m = await this.backend.getMeta(id); if (!m) throw new Error('That world is missing from storage.');
      const t = await this.backend.getData(id); const o = JSON.parse(t); o.name = name; m.name = name; m.updated = Date.now();
      await this.backend.put(m, JSON.stringify(o)); return m;
    }
    async duplicate(id) {
      const m = await this.backend.getMeta(id), t = await this.backend.getData(id); if (!m || t == null) throw new Error('That world is missing from storage.');
      const names = new Set((await this.backend.list()).map((x) => x.name));
      let name = m.name + ' (copy)', n = 2; while (names.has(name)) name = m.name + ' (copy ' + n++ + ')';
      return this.save({ name, json: t, thumb: m.thumb });
    }
    remove(id) { return this.backend.remove(id); }
    autosave(json) { return this.backend.setKV('autosave', { at: Date.now(), json }); }
    readAutosave() { return this.backend.getKV('autosave'); }
  }

  Object.assign(K, { WorldStore, MemoryBackend, IdbBackend });
})(typeof window !== 'undefined' ? window : globalThis);
