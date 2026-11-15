/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class Avatars {
    constructor(game, net) {
      this.g = game;
         this.net = net;
         this.by = new Map();
         this.root = document.createElement('div');
         this.root.id = 'cPlates';
        game.cui.root.appendChild(this.root);
    }
    get play() { return this.g.play;
      }
    add(p) {
      if (this.by.has(p.id)) return this.by.get(p.id);
        const g = this.g;
      const a = g.addActor({ id: 'pl:' + p.id,
         role: 'remote',
         spriteId: 'warden',
         name: p.name,
         x: p.x || 0,
         z: p.z || 0,
         hpMax: 100,
         atk: 0,
         def: 0,
         speed: 3,
         cd: 1,
         reach: 1,
         r: 0.4,
         scale: 1,
         level: 1,
         info: { xp: 0,
        loot: [] } });
      a.remote = true;
         a.pid = p.id;
        a.hostile = false;
      const rec = { a,
         tx: p.x || 0,
         tz: p.z || 0,
         ty: p.y || 0,
         f: p.f || 0,
         s: p.s || 'idle',
         name: p.name,
         el: document.createElement('div'),
         say: null,
        sayT: 0 };
      rec.el.className = 'plate';
         rec.el.innerHTML = `<i class="tm"></i><b>${K.NetText.escape(p.name)}</b><span></span>`;
         this.root.appendChild(rec.el);
         rec.id = p.id;
        this.look(rec);
      a.brain = { update: (dt) => this.step(rec, dt) };
         this.by.set(p.id, rec);
        return rec;
    }
    /** their colour, logo and team name, on their clothes and over their head */
    look(r) { const b = this.g.banners.get(r.id), tm = r.el.querySelector('.tm');
       { const c = K.BANNER_COLORS[b.color % 12];
       if (r.a.view.setTeam) r.a.view.setTeam(c);
       else r.a.view.setTint(c);
       } if (tm) tm.innerHTML = `<img src="${K.Emblems.url(b.logo)}" alt="">${K.NetText.escape(b.name)}`;
       tm.style.background = '#' + K.BANNER_COLORS[b.color % 12].toString(16).padStart(6, '0');
      }
    relook() { for (const r of this.by.values()) this.look(r);
      }
    remove(id) { const r = this.by.get(id);
       if (!r) return;
       this.g.removeActor(r.a);
       r.el.remove();
       this.by.delete(id);
      }
    clear() { for (const id of [...this.by.keys()]) this.remove(id);
      }
    /** the server's batch: where everyone is now */
    ticks(list) {
      for (const [id, x, z, y, f, s] of list) { if (id === this.net.id) continue;
         const r = this.by.get(id);
         if (!r) continue;
         r.tx = x;
         r.tz = z;
         r.ty = y;
         r.f = f;
         r.s = s;
        }
    }
    step(r, dt) {
      const a = r.a, k = Math.min(1, dt * 9), dx = r.tx - a.x, dz = r.tz - a.z, d = Math.hypot(dx, dz);
      if (d > 30) { a.x = r.tx;
         a.z = r.tz;
         } else { a.x += dx * k;
         a.z += dz * k;
        }
      a.y += (r.ty - a.y) * k;
         if (d > 0.04) a.view.setFacing(dx, dz);
        else a.view.setFacing(Math.cos(r.f), Math.sin(r.f));
      const moving = d > 0.12, want = r.s === 'attack' || r.s === 'action' ? r.s : moving ? (d > 0.9 ? 'run' : 'walk') : 'idle';
      if (a.view.state !== want && !(a.view.state === 'attack' && a.view.stateT < 0.45)) a.view.setState(want);
    }
    say(id, text) { const r = this.by.get(id);
       if (!r) return;
       r.say = text;
       r.sayT = 6;
       r.el.querySelector('span').textContent = text;
       r.el.classList.add('talking');
      }
    update(dt) {
      for (const r of this.by.values()) {
        const [x, y, front] = this.play.toScreen(r.a.x, r.a.y + (r.a.view.h || 1.6) + 0.35, r.a.z);
        this.placePlate(r, x, y, front);
        if (r.sayT > 0 && (r.sayT -= dt) <= 0) {
          r.el.classList.remove('talking');
          r.el.querySelector('span').textContent = '';
        }
      }
    }

    /** DOM writes only on change: 30 plates every frame add up */
    placePlate(r, x, y, front) {
      const display = front ? '' : 'none';
      if (r.display !== display) {
        r.display = display;
        r.el.style.display = display;
      }
      const transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;
      if (front && r.transform !== transform) {
        r.transform = transform;
        r.el.style.transform = transform;
      }
    }
    dispose() { this.clear();
       this.root.remove();
      }
  }

  /** everyone's supplies around their houses, drawn the same for all; anyone may take from them */
  K.Avatars = Avatars;
})(typeof window !== 'undefined' ? window : globalThis);
