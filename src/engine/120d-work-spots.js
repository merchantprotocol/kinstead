/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · where workers stand.
     WorkSpots   points around buildings: just outside a building's door, just inside it, a point in a piece's own frame
     Stations    where a worker stands to use a piece of furniture inside a walk-in building (a free floor tile next to it) */
(function (G) {
  const K = G.K, TILE = K.TILE;

  class WorkSpots {
    /** the main door of a building spec, just outside */
    static door(spec) {
      const d = WorkSpots.mainDoor(spec), along = d.side === 'n' || d.side === 's';
      let x = spec.x + d.x + (along ? d.w / 2 : 0), z = spec.z + d.z + (along ? 0 : d.w / 2);
      if (d.side === 's') z += 1.8; else if (d.side === 'n') z -= 0.8; else if (d.side === 'e') x += 1.8; else x -= 0.8;
      return { x: x * TILE, z: z * TILE };
    }
    /** just inside the main door */
    static inside(spec) {
      const d = WorkSpots.mainDoor(spec), along = d.side === 'n' || d.side === 's';
      let x = spec.x + d.x + (along ? d.w / 2 : 0.5), z = spec.z + d.z + (along ? 0.5 : d.w / 2);
      if (d.side === 's') z -= 1.2; else if (d.side === 'n') z += 1.2; else if (d.side === 'e') x -= 1.2; else x += 1.2;
      return { x: x * TILE, z: z * TILE };
    }
    /** flat distance between two things with x and z */
    static dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
    static mainDoor(spec) { return spec.doors.find((q) => q.kind !== 'interior') || spec.doors[0]; }
    /** a point in a piece's own frame (lx along its width, lz toward its front), in the world */
    static local(p, lx, lz) { const r = p.rot || 0, c = Math.cos(r), s = Math.sin(r); return { x: p.x + lx * c + lz * s, z: p.z - lx * s + lz * c }; }
  }

  class Stations {
    constructor(game) { this.g = game; this.cache = new Map(); }
    /** [{ x, z, face, type }] for every item of these furniture types in the building */
    of(spec, types) {
      if (!spec) return [];
      const key = `${spec.id}:${spec.x},${spec.z}:${types.join(',')}`; if (this.cache.has(key)) return this.cache.get(key);
      const out = []; for (const f of spec.furniture || []) { if (!types.includes(f.type)) continue; const s = this.station(spec, f); if (s) out.push(s); }
      this.cache.set(key, out); return out;
    }
    /** the nearest free floor point beside one item, facing its middle */
    station(spec, f) {
      const def = (K.FURNITURE || {})[f.type], [w0, d0] = def && def.size ? def.size : [1, 1], [w, d] = (f.rot || 0) % 2 ? [d0, w0] : [w0, d0];
      const cx = (spec.x + f.x + w / 2) * TILE, cz = (spec.z + f.z + d / 2) * TILE, nav = this.g.play.nav;
      for (let r = 1; r <= 3; r++) {
        let best = null, bd = 1e9;
        for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const x = cx + di * TILE * 0.9, z = cz + dj * TILE * 0.9;
          if (!nav.standable(x, z) || !this.g.insideBuilding(x, z)) continue;
          const dd = Math.hypot(x - cx, z - cz); if (dd < bd) { bd = dd; best = { x, z }; }
        }
        if (best) return { x: best.x, z: best.z, face: { x: cx, z: cz }, type: f.type };
      }
      return null;
    }
  }

  Object.assign(K, { WorkSpots, Stations });
})(typeof window !== 'undefined' ? window : globalThis);
