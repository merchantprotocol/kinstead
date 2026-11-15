/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · what a worker's body does while they work, and what they carry.
     WorkProps    the little loads a worker carries in both arms: a sack, a log, a stone, a pail, a basket of bread…
     WorkPoser    the trade on top of a voxel actor's base pose: chop, hammer, saw, stir, sweep, pitch, lift, knead,
                  milk, feed, brush, read, look, talk, warm. One shared instance; each view keeps its own state
                  (view.work = the pose, view.carry = the prop). The actor view calls poser.pose(view, t) every frame. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  /** the props, built once each from VoxKit boxes and shared by every worker who carries one */
  class WorkProps {
    constructor(mats) { this.mats = mats; this.cache = new Map(); }
    /** how each prop is drawn (centred on the hands, y up) */
    static get SHAPES() {
      const CYL = K.VoxKit.CYL, CYL8 = K.VoxKit.CYL8, R = Math.PI / 2;
      return {
        sack: (k) => { k.box('canvas', 0, -0.13, 0, 0.3, 0.26, 0.2); k.box('rope', 0, 0.12, 0, 0.12, 0.04, 0.1); },
        flour: (k) => { k.box('paintWhite', 0, -0.13, 0, 0.3, 0.26, 0.2); k.box('rope', 0, 0.12, 0, 0.12, 0.04, 0.1); },
        wheat: (k) => {
          for (let i = 0; i < 5; i++) k.box('wheatGold', -0.08 + i * 0.04, -0.16, 0, 0.03, 0.42, 0.03, 0, 0, (i - 2) * 0.08);
          k.box('rope', 0, -0.02, 0, 0.2, 0.04, 0.05);
        },
        log: (k) => {
          k.geo('bark', CYL8, 0, 0, 0, 0, 0, R, 0.09, 0.62, 0.09);
          k.geo('woodLight', CYL8, 0, 0, 0, 0, 0, R, 0.07, 0.64, 0.07);
        },
        plank: (k) => { k.box('woodLight', 0, -0.03, 0, 0.72, 0.05, 0.14); k.box('woodLight', 0, 0.025, 0, 0.72, 0.05, 0.14); },
        stone: (k) => { k.box('stoneLight', 0, -0.12, 0, 0.28, 0.22, 0.24); },
        crate: (k) => { k.box('woodLight', 0, -0.15, 0, 0.3, 0.3, 0.26); k.box('woodDark', 0, -0.03, 0, 0.32, 0.05, 0.28); },
        bucket: (k) => {
          k.geo('woodMid', CYL, 0, -0.1, 0, 0, 0, 0, 0.1, 0.2, 0.1);
          k.geo('eggWhite', CYL, 0, 0.005, 0, 0, 0, 0, 0.085, 0.01, 0.085);
          k.box('ironDark', 0, 0.02, 0, 0.2, 0.02, 0.02);
        },
        bread: (k) => { k.box('woodMid', 0, -0.1, 0, 0.36, 0.08, 0.24);
          for (let i = 0; i < 3; i++) k.box('bread', -0.1 + i * 0.1, -0.03, 0, 0.09, 0.07, 0.18);
          },
        hay: (k) => { k.box('hay', 0, -0.14, 0, 0.42, 0.26, 0.28); k.box('rope', 0, -0.145, 0, 0.03, 0.27, 0.29); },
        meat: (k) => { k.box('meatRed', 0, -0.12, 0, 0.26, 0.18, 0.16); k.box('eggWhite', 0.1, -0.04, 0, 0.05, 0.05, 0.05); },
        eggs: (k) => {
          k.box('woodMid', 0, -0.1, 0, 0.3, 0.1, 0.2);
          for (let i = 0; i < 4; i++) k.box('eggWhite', -0.08 + (i % 2) * 0.12, -0.02, -0.04 + (i >> 1) * 0.08, 0.06, 0.07, 0.06);
        },
        potion: (k) => {
          k.box('potionPink', -0.05, -0.08, 0, 0.07, 0.12, 0.07); k.box('potionTeal', 0.06, -0.08, 0, 0.07, 0.12, 0.07);
          k.box('woodMid', 0, -0.12, 0, 0.22, 0.04, 0.12);
        },
        arrows: (k) => { for (let i = 0; i < 5; i++) k.box('woodLight', -0.06 + i * 0.03, -0.05, 0, 0.015, 0.015, 0.6);
          k.box('rope', 0, -0.05, 0, 0.18, 0.03, 0.04);
          },
        tray: (k) => {
          k.box('woodMid', 0, -0.06, 0, 0.36, 0.03, 0.26);
          k.box('food', -0.06, -0.03, 0, 0.12, 0.05, 0.1); k.box('bread', 0.08, -0.03, 0.02, 0.1, 0.06, 0.08);
        },
      };
    }
    /** the shared meshes of one prop, or null for a name it does not know */
    meshes(name) {
      if (this.cache.has(name)) return this.cache.get(name);
      const draw = WorkProps.SHAPES[name]; if (!draw) return null;
      const kit = new K.VoxKit(); draw(kit);
      const out = kit.meshes(this.mats, { cast: false }); this.cache.set(name, out); return out;
    }
    /** a fresh group showing the prop (its meshes share geometry and materials) */
    make(name) {
      const ms = this.meshes(name); if (!ms) return null;
      const grp = new THREE.Group(); for (const m of ms) grp.add(new THREE.Mesh(m.geometry, m.material)); return grp;
    }
  }

  class WorkPoser {
    constructor(props) { this.props = props; }
    /** keep the prop in the view's arms in step with view.carry */
    hold(v) {
      if (v.carryShown === v.carry || !v.rig) return;
      if (v.carryGroup) { v.rig.group.remove(v.carryGroup); v.carryGroup = null; }
      v.carryShown = v.carry; if (!v.carry) return;
      const grp = this.props.make(v.carry); if (!grp) return;
      const H = (v.h || 1.4) / (v.scale || 1); grp.position.set(0, H * 0.5, H * 0.2); v.rig.group.add(grp); v.carryGroup = grp;
    }
    pose(v, t) {
      if (!v.rig) return; this.hold(v);
      const bones = new BoneSetter(v.rig);
      // pulling a cart's handles behind them
      if (v.haul) { bones.set('armR', 0.45, 0, -0.18);
        bones.set('armL', 0.45, 0, 0.18);
        bones.add('torso', 0.22);
        return;
        }
      if (v.carry) { bones.set('armR', -1.2, 0, 0.12); bones.set('armL', -1.2, 0, -0.12); if (v.state !== 'action') return; }
      if (v.state !== 'action' || !v.work) return;
      const move = WorkPoser.MOVES[v.work]; if (move) move(bones, t + (v.phase || 0));
    }
    /** the trades: each moves the arms, torso and head for time T */
    static get MOVES() {
      if (WorkPoser._moves) return WorkPoser._moves;
      const swing = (T, len, up) => { const c = (T % len) / len; return c < up ? WorkPoser.ease(c / up) : 1 - WorkPoser.ease((c - up) / 0.15); };
      const wave = (T, len) => Math.sin(((T % len) / len) * Math.PI);
      WorkPoser._moves = {
        chop: (b, T) => { const a = swing(T, 1.05, 0.62);
          b.set('armR', -0.4 - 2.3 * a, 0, -0.1);
          b.set('armL', -0.4 - 2.3 * a, 0, 0.1);
          b.add('torso', 0.28 * (1 - a) - 0.08);
          },
        hammer: (b, T) => { const a = swing(T, 0.62, 0.6);
          b.set('armR', -0.6 - 1.9 * a, 0, -0.12);
          b.set('armL', -0.95, 0, 0.2);
          b.add('torso', 0.14 * (1 - a));
          },
        saw: (b, T) => { const s = Math.sin(T * 8); b.set('armR', -1.1 + 0.38 * s, 0, -0.1); b.set('armL', -0.9, 0, 0.18); b.add('torso', 0.18, 0.1 * s); },
        stir: (b, T) => {
          const s = Math.sin(T * 3), c = Math.cos(T * 3);
          b.set('armR', -1.0 + 0.18 * s, 0, -0.1 + 0.15 * c); b.set('armL', -1.0 + 0.18 * s, 0, 0.1 + 0.15 * c); b.add('torso', 0.14, 0.25 * c);
        },
        sweep: (b, T) => { b.set('armR', -0.55, 0, -0.12); b.set('armL', -0.8, 0, 0.12); b.add('torso', 0.22, 0.45 * Math.sin(T * 3.2)); },
        pitch: (b, T) => { const a = wave(T, 1.4);
          b.set('armR', -0.7 - 0.9 * a, 0, -0.1);
          b.set('armL', -0.95 - 0.7 * a, 0, 0.1);
          b.add('torso', 0.45 * (1 - a), 0.3 * a);
          },
        lift: (b, T) => { const a = wave(T, 1.6);
          b.add('torso', 0.75 * a);
          b.set('armR', -0.5 - 0.9 * a);
          b.set('armL', -0.5 - 0.9 * a);
          b.add('head', -0.2 * a);
          },
        knead: (b, T) => { const s = Math.abs(Math.sin(T * 4));
          b.set('armR', -1.0 - 0.32 * s, 0, -0.05);
          b.set('armL', -1.0 - 0.32 * s, 0, 0.05);
          b.add('torso', 0.25 + 0.12 * s);
          },
        milk: (b, T) => { const s = Math.sin(T * 7); b.add('torso', 0.55); b.set('armR', -0.9 + 0.28 * s); b.set('armL', -0.9 - 0.28 * s); },
        feed: (b, T) => {
          const c = (T % 1.2) / 1.2, a = c < 0.3 ? c / 0.3 : 1 - (c - 0.3) / 0.7;
          b.set('armR', -0.4 - 1.0 * a, 0, -0.3 * a); b.set('armL', -0.85, 0, 0.2); b.add('torso', 0.06, 0.2 * a);
        },
        brush: (b, T) => {
          const s = Math.sin(T * 5), c = Math.cos(T * 5);
          b.set('armR', -1.2 + 0.25 * s, 0, -0.2 + 0.2 * c); b.set('armL', -0.35, 0, 0.1); b.add('torso', 0.08, 0.1 * s);
        },
        read: (b, T) => { b.set('armR', -0.95, 0, -0.25); b.set('armL', -0.95, 0, 0.25); b.add('head', 0.28 + 0.05 * Math.sin(T), 0.15 * Math.sin(T * 0.7)); },
        look: (b, T) => { b.set('armR', -2.3, 0, -0.5); b.add('head', -0.05, 0.55 * Math.sin(T * 0.8)); b.add('torso', 0, 0.2 * Math.sin(T * 0.8)); },
        talk: (b, T) => { b.set('armR', -0.7 + 0.32 * Math.sin(T * 4), 0, -0.25); b.set('armL', -0.2, 0, 0.1); b.add('head', 0.06 * Math.sin(T * 6)); },
        warm: (b) => { b.set('armR', -1.1, 0, -0.25); b.set('armL', -1.1, 0, 0.25); b.add('torso', 0.12); b.add('head', 0.1); },
      };
      return WorkPoser._moves;
    }
    static ease(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  }

  /** sets a rig's bones relative to their rest pose (set) or on top of the current pose (add) */
  class BoneSetter {
    constructor(rig) { this.bones = rig.bones; this.rest = rig.rest; }
    set(name, x, y = 0, z = 0) { const b = this.bones[name]; if (!b) return; const r = this.rest[name].r; b.rotation.set(r.x + x, r.y + y, r.z + z); }
    add(name, x, y = 0, z = 0) { const b = this.bones[name]; if (!b) return; b.rotation.x += x; b.rotation.y += y; b.rotation.z += z; }
  }

  Object.assign(K, { WorkProps, WorkPoser, BoneSetter });
})(typeof window !== 'undefined' ? window : globalThis);
