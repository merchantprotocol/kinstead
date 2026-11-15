/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class MultiplayerCombat extends K.MultiplayerWorld {
    pvp(target) { this.net.send({ t: 'pvp', to: target, tool: this.g.tools.tool.id, auto: !!this.g.sweep.lastSwingAuto });
      }
    /** another player's blow lands on you */
    onPvpHit(m) {
      const g = this.g, me = g.play.me;
         if (!me.alive) return;
         g.play.float(me, '-' + m.dmg, 'hurt');
         me.view.flash && me.view.flash('hit');
        g.sound.play('hit');
      if (g.play.player.hurt(m.dmg)) g.play.defeat();
      g.xp.taken();
         if (m.mob) { const mr = this.mobs.find(m.from, m.mob);
         if (mr) g.sweep.defend(mr.a);
         return;
        }   // a creature bit you: fight it like your own
      const r = this.avatars.by.get(m.from);
         if (r && !m.auto) g.sweep.defend(r.a, true);
           // one blow back for a blow struck on purpose;
        // a blow struck back is never answered automatically, so it cannot spiral
    }
    /**
     * If shut inside someone else's house or fence, walk out: the door opens for you,
     * then shuts behind you. You cannot come back in.
     */
    exits() {
      const g = this.g, me = g.play.me, b = g.R.buildings.at(Math.floor(me.x / TILE), Math.floor(me.z / TILE)), here = b ? b.spec.id : null;
      for (const rec of this.world.doors.values()) {
        const d = rec.door;
           if (this.mayUse(rec.owner) || d.broken || d.open) { if (d.localOpen) { d.localOpen = false;
           d.apply();
           } continue;
          }
        const dist = Math.hypot(me.x - d.ent.x, me.z - d.ent.z);
        if (!d.localOpen && here === 'home:' + rec.slot && dist < 1.9) { d.localOpen = true;
           d.apply();
           } else if (d.localOpen && dist > 2.8) { d.localOpen = false;
           d.apply();
          }
      }
      for (const r of this.world.pieces.values()) {
        const gt = r.gate;
           if (!gt) continue;
          const p = r.p;
        if (this.mayUse(p.owner) || gt.open) { if (gt.localOpen) { gt.localOpen = false;
           gt.apply();
           } continue;
          }
        const dist = Math.hypot(me.x - p.x, me.z - p.z), h = this.world.houseAt[p.owner], nx = Math.sin(p.rot || 0), nz = Math.cos(p.rot || 0);
        const mine = (me.x - p.x) * nx + (me.z - p.z) * nz, theirs = h ? (h.x - p.x) * nx + (h.z - p.z) * nz : 0;
        const inside = !!h && mine * theirs > 0;
          // you are on the side where their house is
        if (!gt.localOpen && inside && dist < 2.2) { gt.localOpen = true;
           gt.apply();
           } else if (gt.localOpen && dist > 3.2) { gt.localOpen = false;
           gt.apply();
          }
      }
    }
    /** a swing at someone else's wall, gate or door: the server decides if it lands */
    hit(rec, door) {
      const g = this.g, now = g.play.t;
         if (now - this.lastHit < 0.35) return;
         this.lastHit = now;
        const me = g.play.me;
      g.play.face(me, door ? rec.door.ent : rec.p);
         me.view.setState('attack');
        g.sound.play('thunk');
      this.net.send(door ? { t: 'hit', slot: rec.slot, tool: g.tools.tool.id } : { t: 'hit', id: rec.p.id, tool: g.tools.tool.id });
    }
    installDoor(rec) {
      const g = this.g, c = g.castle;
         if (!c.spend({ wood: 3 })) { g.cui.toast('You need 3 wood to hang a door.');
         return;
        }
      this.net.send({ t: 'install', slot: rec.slot });
        g.changed();
    }
    onHp(m) {
      const g = this.g;
      if (m.id) {
        const r = this.world.pieces.get(m.id), mine = g.castle.pieces.find((q) => this.pieceId(q) === m.id), old = r ? r.hp : mine ? mine.hp : m.hp;
        if (r) r.hp = m.hp;
           if (mine) mine.hp = m.hp;
           const at = r ? r.p : mine;
          if (at && old > m.hp) g.play.float({ x: at.x, z: at.z, y: g.play.nav.y(at.x, at.z), h: 1 }, '-' + (old - m.hp), 'hurt');
      } else if (m.slot != null) {
        const d = m.slot === g.L.slot ? g.home.door : (this.world.doors.get(m.slot) || {}).door;
           if (!d) return;
           const old = d.hp || m.hp;
           d.hp = m.hp;
           const rec = this.world.doors.get(m.slot);
          if (rec) rec.hp = m.hp;
        if (old > m.hp) g.play.float(d.ent, '-' + (old - m.hp), 'hurt');
      }
    }
    onDoor(m) {
      const g = this.g;
      if (m.slot === g.L.slot) {   // my own door
        const d = g.home.door;
           if (m.broken === true) { d.broken = true;
           d.open = true;
           d.apply();
           g.cui.toast('Your door was broken down!');
           g.sound.play('crack');
          }
        else if (m.open !== undefined && !m.broken) { d.open = !!m.open;
           d.apply();
          }
        return;
      }
      this.world.doorMsg(m);
         if (m.captured) { const rec = this.world.doors.get(m.slot);
         g.cui.toast(`${(this.avatars.by.get(m.owner) || {}).name || 'A settler'} captured ${this.world.owners[m.slot] || 'a'}'s castle!`);
        }
    }
    onEvicted() {
      const g = this.g;
         try { G.localStorage.setItem('kinstead.evict', '1');
        } catch (e) { /* private mode */ }
      const message = '<h2>Your castle was taken</h2>' +
        '<p>Someone broke your door and hung their own. You keep what you carry, ' +
        'and you will wake on a fresh plot.</p>';
      g.cui.modal(message,
         [{ label: 'Start again',
         pri: true,
        run: () => G.location.reload() }]);
    }
    /* ---------- other people: teams and tribute ---------- */
  }
  K.MultiplayerCombat = MultiplayerCombat;
})(typeof window !== 'undefined' ? window : globalThis);
