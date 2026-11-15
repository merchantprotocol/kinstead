/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class RemoteMobs {
    constructor(game, net) { this.g = game;
       this.net = net;
       this.by = new Map();
      }
    key(from, id) { return from + ':' + id;
      }
    update(from, list) {
      const g = this.g, now = g.play.t;
      for (const [id, kind, x, z, y, f, st, hp, hpMax, name] of list) {
        const k = this.key(from, id);
          let r = this.by.get(k);
        if (!r) {
          const worker = kind.startsWith('person:'), sprite = worker ? kind.slice(7) : kind === 'bear' ? 'bear' : kind === 'wolf' ? 'wolf' : 'ranger';
          const a = g.addActor({ id: 'mob:' + k,
             role: 'remote',
             spriteId: sprite,
             name: name || kind,
             x,
             z,
             hpMax: hpMax || 30,
             atk: 0,
             def: 0,
             speed: 3,
             cd: 1,
             reach: 1,
             r: kind === 'bear' ? 0.8 : 0.45,
             scale: 1,
             level: 1,
             info: { xp: 0,
            loot: [] } });
          a.remote = true;
             a.hostile = !worker;
             a.mob = { owner: from, id };
             if (worker) a.worker = true;
            if (kind === 'raider') a.view.setTint(0x6e4a42);
          if (K.GAME_ANIMALS && K.GAME_ANIMALS[kind]) { a.view.dispose();
             a.view = new K.AnimalView(g.R, kind);
             a.view.setPosition(x, y, z);
             a.gameKind = kind;
             a.r = K.GAME_ANIMALS[kind].r;
            }   // a deer, elk, bison or wild horse someone else's game runs
          r = { a, tx: x, tz: z, ty: y, f, st, seen: now };
             a.brain = { update: (dt) => this.step(r, dt) };
            this.by.set(k, r);
        }
        r.tx = x;
           r.tz = z;
           r.ty = y;
           r.f = f;
           r.st = st;
           r.seen = now;
           r.a.hp = hp;
          r.a.hpMax = hpMax || r.a.hpMax;
      }
    }
    step(r, dt) {
      const a = r.a, g = this.g;
         if (g.play.t - r.seen > 2.5) { this.remove(r);
         return;
        }   // its owner stopped telling us about it: gone
      const k = Math.min(1, dt * 9), dx = r.tx - a.x, dz = r.tz - a.z, d = Math.hypot(dx, dz);
      if (d > 20) { a.x = r.tx;
         a.z = r.tz;
         } else { a.x += dx * k;
         a.z += dz * k;
        } a.y += (r.ty - a.y) * k;
      if (d > 0.04) a.view.setFacing(dx, dz);
        else a.view.setFacing(Math.cos(r.f), Math.sin(r.f));
      const want = r.st === 'dead' ? 'dead' : r.st === 'attack' ? 'attack' : d > 0.1 ? (d > 0.8 ? 'run' : 'walk') : 'idle';
      if (a.view.state !== want && !(a.view.state === 'attack' && a.view.stateT < 0.45)) a.view.setState(want);
      if (r.st === 'dead') a.alive = false;
    }
    remove(r) { this.by.delete(this.key(r.a.mob.owner, r.a.mob.id));
       this.g.removeActor(r.a);
      }
    dropOwner(owner) { for (const r of [...this.by.values()]) if (r.a.mob.owner === owner) this.remove(r);
      }
    find(owner, id) { return this.by.get(this.key(owner, id)) || null;
      }
    dispose() { for (const r of [...this.by.values()]) this.remove(r);
      }
  }

  /** invitations to join a team: little notices beside the world map, each with Accept and Decline */
  K.RemoteMobs = RemoteMobs;
})(typeof window !== 'undefined' ? window : globalThis);
