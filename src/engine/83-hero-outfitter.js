/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · HeroOutfitter: your hero. Made with the lantern, bread and your weapons, best blade in hand, wearing your
   banner's colour, and standing where you last slept. */
(function (G) {
  const K = G.K;

  class HeroOutfitter {
    constructor(game) { this.g = game; }
    makePlayer() {
      const g = this.g;
      g.xp = g.xp || new K.Experience(g);
      const p = new K.CastleHero(g.play.items, g.castle);
      p.xp = g.xp;
      p.addItem('ember_lantern', 1);
      if (g.freshStart) p.addItem('bread', 10);   // you arrive with food to last a while
      for (const w of g.castle.weapons) p.addItem(w, 1);
      this.equipBest(p);
      p.healFull();
      return p;
    }
    equipBest(p) {
      const w = this.g.castle.bestWeapon();
      if (w && p.count(w.id)) p.equip(w.id);
    }
    /** your character wears your banner's colour */
    applyLook() {
      const g = this.g, me = g.play.me;
      if (!me || !me.view) return;
      const c = K.BANNER_COLORS[g.banners.mine().color % 12];
      if (me.view.setTeam) me.view.setTeam(c);
      else if (me.view.setTint) me.view.setTint(c);
    }
    /** spawn by the Keep's door, or where you last slept */
    placeAtSpawn() {
      const g = this.g, play = g.play;
      play.spawn = { x: g.L.start.x, z: g.L.start.z };
      const extras = g.saved && g.saved.extras, rs = (g.net && g.net.welcome.respawn) || (extras && extras.respawn);
      if (rs) { play.spawn = { x: rs.x, z: rs.z }; g.respawn = rs; }
      const me = play.me;
      me.x = play.spawn.x;
      me.z = play.spawn.z;
      me.y = play.nav.y(play.spawn.x, play.spawn.z);
      me.layer = 'ground';
      me.leg = null;
    }
    /** where you slept last is where you wake (and where you come back after a fall); only a house, not the workshop */
    setRespawn(buildingId, x, z) {
      const g = this.g, slot = g.mp ? g.mp.slotOf(buildingId) : buildingId === 'home' ? 0 : null;
      if (slot == null) return;
      g.respawn = { x, z, id: buildingId };
      g.play.spawn = { x, z };
      if (g.mp) g.mp.setRespawn(slot, x, z);
      g.cui.toast('You will wake here.');
    }
  }

  K.HeroOutfitter = HeroOutfitter;
})(typeof window !== 'undefined' ? window : globalThis);
