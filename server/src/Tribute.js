import { ServerConfig } from './ServerConfig.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
export class Tribute {
  onTribute(p, m) {
    const [ws, q] = this.byId(m.to); if (!ws || q === p || !this.near(p, q, 12)) return;
    if (m.t === 'demand') { const res = String(m.res),
    n = Math.max(1,
    Math.min(9999,
    m.n | 0));
    if (!ServerConfig.RES.has(res)) return;
    this.send(ws,
    { t: 'demand',
    from: p.id,
    name: p.name,
    res,
    n });
    }
    else if (m.t === 'pay') { const res = String(m.res),
    n = Math.max(1,
    Math.min(9999,
    m.n | 0));
    if (!ServerConfig.RES.has(res)) return;
    this.send(ws,
    { t: 'paid',
    from: p.id,
    name: p.name,
    res,
    n });
    }
    else this.send(ws, { t: 'refused', from: p.id, name: p.name });
  }

  install(room) {
    for (const method of ['onTribute']) room[method] = this[method].bind(room);
  }
}
