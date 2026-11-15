import { ServerConfig } from './ServerConfig.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
export class Stores {
  onStores(p, m) {
    for (const s of (m.list || []).slice(0, 80)) {
      const id = p.id + ':' + s.id, existing = this.stores[id];
      this.stores[id] = { id,
      owner: p.id,
      kind: s.kind,
      name: String(s.name || '').slice(0,
      40),
      res: s.res,
      x: s.x,
      z: s.z,
      stack: s.stack || 1,
      stock: existing ? Math.min(existing.stock,
      Math.max(0,
      s.stock | 0)) : Math.max(0,
      s.stock | 0) };
    }
    // A reconnect snapshot may be stale. Keep server-known stores omitted by it; only explicit store-gone removes them.
    this.broadcast({ t: 'stores',
    owner: p.id,
    list: Object.values(this.stores).filter((q) => q.owner === p.id) }, this.wsOf(p));
    this.storesDirty = true;
    this.ver.s++;
    this.send(this.wsOf(p), { t: 'stores',
    owner: p.id,
    mine: true,
    list: Object.values(this.stores).filter((q) => q.owner === p.id) });
    // what the server holds for you (it may differ: raiders)
  }

  onStore(p, m) {   // one store appears (a pile you dropped) or goes
    const id = p.id + ':' + m.id;
    if (m.gone) { delete this.stores[id]; this.broadcast({ t: 'store', id, gone: true }); }
    else { const old = this.stores[id];
    this.stores[id] = { id,
    owner: p.id,
    kind: m.kind,
    name: String(m.name || '').slice(0,
    40),
    res: m.res,
    x: m.x,
    z: m.z,
    stack: m.stack || 1,
    stock: old ? Math.min(old.stock,
    Math.max(0,
    m.stock | 0)) : Math.max(0,
    m.stock | 0) };
    this.broadcast({ t: 'store',
    s: this.stores[id] },
    this.wsOf(p));
    }
    this.storesDirty = true; this.ver.s++;
  }

  onStock(p, m) {   // the owner added or removed some of their own; cap each wire delta
    const st = this.stores[p.id + ':' + m.id];
    if (!st) return;
    const d = Math.max(-999, Math.min(999, m.d | 0));
    st.stock = Math.max(0, st.stock + d);
    this.broadcast({ t: 'stock',
    id: st.id,
    stock: st.stock });
    this.storesDirty = true;
    this.ver.s++;
  }

  onTake(p, m) {
    const st = this.stores[m.id]; if (!st || !this.near(p, st, 6)) return; const n = Math.min(st.stock, Math.max(1, Math.min(10, m.n | 0))); if (n <= 0) return;
    st.stock -= n;
    this.send(this.wsOf(p), { t: 'took',
    id: st.id,
    res: st.res,
    n });
    this.broadcast({ t: 'stock',
    id: st.id,
    stock: st.stock });
    this.storesDirty = true;
    this.ver.s++;
    const [ws] = this.byId(st.owner); if (ws && st.owner !== p.id) this.send(ws, { t: 'raided', by: p.name, res: st.res, n });
  }

  install(room) {
    for (const method of ['onStores', 'onStore', 'onStock', 'onTake']) room[method] = this[method].bind(room);
  }
}
