/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  class KinBrain {
    constructor(game, a, id) { this.g = game;
      this.a = a;
      this.id = id;
      this.cd = 0;
      this.repathT = 0;
      this.downT = 0;
    this.offset = { pinewarden: [-1.4, 0.9], emberwright: [1.3, 1.1], rime_brute: [0.2, -1.5] }[id] || [1, 1];
      }
    get joined() { return this.g.castle.kin.has(this.id);
      }
    update(dt) {
      const g = this.g, a = this.a, me = g.play.me;
      if (!this.joined) { if (a.view.state !== 'idle') a.view.setState('idle');
        return;
        }
      if (!a.alive) { this.downT -= dt;
        if (this.downT <= 0) { a.alive = true;
        a.hp = a.hpMax;
        a.view.setState('idle');
      g.play.float(a, 'Up again', 'heal');
        } return;
        }
      this.cd -= dt;
      const st = g.kinStats(this.id);
        a.hpMax = st.hp;
      // dusk: the Pinewarden climbs a watchtower
      const tower = this.id === 'pinewarden' && g.isNightish() ? g.towerFor(a) : null;
      if (tower) {
        a.manning = tower;
          a.path = null;
          a.x = tower.x;
          a.z = tower.z;
          a.y = g.play.nav.y(tower.x, tower.z) + 3.2;
        const foe = g.nearestEnemy(a, 6.5);
          if (foe && this.cd <= 0) this.shoot(foe, st);
          else if (foe) a.view.setFacing(foe.x - a.x, foe.z - a.z);
        return;
      }
      if (a.manning) { a.manning = null;
        a.y = g.play.nav.y(a.x, a.z);
        }
      const range = st.ranged ? 4.5 : 1.2, foe = g.nearestEnemy(a, st.ranged ? 5 : 3.2);
      if (foe) {
        const d = Math.hypot(foe.x - a.x, foe.z - a.z);
        if (d <= range) { a.path = null;
          a.view.setFacing(foe.x - a.x, foe.z - a.z);
          if (this.cd <= 0) this.shoot(foe, st);
          return this.anim(false);
          }
        if ((this.repathT -= dt) <= 0) { this.repathT = 0.4;
          a.path = g.play.nav.find(a.x, a.z, foe.x, foe.z, { range: range * 0.9, maxNodes: 1500 });
          }
        return this.anim(g.play.move(a, dt, a.speed * 1.2));
      }
      // follow the hero
      const tx = me.x + this.offset[0], tz = me.z + this.offset[1], d = Math.hypot(tx - a.x, tz - a.z);
      if (d > 3.4 || (a.path && d > 0.6)) {
        if ((this.repathT -= dt) <= 0 || !a.path) { this.repathT = 0.6;
          a.path = g.play.nav.find(a.x, a.z, tx, tz, { range: 0.5, maxNodes: 2500 });
          }
        if (d > 14) { a.x = me.x - 1;
          a.z = me.z + 1;
          a.y = g.play.nav.y(a.x, a.z);
          a.path = null;
          }
        return this.anim(g.play.move(a, dt, a.speed * (d > 6 ? 1.8 : 1)));
      }
      a.path = null;
        this.anim(false);
    }
    shoot(foe, st) {
      const g = this.g, a = this.a;
        this.cd = st.cd;
        a.view.setState('attack');
        a.view.setFacing(foe.x - a.x, foe.z - a.z);
      if (st.ranged) g.tracer(a, foe, st.color);
        g.hurtEnemy(foe, st.atk, this.id, true);
    }
    knock() { const a = this.a;
      a.alive = false;
      a.view.setState('dead');
      this.downT = 5;
      a.path = null;
      }
    anim(moving) { const v = this.a.view;
      if (moving) { if (v.state !== 'attack' && v.state !== 'hurt') v.setState('walk');
    } else if (v.state === 'walk' || v.state === 'run') v.setState('idle');
      }
  }
  K.KinBrain = KinBrain;
})(typeof window !== 'undefined' ? window : globalThis);
