/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · KeeperRoutines: what each keeper does all day, one small routine class per trade, looked up by building type.
     YardRoutine      the workshop's own work spots from the art (millstones, chopping block, hay shed…), carrying loads between them
     WoodsRoutine     the woodcutter and the quarryman: out to real trees and rocks, back with the load, yard work between trips
     FieldRoutine     the farmer: hoes the wheat squares, brings a sheaf home, forks hay in the shed
     HerdRoutine      the cowherd: milks a cow into a pail, carries it to the trough side, forks hay
     MillRoutine      the miller: grinds at the stones, shifts sacks and hay, and now and then fetches a sack from the silo
     LookoutRoutine   the archer: walks round the tower, shading their eyes */
(function (G) {
  const K = G.K, TILE = K.TILE;
  const at = K.WorkSpots.local;

  class YardRoutine {
    run(k, e) { this.yard(k, e, 2); }
    /** n turns at the building's work spots; a spot with a load is picked up there and set down at the next */
    yard(k, e, n) {
      const p = k.p, sp = K.WorkshopLayout.workSpots(p.type); if (!sp) { this.round(k, e, ['sweep', 'lift']); return; }
      for (let q = 0; q < n; q++) {
        const s = sp[(k.loop++) % sp.length], here = at(p, s.x, s.z), face = at(p, s.face[0], s.face[1]);
        if (!s.carry) { e.go(here.x, here.z).work(3 + Math.random() * 2.5, s.pose, face, { spin: s.spin ? k.spinner : null }); continue; }
        const nx = sp[k.loop % sp.length], to = at(p, nx.x, nx.z);
        e.go(here.x, here.z).work(1.4, 'lift', face).carry(s.carry).go(to.x, to.z).work(1, 'lift', at(p, nx.face[0], nx.face[1])).carry(null);
      }
    }
    /** a short walk round the outside of the building, doing something with their hands at each stop */
    round(k, e, poses, r0 = 0.9) {
      const p = k.p, [w, d] = K.CastleArt.size(p.type), R = Math.max(w, d) / 2 + r0, nav = k.g.play.nav;
      for (let q = 0; q < 2; q++) {
        const ang = Math.random() * 6.283, x = p.x + Math.cos(ang) * R, z = p.z + Math.sin(ang) * R;
        if (nav.standable(x, z)) e.go(x, z).work(2.5 + Math.random() * 2, poses[q % poses.length], q ? null : p);
      }
      if (!e.busy) e.work(2.5, poses[0], p);
    }
  }

  class WoodsRoutine extends YardRoutine {
    run(k, e) { if (k.loop % 3 === 2 && this.trip(k, e)) { k.loop++; return; } this.yard(k, e, 2); }
    /** out to the nearest live tree or rock, work it, carry the load back; every few loads a cart takes it to your stores */
    trip(k, e) {
      const g = k.g, p = k.p, wood = p.type === 'woodcutter', kinds = wood ? ['c_tree'] : ['c_boulder', 'c_rubble'];
      let best = null, bd = 32;
      for (const n of g.forest.nodes) { if (!kinds.includes(n.type) || !g.forest.live(n)) continue;
        const d = Math.hypot(n.x - p.x, n.z - p.z);
        if (d < bd) { bd = d;
          best = n;
          } }
      if (!best) return false;
      const dx = p.x - best.x, dz = p.z - best.z, L = Math.hypot(dx, dz) || 1, r = (best.r || 0.5) + 0.55, stand = { x: best.x + dx / L * r,
          z: best.z + dz / L * r };
      if (!g.play.nav.standable(stand.x, stand.z)) return false;
      const sp = K.WorkshopLayout.workSpots(p.type), drop = at(p, sp[2].x, sp[2].z);
      e.go(stand.x, stand.z).work(4.5, 'chop', best).carry(wood ? 'log' : 'stone').go(drop.x, drop.z).work(1, 'lift', at(p, ...sp[2].face)).carry(null);
      e.then(() => this.haul(k, wood));
      return true;
    }
    haul(k, wood) {
      k.trips = (k.trips || 0) + 1; if (k.trips % 3) return;
      const eco = k.g.economy, p = k.p, near = (a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z);
      const to = eco.of('storehouse').sort(near)[0] || eco.of('market')[0];
      const free = !eco.carts.some((c) => c.from === p);   // one cart per building, as the farms have
      if (to && free && Math.hypot(to.x - p.x, to.z - p.z) > 3 && eco.carts.length < 12) eco.carts.push(new K.Cart(eco, p, to, wood ? 'wood' : 'stone', 0));
    }
  }

  class FieldRoutine extends YardRoutine {
    run(k, e) {
      const eco = k.eco, p = k.p, mine = [...eco.fields.tiles.values()].filter((t) => eco.nearestFarm((t.i + 0.5) * TILE, (t.j + 0.5) * TILE) === p);
      if (!mine.length || k.loop++ % 2) { this.yard(k, e, 2); return; }
      const t = mine[Math.floor(Math.random() * mine.length)], x = (t.i + 0.5) * TILE, z = (t.j + 0.5) * TILE, home = at(p, -1.0, 0.75);
      e.go(x, z + 0.3).work(4, eco.fields.stage(t) === 2 ? 'chop' : 'pitch', { x, z }).carry('wheat').go(home.x, home.z).work(1, 'lift', at(p, -1.0,
          1.0)).carry(null);
    }
  }

  class HerdRoutine extends YardRoutine {
    run(k, e) {
      const h = k.eco.stock.herd(k.p); if (!h.length || k.loop++ % 2) { this.yard(k, e, 2); return; }
      const b = h[Math.floor(Math.random() * h.length)], back = at(k.p, 0.85, 0.1);
      e.go(b.x + 0.5, b.z).then(() => { b.a.path = null; b.wait = 6; }).work(4, 'milk', b.a).carry('bucket');
      e.go(back.x, back.z).work(1, 'lift', at(k.p, 1.15, 0.08)).carry(null);
    }
  }

  class MillRoutine extends YardRoutine {
    run(k, e) { if (k.loop % 4 === 3 && this.fromSilo(k, e)) { k.loop++; return; } this.yard(k, e, 2); }
    /** a sack from the silo for the stones (for show: the wheat itself stays in the silo's count) */
    fromSilo(k, e) {
      const silo = k.eco.of('silo').find((s) => k.eco.ledger(s).amount('wheat') >= 1); if (!silo || K.WorkSpots.dist(silo, k.p) > 30) return false;
      const out = at(silo, 0, 1.4), back = at(k.p, 0.75, -0.55);
      e.go(out.x, out.z).work(1.6, 'lift', silo).carry('sack').go(back.x, back.z).work(1, 'lift', at(k.p, 0.7, -0.85)).carry(null);
      return true;
    }
  }

  class LookoutRoutine extends YardRoutine { run(k, e) { this.round(k, e, ['look', 'look', 'sweep'], 0.6); } }

  class KeeperRoutines {
    constructor(workers) {
      this.w = workers;
      const yard = new YardRoutine(), woods = new WoodsRoutine();
      this.byType = { storehouse: new MillRoutine(), woodcutter: woods, quarry: woods, farm: new FieldRoutine(), barn: new HerdRoutine(),
          watchtower: new LookoutRoutine() };
      this.fallback = yard;
    }
    /** a loaded cart waiting at the door comes first; otherwise the trade's own routine */
    run(keeper, e) { if (this.w.haulage.take(keeper, e)) return; (this.byType[keeper.p.type] || this.fallback).run(keeper, e); }
  }

  Object.assign(K, { KeeperRoutines, YardRoutine, WoodsRoutine, FieldRoutine, HerdRoutine, MillRoutine, LookoutRoutine });
})(typeof window !== 'undefined' ? window : globalThis);
