import { ServerConfig } from './ServerConfig.js';

// Copyright (c) 2026 Merchant Protocol. All rights reserved.
export class Banners {
  defaultBanner(id) { let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { name: '',
  color: [0,
  1,
  3,
  4,
  5,
  6,
  7,
  10,
  2][h % 9],
  logo: h % 12 };
  }
  clean(b, fallback) { b = b || {};
  return { name: String(b.name == null ? fallback.name : b.name).slice(0,
  24),
  color: Math.max(0,
  Math.min(11,
  b.color == null ? fallback.color : b.color | 0)),
  logo: Math.max(0,
  Math.min(11,
  b.logo == null ? fallback.logo : b.logo | 0)) };
  }
  /** what a settler (online or not) flies: their team's banner if they are on a team, else their own */
  resolved(id) { const t = this.teams[this.teamOf(id)];
  const b = t && t.banner ? t.banner : this.banners[id] || this.defaultBanner(id);
  return Object.assign({},
  b,
  { team: t ? t.id : null });
  }
  allBanners() { const ids = new Set([...Object.keys(this.banners),
  ...Object.values(this.plots).map((v,
  i) => Object.keys(this.plots)[i].slice(0,
  8)),
  ...Object.values(this.world.houses).map((h) => h.owner),
  ...Object.values(this.world.pieces).map((q) => q.owner)]);
  const out = {};
  for (const id of ids) if (id) out[id] = this.resolved(id);
  return out;
  }
  pushBanners(ids) { const m = {};
  for (const id of ids) m[id] = this.resolved(id);
  this.broadcast({ t: 'banners',
  map: m });
  this.state.storage.put('banners',
  this.banners);
  }
  onBanner(p, m) {
    const tid = this.teamOf(p.id), cur = this.resolved(p.id), nb = this.clean(m.b, cur);
    if (tid) { const t = this.teams[tid]; t.banner = nb; t.name = nb.name || t.name; this.saveTeams(); this.pushBanners(t.members); }
    else { this.banners[p.id] = nb; this.pushBanners([p.id]); }
  }

  install(room) {
    for (const method of ['defaultBanner', 'clean', 'resolved', 'allBanners', 'pushBanners', 'onBanner']) room[method] = this[method].bind(room);
  }
}
