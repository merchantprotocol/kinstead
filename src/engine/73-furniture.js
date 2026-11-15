/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · buildings: furniture catalog. Block models in the diorama style + interaction descriptors.
   Local frame: origin = centre of the footprint at floor level, +z = the front (where the player stands), 1 tile = 0.5 units.
   def: { name, group, size:[w,d] tiles, solid, layer:'floor'|'wall'|undefined, build(k, o, def), interact?, dyn?, chimney? } */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const CYL = () => K.VoxKit.CYL, CYL8 = () => K.VoxKit.CYL8;
  const H = Math.PI / 2;

  /* ---- small reusable pieces ---- */
  const legs = (k, w, d, h, key = 'timber', t = 0.06) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(key, sx * (w / 2 - t / 2), 0, sz * (d / 2 - t / 2), t, h, t); };
  const candleAt = (k, x, y, z, h = 0.12) => { k.box('wax', x, y, z, 0.05, h, 0.05); k.box('flame', x, y + h, z, 0.025, 0.05, 0.025); };
  const sword = (k, x, z, lean = -0.14, ry = 0) => {
    k.push(new THREE.Matrix4().makeRotationY(ry)).push(new THREE.Matrix4().makeTranslation(x, 0.05, z)).push(new THREE.Matrix4().makeRotationX(lean));
    k.box('steel', 0, 0.28, 0, 0.05, 0.62, 0.015); k.box('brass', 0, 0.24, 0, 0.18, 0.035, 0.04); k.box('leather', 0, 0.06, 0, 0.035, 0.18, 0.035); k.box('brass', 0, 0.02, 0, 0.05, 0.05, 0.05);
    k.pop().pop().pop();
  };
  const spear = (k, x, z, lean = -0.12) => {
    k.push(new THREE.Matrix4().makeTranslation(x, 0, z)).push(new THREE.Matrix4().makeRotationX(lean));
    k.box('wood', 0, 0, 0, 0.035, 1.25, 0.035); k.box('steel', 0, 1.25, 0, 0.06, 0.16, 0.015); k.box('cloth', 0, 1.15, 0, 0.05, 0.06, 0.05);
    k.pop().pop();
  };
  const axe = (k, x, z, lean = -0.14) => {
    k.push(new THREE.Matrix4().makeTranslation(x, 0, z)).push(new THREE.Matrix4().makeRotationX(lean));
    k.box('wood', 0, 0, 0, 0.04, 0.85, 0.04); k.box('steel', 0.07, 0.68, 0, 0.14, 0.16, 0.02); k.box('iron', -0.02, 0.72, 0, 0.06, 0.08, 0.05);
    k.pop().pop();
  };
  const hammer = (k, x, y, z, ry = 0, rz = 0) => { k.push(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, ry, rz)).setPosition(x, y, z)); k.box('wood', 0, 0, 0, 0.3, 0.035, 0.035); k.box('iron', 0.14, -0.03, 0, 0.06, 0.1, 0.06); k.pop(); };
  const jar = (k, x, y, z, key = 'wax', s = 1) => { k.geo(key, CYL8(), x, y + 0.07 * s, z, 0, 0, 0, 0.05 * s, 0.14 * s, 0.05 * s, 0.4, 0.4); k.box('soot', x, y + 0.14 * s, z, 0.06 * s, 0.02, 0.06 * s); };

  const T = 0.5;
  let SPH = null; const sphere = () => SPH || (SPH = new THREE.SphereGeometry(1, 10, 8));

  /* ---- sign icons: flat voxel pictures in the XY plane, centred on the origin, about 0.5 x 0.5 units, `D` thick
     (so they show on both faces of a board). Used by shop signs, roof emblems and the hanging section signs. ---- */
  const SignIcons = {
    draw(k, icon, D = 0.09) {
      const px = (m, x, y, w, h, rz = 0, d = D) => k.box(m, x, y - h / 2, 0, w, h, d, 0, 0, rz);
      const rot = (a, fn) => { k.push(new THREE.Matrix4().makeRotationZ(a)); fn(); k.pop(); };
      const disc = (m, x, y, r, d = D) => k.geo(m, K.VoxKit.CYL, x, y, 0, H, 0, 0, r, d, r);
      const f = SignIcons.icons[icon] || SignIcons.icons.home;
      f(px, rot, disc, D);
    },
    icons: {
      bread(px) {
        px('woodMid', 0, -0.1, 0.46, 0.06); px('woodLight', 0, -0.03, 0.48, 0.12); px('woodLight', 0, 0.06, 0.4, 0.08); px('woodLight', 0, 0.12, 0.26, 0.05);
        for (const x of [-0.12, 0, 0.12]) px('wheatGold', x, 0.07, 0.035, 0.11, -0.6, 0.12);
      },
      anvil(px, rot) {
        px('ironDark', 0, 0.09, 0.38, 0.09); px('ironDark', 0.23, 0.1, 0.12, 0.06); px('ironDark', 0.31, 0.105, 0.06, 0.035); px('steel', -0.02, 0.14, 0.32, 0.02, 0, 0.1);
        px('ironDark', 0, -0.02, 0.14, 0.14); px('ironDark', 0, -0.12, 0.3, 0.07); px('ironDark', 0, -0.17, 0.36, 0.04);
        rot(0.7, () => { px('woodMid', -0.02, 0.27, 0.04, 0.22); px('ironDark', -0.02, 0.38, 0.13, 0.07); });
        for (const [x, y] of [[0.16, 0.26], [0.22, 0.2], [0.1, 0.3]]) px('paintOrange', x, y, 0.03, 0.03, 0, 0.11);
      },
      horse(px, rot) {
        rot(-0.5, () => { px('woodMid', 0.05, -0.08, 0.17, 0.32); px('woodDark', 0.15, -0.06, 0.06, 0.34); });
        rot(0.55, () => { px('woodMid', -0.08, 0.1, 0.3, 0.15); px('woodDark', -0.22, 0.08, 0.06, 0.12); });
        px('woodMid', 0.08, 0.17, 0.06, 0.1, 0.3); px('ironDark', -0.02, 0.14, 0.03, 0.03, 0, 0.11); px('paintRed', -0.06, 0.07, 0.2, 0.025, 0.55, 0.11);
      },
      horseshoe(px) {
        for (const sx of [-1, 1]) { px('gold', sx * 0.14, 0.04, 0.07, 0.26); px('gold', sx * 0.1, -0.12, 0.09, 0.09, sx * 0.6); for (const y of [0.1, 0.0]) px('ironDark', sx * 0.14, y, 0.025, 0.025, 0, 0.11); }
        px('gold', 0, -0.15, 0.14, 0.07);
      },
      cleaver(px, rot) {
        rot(-0.45, () => { px('steel', 0.05, 0.03, 0.3, 0.22); px('paintWhite', 0.05, -0.075, 0.3, 0.025, 0, 0.1); px('ironDark', 0.15, 0.1, 0.04, 0.04, 0, 0.11); px('woodDark', -0.2, 0.09, 0.2, 0.065); px('gold', -0.11, 0.09, 0.03, 0.08); });
      },
      ham(px) { px('meatRed', 0.04, 0.0, 0.3, 0.24, 0.5); px('meatRed', 0.1, 0.05, 0.2, 0.2, 0.5); px('paintRed', 0.06, 0.02, 0.18, 0.06, 0.5, 0.1); px('eggWhite', -0.16, -0.12, 0.15, 0.05, 0.5); px('eggWhite', -0.23, -0.17, 0.07, 0.08); },
      potion(px) {
        px('potionPink', 0, -0.08, 0.3, 0.22); px('potionPink', 0, -0.08, 0.22, 0.3); px('paintPurple', 0, -0.16, 0.22, 0.05, 0, 0.1);
        px('canvas', 0, 0.1, 0.09, 0.12); px('gold', 0, 0.04, 0.12, 0.025); px('woodLight', 0, 0.19, 0.1, 0.06); px('paintWhite', -0.08, -0.04, 0.04, 0.09, 0, 0.1);
        for (const [x, y] of [[0.05, -0.02], [-0.02, -0.12]]) px('paintWhite', x, y, 0.03, 0.03, 0, 0.1);
      },
      book(px) { px('bookRed', 0, -0.02, 0.5, 0.3); px('paintWhite', -0.12, 0.0, 0.22, 0.28, 0.1, 0.11); px('paintWhite', 0.12, 0.0, 0.22, 0.28, -0.1, 0.11); for (const y of [0.06, 0.0, -0.06]) { px('woodDark', -0.12, y, 0.15, 0.015, 0.1, 0.12); px('woodDark', 0.12, y, 0.15, 0.015, -0.1, 0.12); } },
      scales(px) {
        px('gold', 0, 0.0, 0.04, 0.36); px('gold', 0, -0.19, 0.22, 0.04); px('gold', 0, 0.15, 0.48, 0.035); px('gold', 0, 0.19, 0.06, 0.06);
        for (const sx of [-1, 1]) { px('ironDark', sx * 0.2 - 0.04, 0.05, 0.012, 0.2, -0.25); px('ironDark', sx * 0.2 + 0.04, 0.05, 0.012, 0.2, 0.25); px('gold', sx * 0.2, -0.05, 0.16, 0.04); }
        px('paintRed', -0.2, -0.01, 0.06, 0.05, 0, 0.1); px('wheatGold', 0.2, -0.01, 0.07, 0.05, 0, 0.1);
      },
      coins(px, rot, disc) { for (const [x, y, n] of [[-0.14, -0.15, 4], [0.02, -0.15, 6], [0.17, -0.15, 3]]) for (let i = 0; i < n; i++) px(i % 2 ? 'wheatGold' : 'gold', x + (i % 2) * 0.01, y + i * 0.05, 0.13, 0.04); },
      wheat(px, rot) {
        for (const a of [-0.35, 0, 0.35]) rot(a, () => { px('wheatGold', 0, -0.06, 0.03, 0.3); px('wheatGold', 0, 0.15, 0.07, 0.16); for (const y of [0.1, 0.16, 0.22]) px('woodLight', 0, y, 0.09, 0.02, 0, 0.1); });
        px('paintRed', 0, -0.06, 0.14, 0.05, 0, 0.11);
      },
      egg(px) { for (const [x, y, s] of [[-0.1, -0.03, 1], [0.12, -0.05, 0.85]]) { px('eggWhite', x, y, 0.16 * s, 0.24 * s); px('eggWhite', x, y - 0.01, 0.2 * s, 0.16 * s); } px('woodLight', 0, -0.18, 0.46, 0.06); px('rope', 0, -0.13, 0.42, 0.04); },
      sword(px, rot) { for (const a of [0.65, -0.65]) rot(a, () => { px('steel', 0, 0.06, 0.06, 0.36); px('paintWhite', 0, 0.06, 0.015, 0.32, 0, 0.1); px('gold', 0, -0.13, 0.2, 0.04); px('woodDark', 0, -0.18, 0.045, 0.08); px('gold', 0, -0.24, 0.06, 0.05); }); },
      shield(px) { px('paintRed', 0, 0, 0.34, 0.38); px('paintRed', 0, 0.02, 0.4, 0.3); px('gold', 0, 0, 0.07, 0.38, 0, 0.1); px('gold', 0, 0, 0.4, 0.06, 0, 0.1); px('ironDark', 0, 0, 0.1, 0.1, 0, 0.12); },
      logs(px, rot, disc, D) { for (const [x, y] of [[-0.12, -0.1], [0.12, -0.1], [0, 0.1]]) { disc('woodDark', x, y, 0.12, D); disc('woodLight', x, y, 0.09, D + 0.02); disc('woodMid', x, y, 0.03, D + 0.03); } },
      home(px) { px('paintWhite', 0, -0.08, 0.32, 0.22); px('paintRed', -0.1, 0.1, 0.28, 0.07, 0.6); px('paintRed', 0.1, 0.1, 0.28, 0.07, -0.6); px('woodDark', 0, -0.13, 0.08, 0.13, 0, 0.11); px('paintYellow', 0.09, -0.05, 0.06, 0.06, 0, 0.11); },
    },
    /* a framed board with the icon on both faces, centred on the origin, facing +z */
    plaque(k, icon, board = 'signBoard', s = 1) {
      k.push(new THREE.Matrix4().makeScale(s, s, s));
      k.box(board, 0, -0.25, 0, 0.62, 0.5, 0.05); for (const y of [-0.27, 0.23]) k.box('woodDark', 0, y, 0, 0.66, 0.04, 0.07); for (const x of [-0.32, 0.32]) k.box('woodDark', x, -0.27, 0, 0.04, 0.54, 0.07);
      k.push(new THREE.Matrix4().makeScale(0.82, 0.82, 1)); SignIcons.draw(k, icon, 0.1); k.pop();
      k.pop();
    },
  };
  /* a little row of brightly bound books standing on a shelf at y, across width w */
  const bookRow = (k, y, w, z = -0.04, seed = 0) => {
    const cols = ['bookRed', 'bookBlue', 'paintGreen', 'woodLight', 'paintPurple', 'gold', 'bookRed', 'paintOrange', 'bookBlue'];
    let x = -w / 2; let i = seed;
    while (x < w / 2 - 0.05) { const bw = 0.045 + ((i * 37) % 5) * 0.008, bh = 0.2 + ((i * 53) % 4) * 0.025; if (x + bw > w / 2) break; k.box(cols[i % cols.length], x + bw / 2, y, z, bw - 0.004, bh, 0.22, 0, 0, (i % 7 === 3) ? 0.18 : 0); x += bw; i++; }
  };
  const bottle = (k, m, x, y, z, s = 1) => { k.geo(m, CYL8(), x, y + 0.06 * s, z, 0, 0, 0, 0.045 * s, 0.12 * s, 0.045 * s); k.box('canvas', x, y + 0.12 * s, z, 0.03 * s, 0.05 * s, 0.03 * s); k.box('woodLight', x, y + 0.17 * s, z, 0.035 * s, 0.025 * s, 0.035 * s); };
  const loaf = (k, x, y, z, ry = 0, s = 1) => { k.box('woodLight', x, y, z, 0.2 * s, 0.07 * s, 0.11 * s, ry); k.box('bread', x, y + 0.06 * s, z, 0.15 * s, 0.03 * s, 0.08 * s, ry); };
  const logPiece = (k, x, y, z, len, r = 0.07, ry = 0) => { k.geo('bark', CYL8(), x, y + r, z, 0, ry, H, r, len, r); };

  const FURNITURE = {
    /* ---------- bedroom ---------- */
    bed: {
      name: 'Bed', group: 'Bedroom', size: [2, 3],
      build(k) {
        const W = 1.0, D = 1.5;
        for (const sx of [-1, 1]) { k.box('timber', sx * 0.46, 0, -0.71, 0.08, 0.72, 0.08); k.box('timber', sx * 0.46, 0, 0.71, 0.08, 0.42, 0.08); }
        k.box('wood', 0, 0.62, -0.72, W, 0.08, 0.06); k.box('wood', 0, 0.2, -0.72, 0.86, 0.42, 0.04); k.box('wood', 0, 0.3, 0.72, 0.86, 0.1, 0.04);
        k.box('wood', 0, 0.12, 0, 0.94, 0.1, 1.4);
        k.box('linen', 0, 0.22, 0, 0.86, 0.14, 1.34);
        k.box('cloth', 0, 0.34, 0.18, 0.9, 0.06, 0.96); for (const sx of [-1, 1]) k.box('cloth', sx * 0.45, 0.17, 0.18, 0.03, 0.2, 0.96);
        k.box('cloth', 0, 0.37, -0.28, 0.9, 0.05, 0.12, 0, 0.25);
        k.box('linen', -0.2, 0.36, -0.52, 0.34, 0.1, 0.24); k.box('linen', 0.2, 0.36, -0.52, 0.34, 0.1, 0.24, 0.08);
      },
      interact: { type: 'bed', label: 'Bed', actions: [{ id: 'sleep', label: 'Sleep (8 h · full health)' }, { id: 'rest', label: 'Rest 1 hour' }] },
    },
    /** a two-high bunk bed for the bunkhouse: workers sleep here at night (no interaction: it is theirs, not yours) */
    bunk: {
      name: 'Bunk bed', group: 'Bedroom', size: [2, 3],
      build(k) {
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box('timber', sx * 0.44, 0, sz * 0.68, 0.08, 1.62, 0.08);
        for (const y of [0.18, 0.96]) {
          k.box('wood', 0, y, 0, 0.9, 0.08, 1.42); k.box('linen', 0, y + 0.08, 0, 0.82, 0.1, 1.34);
          k.box('cloth', 0, y + 0.18, 0.16, 0.86, 0.05, 0.92); k.box('linen', 0, y + 0.18, -0.5, 0.5, 0.09, 0.24);
          for (const sz of [-1, 1]) k.box('wood', 0, y + 0.2, sz * 0.7, 0.86, 0.14, 0.04);
        }
        for (let i = 0; i < 4; i++) k.box('timber', 0.46, 0.35 + i * 0.22, 0.6, 0.05, 0.04, 0.22);   // ladder rungs
      },
    },
    wardrobe: {
      name: 'Wardrobe', group: 'Bedroom', size: [2, 1],
      build(k) {
        k.box('timber', 0, 0, 0, 0.98, 0.08, 0.46); k.box('wood', 0, 0.08, -0.01, 0.92, 1.42, 0.42);
        k.box('timber', 0, 1.5, 0, 1.0, 0.09, 0.5); k.box('timber', 0, 1.59, -0.02, 0.84, 0.05, 0.4);
        for (const sx of [-1, 1]) { k.box('timber', sx * 0.225, 0.18, 0.205, 0.4, 1.22, 0.025); k.box('wood', sx * 0.225, 0.26, 0.215, 0.32, 0.5, 0.02); k.box('wood', sx * 0.225, 0.84, 0.215, 0.32, 0.48, 0.02); k.box('brass', sx * 0.05, 0.78, 0.225, 0.03, 0.1, 0.03); }
      },
      interact: { type: 'wardrobe', label: 'Wardrobe', actions: [{ id: 'change_outfit', label: 'Change outfit' }] },
    },
    /* ---------- armory ---------- */
    weapon_rack: {
      name: 'Weapon rack', group: 'Armory', size: [2, 1],
      build(k) {
        for (const sx of [-1, 1]) { k.box('timber', sx * 0.44, 0, -0.14, 0.07, 1.15, 0.07); k.box('timber', sx * 0.44, 0, 0.0, 0.07, 0.06, 0.34); }
        k.box('timber', 0, 0.16, 0.08, 0.95, 0.06, 0.08); k.box('timber', 0, 0.98, -0.14, 0.95, 0.07, 0.07); k.box('wood', 0, 0.78, -0.14, 0.9, 0.05, 0.05);
        sword(k, -0.3, 0.06); sword(k, -0.14, 0.06, -0.18); spear(k, 0.04, 0.06, -0.13); axe(k, 0.22, 0.06, -0.16); spear(k, 0.36, 0.06, -0.1);
      },
      interact: { type: 'weapon_rack', label: 'Weapon rack', actions: [{ id: 'take_weapon', label: 'Take weapon' }, { id: 'store_weapon', label: 'Store weapon' }] },
    },
    armor_stand: {
      name: 'Armor stand', group: 'Armory', size: [1, 1],
      build(k) {
        k.box('timber', 0, 0, 0, 0.4, 0.06, 0.4); k.box('timber', 0, 0.06, 0, 0.06, 1.0, 0.06); k.box('timber', 0, 0.98, 0, 0.42, 0.05, 0.06);
        k.box('steel', 0, 0.52, 0.0, 0.34, 0.46, 0.2); k.box('steel', 0, 0.44, 0.0, 0.3, 0.1, 0.22); k.box('cloth', 0, 0.36, 0.01, 0.32, 0.1, 0.2);
        for (const sx of [-1, 1]) k.box('steel', sx * 0.21, 0.82, 0, 0.12, 0.14, 0.2, 0, 0, sx * 0.3);
        k.box('steel', 0, 1.06, 0, 0.2, 0.22, 0.2); k.box('soot', 0, 1.13, 0.1, 0.14, 0.03, 0.01); k.box('cloth', 0, 1.28, -0.02, 0.04, 0.08, 0.14);
        k.push(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.25, 0.4, 0)).setPosition(0.14, 0.02, 0.17));
        k.box('cloth', 0, 0, 0, 0.32, 0.4, 0.04); k.box('linen', 0, 0.16, 0.021, 0.05, 0.2, 0.01); k.box('linen', 0, 0.22, 0.021, 0.16, 0.05, 0.01); k.box('brass', 0, 0.19, 0.025, 0.07, 0.07, 0.02);
        k.pop();
      },
      interact: { type: 'armor_stand', label: 'Armor stand', actions: [{ id: 'take_armor', label: 'Take armor' }, { id: 'store_armor', label: 'Store armor' }] },
    },
    chest: {
      name: 'Chest', group: 'Storage', size: [2, 1],
      build(k) {
        k.box('wood', 0, 0, 0, 0.86, 0.36, 0.42); k.box('timber', 0, 0.36, -0.005, 0.9, 0.11, 0.45); k.box('timber', 0, 0.47, -0.01, 0.82, 0.04, 0.38);
        for (const sx of [-0.28, 0.28]) k.box('iron', sx, -0.005, 0, 0.06, 0.52, 0.47);
        k.box('brass', 0, 0.26, 0.215, 0.1, 0.12, 0.03);
      },
      interact: { type: 'storage', label: 'Chest', actions: [{ id: 'open', label: 'Open storage' }] },
    },
    /* ---------- kitchen ---------- */
    hearth: {
      name: 'Kitchen hearth', group: 'Kitchen', size: [3, 2], chimney: true,
      build(k) {
        k.box('ashlar', 0, 0, -0.36, 1.5, 1.34, 0.28);
        for (const sx of [-1, 1]) k.box('ashlar', sx * 0.6, 0, -0.1, 0.3, 0.92, 0.5);
        k.box('ashlar', 0, 0, 0.08, 1.4, 0.07, 0.42); k.box('soot', 0, 0.07, -0.18, 0.86, 0.6, 0.2);
        k.box('timber', 0, 0.92, -0.06, 1.6, 0.12, 0.6); k.box('ashlar', 0, 1.04, -0.24, 1.2, 0.5, 0.42); k.box('ashlar', 0, 1.54, -0.3, 0.9, 0.4, 0.3);
        k.box('coals', 0, 0.07, -0.06, 0.62, 0.05, 0.34); k.box('timber', -0.08, 0.1, -0.06, 0.5, 0.07, 0.08, 0.5); k.box('timber', 0.1, 0.1, -0.04, 0.46, 0.07, 0.08, -0.6);
        k.box('iron', 0.34, 0.07, -0.3, 0.03, 0.76, 0.03); k.box('iron', 0.2, 0.8, -0.3, 0.3, 0.03, 0.03);
        k.geo('iron', CYL8(), 0.06, 0.52, -0.12, 0, 0, 0, 0.12, 0.16, 0.12); k.box('food', 0.06, 0.6, -0.12, 0.16, 0.02, 0.16);
        k.box('wood', -0.45, 0.98, 0.12, 0.22, 0.12, 0.12); k.box('bread', 0.45, 0.98, 0.1, 0.16, 0.08, 0.1); jar(k, 0.62, 0.98, 0.08, 'wax');
      },
      dyn: { fire: [0, 0.08, -0.06, 0.62], light: [0, 0.55, 0.25, 0.85], embers: [0, 0.3, -0.06] },
      interact: { type: 'cook', label: 'Kitchen hearth', station: 'hearth', actions: [{ id: 'cook', label: 'Cook' }, { id: 'warm', label: 'Warm up' }] },
    },
    pantry: {
      name: 'Pantry shelves', group: 'Kitchen', size: [2, 1],
      build(k) {
        k.box('wood', 0, 0, -0.2, 0.94, 1.3, 0.05); for (const sx of [-1, 1]) k.box('timber', sx * 0.45, 0, -0.04, 0.05, 1.3, 0.36);
        for (const y of [0.04, 0.44, 0.84, 1.24]) k.box('wood', 0, y, -0.04, 0.88, 0.04, 0.34);
        k.geo('cheese', CYL(), -0.26, 0.54, -0.02, 0, 0, 0, 0.12, 0.1, 0.12); k.geo('cheese', CYL(), -0.04, 0.54, -0.04, 0, 0, 0, 0.1, 0.08, 0.1);
        k.box('bread', 0.18, 0.48, 0.0, 0.22, 0.09, 0.12, 0.2); k.box('bread', 0.32, 0.48, -0.08, 0.16, 0.08, 0.1, -0.3);
        jar(k, -0.3, 0.88, -0.05); jar(k, -0.16, 0.88, 0.0, 'food'); jar(k, 0.02, 0.88, -0.06, 'green'); k.box('food', 0.24, 0.88, -0.02, 0.24, 0.12, 0.2); k.box('green', 0.24, 1.0, -0.02, 0.16, 0.04, 0.14);
        k.box('linen', -0.2, 0.08, -0.04, 0.3, 0.3, 0.24, 0.2); k.box('wood', 0.2, 0.08, -0.04, 0.3, 0.28, 0.26);
        for (const sx of [-0.25, 0, 0.25]) { k.box('soot', sx, 1.06, 0.12, 0.01, 0.12, 0.01); k.box('food', sx, 0.9, 0.12, 0.07, 0.16, 0.07); }
      },
      interact: { type: 'eat', label: 'Pantry', actions: [{ id: 'eat', label: 'Eat' }, { id: 'take_food', label: 'Take food' }] },
    },
    table: {
      name: 'Table', group: 'Kitchen', size: [2, 2],
      build(k) {
        legs(k, 0.86, 0.8, 0.46); k.box('wood', 0, 0.46, 0, 0.94, 0.07, 0.88);
        k.box('linen', -0.18, 0.53, 0.12, 0.2, 0.015, 0.2); k.box('food', -0.18, 0.545, 0.12, 0.1, 0.05, 0.08);
        k.box('bread', 0.16, 0.53, -0.12, 0.22, 0.09, 0.12, 0.4); k.geo('wood', CYL8(), 0.24, 0.58, 0.18, 0, 0, 0, 0.04, 0.1, 0.04); candleAt(k, -0.05, 0.53, -0.22);
      },
      dyn: { candles: [[-0.05, 0.7, -0.22]] },
      interact: { type: 'eat', label: 'Table', actions: [{ id: 'eat', label: 'Eat' }] },
    },
    long_table: {
      name: 'Long table', group: 'Hall', size: [4, 2],
      build(k) {
        for (const sx of [-0.8, 0.8]) { k.box('timber', sx, 0, 0, 0.08, 0.46, 0.72); k.box('timber', sx, 0, 0, 0.16, 0.06, 0.8); }
        k.box('timber', 0, 0.2, 0, 1.6, 0.06, 0.06); k.box('wood', 0, 0.46, 0, 1.94, 0.08, 0.9);
        for (const x of [-0.6, -0.1, 0.4]) { k.box('linen', x, 0.54, 0.2, 0.2, 0.015, 0.2); k.box('food', x, 0.555, 0.2, 0.12, 0.05, 0.08); k.geo('brass', CYL8(), x + 0.18, 0.6, 0.22, 0, 0, 0, 0.035, 0.1, 0.035); }
        k.box('bread', 0.15, 0.54, -0.15, 0.24, 0.1, 0.13, 0.3); k.box('food', -0.35, 0.54, -0.12, 0.3, 0.12, 0.2); candleAt(k, -0.75, 0.54, -0.15); candleAt(k, 0.75, 0.54, -0.15, 0.16);
      },
      dyn: { candles: [[-0.75, 0.72, -0.15], [0.75, 0.75, -0.15]] },
      interact: { type: 'eat', label: 'Feast table', actions: [{ id: 'eat', label: 'Eat' }] },
    },
    /* ---------- smithy ---------- */
    anvil: {
      name: 'Anvil', group: 'Smithy', size: [1, 1],
      build(k) {
        k.geo('bark', CYL8(), 0, 0.15, 0, 0, 0, 0, 0.17, 0.3, 0.17, 1, 0.6); k.box('wood', 0, 0.3, 0, 0.3, 0.02, 0.3);
        k.box('iron', 0, 0.32, 0, 0.16, 0.12, 0.14); k.box('iron', 0, 0.44, 0, 0.34, 0.08, 0.16); k.box('iron', 0.21, 0.45, 0, 0.1, 0.06, 0.1); k.box('iron', 0.28, 0.46, 0, 0.06, 0.04, 0.06);
        k.box('steel', -0.03, 0.52, 0, 0.26, 0.005, 0.15); hammer(k, -0.02, 0.56, 0.0, 0.5);
      },
      interact: { type: 'smith', label: 'Anvil', station: 'anvil', actions: [{ id: 'craft', label: 'Smith weapons & armor' }], requires: { nearby: 'forge' } },
    },
    forge: {
      name: 'Forge', group: 'Smithy', size: [2, 2], chimney: true,
      build(k) {
        k.box('ashlar', 0, 0, -0.04, 0.95, 0.5, 0.86); k.box('ashlar', 0, 0.5, -0.34, 0.95, 0.34, 0.26); for (const sx of [-1, 1]) k.box('ashlar', sx * 0.42, 0.5, 0, 0.12, 0.1, 0.8);
        k.box('coals', 0, 0.5, 0.02, 0.66, 0.05, 0.56);
        k.box('ashlar', 0, 1.2, -0.18, 0.86, 0.36, 0.6); k.box('ashlar', 0, 1.56, -0.26, 0.6, 0.5, 0.42);
        for (const sx of [-1, 1]) k.box('timber', sx * 0.4, 0.84, 0.06, 0.06, 0.36, 0.06);
        k.box('leather', 0.4, 0.5, 0.36, 0.2, 0.12, 0.24, 0, 0.15); k.box('wood', 0.4, 0.48, 0.36, 0.22, 0.03, 0.26); k.box('iron', 0.4, 0.55, 0.15, 0.04, 0.04, 0.2);
        k.box('iron', -0.2, 0.55, 0.1, 0.03, 0.03, 0.4, 0.4); k.box('glowbar', 0.05, 0.55, 0.05, 0.18, 0.025, 0.04, 0.3);
      },
      dyn: { fire: [0, 0.5, 0.0, 0.5], light: [0, 0.9, 0.35, 1.0], embers: [0, 0.7, 0.0] },
      interact: { type: 'smith', label: 'Forge', station: 'forge', actions: [{ id: 'craft', label: 'Smelt ore' }] },
    },
    grindstone: {
      name: 'Grindstone', group: 'Smithy', size: [1, 1],
      build(k) {
        for (const sx of [-1, 1]) { k.box('timber', sx * 0.12, 0, 0, 0.05, 0.42, 0.06); k.box('timber', sx * 0.12, 0, 0, 0.06, 0.05, 0.38); }
        k.geo('ashlar', K.VoxKit.CYL, 0, 0.42, 0, 0, 0, H, 0.17, 0.08, 0.17, 0.5, 0.2); k.box('iron', 0, 0.42, 0, 0.32, 0.03, 0.03);
        k.box('iron', 0.17, 0.36, 0, 0.03, 0.12, 0.03); k.box('wood', 0.17, 0.3, 0.04, 0.03, 0.03, 0.1); k.box('wood', 0, 0.2, 0.17, 0.2, 0.05, 0.1);
      },
      interact: { type: 'smith', label: 'Grindstone', station: 'grindstone', actions: [{ id: 'craft', label: 'Sharpen' }] },
    },
    workbench: {
      name: 'Workbench', group: 'Smithy', size: [3, 1],
      build(k) {
        legs(k, 1.4, 0.4, 0.42); k.box('timber', 0, 0.14, 0, 1.3, 0.04, 0.34); k.box('wood', 0, 0.42, 0, 1.46, 0.09, 0.46);
        k.box('wood', 0, 0.51, -0.21, 1.4, 0.7, 0.04); for (const x of [-0.5, -0.3, 0.1, 0.35]) k.box('soot', x, 0.95, -0.185, 0.02, 0.02, 0.02);
        hammer(k, -0.5, 0.82, -0.17, 0, H); k.box('steel', -0.28, 0.72, -0.18, 0.1, 0.22, 0.01); k.box('wood', -0.28, 0.92, -0.18, 0.04, 0.08, 0.02);
        k.box('steel', 0.12, 0.68, -0.18, 0.04, 0.28, 0.01); k.box('iron', 0.35, 0.74, -0.18, 0.16, 0.04, 0.02); k.box('iron', 0.35, 0.66, -0.18, 0.03, 0.12, 0.02);
        k.box('iron', 0.6, 0.51, 0.12, 0.1, 0.08, 0.12); k.box('wood', -0.1, 0.51, 0.05, 0.5, 0.04, 0.12, 0.15); k.box('leather', 0.3, 0.51, 0.08, 0.2, 0.02, 0.16, -0.2);
        k.box('wood', -0.55, 0, 0.05, 0.2, 0.14, 0.26); k.box('hay', 0.45, 0, 0.0, 0.3, 0.06, 0.3);
      },
      interact: { type: 'smith', label: 'Workbench', station: 'workbench', actions: [{ id: 'craft', label: 'Craft tools & gear' }] },
    },
    /* ---------- stable ---------- */
    stall: {
      name: 'Stable stall', group: 'Stable', size: [3, 4], solid: false,
      build(k) {
        for (const sx of [-1, 1]) {
          k.box('timber', sx * 0.72, 0, 0.94, 0.08, 1.15, 0.08); k.box('timber', sx * 0.72, 0, -0.94, 0.08, 1.15, 0.08);
          k.box('wood', sx * 0.72, 0, 0, 0.05, 0.72, 1.82); k.box('timber', sx * 0.72, 0.95, 0, 0.06, 0.06, 1.9);
        }
        k.box('wood', 0, 0.84, -0.86, 1.2, 0.08, 0.24); for (let x = -0.5; x <= 0.5; x += 0.125) k.box('timber', x, 0.92, -0.9, 0.025, 0.35, 0.025, 0, 0.25);
        k.box('hay', 0, 0.92, -0.9, 1.1, 0.18, 0.16); k.box('straw', 0, 0, 0, 1.36, 0.03, 1.8);
        k.box('wood', -0.45, 0, 0.94, 0.5, 0.75, 0.04, 0.0); k.box('timber', -0.45, 0.6, 0.94, 0.5, 0.06, 0.06);
        k.box('iron', -0.66, 0.35, 0.96, 0.05, 0.1, 0.05); k.box('hay', 0.4, 0, -0.5, 0.36, 0.18, 0.3);
      },
      interact: { type: 'stable', label: 'Stable stall', actions: [{ id: 'stable_horse', label: 'Stable horse' }, { id: 'feed', label: 'Feed horse' }] },
    },
    horse: {
      name: 'Horse', group: 'Stable', size: [1, 3],
      build(k, o) {
        const coat = o.state && o.state.coat === 'grey' ? 'horseGrey' : 'horse';
        for (const [x, z] of [[-0.1, 0.32], [0.1, 0.32], [-0.1, -0.36], [0.1, -0.36]]) { k.box(coat, x, 0.06, z, 0.1, 0.54, 0.11); k.box('soot', x, 0, z, 0.11, 0.07, 0.12); }
        k.box(coat, 0, 0.56, -0.02, 0.36, 0.4, 0.9); k.box(coat, 0, 0.6, -0.44, 0.28, 0.3, 0.12);
        k.box(coat, 0, 0.76, 0.44, 0.18, 0.42, 0.22, 0, -0.55); k.box('mane', 0, 0.92, 0.38, 0.06, 0.36, 0.12, 0, -0.55);
        k.box(coat, 0, 0.98, 0.62, 0.16, 0.18, 0.34, 0, 0.25); k.box('mane', 0, 0.96, 0.8, 0.14, 0.12, 0.08, 0, 0.25);
        for (const sx of [-1, 1]) { k.box(coat, sx * 0.05, 1.16, 0.54, 0.04, 0.09, 0.04); k.box('soot', sx * 0.085, 1.04, 0.66, 0.01, 0.03, 0.03); }
        k.box('mane', 0, 0.6, -0.54, 0.08, 0.38, 0.08, 0, 0.35);
        k.box('clothBlue', 0, 0.9, -0.02, 0.36, 0.05, 0.34); k.box('leather', 0, 0.94, -0.02, 0.24, 0.06, 0.26); k.box('leather', 0, 1.0, -0.12, 0.2, 0.06, 0.05);
        for (const sx of [-1, 1]) { k.box('leather', sx * 0.17, 0.62, -0.02, 0.02, 0.3, 0.03); k.box('iron', sx * 0.17, 0.58, -0.02, 0.04, 0.04, 0.06); }
      },
      interact: { type: 'mount', label: 'Horse', actions: [{ id: 'saddle', label: 'Saddle horse', requires: { items: { saddle: 1 } } }, { id: 'mount', label: 'Mount horse', requires: { state: 'saddled' } }] },
    },
    tack_rack: {
      name: 'Tack rack', group: 'Stable', size: [2, 1],
      build(k) {
        k.box('timber', 0, 0.2, -0.22, 0.96, 1.0, 0.05);
        for (const x of [-0.25, 0.25]) { k.box('timber', x, 0.62, -0.08, 0.06, 0.06, 0.26); k.box('leather', x, 0.62, -0.06, 0.34, 0.12, 0.3); k.box('leather', x, 0.7, -0.14, 0.24, 0.1, 0.08); k.box('clothBlue', x, 0.5, -0.06, 0.38, 0.12, 0.26); k.box('iron', x - 0.17, 0.32, -0.06, 0.02, 0.22, 0.03); }
        for (const x of [-0.36, 0, 0.36]) { k.box('iron', x, 1.06, -0.18, 0.03, 0.03, 0.08); k.box('leather', x, 0.86, -0.15, 0.04, 0.2, 0.02); k.box('brass', x, 0.84, -0.14, 0.06, 0.04, 0.02); }
        k.geo('hay', K.VoxKit.CYL, 0.0, 0.08, -0.05, 0, 0, 0, 0.16, 0.08, 0.16, 0.6, 0.2);
      },
      interact: { type: 'tack', label: 'Tack rack', station: 'tack', actions: [{ id: 'take_tack', label: 'Take tack' }, { id: 'craft', label: 'Make tack' }] },
    },
    trough: {
      name: 'Water trough', group: 'Stable', size: [2, 1],
      build(k) { k.box('wood', 0, 0, 0, 0.92, 0.32, 0.4); k.box('water', 0, 0.3, 0, 0.82, 0.01, 0.3); k.box('iron', -0.3, -0.01, 0, 0.04, 0.34, 0.42); k.box('iron', 0.3, -0.01, 0, 0.04, 0.34, 0.42); },
      interact: { type: 'water', label: 'Water trough', actions: [{ id: 'water_horse', label: 'Water horse' }, { id: 'drink', label: 'Drink' }] },
    },
    hay_bale: {
      name: 'Hay bale', group: 'Stable', size: [1, 1],
      build(k) { k.box('hay', 0, 0, 0, 0.44, 0.32, 0.4); k.box('leather', -0.1, -0.005, 0, 0.025, 0.33, 0.41); k.box('leather', 0.1, -0.005, 0, 0.025, 0.33, 0.41); k.box('hay', 0.05, 0.32, 0.03, 0.2, 0.05, 0.14, 0.4); },
    },
    /* ---------- study ---------- */
    bookshelf: {
      name: 'Bookshelf', group: 'Study', size: [2, 1],
      build(k) {
        k.box('wood', 0, 0, -0.18, 0.96, 1.62, 0.04); for (const sx of [-1, 1]) k.box('timber', sx * 0.46, 0, -0.03, 0.05, 1.62, 0.34);
        k.box('timber', 0, 1.62, -0.02, 1.0, 0.06, 0.38);
        for (const [i, y] of [0.02, 0.42, 0.82, 1.22].entries()) { k.box('wood', 0, y, -0.03, 0.88, 0.04, 0.32); k.box('books', (i % 2 ? 0.04 : -0.03), y + 0.04, -0.04, i === 3 ? 0.6 : 0.84, 0.3, 0.26); }
        k.box('books', 0.32, 1.26, -0.02, 0.2, 0.06, 0.26, 0, 0, 0); jar(k, 0.34, 1.32, -0.02, 'brass', 0.7);
      },
      interact: { type: 'read', label: 'Bookshelf', actions: [{ id: 'read', label: 'Read' }] },
    },
    /* ---------- decor ---------- */
    rug: { name: 'Rug', group: 'Decor', size: [3, 2], solid: false, layer: 'floor', build(k, o) { k.box(o.state && o.state.color === 'blue' ? 'rugBlue' : 'rug', 0, 0, 0, 1.4, 0.015, 0.92, 0, 0, 0, 'face'); } },
    candle: {
      name: 'Candle stand', group: 'Decor', size: [1, 1],
      build(k) {
        k.box('iron', 0, 0, 0, 0.22, 0.04, 0.22); k.box('iron', 0, 0.04, 0, 0.04, 0.96, 0.04); k.box('iron', 0, 1.0, 0, 0.3, 0.03, 0.06); k.box('iron', 0, 1.0, 0, 0.06, 0.03, 0.3);
        candleAt(k, 0, 1.03, 0, 0.16); candleAt(k, 0.12, 1.03, 0, 0.1); candleAt(k, -0.12, 1.03, 0, 0.12); candleAt(k, 0, 1.03, 0.12, 0.09);
      },
      dyn: { candles: [[0, 1.22, 0]] },
    },
    barrel: {
      name: 'Barrel', group: 'Decor', size: [1, 1],
      build(k) { k.geo('wood', CYL8(), 0, 0.26, 0, 0, 0.2, 0, 0.19, 0.52, 0.19, 1.2, 0.5); for (const y of [0.08, 0.44]) k.geo('iron', CYL8(), 0, y, 0, 0, 0.2, 0, 0.2, 0.04, 0.2); k.geo('timber', CYL8(), 0, 0.52, 0, 0, 0.2, 0, 0.17, 0.02, 0.17); },
    },
    sack: {
      name: 'Sack', group: 'Decor', size: [1, 1],
      build(k) { k.box('linen', 0, 0, 0, 0.3, 0.26, 0.26, 0.3); k.box('linen', 0, 0.22, 0, 0.24, 0.1, 0.2, 0.3, 0.1); k.box('leather', 0, 0.31, 0, 0.1, 0.04, 0.1, 0.3); k.box('linen', 0.03, 0.34, 0, 0.12, 0.06, 0.1, 0.3); k.box('linen', 0.18, 0, 0.12, 0.2, 0.18, 0.18, -0.5, 0, 0.3); },
    },
    crate: { name: 'Crate', group: 'Decor', size: [1, 1], build(k) { k.box('crate', 0, 0, 0, 0.42, 0.42, 0.42, 0.1, 0, 0, 'face'); } },
    banner: {
      name: 'Wall banner', group: 'Decor', size: [1, 1], solid: false, layer: 'wall',
      build(k, o) { k.box('timber', 0, 1.85, -0.2, 0.42, 0.04, 0.04); k.box('brass', -0.22, 1.84, -0.2, 0.04, 0.06, 0.06); k.box('brass', 0.22, 1.84, -0.2, 0.04, 0.06, 0.06); k.quad(o.state && o.state.color === 'red' ? 'hangingRed' : 'hanging', [-0.18, 1.08, -0.17], [0.18, 1.08, -0.17], [0.18, 1.86, -0.17], [-0.18, 1.86, -0.17], [[0, 0], [1, 0], [1, 1], [0, 1]]); },
    },
    chair: {
      name: 'Chair', group: 'Decor', size: [1, 1],
      build(k) { legs(k, 0.32, 0.32, 0.26, 'timber', 0.045); k.box('wood', 0, 0.26, 0, 0.36, 0.05, 0.36); for (const sx of [-1, 1]) k.box('timber', sx * 0.14, 0.31, -0.155, 0.05, 0.42, 0.05); k.box('wood', 0, 0.48, -0.16, 0.32, 0.2, 0.03); },
      interact: { type: 'sit', label: 'Chair', actions: [{ id: 'sit', label: 'Sit' }] },
    },
    bench: {
      name: 'Bench', group: 'Decor', size: [2, 1],
      build(k) { for (const sx of [-0.36, 0.36]) k.box('timber', sx, 0, 0, 0.06, 0.24, 0.28); k.box('timber', 0, 0.1, 0, 0.72, 0.05, 0.05); k.box('wood', 0, 0.24, 0, 0.94, 0.06, 0.32); },
      interact: { type: 'sit', label: 'Bench', actions: [{ id: 'sit', label: 'Sit' }] },
    },
    shelf: {
      name: 'Wall shelf', group: 'Decor', size: [2, 1], solid: false, layer: 'wall',
      build(k) {
        for (const y of [0.95, 1.35]) { k.box('wood', 0, y, -0.12, 0.9, 0.04, 0.24); for (const sx of [-0.36, 0.36]) k.box('iron', sx, y - 0.1, -0.2, 0.03, 0.1, 0.06); }
        jar(k, -0.3, 0.99, -0.12, 'wax'); jar(k, -0.15, 0.99, -0.1, 'food', 0.8); k.box('wood', 0.15, 0.99, -0.12, 0.2, 0.12, 0.14); jar(k, 0.32, 0.99, -0.12, 'green', 1.1);
        k.box('books', -0.12, 1.39, -0.12, 0.4, 0.22, 0.18); jar(k, 0.2, 1.39, -0.12, 'brass', 0.8);
      },
    },

    /* ---------- bakery ---------- */
    oven: {
      name: 'Bread oven', group: 'Bakery', size: [3, 2], chimney: true,
      build(k) {
        k.box('stoneLight', 0, 0, -0.05, 1.42, 0.42, 0.86); k.box('stoneMid', 0, 0.42, -0.05, 1.46, 0.05, 0.9);
        k.box('roofRed', 0, 0.47, -0.08, 1.3, 0.34, 0.8); k.box('roofRed', 0, 0.81, -0.1, 1.08, 0.2, 0.66); k.box('roofRed', 0, 1.01, -0.12, 0.8, 0.14, 0.5); k.box('roofRed', 0, 1.15, -0.14, 0.44, 0.08, 0.32);
        k.box('roofRed', 0, 1.0, -0.36, 0.34, 0.9, 0.2);   // flue
        k.box('soot', 0, 0.47, 0.3, 0.5, 0.32, 0.04); k.box('stoneLight', 0, 0.79, 0.31, 0.58, 0.06, 0.08); for (const sx of [-1, 1]) k.box('stoneLight', sx * 0.28, 0.47, 0.31, 0.06, 0.32, 0.08);
        k.box('coals', 0, 0.47, 0.18, 0.4, 0.04, 0.2);
        k.box('woodLight', 0, 0.42, 0.42, 1.2, 0.04, 0.12); loaf(k, -0.42, 0.46, 0.42, 0.1); loaf(k, 0.42, 0.46, 0.42, -0.2); loaf(k, 0.2, 0.46, 0.42, 0.05, 0.9);
        k.box('woodLight', 0.6, 0.0, 0.38, 0.05, 1.05, 0.03, 0, -0.18); k.box('woodLight', 0.6, 0.0, 0.36, 0.22, 0.03, 0.18, 0, -0.18);   // baker's peel
        for (let i = 0; i < 4; i++) k.box('woodMid', -0.55 + i * 0.05, 0, 0.42, 0.04, 0.3, 0.05, 0, 0, 0.2);
      },
      dyn: { fire: [0, 0.5, 0.22, 0.34], light: [0, 0.7, 0.55, 0.9], embers: [0, 0.6, 0.2] },
    },
    bread_rack: {
      name: 'Bread rack', group: 'Bakery', size: [2, 1],
      build(k) {
        for (const sx of [-1, 1]) k.box('woodLight', sx * 0.44, 0, -0.04, 0.05, 1.3, 0.36);
        k.box('woodMid', 0, 0, -0.2, 0.92, 1.3, 0.03);
        [0.06, 0.4, 0.74, 1.08].forEach((y, i) => {
          k.box('woodLight', 0, y, -0.04, 0.86, 0.04, 0.34);
          for (let j = 0; j < 4; j++) loaf(k, -0.3 + j * 0.2, y + 0.04, -0.03 + ((i + j) % 2) * 0.06, ((i + j) % 3 - 1) * 0.3, i === 3 ? 0.8 : 1);
        });
        k.box('woodLight', 0, 1.3, -0.04, 0.96, 0.05, 0.38);
        for (const x of [-0.25, 0.05, 0.3]) k.box('wheatGold', x, 1.35, -0.06, 0.06, 0.06, 0.32, 0.2);
      },
    },
    flour_sack: {
      name: 'Flour sack', group: 'Bakery', size: [1, 1],
      build(k) {
        k.box('canvas', 0, 0, 0, 0.32, 0.36, 0.28, 0.2); k.box('canvas', 0, 0.34, 0, 0.24, 0.07, 0.2, 0.2); k.box('rope', 0, 0.38, 0, 0.12, 0.04, 0.12, 0.2);
        k.box('paintBlue', 0, 0.12, 0, 0.33, 0.05, 0.29, 0.2); k.box('paintWhite', 0, 0.41, 0, 0.1, 0.04, 0.1, 0.2); k.box('paintWhite', 0.12, 0, 0.16, 0.22, 0.012, 0.14, 0.4);
      },
    },
    kneading_table: {
      name: 'Kneading table', group: 'Bakery', size: [2, 1],
      build(k) {
        legs(k, 0.88, 0.4, 0.46, 'woodMid'); k.box('woodLight', 0, 0.46, 0, 0.96, 0.06, 0.46); k.box('paintWhite', 0, 0.52, 0, 0.7, 0.006, 0.34);
        k.box('eggWhite', -0.2, 0.52, 0.02, 0.22, 0.07, 0.16, 0.3); k.box('eggWhite', 0.08, 0.52, -0.06, 0.14, 0.05, 0.12); k.geo('woodLight', CYL8(), 0.28, 0.56, 0.08, 0, 0.2, H, 0.03, 0.34, 0.03);
        k.box('woodMid', 0, 0.14, 0, 0.8, 0.03, 0.36); k.box('canvas', -0.2, 0.17, 0, 0.26, 0.2, 0.22, 0.3); k.geo('woodLight', CYL8(), 0.22, 0.25, 0, 0, 0, 0, 0.12, 0.2, 0.12);
      },
    },
    /* ---------- shops ---------- */
    counter: {
      name: 'Shop counter', group: 'Shop', size: [3, 1],
      build(k, o) {
        const goods = (o.state && o.state.goods) || 'bread';
        const paint = { bread: 'paintOrange', wheat: 'paintYellow', meat: 'paintRed', eggs: 'paintGreen', weapons: 'paintBlue', ore: 'paintPurple' }[goods] || 'paintRed';
        k.box('woodMid', 0, 0, -0.02, 1.4, 0.56, 0.4); k.box(paint, 0, 0.06, 0.18, 1.32, 0.44, 0.02); k.box('paintWhite', 0, 0.42, 0.19, 1.32, 0.05, 0.02);
        k.box('woodLight', 0, 0.56, 0, 1.48, 0.06, 0.48);
        // a little balance at the end, and the goods
        k.box('gold', 0.6, 0.62, -0.1, 0.03, 0.22, 0.03); k.box('gold', 0.6, 0.84, -0.1, 0.24, 0.02, 0.02); for (const sx of [-1, 1]) k.box('gold', 0.6 + sx * 0.1, 0.7, -0.1, 0.09, 0.015, 0.09);
        const y = 0.62;
        if (goods === 'bread') { for (let i = 0; i < 5; i++) loaf(k, -0.55 + i * 0.2, y, -0.04 + (i % 2) * 0.1, (i % 3 - 1) * 0.4); k.geo('rope', CYL8(), 0.3, y + 0.05, 0.05, 0, 0, 0, 0.12, 0.1, 0.12); for (let i = 0; i < 3; i++) k.box('wheatGold', 0.28 + i * 0.03, y + 0.1, 0.05, 0.07, 0.05, 0.07); }
        else if (goods === 'wheat') { for (let i = 0; i < 3; i++) { k.box('wheatGold', -0.5 + i * 0.22, y, -0.05, 0.12, 0.34, 0.12, 0, 0, (i - 1) * 0.12); k.box('paintRed', -0.5 + i * 0.22, y + 0.1, -0.05, 0.14, 0.04, 0.14); } k.box('canvas', 0.2, y, 0, 0.26, 0.24, 0.22, 0.3); k.box('wheatGold', 0.2, y + 0.24, 0, 0.18, 0.03, 0.15, 0.3); }
        else if (goods === 'meat') { for (let i = 0; i < 3; i++) { k.box('meatRed', -0.5 + i * 0.25, y, 0.0, 0.2, 0.1, 0.14, i * 0.4); k.box('eggWhite', -0.5 + i * 0.25 - 0.1, y + 0.03, 0.0, 0.06, 0.04, 0.04, i * 0.4); } for (let i = 0; i < 6; i++) k.box('paintRed', 0.12 + (i % 3) * 0.08, y, -0.08 + (i >> 1 & 1) * 0.12, 0.07, 0.05, 0.06); }
        else if (goods === 'eggs') { for (const x of [-0.45, -0.1, 0.25]) { k.box('rope', x, y, 0, 0.26, 0.1, 0.24); for (let i = 0; i < 6; i++) k.box('eggWhite', x - 0.08 + (i % 3) * 0.08, y + 0.08, -0.05 + (i > 2 ? 0.1 : 0), 0.06, 0.08, 0.06); } }
        else if (goods === 'weapons') { for (let i = 0; i < 3; i++) { k.box('steel', -0.42 + i * 0.2, y, -0.02, 0.06, 0.02, 0.4, 0.15); k.box('gold', -0.42 + i * 0.2, y, 0.12, 0.16, 0.03, 0.03, 0.15); } k.geo('paintBlue', K.VoxKit.CYL, 0.25, y + 0.02, 0, 0, 0, 0, 0.18, 0.04, 0.18); k.geo('gold', K.VoxKit.CYL, 0.25, y + 0.05, 0, 0, 0, 0, 0.05, 0.04, 0.05); }
        else { for (let i = 0; i < 4; i++) k.box(i % 2 ? 'stoneLight' : 'stoneMid', -0.5 + i * 0.16, y, -0.06 + (i % 2) * 0.1, 0.13, 0.1, 0.13, i); for (let i = 0; i < 3; i++) k.box('ironDark', 0.1 + i * 0.13, y + (i === 2 ? 0.06 : 0), 0, 0.12, 0.06, 0.2); k.box('gold', 0.1, y + 0.06, 0, 0.1, 0.05, 0.16); }
      },
    },
    hanging_sign: {
      name: 'Hanging sign', group: 'Shop', size: [1, 1], solid: false, layer: 'wall',
      build(k, o) {
        const icon = (o.state && o.state.icon) || 'coins';
        for (const sx of [-1, 1]) k.box('ironDark', sx * 0.22, 1.82, 0, 0.015, 0.5, 0.015);
        k.push(new THREE.Matrix4().makeTranslation(0, 1.84, 0).multiply(new THREE.Matrix4().makeRotationX(-0.3)));
        SignIcons.plaque(k, icon, 'paintWhite', 0.9);
        k.pop();
      },
    },
    /* ---------- butcher ---------- */
    meat_hooks: {
      name: 'Meat hooks', group: 'Butcher', size: [2, 1],
      build(k) {
        for (const sx of [-1, 1]) k.box('woodDark', sx * 0.44, 0, -0.12, 0.07, 1.62, 0.07);
        k.box('woodDark', 0, 1.56, -0.12, 0.96, 0.07, 0.08); k.box('woodMid', 0, 0, -0.2, 0.9, 0.2, 0.03);
        const items = [[-0.3, 'ham'], [-0.1, 'sausage'], [0.1, 'ham'], [0.3, 'bird']];
        for (const [x, kind] of items) {
          k.box('ironDark', x, 1.4, -0.12, 0.02, 0.16, 0.02);
          if (kind === 'ham') { k.box('meatRed', x, 0.98, -0.12, 0.17, 0.3, 0.14); k.box('meatRed', x, 0.9, -0.12, 0.13, 0.1, 0.12); k.box('paintRed', x, 1.04, -0.05, 0.14, 0.12, 0.01); k.box('eggWhite', x, 1.28, -0.12, 0.05, 0.12, 0.05); k.box('eggWhite', x, 1.38, -0.12, 0.07, 0.04, 0.07); }
          else if (kind === 'sausage') { for (let i = 0; i < 5; i++) k.box('paintRed', x + (i % 2) * 0.03 - 0.015, 1.36 - i * 0.1, -0.12, 0.06, 0.09, 0.06); }
          else { k.box('eggWhite', x, 1.0, -0.12, 0.16, 0.22, 0.14); k.box('eggWhite', x, 1.22, -0.12, 0.05, 0.16, 0.05); k.box('paintYellow', x, 0.94, -0.12, 0.04, 0.06, 0.04); }
        }
      },
    },
    chopping_block: {
      name: 'Chopping block', group: 'Butcher', size: [1, 1],
      build(k) {
        k.geo('bark', CYL8(), 0, 0.22, 0, 0, 0.3, 0, 0.2, 0.44, 0.2, 1, 0.6); k.geo('woodLight', CYL8(), 0, 0.445, 0, 0, 0.3, 0, 0.18, 0.012, 0.18);
        k.box('meatRed', -0.06, 0.45, 0.04, 0.12, 0.012, 0.1, 0.5); k.box('meatRed', 0.06, 0.45, -0.06, 0.1, 0.06, 0.08, 0.3);
        k.push(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, 0.6, -0.25)).setPosition(-0.02, 0.45, -0.02));
        k.box('steel', 0, -0.06, 0, 0.18, 0.14, 0.015); k.box('woodDark', -0.15, 0.04, 0, 0.14, 0.04, 0.035); k.pop();
      },
    },
    /* ---------- alchemist ---------- */
    cauldron: {
      name: 'Cauldron', group: 'Alchemist', size: [2, 2],
      build(k) {
        for (const a of [0.5, 2.6, 4.7]) k.box('ironDark', Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, 0.06, 0.24, 0.06);
        k.geo('ironDark', K.VoxKit.CYL, 0, 0.42, 0, 0, 0, 0, 0.38, 0.38, 0.38); k.geo('ironDark', K.VoxKit.CYL, 0, 0.24, 0, 0, 0, 0, 0.3, 0.1, 0.3);
        k.geo('ironDark', K.VoxKit.CYL, 0, 0.62, 0, 0, 0, 0, 0.42, 0.06, 0.42); k.geo('glow:#46e8a8', K.VoxKit.CYL, 0, 0.66, 0, 0, 0, 0, 0.36, 0.03, 0.36);
        for (const [x, z, s] of [[0.1, 0.05, 0.06], [-0.12, -0.08, 0.05], [0.02, -0.15, 0.04], [-0.05, 0.14, 0.035]]) k.box('glow:#b8ffe0', x, 0.67, z, s, s, s);
        k.box('coals', 0, 0, 0, 0.4, 0.04, 0.4); logPiece(k, 0, 0.0, 0.05, 0.42, 0.04, 0.6); logPiece(k, 0, 0.0, -0.05, 0.42, 0.04, -0.6);
        k.box('woodLight', 0.15, 0.6, 0.1, 0.03, 0.5, 0.03, 0, 0.3, -0.35);
      },
      dyn: { fire: [0, 0.02, 0, 0.3], light: [0, 0.9, 0.2, 0.9, 0x6dffc0], embers: [0, 0.75, 0] },
    },
    cauldron_small: {
      name: 'Small cauldron', group: 'Alchemist', size: [1, 1],
      build(k) {
        k.geo('ironDark', K.VoxKit.CYL, 0, 0.18, 0, 0, 0, 0, 0.18, 0.28, 0.18); k.geo('ironDark', K.VoxKit.CYL, 0, 0.33, 0, 0, 0, 0, 0.2, 0.04, 0.2);
        k.geo('glow:#ff6ad0', K.VoxKit.CYL, 0, 0.34, 0, 0, 0, 0, 0.16, 0.02, 0.16); k.box('glow:#ffd0f0', 0.04, 0.35, 0.02, 0.04, 0.04, 0.04);
      },
    },
    potion_shelf: {
      name: 'Potion shelf', group: 'Alchemist', size: [2, 1],
      build(k) {
        k.box('woodDark', 0, 0, -0.2, 0.96, 1.62, 0.04); for (const sx of [-1, 1]) k.box('woodDark', sx * 0.46, 0, -0.04, 0.05, 1.62, 0.34);
        k.box('woodDark', 0, 1.62, -0.03, 1.0, 0.06, 0.38);
        const cols = ['potionPink', 'potionTeal', 'paintPurple', 'paintGreen', 'gold', 'paintBlue', 'paintOrange', 'paintRed'];
        [0.04, 0.44, 0.84, 1.24].forEach((y, i) => {
          k.box('woodMid', 0, y, -0.04, 0.88, 0.04, 0.32);
          for (let j = 0; j < 6; j++) bottle(k, cols[(i * 3 + j) % cols.length], -0.35 + j * 0.14, y + 0.04, -0.05 + (j % 2) * 0.07, 0.8 + ((i + j) % 3) * 0.2);
        });
      },
    },
    potion_crate: {
      name: 'Potion crate', group: 'Alchemist', size: [1, 1],
      build(k) { k.box('crate', 0, 0, 0, 0.42, 0.3, 0.42, 0, 0, 0, 'face'); bottle(k, 'potionPink', -0.1, 0.3, -0.08, 0.9); bottle(k, 'potionTeal', 0.08, 0.3, -0.06); bottle(k, 'paintPurple', -0.06, 0.3, 0.1, 1.1); bottle(k, 'gold', 0.1, 0.3, 0.1, 0.8); },
    },
    alchemy_table: {
      name: 'Alchemy table', group: 'Alchemist', size: [2, 1],
      build(k) {
        legs(k, 0.88, 0.4, 0.48, 'woodDark'); k.box('woodMid', 0, 0.48, 0, 0.96, 0.06, 0.46);
        k.box('bookRed', -0.24, 0.54, 0.02, 0.34, 0.03, 0.26, 0.15); k.box('paintWhite', -0.31, 0.57, 0.02, 0.15, 0.015, 0.22, 0.15); k.box('paintWhite', -0.16, 0.57, 0.03, 0.15, 0.015, 0.22, 0.15);
        k.geo('glow:#7fd4ff', sphere(), 0.12, 0.66, -0.05, 0, 0, 0, 0.09, 0.09, 0.09); k.box('canvas', 0.12, 0.72, -0.05, 0.03, 0.12, 0.03); k.box('canvas', 0.18, 0.82, -0.05, 0.16, 0.02, 0.02, 0, 0, -0.4);
        k.box('ironDark', 0.12, 0.54, -0.05, 0.12, 0.04, 0.12); bottle(k, 'potionPink', 0.34, 0.54, 0.1, 0.9); bottle(k, 'paintGreen', 0.38, 0.54, -0.1, 0.7);
        k.geo('stoneLight', CYL8(), -0.02, 0.58, 0.14, 0, 0, 0, 0.06, 0.08, 0.06); candleAt(k, 0.42, 0.54, -0.16, 0.12);
      },
      dyn: { candles: [[0.42, 0.72, -0.16]] },
    },
    book_pile: {
      name: 'Book pile', group: 'Study', size: [1, 1],
      build(k) { const c = ['bookRed', 'bookBlue', 'paintGreen', 'woodLight', 'paintPurple']; for (let i = 0; i < 5; i++) k.box(c[i], (i % 2) * 0.03 - 0.015, i * 0.07, 0, 0.3 - i * 0.02, 0.065, 0.22, (i * 0.37) % 0.8 - 0.4); for (let i = 0; i < 5; i++) k.box('paintWhite', (i % 2) * 0.03 - 0.005, i * 0.07 + 0.01, 0.005, 0.28 - i * 0.02, 0.045, 0.2, (i * 0.37) % 0.8 - 0.4); candleAt(k, 0, 0.35, 0, 0.1); },
    },
    globe: {
      name: 'Globe', group: 'Study', size: [1, 1],
      build(k) {
        k.box('woodDark', 0, 0, 0, 0.3, 0.04, 0.3); k.box('woodDark', 0, 0.04, 0, 0.05, 0.5, 0.05);
        k.geo('waterBlue', sphere(), 0, 0.72, 0, 0, 0, 0.4, 0.2, 0.2, 0.2); k.box('leafGreen', 0.08, 0.72, 0.12, 0.1, 0.12, 0.08, 0.3); k.box('leafGreen', -0.12, 0.66, 0.06, 0.08, 0.1, 0.1); k.box('wheatGold', 0.02, 0.8, -0.14, 0.12, 0.06, 0.06);
        k.geo('brass', K.VoxKit.CYL, 0, 0.72, 0, H, 0, 0.4, 0.24, 0.02, 0.24);
      },
    },
    /* ---------- market goods ---------- */
    wheat_sheaf: {
      name: 'Wheat sheaf', group: 'Market', size: [1, 1],
      build(k) { for (const [x, z, a] of [[-0.06, 0, -0.1], [0.06, 0.02, 0.12], [0, -0.06, 0]]) { k.box('wheatGold', x, 0, z, 0.12, 0.62, 0.12, 0, 0, a); k.box('wheatGold', x + a * 0.6, 0.6, z, 0.18, 0.16, 0.18, 0.3, 0, a); } k.box('paintRed', 0, 0.26, 0, 0.26, 0.06, 0.24); },
    },
    egg_basket: {
      name: 'Egg basket', group: 'Market', size: [1, 1],
      build(k) { k.box('rope', 0, 0, 0, 0.36, 0.16, 0.34); k.box('wheatGold', 0, 0.15, 0, 0.32, 0.02, 0.3); for (let i = 0; i < 7; i++) k.box('eggWhite', -0.1 + (i % 3) * 0.1, 0.16, -0.08 + Math.floor(i / 3) * 0.08, 0.07, 0.09, 0.065); k.box('woodLight', 0, 0.16, 0, 0.03, 0.16, 0.36, 0, 0, 0); },
    },
    material_pile: {
      name: 'Material pile', group: 'Market', size: [2, 1],
      build(k, o) {
        const kind = (o.state && o.state.kind) || 'wood';
        if (kind === 'wood') { for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) { logPiece(k, -0.3 + i * 0.2 + r * 0.1, r * 0.15, 0, 0.42, 0.08, H); k.geo('woodLight', CYL8(), -0.3 + i * 0.2 + r * 0.1, r * 0.15 + 0.08, 0.215, H, 0, 0, 0.07, 0.01, 0.07); } }
        else if (kind === 'stone') { for (let i = 0; i < 6; i++) k.box(i % 3 ? 'stoneLight' : 'stoneMid', -0.3 + (i % 3) * 0.3, Math.floor(i / 3) * 0.2, (i % 2) * 0.04, 0.26, 0.2, 0.32); }
        else { for (let i = 0; i < 6; i++) { const x = -0.32 + (i % 4) * 0.2, y = Math.floor(i / 4) * 0.14; k.box('stoneDark', x, y, 0, 0.2, 0.16, 0.22, i * 0.7); k.box(i % 2 ? 'paintOrange' : 'gold', x + 0.05, y + 0.12, 0.08, 0.05, 0.04, 0.05); } for (let i = 0; i < 3; i++) k.box('ironDark', 0.18 + i * 0.03, 0.2 + i * 0.05, -0.05, 0.22, 0.05, 0.1, 0.2); }
      },
    },
    woodpile: {
      name: 'Woodpile', group: 'Decor', size: [2, 1],
      build(k) {
        for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) { logPiece(k, -0.36 + i * 0.18 + (r % 2) * 0.05, r * 0.13, -0.02, 0.36, 0.065, H); k.geo('woodLight', CYL8(), -0.36 + i * 0.18 + (r % 2) * 0.05, r * 0.13 + 0.065, 0.165, H, 0, 0, 0.055, 0.01, 0.055); }
        k.box('snow', 0, 0.58, -0.02, 0.92, 0.05, 0.36); k.box('ironDark', 0.3, 0.6, 0.05, 0.03, 0.03, 0.26, 0, 0, 0.3); k.box('steel', 0.36, 0.62, 0.17, 0.09, 0.07, 0.02);
      },
    },
    shield_rack: {
      name: 'Shield rack', group: 'Armory', size: [2, 1],
      build(k) {
        k.box('woodDark', 0, 0, -0.2, 0.96, 1.4, 0.05); for (const sx of [-1, 1]) k.box('woodDark', sx * 0.45, 0, -0.15, 0.06, 1.4, 0.12);
        for (const [x, y, c, t] of [[-0.24, 0.95, 'paintRed', 'gold'], [0.24, 0.95, 'paintBlue', 'paintWhite'], [0, 0.45, 'paintGreen', 'paintYellow']]) {
          k.geo(c, K.VoxKit.CYL, x, y, -0.13, H, 0, 0, 0.2, 0.05, 0.2); k.box(t, x, y - 0.2, -0.1, 0.06, 0.4, 0.02); k.box(t, x, y - 0.025, -0.1, 0.4, 0.05, 0.02); k.geo('ironDark', K.VoxKit.CYL, x, y, -0.09, H, 0, 0, 0.06, 0.04, 0.06);
        }
      },
    },
    quench_tub: {
      name: 'Quench tub', group: 'Smithy', size: [1, 1],
      build(k) { k.geo('woodMid', CYL8(), 0, 0.17, 0, 0, 0.2, 0, 0.21, 0.34, 0.21); k.geo('ironDark', CYL8(), 0, 0.28, 0, 0, 0.2, 0, 0.22, 0.04, 0.22); k.geo('waterBlue', CYL8(), 0, 0.33, 0, 0, 0.2, 0, 0.18, 0.01, 0.18); k.box('ironDark', 0.08, 0.2, 0.02, 0.025, 0.4, 0.025, 0, 0.2, 0.3); k.box('ironDark', 0.12, 0.2, -0.02, 0.025, 0.4, 0.025, 0, -0.2, 0.3); },
    },
  };
  // brighter furniture: books in coloured bindings
  FURNITURE.bookshelf.build = function (k) {
    k.box('woodDark', 0, 0, -0.18, 0.96, 1.62, 0.04); for (const sx of [-1, 1]) k.box('woodMid', sx * 0.46, 0, -0.03, 0.05, 1.62, 0.34);
    k.box('woodMid', 0, 1.62, -0.02, 1.0, 0.06, 0.38);
    [0.02, 0.42, 0.82, 1.22].forEach((y, i) => { k.box('woodMid', 0, y, -0.03, 0.88, 0.04, 0.32); bookRow(k, y + 0.04, i === 3 ? 0.56 : 0.84, -0.04, i * 5); });
    jar(k, 0.32, 1.26, -0.02, 'brass', 0.7);
  };

  /* every furniture type with an interaction, for the play-mode registry and the builder's palette */
  const FurnitureCatalog = {
    types() { return Object.keys(FURNITURE); },
    def(type) { return FURNITURE[type] || null; },
    interactive() { return Object.entries(FURNITURE).filter(([, d]) => d.interact).map(([type, d]) => ({ type, name: d.name, ...d.interact })); },
    groups() { const g = {}; for (const [t, d] of Object.entries(FURNITURE)) (g[d.group] = g[d.group] || []).push(t); return g; },
  };

  Object.assign(K, { FURNITURE, FurnitureCatalog, SignIcons });
})(typeof window !== 'undefined' ? window : globalThis);
