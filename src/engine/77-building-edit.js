/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · buildings: editing operations the builder runs on building objects (format v2).
   Pure data (no THREE, no DOM): quarter-turn rotation, moving, placement checks against the world,
   and furniture placement checks inside a building. Used by the Building and Furniture tools and the tests. */
(function (G) {
  const K = G.K;
  const TILE = K.TILE || 0.5;
  const { Footprint, FurnitureFootprint, BuildingSpec, BuildingLayout } = K;
  const SIDE_CW = { n: 'e', e: 's', s: 'w', w: 'n' };
  const CORNER_CW = { ne: 'se', se: 'sw', sw: 'nw', nw: 'ne' };

  class BuildingEdit {
    constructor(catalog = K.FURNITURE) { this.catalog = catalog; }

    /* ---------- rotation ----------
       One clockwise quarter turn (seen from above, x east, z south): local tile (i, j) -> (H-1-j, i).
       Directions map n->e->s->w->n; furniture `rot` (0 faces south) becomes (rot+3)%4. The building
       stays centred on the same spot. dir = +1 clockwise, -1 counter-clockwise (three clockwise turns). */
    rotate(b, dir = 1) {
      let o = BuildingSpec.normalize(b);
      const turns = ((dir % 4) + 4) % 4;
      for (let k = 0; k < turns; k++) o = this.rotateCW(o);
      return o;
    }
    rotateCW(b) {
      const W = b.footprint.w, H = b.footprint.h, o = JSON.parse(JSON.stringify(b));
      const mapT = (i, j) => [H - 1 - j, i];
      o.footprint = { shape: b.footprint.shape, w: H, h: W };
      if (b.footprint.notch) o.footprint.notch = { corner: CORNER_CW[b.footprint.notch.corner], w: b.footprint.notch.h, h: b.footprint.notch.w };
      o.rooms = b.rooms.map((r) => Object.assign({}, r, { x: H - r.z - r.h, z: r.x, w: r.h, h: r.w }));
      const opening = (d) => {
        const along = d.side === 'n' || d.side === 's' ? [1, 0] : [0, 1], tiles = [];
        for (let k = 0; k < d.w; k++) tiles.push(mapT(d.x + along[0] * k, d.z + along[1] * k));
        return Object.assign({}, d, { x: Math.min(...tiles.map((t) => t[0])), z: Math.min(...tiles.map((t) => t[1])), side: SIDE_CW[d.side] });
      };
      o.doors = b.doors.map(opening); o.windows = b.windows.map(opening);
      o.furniture = b.furniture.map((f) => {
        const def = this.catalog[f.type] || { size: [1, 1] }, [fw, fd] = FurnitureFootprint.size(def, f.rot | 0);
        return Object.assign({}, f, { x: H - f.z - fd, z: f.x, rot: ((f.rot | 0) + 3) % 4 });
      });
      o.x = b.x + Math.floor((W - H) / 2); o.z = b.z + Math.floor((H - W) / 2);
      o.rotation = (((b.rotation | 0) + 1) % 4);
      return BuildingSpec.normalize(o);
    }

    /* ---------- placement in the world ---------- */
    worldTiles(b) { return Footprint.tiles(b.footprint).map(([i, j]) => [b.x + i, b.z + j]); }
    /* problems placing building `b` in `doc` (ignoring the object with id b.id); [] when it fits */
    placementProblems(doc, b) {
      const errs = [], tiles = this.worldTiles(b), set = new Set(tiles.map(([i, j]) => i + ',' + j));
      if (tiles.some(([i, j]) => i < 1 || j < 1 || i >= doc.w - 1 || j >= doc.h - 1)) errs.push('The building must sit inside the world, one tile from the edge.');
      const chasm = (K.T && K.T.CHASM != null) ? K.T.CHASM : 4;
      if (tiles.some(([i, j]) => doc.inside(i, j) && doc.type(i, j) === chasm)) errs.push('It would hang over the chasm.');
      for (const o of doc.objects) {
        if (o.id === b.id) continue;
        if (o.kind === 'building') {
          if (this.worldTiles(o).some(([i, j]) => set.has(i + ',' + j))) { errs.push('It overlaps ' + (o.name || (K.BUILDING_PREFABS[o.prefab] || {}).name || 'another building') + '.'); }
        } else if (o.kind === 'bridge') {
          const pts = [o.a, o.b, [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2]];
          if (pts.some(([x, z]) => set.has(Math.floor(x / TILE) + ',' + Math.floor(z / TILE)))) errs.push('It overlaps a bridge.');
        }
      }
      return errs;
    }
    /* move by whole tiles */
    moved(b, di, dj) { return Object.assign(JSON.parse(JSON.stringify(b)), { x: b.x + di, z: b.z + dj }); }

    /* ---------- furniture ---------- */
    /* the local tiles a doorway keeps clear (both sides of interior doors, the inside of exterior doors) */
    doorTiles(b) {
      const L = new BuildingLayout(b, this.catalog), out = new Set(), N = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
      for (const d of L.doors) for (const [i, j] of d.tiles) { out.add(i + ',' + j); if (d.kind === 'interior') { const n = N[d.side]; out.add((i + n[0]) + ',' + (j + n[1])); } }
      return out;
    }
    /* problems placing furniture `f` (local tiles) in building `b` (ignoring furniture with f.id); [] when it fits */
    furnitureProblems(b, f) {
      const def = this.catalog[f.type]; if (!def) return ['Unknown furniture ' + f.type + '.'];
      const errs = [], tiles = FurnitureFootprint.tiles(def, f);
      if (tiles.some(([i, j]) => !Footprint.inside(b.footprint, i, j))) errs.push(def.name + ' must stay inside the building.');
      const solid = def.solid !== false && def.layer !== 'floor';
      if (solid) {
        const layout = new BuildingLayout(b, this.catalog), roomIds = new Set(tiles.map(([i,j]) => (layout.roomAt(i,j) || {}).id));
        if (roomIds.size > 1) errs.push(def.name + ' must fit within one room.');
        const doors = this.doorTiles(b);
        if (tiles.some(([i, j]) => doors.has(i + ',' + j))) errs.push(def.name + ' would block a doorway.');
        for (const g of b.furniture) {
          if (g.id === f.id) continue; const gd = this.catalog[g.type]; if (!gd || gd.solid === false || gd.layer === 'floor') continue;
          const gt = new Set(FurnitureFootprint.tiles(gd, g).map(([i, j]) => i + ',' + j));
          if (tiles.some(([i, j]) => gt.has(i + ',' + j))) { errs.push(def.name + ' overlaps the ' + gd.name.toLowerCase() + '.'); break; }
        }
      }
      return errs;
    }
    /* the furniture item covering local tile (i,j) (interactive / solid items win over rugs) */
    furnitureAt(b, i, j) {
      let best = null;
      for (const f of b.furniture) {
        const def = this.catalog[f.type]; if (!def) continue;
        if (!FurnitureFootprint.tiles(def, f).some(([x, z]) => x === i && z === j)) continue;
        const rank = def.layer === 'floor' ? 0 : 1;
        if (!best || rank >= best.rank) best = { f, rank };
      }
      return best ? best.f : null;
    }
    /* next free furniture id in a building */
    nextFurnitureId(b) { let n = b.furniture.length; const ids = new Set(b.furniture.map((f) => f.id)); while (ids.has('f' + n)) n++; return 'f' + n; }
  }

  K.BuildingEdit = BuildingEdit;
})(typeof window !== 'undefined' ? window : globalThis);
