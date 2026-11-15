/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* PresenceSync: who is here (joins, leaves, ticks) and where you are, sent ten times a second. */
(function (G) {
  const K = G.K;

  class PresenceSync {
    constructor(multiplayer) {
      this.mp = multiplayer;
      this.g = multiplayer.g;
      this.net = multiplayer.net;
      this.posT = 0;
      this.net.on('join', (m) => this.onJoin(m));
      this.net.on('leave', (m) => this.onLeave(m));
      this.net.on('tick', (m) => this.mp.avatars.ticks(m.p));
      this.net.on('offline', () => this.g.cui.toast('Lost the connection. Reconnecting…'));
    }

    onJoin(m) {
      this.mp.avatars.add(m.p);
      this.g.cui.toast(`${m.p.name} joined.`);
    }

    onLeave(m) {
      const avatar = this.mp.avatars.by.get(m.id);
      if (avatar) this.g.cui.toast(`${avatar.name} left.`);
      this.mp.avatars.remove(m.id);
    }

    /** replace everyone you can see with the list the server sent */
    reset(players) {
      this.mp.avatars.clear();
      for (const player of players || []) this.mp.avatars.add(player);
    }

    /** a resync: add whoever is new, drop whoever has gone */
    reconcile(players) {
      const avatars = this.mp.avatars;
      const ids = new Set(players.map((p) => p.id));
      for (const player of players) avatars.add(player);
      for (const id of [...avatars.by.keys()]) {
        if (!ids.has(id)) avatars.remove(id);
      }
    }

    update(dt) {
      this.posT += dt;
      if (this.posT < 0.1) return;
      this.posT = 0;
      this.sendPosition();
    }

    sendPosition() {
      const g = this.g;
      const me = g.play.me;
      const dir = me.view.dir;
      this.net.send({
        t: 'pos',
        x: +me.x.toFixed(2),
        z: +me.z.toFixed(2),
        y: +(me.y || 0).toFixed(2),
        f: +Math.atan2(dir.z, dir.x).toFixed(2),
        s: me.view.state,
        tool: g.tools.tool.id,
        hp: Math.round(g.play.player.hp),
      });
    }
  }

  K.PresenceSync = PresenceSync;
})(typeof window !== 'undefined' ? window : globalThis);
