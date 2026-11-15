/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class MultiplayerMobs extends K.MultiplayerStores {
    castMobs() {
      const g = this.g, list = [];
      for (const a of g.play.actors) {
        const townsperson = !!a.worker || (a.role === 'npc' && String(a.id).startsWith('kin:'));
        if (a.remote || a === g.play.me || (!townsperson && (!a.hostile || !(a.wolf || a.bear || a.thief || a.gameKind)))) continue;
        const d = a.view.dir, kind = townsperson ? 'person:' + a.spriteId : a.gameKind || (a.bear ? 'bear' : a.wolf ? 'wolf' : 'raider');
        list.push([a.id,
           kind,
           +a.x.toFixed(2),
           +a.z.toFixed(2),
           +(a.y || 0).toFixed(2),
           +Math.atan2(d.z,
           d.x).toFixed(2),
           a.alive ? a.view.state : 'dead',
           Math.round(a.hp),
           a.hpMax,
          a.name]);
        if (list.length >= 40) break;
      }
      if (list.length || this.hadMobs) this.net.send({ t: 'mobs', list });
        this.hadMobs = list.length > 0;
    }
    /** you struck someone else's creature: its owner's game takes the blow */
    mobHit(b) { this.net.send({ t: 'mobhit', to: b.mob.owner, id: b.mob.id, tool: this.g.tools.tool.id });
      }
    /** one of your creatures bit another player */
    mobBite(a, b) { this.net.send({ t: 'mobbite', to: b.pid, mob: a.id, name: a.name, dmg: Math.round(a.atk || 5) });
      }
    onMobHurt(m) {
      const g = this.g, a = g.play.actors.find((x) => x.id === m.id && !x.remote);
        if (!a || !a.alive || !a.hostile) return;
      a.hp -= m.dmg;
         a.aggro = true;
         a.lastFight = g.play.t;
         g.play.float(a, String(m.dmg), 'dealt');
         if (a.view.flash) a.view.flash('hit');
        if (a.hp <= 0) g.play.kill(a);
    }
    /** you built your cottage: everyone gets to see it, and its door is yours */
  }
  K.MultiplayerMobs = MultiplayerMobs;
})(typeof window !== 'undefined' ? window : globalThis);
