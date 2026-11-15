/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Shared geometry and sign drawing services for furniture builders. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  class FurniturePrimitives {
    static HALF_TURN = Math.PI / 2;
    static CYL() { return K.VoxKit.CYL; }
    static CYL8() { return K.VoxKit.CYL8; }
    static legs(k, w, d, h, key = 'timber', t = 0.06) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        k.box(key, sx * (w / 2 - t / 2), 0, sz * (d / 2 - t / 2), t, h, t);
      }
    }
    static candleAt(k, x, y, z, h = 0.12) {
      k.box('wax', x, y, z, 0.05, h, 0.05);
      k.box('flame', x, y + h, z, 0.025, 0.05, 0.025);
    }
    static sword(k, x, z, lean = -0.14, ry = 0) {
      k.push(new THREE.Matrix4().makeRotationY(ry)).push(new THREE.Matrix4().makeTranslation(x, 0.05, z));
      k.push(new THREE.Matrix4().makeRotationX(lean));
      k.box('steel', 0, 0.28, 0, 0.05, 0.62, 0.015);
      k.box('brass', 0, 0.24, 0, 0.18, 0.035, 0.04);
      k.box('leather', 0, 0.06, 0, 0.035, 0.18, 0.035);
      k.box('brass', 0, 0.02, 0, 0.05, 0.05, 0.05);
      k.pop().pop().pop();
    }
    static spear(k, x, z, lean = -0.12) {
      k.push(new THREE.Matrix4().makeTranslation(x, 0, z)).push(new THREE.Matrix4().makeRotationX(lean));
      k.box('wood', 0, 0, 0, 0.035, 1.25, 0.035);
      k.box('steel', 0, 1.25, 0, 0.06, 0.16, 0.015);
      k.box('cloth', 0, 1.15, 0, 0.05, 0.06, 0.05);
      k.pop().pop();
    }
    static axe(k, x, z, lean = -0.14) {
      k.push(new THREE.Matrix4().makeTranslation(x, 0, z)).push(new THREE.Matrix4().makeRotationX(lean));
      k.box('wood', 0, 0, 0, 0.04, 0.85, 0.04);
      k.box('steel', 0.07, 0.68, 0, 0.14, 0.16, 0.02);
      k.box('iron', -0.02, 0.72, 0, 0.06, 0.08, 0.05);
      k.pop().pop();
    }
    static hammer(k, x, y, z, ry = 0, rz = 0) {
      k.push(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, ry, rz)).setPosition(x, y, z));
      k.box('wood', 0, 0, 0, 0.3, 0.035, 0.035);
      k.box('iron', 0.14, -0.03, 0, 0.06, 0.1, 0.06);
      k.pop();
    }
    static jar(k, x, y, z, key = 'wax', scale = 1) {
      k.geo(key, this.CYL8(), x, y + 0.07 * scale, z, 0, 0, 0,
        0.05 * scale, 0.14 * scale, 0.05 * scale, 0.4, 0.4);
      k.box('soot', x, y + 0.14 * scale, z, 0.06 * scale, 0.02, 0.06 * scale);
    }
    static sphere() { return new THREE.SphereGeometry(1, 10, 8); }
    static bookRow(k, y, w, z = -0.04, seed = 0) {
      const colors = ['bookRed', 'bookBlue', 'paintGreen', 'woodLight', 'paintPurple', 'gold',
        'bookRed', 'paintOrange', 'bookBlue'];
      let x = -w / 2, index = seed;
      while (x < w / 2 - 0.05) {
        const bw = 0.045 + ((index * 37) % 5) * 0.008;
        const bh = 0.2 + ((index * 53) % 4) * 0.025;
        if (x + bw > w / 2) break;
        const angle = index % 7 === 3 ? 0.18 : 0;
        k.box(colors[index % colors.length], x + bw / 2, y, z, bw - 0.004, bh, 0.22, 0, 0, angle);
        x += bw; index++;
      }
    }
    static bottle(k, material, x, y, z, scale = 1) {
      k.geo(material, this.CYL8(), x, y + 0.06 * scale, z, 0, 0, 0,
        0.045 * scale, 0.12 * scale, 0.045 * scale);
      k.box('canvas', x, y + 0.12 * scale, z, 0.03 * scale, 0.05 * scale, 0.03 * scale);
      k.box('woodLight', x, y + 0.17 * scale, z, 0.035 * scale, 0.025 * scale, 0.035 * scale);
    }
    static loaf(k, x, y, z, ry = 0, scale = 1) {
      k.box('woodLight', x, y, z, 0.2 * scale, 0.07 * scale, 0.11 * scale, ry);
      k.box('bread', x, y + 0.06 * scale, z, 0.15 * scale, 0.03 * scale, 0.08 * scale, ry);
    }
    static logPiece(k, x, y, z, length, radius = 0.07, ry = 0) {
      k.geo('bark', this.CYL8(), x, y + radius, z, 0, ry, this.HALF_TURN, radius, length, radius);
    }
  }
  class FurnitureSigns {
    static draw(k, icon, D = 0.09) {
      const px = (m, x, y, w, h, rz = 0, d = D) => k.box(m, x, y - h / 2, 0, w, h, d, 0, 0, rz);
      const rot = (a, fn) => { k.push(new THREE.Matrix4().makeRotationZ(a)); fn(); k.pop(); };
      const disc = (m, x, y, r, d = D) => k.geo(m, K.VoxKit.CYL, x, y, 0, FurniturePrimitives.HALF_TURN, 0, 0, r, d, r);
      const f = FurnitureSigns.icons[icon] || FurnitureSigns.icons.home;
      f(px, rot, disc, D);
    }
    static icons = {
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
    };
    /* a framed board with the icon on both faces, centred on the origin, facing +z */
    static plaque(k, icon, board = 'signBoard', s = 1) {
      k.push(new THREE.Matrix4().makeScale(s, s, s));
      k.box(board, 0, -0.25, 0, 0.62, 0.5, 0.05); for (const y of [-0.27, 0.23]) k.box('woodDark', 0, y, 0, 0.66, 0.04, 0.07); for (const x of [-0.32, 0.32]) k.box('woodDark', x, -0.27, 0, 0.04, 0.54, 0.07);
      k.push(new THREE.Matrix4().makeScale(0.82, 0.82, 1)); FurnitureSigns.draw(k, icon, 0.1); k.pop();
      k.pop();
    }
  }
  Object.assign(K, { FurniturePrimitives, FurnitureSigns });
})(typeof window !== 'undefined' ? window : globalThis);
