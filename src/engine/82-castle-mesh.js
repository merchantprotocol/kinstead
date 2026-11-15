/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Castle mode art: the 15 castle pieces (+ ruins, Level 2 and frosted looks) as voxel models
   built with VoxKit and the shared BuildingMaterials, so they sit in the diorama like the buildings do.
   Also the castle's props (gatherable pine / boulder / rubble / iron rock), the hearth glow disc, the
   objective arrow, ice (frozen kin, frost barriers) and the troll's slam ring. Models only: no rules. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { PropBuilder } = K;
  const CYL = K.VoxKit.CYL, CYL8 = K.VoxKit.CYL8, CONE6 = new THREE.ConeGeometry(1, 1, 6);

  /* ---------- gatherable props (castle interaction types) ---------- */
  const P = PropBuilder.PROPS;
  P['c:pine'] = { name: 'Snow pine', group: 'Castle', r: 0.6, h: 3, interact: 'c_tree', build(pb, o, st) { if (st === 'depleted') return; pb.pineAt(0, -0.05, 0, 2.9 * pb.rng.range(0.92, 1.08)); } };   // just the tree: no logs lying at its foot
  /* dead trees are harvestable too: the same stump when they are felled */
  P['c:deadtree'] = { name: 'Dead tree', group: 'Castle', r: 0.5, h: 2.4, interact: 'c_tree', build(pb, o, st) {
    if (st === 'depleted') return;   // felled: gone
    P.deadtree.build(pb, o, st);
  } };
  P['c:iron'] = { name: 'Iron rock', group: 'Castle', r: 0.55, h: 0.9, interact: 'c_iron', build(pb, o, st) { if (st === 'depleted') return; P['res:ore'].build(pb, o, st); } };
  P['c:boulder'] = { name: 'Boulder', group: 'Castle', r: 0.6, h: 0.9, interact: 'c_boulder', build(pb, o, st) {
    if (st === 'depleted') return;   // used up: gone
    pb.boulderAt(0, 0, 0, 0.55); pb.boulderAt(0.42, 0, 0.22, 0.3); pb.boulderAt(-0.36, 0, 0.18, 0.26); pb.cap(0, 0.5, 0, 0.42, 0.36, 0.3, 0.07);
  } };
  P['c:rubble'] = { name: 'Ruin rubble', group: 'Castle', r: 0.55, h: 0.5, interact: 'c_rubble', build(pb, o, st) {
    if (st === 'depleted') return;
    pb.rubble(0, 0, 12, 0.55); pb.block(0.2, 0, -0.1, 0.36, 0.22, 0.26, 0.4, 3);
  } };

  /* piece footprints (m): w along the piece's local x, d along local z; used for nav blocking, raider collision and placement */
  const SIZE = {
    keep: [4.2, 4.2], palisade: [0.5, 0.5], stone_wall: [0.5, 0.5], dirt: [0.5, 0.5], gate: [2, 0.5], stone_gate: [4, 1.5], blacksmith: [6, 4.5], cottage: [5, 3.5], gatehouse: [3.6, 1.6], watchtower: [1.5, 1.5], ember_brazier: [0.8, 0.8], fire_pot: [0.8, 0.8], farm: [3, 2.5], silo: [1.6, 1.6], coop: [1.6, 1.4], barn: [3.4, 2.6], market: [1, 1], market_stalls: [3.8, 2.6], market_pavilion: [3.8, 2.6], market_wagons: [3.8, 2.6], field: [0.5, 0.5],
    woodcutter: [2.6, 2.2], quarry: [2.6, 2.2], mine: [2.6, 2.4], great_hall: [5.2, 3.2], chapel: [2.2, 2.6], storehouse: [4.8, 2.6],
    smithy: [3.2, 2.6], ember_forge: [1.8, 1.6], barracks: [4.2, 2.2],
  };

  class CastleArt {
    /* mats: K.BuildingMaterials (the renderer's bmats) */
    constructor(mats) { this.mats = mats; this.cache = new Map(); this.iceMat = null; }
    static size(type) { return SIZE[type] || [2, 2]; }
    /* a THREE.Group for a piece; opts: { ruin, level, built } */
    piece(type, opts = {}) {
      const kit = new K.VoxKit(), k = this.draw(kit, type, opts);
      const g = new THREE.Group(); g.name = 'castle:' + type;
      for (const m of kit.meshes(this.mats)) g.add(m);
      if (kit.roof) g.userData.roof = this.part(g, 'roof', kit.roof);   // a roof you can stand under: it lifts away when you do
      if (kit.spin) { g.userData.spin = this.part(g, 'spin', kit.spin.kit); g.userData.spin.position.set(...kit.spin.at); }   // turns while someone works it
      if (k && k.flames) for (const f of k.flames) g.add(this.flame(f));
      if (opts.level >= 2 && !opts.ruin) this.levelFlag(g, type);
      return g;
    }
    /** a separately movable part of a piece (its roof, its millstone) drawn from its own kit */
    part(g, name, kit) { const grp = new THREE.Group(); grp.name = name; for (const m of kit.meshes(this.mats)) grp.add(m); g.add(grp); return grp; }
    flame([x, y, z, s]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.16 * s, 0.5 * s, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.5) }));
      m.position.set(x, y + 0.25 * s, z); m.userData.flame = true; return m;
    }
    levelFlag(g, type) {
      const [w, d] = CastleArt.size(type), kit = new K.VoxKit();
      kit.geo('wood', CYL8, w / 2 - 0.2, 1.7, -d / 2 + 0.2, 0, 0, 0, 0.04, 3.4, 0.04);
      kit.box('glowbar', w / 2 - 0.2 + 0.3, 2.8, -d / 2 + 0.2, 0.55, 0.36, 0.03);
      for (const m of kit.meshes(this.mats)) g.add(m);
    }
    /* frosted overlay (raiders touched it): a shell of rime */
    frostShell(type) {
      const [w, d] = CastleArt.size(type);
      if (!this.iceMat) this.iceMat = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, emissive: new THREE.Color(0.12, 0.2, 0.3), transparent: true, opacity: 0.55, depthWrite: false });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 2.2, d + 0.2), this.iceMat); m.position.y = 1.1; m.renderOrder = 4; return m;
    }
    /* ---------- the models ---------- */
    draw(k, type, o) {
      const ruin = !!o.ruin, R = new K.RNG(type.length * 97 + (ruin ? 7 : 1)), flames = [];
      const snowCap = (x, y, z, w, d) => k.box('snow', x, y, z, w + 0.04, 0.06, d + 0.04);
      switch (type) {
        case 'keep': {
          const W = 4, H = ruin ? 2.6 : 4.6;
          k.box('ashlar', 0, 0, 0, W + 0.4, 0.35, W + 0.4);
          // four walls, leaving the hearth door on the south face
          for (const [x, z, w, d] of [[0, -W / 2 + 0.2, W, 0.4], [-W / 2 + 0.2, 0, 0.4, W], [W / 2 - 0.2, 0, 0.4, W]]) {
            if (ruin) { for (let s = 0; s < 5; s++) { const t = (s + 0.5) / 5, hh = H * (0.55 + R.next() * 0.45); k.box('ashlar', x + (w > d ? (t - 0.5) * w : 0), 0.35, z + (d > w ? (t - 0.5) * d : 0), w > d ? w / 5 + 0.01 : w, hh, d > w ? d / 5 + 0.01 : d); } }
            else k.box('ashlar', x, 0.35, z, w, H, d);
          }
          k.box('ashlar', -1.25, 0.35, W / 2 - 0.2, 1.5, ruin ? 1.6 : H, 0.4); k.box('ashlar', 1.25, 0.35, W / 2 - 0.2, 1.5, ruin ? 2.1 : H, 0.4);
          if (!ruin) {
            k.box('ashlar', 0, 2.1, W / 2 - 0.2, 1, H - 1.75, 0.4);
            for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { k.box('ashlar', -1.6 + i * 1.07, H + 0.35, s * (W / 2 - 0.2), 0.5, 0.45, 0.42); k.box('ashlar', s * (W / 2 - 0.2), H + 0.35, -1.6 + i * 1.07, 0.42, 0.45, 0.5); }
            k.box('timber', 0, H + 0.2, 0, W - 0.6, 0.18, W - 0.6);
            k.box('slate', 0, H + 0.38, 0, 1.6, 1.2, 1.6, Math.PI / 4); snowCap(0, H + 1.58, 0, 1.1, 1.1);
            k.box('window', -1.25, 2.6, W / 2 + 0.01, 0.3, 0.55, 0.02); k.box('window', 1.25, 2.6, W / 2 + 0.01, 0.3, 0.55, 0.02);
          } else { for (let i = 0; i < 7; i++) k.box('ashlar', R.range(-2.6, 2.6), 0, R.range(-2.6, 2.6), R.range(0.2, 0.45), R.range(0.15, 0.3), R.range(0.2, 0.4), R.range(0, 3)); }
          // the hearth inside the door
          k.box('ashlar', 0, 0.35, W / 2 - 0.55, 1.1, 0.25, 0.7); k.box('soot', 0, 0.6, W / 2 - 0.75, 0.8, 0.9, 0.2);
          if (!ruin) { k.box('coals', 0, 0.6, W / 2 - 0.5, 0.6, 0.12, 0.4); flames.push([0, 0.65, W / 2 - 0.5, 1.3]); }
          else k.box('soot', 0, 0.6, W / 2 - 0.5, 0.6, 0.06, 0.4);
          snowCap(0, 0.35 + (ruin ? 1.6 : H), W / 2 - 0.2, 0.9, 0.4);
          break;
        }
        case 'palisade': {   // a stockade section: sharpened logs, no snow on top
          const tops = [[-0.17, -0.1, 1.08], [-0.03, 0.12, 0.96], [0.12, -0.12, 1.12], [0.17, 0.1, 1.0], [-0.14, 0.13, 1.04], [0.02, -0.02, 1.16]];
          for (const [x, z, h] of tops) { k.geo('bark', CYL8, x, h / 2, z, 0, R.range(0, 3), 0, 0.17, h, 0.17, 0.5, 1); k.geo('wood', CONE6, x, h + 0.1, z, 0, 0, 0, 0.17, 0.3, 0.17, 0.5, 1); }
          k.box('timber', 0, 0.28, -0.2, 0.5, 0.07, 0.05); k.box('timber', 0, 0.7, -0.2, 0.5, 0.07, 0.05);
          break;
        }
        case 'gate': {       // 4 squares wide, solid planked leaves two cubes high, spiked end posts, an arch over the top
          for (const x of [-0.9, 0.9]) { k.geo('bark', CYL8, x, 0.78, 0, 0, 0, 0, 0.2, 1.56, 0.2, 0.5, 1); k.geo('wood', CONE6, x, 1.66, 0, 0, 0, 0, 0.2, 0.32, 0.2, 0.5, 1); }
          // the two leaves are separate, swinging parts (113-castle-drawbridge.js: WoodGate)
          for (let i = -4; i <= 4; i++) { const x = i * 0.215, y = 1.22 + 0.34 * (1 - (x / 0.95) * (x / 0.95)), slope = Math.atan(-0.34 * 2 * x / (0.95 * 0.95)); k.box('timber', x, y - 0.05, 0, 0.26, 0.11, 0.16, 0, 0, slope); }   // the arch
          k.box('wood', 0, 1.46, 0, 0.1, 0.16, 0.2);
          break;
        }
        case 'stone_gate': {   // a stone archway 4 m wide and 1.5 m deep; the drawbridge is its own moving part (113-castle-drawbridge.js)
          for (const sx of [-1, 1]) { k.box('ashlar', sx * 1.75, 0, 0, 0.5, 2.9, 1.5); k.box('ashlar', sx * 1.75, 2.9, 0, 0.62, 0.16, 1.62); snowCap(sx * 1.75, 3.06, 0, 0.62, 1.62); }
          for (let i = -6; i <= 6; i++) { const x = i * 0.25, u = x / 1.5, y = 2.0 + 0.62 * (1 - u * u), slope = Math.atan(-0.62 * 2 * u / 1.5); k.box('ashlar', x, y, 0, 0.27, 0.52, 1.5, 0, 0, slope); }
          k.box('ashlar', 0, 2.78, 0, 4, 0.3, 1.5); for (const mx of [-1.8, -0.9, 0, 0.9, 1.8]) k.box('ashlar', mx, 3.08, 0.55, 0.36, 0.34, 0.32); snowCap(0, 3.08, 0, 4, 1.5);
          k.box('iron', 0, 2.45, 0.76, 0.14, 0.14, 0.06);
          break;
        }
        case 'stone_wall': {   // one tile, one cube high
          k.box('ashlar', 0, 0, 0, 0.5, 0.5, 0.5); k.box('ashlar', -0.12, 0.5, 0.05, 0.2, 0.08, 0.2); snowCap(0, 0.5, 0, 0.5, 0.5);
          break;
        }
        case 'dirt': { k.box('bark', 0, 0, 0, 0.5, 0.5, 0.5); break; }
        case 'cottage':
        case 'blacksmith': {   // only the placement ghost: the footprint of the workshop with a low wall and a chimney
          k.box('ashlar', 0, 0, 0, 6, 0.3, 0.3, 0, 0, 0); k.box('ashlar', 0, 0, 4.2, 6, 0.3, 0.3); k.box('ashlar', -2.85, 0, 2.1, 0.3, 0.3, 4.5); k.box('ashlar', 2.85, 0, 2.1, 0.3, 0.3, 4.5); k.box('timber', 0, 0, 2.1, 5.4, 0.08, 3.9); k.box('ashlar', -2, 0.3, 0.3, 0.6, 1.4, 0.6);
          break;
        }
        case 'gatehouse': {
          const th = ruin ? 1.3 : 3;
          for (const s of [-1, 1]) { k.box('ashlar', s * 1.3, 0, 0, 1.1, th, 1.4); if (!ruin) { for (const dx of [-0.35, 0.35]) k.box('ashlar', s * 1.3 + dx, th, 0.5, 0.3, 0.3, 0.3); k.box('slate', s * 1.3, th, 0, 0.9, 0.7, 0.9, Math.PI / 4); snowCap(s * 1.3, th + 0.7, 0, 0.5, 0.5); } else snowCap(s * 1.3, th, 0, 1.1, 1.4); }
          if (!ruin) {
            k.box('ashlar', 0, 2.1, 0, 1.6, 0.8, 1.2); snowCap(0, 2.9, 0, 1.6, 1.2);
            for (let i = 0; i < 5; i++) k.box('iron', -0.6 + i * 0.3, 0.6, 0.45, 0.06, 1.5, 0.06);
            k.box('iron', 0, 1.6, 0.45, 1.5, 0.08, 0.08); k.box('iron', 0, 1.0, 0.45, 1.5, 0.06, 0.06);
          } else { for (let i = 0; i < 6; i++) k.box('ashlar', R.range(-1, 1), 0, R.range(-0.8, 0.8), R.range(0.25, 0.5), 0.22, R.range(0.2, 0.4), R.range(0, 3)); k.box('timber', 0.2, 0, 0.5, 1.6, 0.12, 0.3, 0.3); }
          break;
        }
        case 'watchtower': {
          k.box('ashlar', 0, 0, 0, 1.4, 0.8, 1.4);
          for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) k.box('timber', x, 0.8, z, 0.16, 2.3, 0.16);
          k.box('planks', 0, 3.1, 0, 1.6, 0.12, 1.6);
          for (const s of [-1, 1]) { k.box('timber', 0, 3.22, s * 0.74, 1.6, 0.4, 0.08); k.box('timber', s * 0.74, 3.22, 0, 0.08, 0.4, 1.6); }
          for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) k.box('timber', x, 3.22, z, 0.1, 0.9, 0.1);
          k.box('slate', 0, 4.1, 0, 1.4, 0.7, 1.4, Math.PI / 4); snowCap(0, 4.8, 0, 0.8, 0.8);
          for (let i = 0; i < 6; i++) k.box('wood', 0.78, 0.9 + i * 0.38, 0.1, 0.05, 0.05, 0.4);
          break;
        }
        case 'fire_pot':
        case 'ember_brazier': {
          k.box('ashlar', 0, 0, 0, 0.7, 0.3, 0.7);
          for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.box('iron', Math.cos(a) * 0.18, 0.3, Math.sin(a) * 0.18, 0.06, 0.55, 0.06); }
          k.geo('iron', CYL, 0, 0.9, 0, 0, 0, 0, 0.32, 0.16, 0.32); k.box('coals', 0, 0.95, 0, 0.42, 0.06, 0.42); flames.push([0, 1.0, 0, 1.1]);
          break;
        }
        case 'field': { k.box('bark', 0, 0, 0, 0.5, 0.05, 0.5); for (const [x, z] of [[-0.12, -0.12], [0.12, 0.1], [-0.1, 0.13], [0.13, -0.11]]) k.box('hay', x, 0.05, z, 0.06, 0.25, 0.06); break; }
        case 'farm': {   // a small barn with a thatched roof, a big door and hay bales
          k.box('timber', 0, 0, 0, 2.8, 1.7, 2.2);
          k.box('slate', 0, 1.7, -0.62, 3.1, 0.14, 1.5, 0, -0.6); k.box('slate', 0, 1.7, 0.62, 3.1, 0.14, 1.5, 0, 0.6);
          k.box('roofSnow', 0, 2.0, -0.58, 3.0, 0.04, 1.38, 0, -0.6); k.box('roofSnow', 0, 2.0, 0.58, 3.0, 0.04, 1.38, 0, 0.6);
          k.box('wood', 0, 0, 1.11, 1.1, 1.3, 0.05); k.box('timber', 0, 0.62, 1.15, 1.1, 0.08, 0.04, 0, 0, 0.85); k.box('timber', 0, 0.62, 1.15, 1.1, 0.08, 0.04, 0, 0, -0.85);
          for (const [x, z] of [[1.7, 0.6], [1.7, 1.15], [1.95, 0.85]]) k.box('hay', x, 0, z, 0.5, 0.42, 0.42); k.box('hay', 1.8, 0.42, 0.88, 0.5, 0.4, 0.42);
          break;
        }
        case 'coop': {   // a little raised hen house with a ramp and straw
          for (const [x, z] of [[-0.6, -0.5], [0.6, -0.5], [-0.6, 0.5], [0.6, 0.5]]) k.box('timber', x, 0, z, 0.1, 0.4, 0.1);
          k.box('planks', 0, 0.4, 0, 1.4, 0.75, 1.2); k.box('slate', 0, 1.15, -0.32, 1.6, 0.1, 0.75, 0, -0.5); k.box('slate', 0, 1.15, 0.32, 1.6, 0.1, 0.75, 0, 0.5);
          k.box('soot', 0, 0.5, 0.61, 0.3, 0.32, 0.02); k.box('wood', 0, 0.02, 0.85, 0.28, 0.06, 0.6, 0, 0.6); k.box('straw', 0.45, 0, 0.75, 0.4, 0.15, 0.3);
          break;
        }
        case 'barn': {   // a long cattle barn with a hayloft door and a trough
          k.box('timber', 0, 0, 0, 3.2, 1.9, 2.4); k.box('slate', 0, 1.9, -0.68, 3.5, 0.14, 1.6, 0, -0.62); k.box('slate', 0, 1.9, 0.68, 3.5, 0.14, 1.6, 0, 0.62);
          k.box('roofSnow', 0, 2.24, -0.62, 3.4, 0.04, 1.4, 0, -0.62); k.box('roofSnow', 0, 2.24, 0.62, 3.4, 0.04, 1.4, 0, 0.62);
          k.box('wood', 0, 0, 1.21, 1.3, 1.45, 0.05); k.box('timber', 0, 0.7, 1.25, 1.3, 0.08, 0.04, 0, 0, 0.8); k.box('timber', 0, 0.7, 1.25, 1.3, 0.08, 0.04, 0, 0, -0.8);
          k.box('wood', 1.61, 1.95, 0, 0.05, 0.45, 0.5); k.box('planks', -1.0, 0, 1.6, 1.0, 0.3, 0.35); k.box('hay', -1.0, 0.3, 1.6, 0.9, 0.06, 0.3);
          break;
        }
        case 'silo': {   // a tall round grain store with an iron-banded wall and a cone roof
          k.geo('planks', CYL, 0, 1.7, 0, 0, 0, 0, 1.45, 3.4, 1.45); for (const y of [0.6, 1.7, 2.8]) k.geo('iron', CYL, 0, y, 0, 0, 0, 0, 1.5, 0.08, 1.5);
          k.geo('slate', CONE6, 0, 3.85, 0, 0, 0, 0, 1.0, 0.9, 1.0); k.box('wood', 0, 0, 0.72, 0.5, 0.9, 0.06);
          break;
        }
        case 'market_stalls': {   // a row of three open stalls under striped awnings, goods heaped on trestles, barrels and sacks about
          for (const [sx, stripe] of [[-1.25, 'cloth'], [0, 'clothBlue'], [1.25, 'cloth']]) {
            k.box('planks', sx, 0.7, 0.35, 1.1, 0.08, 0.6); for (const lx of [-0.48, 0.48]) for (const lz of [0.1, 0.6]) k.box('timber', sx + lx, 0, lz, 0.07, 0.7, 0.07);
            for (const lx of [-0.52, 0.52]) { k.box('timber', sx + lx, 0, 0.72, 0.08, 1.9, 0.08); k.box('timber', sx + lx, 0, -0.35, 0.08, 2.2, 0.08); }
            for (let q = 0; q < 6; q++) k.box(q % 2 ? 'linen' : stripe, sx - 0.55 + 0.1 + q * 0.183, 1.92, 0.2, 0.183, 0.04, 1.35, 0, -0.32);   // striped awning
            for (let q = 0; q < 6; q++) k.box(q % 2 ? 'linen' : stripe, sx - 0.55 + 0.1 + q * 0.183, 1.72, 0.86, 0.183, 0.2, 0.03);       // its scalloped front edge
          }
          k.box('bread', -1.45, 0.78, 0.3, 0.2, 0.1, 0.12, 0.3); k.box('bread', -1.2, 0.78, 0.42, 0.2, 0.1, 0.12, -0.2); k.box('bread', -1.0, 0.78, 0.25, 0.2, 0.1, 0.12, 0.5);
          for (const [x, z] of [[-0.25, 0.3], [0.05, 0.42], [0.3, 0.28]]) k.geo('cheese', CYL, x, 0.83, z, 0, 0, 0, 0.13, 0.1, 0.13);
          for (const [x, z] of [[1.0, 0.3], [1.25, 0.45], [1.5, 0.3]]) k.box('food', x, 0.78, z, 0.2, 0.16, 0.2, 0.4);
          k.box('green', 1.25, 0.78, 0.22, 0.18, 0.12, 0.14);
          for (const [x, z] of [[-1.9, 1.05], [1.95, 1.0]]) k.geo('wood', CYL8, x, 0.32, z, 0, 0, 0, 0.24, 0.64, 0.24);
          for (const [x, z] of [[-0.7, 1.1], [0.65, 1.15]]) { k.box('linen', x, 0, z, 0.32, 0.4, 0.26, 0.3); k.box('hay', x, 0.4, z, 0.2, 0.05, 0.16, 0.3); }
          k.box('crate', 1.6, 0, -0.85, 0.5, 0.45, 0.5); k.box('crate', 1.6, 0.45, -0.85, 0.4, 0.38, 0.4, 0.3); k.box('crate', -1.6, 0, -0.9, 0.5, 0.45, 0.5, 0.2);
          break;
        }
        case 'market_pavilion': {   // an open timber market hall: a steep roof on posts, counters inside, a stone market cross out front
          for (const x of [-1.6, 0, 1.6]) for (const z of [-0.95, 0.95]) { k.box('ashlar', x, 0, z, 0.3, 0.2, 0.3); k.box('timber', x, 0.2, z, 0.16, 1.9, 0.16); }
          k.box('timber', 0, 2.1, -0.95, 3.5, 0.14, 0.16); k.box('timber', 0, 2.1, 0.95, 3.5, 0.14, 0.16);
          k.box('slate', 0, 2.35, -0.6, 3.9, 0.12, 1.45, 0, -0.75); k.box('slate', 0, 2.35, 0.6, 3.9, 0.12, 1.45, 0, 0.75);
          k.box('roofSnow', 0, 2.48, -0.58, 3.8, 0.03, 1.35, 0, -0.75); k.box('roofSnow', 0, 2.48, 0.58, 3.8, 0.03, 1.35, 0, 0.75);
          k.box('planks', 0, 0, -0.45, 2.9, 0.75, 0.45); k.box('planks', -0.9, 0, 0.45, 1.1, 0.75, 0.45); k.box('planks', 0.9, 0, 0.45, 1.1, 0.75, 0.45);
          for (const [x, z, m] of [[-1.0, -0.45, 'food'], [-0.4, -0.45, 'cheese'], [0.3, -0.45, 'bread'], [0.95, -0.45, 'green'], [-0.95, 0.45, 'linen'], [0.95, 0.45, 'hay']]) k.box(m, x, 0.75, z, 0.4, 0.14, 0.3, 0.2);
          for (let q = 0; q < 7; q++) k.box(q % 2 ? 'cloth' : 'clothBlue', -1.5 + q * 0.5, 1.85, 1.0, 0.22, 0.24, 0.02, 0, 0, 0.785);   // bunting under the eaves
          k.box('ashlar', 0, 0, 1.75, 0.6, 0.25, 0.6); k.box('ashlar', 0, 0.25, 1.75, 0.2, 1.3, 0.2); k.box('ashlar', 0, 1.25, 1.75, 0.55, 0.14, 0.14);   // the market cross
          k.geo('wood', CYL8, -1.85, 0.3, 1.45, 0, 0, 0, 0.22, 0.6, 0.22); k.box('crate', 1.85, 0, 1.4, 0.45, 0.42, 0.45, 0.3);
          break;
        }
        case 'market_wagons': {   // a travelling fair: a covered wagon selling from its tailboard, a striped tent, a scale and crates
          k.box('planks', -0.9, 0.45, 0, 1.9, 0.5, 1.1); for (const [x, z] of [[-1.55, -0.6], [-0.25, -0.6], [-1.55, 0.6], [-0.25, 0.6]]) k.geo('wood', CYL, x, 0.34, z, Math.PI / 2, 0, 0, 0.34, 0.08, 0.34);
          for (let q = 0; q < 5; q++) { const a = -1.1 + q * 0.55; k.box('linen', -0.9, 0.95 + Math.cos(a) * 0.55, Math.sin(a) * 0.55, 1.85, 0.05, 0.36, 0, a); }   // the canvas hoops
          k.box('wood', 0.15, 0.45, 0, 0.3, 0.06, 1.0); k.box('food', 0.15, 0.51, -0.25, 0.22, 0.14, 0.22); k.box('cheese', 0.15, 0.51, 0.2, 0.22, 0.12, 0.22); k.box('timber', -2.0, 0.55, 0, 0.9, 0.06, 0.08);
          k.geo('cloth', CONE6, 1.35, 1.05, -0.25, 0, 0.26, 0, 1.0, 1.6, 1.0); k.geo('linen', CONE6, 1.35, 1.07, -0.25, 0, 0.78, 0, 0.98, 1.56, 0.98); k.box('timber', 1.35, 0, -0.25, 0.06, 2.1, 0.06);
          k.box('cloth', 1.35, 2.05, -0.25, 0.03, 0.2, 0.28);   // the tent's pennant
          k.box('soot', 1.35, 0, 0.7, 0.45, 0.6, 0.02);
          k.box('planks', 0.9, 0, 0.95, 0.9, 0.7, 0.4); k.box('brass', 0.75, 0.7, 0.95, 0.04, 0.4, 0.04); k.box('brass', 0.75, 1.08, 0.95, 0.5, 0.03, 0.03); k.geo('brass', CYL8, 0.53, 0.92, 0.95, 0, 0, 0, 0.12, 0.03, 0.12); k.geo('brass', CYL8, 0.97, 0.92, 0.95, 0, 0, 0, 0.12, 0.03, 0.12);
          for (const [x, z] of [[1.75, 1.0], [1.75, 0.55]]) k.geo('wood', CYL8, x, 0.3, z, 0, 0, 0, 0.22, 0.6, 0.22);
          k.box('crate', -1.7, 0, 1.05, 0.45, 0.42, 0.45, 0.4); k.box('crate', -1.2, 0, 1.1, 0.4, 0.36, 0.4); k.box('linen', -0.6, 0, 1.15, 0.3, 0.38, 0.26);
          break;
        }
        case 'market': {   // the marketplace's street front: four stalls along the hall, one per section (the hall stands behind them)
          const stall = (cx, cloth, w = 1.5) => {
            k.box('planks', cx, 0.7, 0.05, w, 0.08, 0.7); for (const lx of [-w / 2 + 0.05, w / 2 - 0.05]) { k.box('timber', cx + lx, 0, 0.35, 0.08, 1.85, 0.08); k.box('timber', cx + lx, 0, -0.55, 0.08, 2.15, 0.08); for (const lz of [-0.2, 0.3]) k.box('timber', cx + lx * 0.95, 0, lz, 0.06, 0.7, 0.06); }
            const n = Math.round(w / 0.25); for (let q = 0; q < n; q++) { const x = cx - w / 2 + (q + 0.5) * (w / n); k.box(q % 2 ? 'linen' : cloth, x, 1.88, -0.12, w / n, 0.04, 1.15, 0, 0.3); k.box(q % 2 ? 'linen' : cloth, x, 1.72, 0.45, w / n, 0.18, 0.03); }
          };
          stall(-4.0, 'hay', 1.6); stall(-1.0, 'cloth'); stall(1.0, 'clothBlue'); stall(4.0, 'bark', 1.6);
          k.box('linen', -4.6, 0, 0.6, 0.3, 0.38, 0.26); k.box('hay', -3.4, 0, 0.62, 0.4, 0.3, 0.3);            // wheat and bread
          k.geo('wood', CYL8, -1.6, 0.3, 0.6, 0, 0, 0, 0.22, 0.6, 0.22); k.box('crate', -0.45, 0, 0.62, 0.36, 0.34, 0.34);   // meat and eggs
          k.box('timber', 1.0, 0.78, -0.4, 1.3, 0.06, 0.06); for (let q = 0; q < 4; q++) k.box('iron', 0.55 + q * 0.3, 0.84, -0.4, 0.04, 0.6, 0.02);   // a rack of blades
          for (let q = 0; q < 3; q++) k.geo('bark', CYL8, 4.0 - 0.5 + q * 0.5, 0.12, 0.75, 0, 0, Math.PI / 2, 0.12, 0.7, 0.12);   // the raw-materials yard: a log pile
          break;
        }
        case 'woodcutter': {
          k.box('timber', 0, 0, 0, 2.2, 1.3, 1.6);
          k.box('slate', 0, 1.3, -0.45, 2.5, 0.12, 1.15, 0, -0.55); k.box('slate', 0, 1.3, 0.45, 2.5, 0.12, 1.15, 0, 0.55);
          k.box('roofSnow', 0, 1.56, -0.42, 2.4, 0.04, 1.05, 0, -0.55); k.box('roofSnow', 0, 1.56, 0.42, 2.4, 0.04, 1.05, 0, 0.55);
          k.box('wood', 0.3, 0, 0.81, 0.5, 0.9, 0.04); k.box('window', -0.6, 0.6, 0.81, 0.35, 0.3, 0.02);
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) k.geo('bark', CYL8, -0.9 + j * 0.26 + i * 0.13, 0.12 + i * 0.22, 1.05, Math.PI / 2, 0, 0, 0.11, 0.7, 0.11);
          k.geo('bark', CYL8, 1.15, 0.2, 1.05, 0, 0, 0, 0.22, 0.4, 0.22); k.box('wood', 1.15, 0.4, 1.05, 0.04, 0.5, 0.04, 0, 0, 0.4); k.box('iron', 1.24, 0.82, 1.05, 0.2, 0.12, 0.04);
          break;
        }
        case 'quarry': {
          k.box('ashlar', -0.2, 0, -0.5, 2.2, 1.4, 1, 0); k.box('ashlar', -0.6, 1.4, -0.6, 1.2, 0.6, 0.8); snowCap(-0.6, 2, -0.6, 1.2, 0.8);
          k.box('timber', 0.9, 0, 0.5, 0.12, 2.2, 0.12); k.box('timber', 0.5, 2.1, 0.5, 1, 0.1, 0.1); k.box('steel', 0.1, 1.4, 0.5, 0.02, 0.7, 0.02);
          for (let i = 0; i < 4; i++) k.box('ashlar', -0.6 + (i % 2) * 0.5, (i >> 1) * 0.36, 0.6, 0.45, 0.34, 0.4);
          break;
        }
        case 'mine': {
          k.box('ashlar', 0, 0, -0.3, 2.6, 1.5, 1.8); k.box('ashlar', 0, 1.5, -0.5, 1.8, 0.6, 1.2); snowCap(0, 2.1, -0.5, 1.8, 1.2);
          k.box('soot', 0, 0, 0.6, 0.9, 1.1, 0.04);
          for (const s of [-1, 1]) k.box('timber', s * 0.55, 0, 0.62, 0.14, 1.3, 0.14); k.box('timber', 0, 1.25, 0.62, 1.3, 0.14, 0.16);
          k.box('iron', -0.15, 0, 1.2, 0.08, 0.04, 1.2, 0); k.box('iron', 0.15, 0, 1.2, 0.08, 0.04, 1.2);
          k.box('wood', 0, 0.12, 1.3, 0.55, 0.32, 0.42); k.box('soot', 0, 0.42, 1.3, 0.45, 0.06, 0.34); k.box('glowbar', 0.6, 1.0, 0.7, 0.1, 0.16, 0.1);
          break;
        }
        case 'great_hall': {
          const W = 5, D = 3, H = ruin ? 1.1 : 2.1;
          k.box('ashlar', 0, 0, 0, W + 0.2, 0.25, D + 0.2);
          if (ruin) {
            for (let s = 0; s < 10; s++) { const t = (s + 0.5) / 10; k.box('ashlar', (t - 0.5) * W, 0.25, -D / 2 + 0.15, W / 10 + 0.01, H * (0.3 + R.next() * 0.9), 0.3); k.box('ashlar', (t - 0.5) * W, 0.25, D / 2 - 0.15, W / 10 + 0.01, H * (0.2 + R.next() * 0.8), 0.3); }
            for (const s of [-1, 1]) k.box('ashlar', s * (W / 2 - 0.15), 0.25, 0, 0.3, H * 1.4, D);
            for (let i = 0; i < 4; i++) k.box('timber', R.range(-2, 2), 0.25, R.range(-1, 1), 1.8, 0.14, 0.16, R.range(0, 3), 0, 0.15);
          } else {
            k.box('ashlar', 0, 0.25, 0, W, H, D);
            for (let i = 0; i < 4; i++) for (const s of [-1, 1]) k.box('window', -1.8 + i * 1.2, 1.0, s * (D / 2 + 0.01), 0.36, 0.7, 0.02);
            k.box('wood', 0, 0.25, D / 2 + 0.01, 0.8, 1.3, 0.04);
            k.box('slate', 0, 2.35, -0.8, W + 0.4, 0.14, 1.95, 0, 0.75); k.box('slate', 0, 2.35, 0.8, W + 0.4, 0.14, 1.95, 0, -0.75);
            k.box('roofSnow', 0, 2.62, -0.74, W + 0.3, 0.04, 1.7, 0, 0.75); k.box('roofSnow', 0, 2.62, 0.74, W + 0.3, 0.04, 1.7, 0, -0.75);
            for (const s of [-1, 1]) k.box('ashlar', s * (W / 2 - 0.1), 2.35, 0, 0.2, 1.2, D * 0.6);
            k.geo('wood', CYL8, W / 2 + 0.3, 1.5, D / 2 + 0.3, 0, 0, 0, 0.05, 3, 0.05); k.box('hangingRed', W / 2 + 0.55, 2.1, D / 2 + 0.3, 0.5, 0.8, 0.02);
          }
          break;
        }
        case 'chapel': {
          k.box('ashlar', 0, 0, 0, 1.8, 1.6, 2.2); k.geo('glowbar', CYL, 0, 1.15, 1.11, Math.PI / 2, 0, 0, 0.28, 0.04, 0.28);
          k.box('slate', 0, 1.6, -0.5, 2.1, 0.12, 1.3, 0, 0.6); k.box('slate', 0, 1.6, 0.5, 2.1, 0.12, 1.3, 0, -0.6); k.box('roofSnow', 0, 1.9, 0, 2, 0.05, 0.5);
          k.box('timber', 0, 2.1, 0.8, 0.5, 0.7, 0.5); k.box('brass', 0, 2.25, 0.8, 0.22, 0.26, 0.22); k.box('slate', 0, 2.8, 0.8, 0.5, 0.35, 0.5, Math.PI / 4);
          break;
        }
        case 'storehouse': {
          k.box('ashlar', 0, 0, 0, 2.6, 1.2, 2); k.box('timber', 0, 1.2, 0, 2.6, 0.7, 2);
          k.box('slate', 0, 1.9, -0.55, 2.9, 0.12, 1.25, 0, -0.5); k.box('slate', 0, 1.9, 0.55, 2.9, 0.12, 1.25, 0, 0.5); k.box('roofSnow', 0, 2.2, 0, 2.8, 0.04, 0.6);
          k.box('wood', 0, 0, 1.01, 0.7, 1, 0.04); k.box('iron', 0, 0.4, 1.04, 0.72, 0.06, 0.02); k.box('iron', 0, 0.75, 1.04, 0.72, 0.06, 0.02);
          for (let i = 0; i < 3; i++) k.geo('wood', CYL8, -1.1 + i * 0.32, 0.25, 1.3, 0, 0, 0, 0.15, 0.5, 0.15); k.box('crate', 1, 0, 1.3, 0.4, 0.4, 0.4, 0.3); k.box('hay', 0.95, 0.4, 1.3, 0.3, 0.25, 0.3);
          break;
        }
        case 'smithy': {
          const W = 3, D = 2.4, H = ruin ? 0.9 : 1.6;
          k.box('flagstone', 0, 0, 0, W, 0.12, D);
          if (ruin) {
            for (let s = 0; s < 6; s++) { const t = (s + 0.5) / 6; k.box('ashlar', (t - 0.5) * W, 0.12, -D / 2 + 0.15, W / 6 + 0.01, H * (0.3 + R.next() * 0.9), 0.3); }
            for (const s of [-1, 1]) k.box('ashlar', s * (W / 2 - 0.15), 0.12, -0.2, 0.3, H * (0.6 + R.next() * 0.5), D * 0.7);
            k.box('soot', 0.6, 0.12, -0.6, 0.8, 0.5, 0.6); k.box('iron', -0.5, 0.12, 0.4, 0.5, 0.3, 0.3, 0.6, 0, 0.5);
          } else {
            k.box('ashlar', 0, 0.12, -D / 2 + 0.15, W, H, 0.3); for (const s of [-1, 1]) k.box('ashlar', s * (W / 2 - 0.15), 0.12, 0, 0.3, H, D);
            k.box('slate', 0, 1.72, -0.2, W + 0.3, 0.12, D + 0.2, 0, 0.18); k.box('roofSnow', 0, 1.9, -0.2, W + 0.2, 0.04, D, 0, 0.18);
            k.box('ashlar', 0.7, 0.12, -0.6, 0.9, 0.7, 0.7); k.box('coals', 0.7, 0.82, -0.6, 0.6, 0.06, 0.45); flames.push([0.7, 0.85, -0.6, 0.8]);
            k.box('ashlar', 0.7, 1.72, -0.75, 0.45, 1.1, 0.45);
            k.geo('bark', CYL8, -0.6, 0.12, 0.4, 0, 0, 0, 0.2, 0.5, 0.2); k.box('steel', -0.6, 0.62, 0.4, 0.55, 0.2, 0.22); k.box('steel', -0.33, 0.68, 0.4, 0.2, 0.1, 0.12);
          }
          break;
        }
        case 'ember_forge': {
          k.box('soot', 0, 0, 0, 1.6, 0.9, 1.3); k.box('iron', 0, 0.9, 0, 1.4, 0.2, 1.1);
          for (const x of [-0.5, 0, 0.5]) k.box('glowbar', x, 0.3, 0.66, 0.12, 0.4, 0.02);
          k.box('coals', 0, 1.1, 0, 0.9, 0.06, 0.6); flames.push([0, 1.15, 0, 1.4]); flames.push([0.3, 1.15, 0.15, 0.9]);
          k.box('soot', -0.55, 1.1, -0.4, 0.4, 1.3, 0.4);
          break;
        }
        case 'barracks': {
          k.box('timber', 0, 0, 0, 4, 1.2, 1.8);
          k.box('slate', 0, 1.2, -0.5, 4.3, 0.12, 1.2, 0, -0.45); k.box('slate', 0, 1.2, 0.5, 4.3, 0.12, 1.2, 0, 0.45); k.box('roofSnow', 0, 1.45, 0, 4.2, 0.04, 0.6);
          for (let i = 0; i < 3; i++) k.box('wood', -1.2 + i * 1.2, 0, 0.91, 0.5, 0.95, 0.04);
          k.box('timber', 2.2, 0, 0.3, 0.1, 1, 0.1); for (let i = 0; i < 3; i++) k.box('steel', 2.25, 0.3 + i * 0.05, 0.1 + i * 0.2, 0.03, 1.2, 0.03);
          k.geo('clothBlue', CYL8, -2.15, 0.65, 0.3, 0, 0, Math.PI / 2, 0.3, 0.05, 0.3);
          break;
        }
        default: k.box('ashlar', 0, 0, 0, 1, 1, 1);
      }
      return { flames };
    }

    /* ---------- effects ---------- */
    /* the warm ground glow of the hearth: a soft disc and a bright rim at the glow radius */
    glow() {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,190,110,0.55)'); g.addColorStop(0.75, 'rgba(255,150,70,0.22)'); g.addColorStop(0.95, 'rgba(255,200,120,0.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 2; return m;
    }
    /* a bobbing golden arrow above the current objective */
    arrow() {
      const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 0.6) });
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 8), mat); head.rotation.x = Math.PI; head.position.y = 0.28;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), mat); shaft.position.y = 0.85;
      g.add(head, shaft); g.renderOrder = 9; return g;
    }
    /* ice: a crystal cluster (frozen kin, frost barriers) */
    ice(w, h, d, seed = 3) {
      const kit = new K.VoxKit(), R = new K.RNG(seed);
      const n = Math.max(3, Math.round(w * d * 3));
      for (let i = 0; i < n; i++) kit.box('ice', R.range(-w / 2, w / 2), 0, R.range(-d / 2, d / 2), R.range(0.25, 0.5), h * R.range(0.5, 1), R.range(0.25, 0.5), R.range(0, 3), R.range(-0.2, 0.2), R.range(-0.2, 0.2));
      const g = new THREE.Group(); for (const m of kit.meshes(this.mats, { clone: true })) { m.material.transparent = true; m.material.opacity = 0.82; g.add(m); }
      return g;
    }
    /* the troll's ground slam telegraph */
    ring() {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.9, 0.4), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.renderOrder = 8; return m;
    }
    /* a translucent placement ghost tinted green (ok) or red (blocked) */
    ghost(type) {
      const g = this.piece(type); g.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.55; m.material.depthWrite = false; m.castShadow = false; } });
      const [w, d] = CastleArt.size(type);
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.3, d + 0.3), new THREE.MeshBasicMaterial({ color: 0x7fe08a, transparent: true, opacity: 0.35, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2; pad.position.y = 0.04; pad.userData.pad = true; g.add(pad); return g;
    }
    static tintGhost(g, ok) { g.traverse((m) => { if (m.isMesh && m.userData.pad) m.material.color.setHex(ok ? 0x7fe08a : 0xff6a5a); }); }
  }

  Object.assign(K, { CastleArt, CASTLE_SIZE: SIZE });
})(typeof window !== 'undefined' ? window : globalThis);
