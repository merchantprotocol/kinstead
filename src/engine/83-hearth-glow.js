/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · HearthGlow: the hearth's light and the night. The glow disc, the fire lights (hearth, braziers, fire pots),
   the flare when the hearth roars, the sky darkening at night, and the Castle Level-up card. */
(function (G) {
  const K = G.K, THREE = G.THREE;

  class HearthGlow {
    static FIRE_PIECES = new Set(['ember_brazier', 'ember_forge', 'smithy']);

    static lerp(a, b, t) { return a + (b - a) * t; }

    constructor(game) { this.g = game; this.glowMesh = null; this.glowR = 0; this.flareT = 0; this.nightK = 0; this.lightT = 0; this.lastCl = 0; }
    /** into the scene: the glow disc, our lights added to every light pass, the day's sky remembered */
    attach() {
      const g = this.g, R = g.R;
      this.nightK = g.day.isNight ? 1 : 0;
      this.lastCl = g.castle.cl();
      this.glowMesh = g.art.glow();
      g.group.add(this.glowMesh);
      this.glowR = g.castle.glowRadius();
      const pd = R.placeDynamics.bind(R);
      this.origPlace = pd;
      R.placeDynamics = () => { pd(); this.pushLights(); };
      R.placeDynamics();
      this.hemi = R.scene.children.find((o) => o.isHemisphereLight);
      this.base = { sun: R.sun.intensity, hemi: this.hemi ? this.hemi.intensity : 1, bg: R.scene.background.clone(), fog: R.scene.fog.color.clone() };
    }
    detach() { if (this.origPlace) this.g.R.placeDynamics = this.origPlace; }
    flare(sec) { this.flareT = sec; }
    pushLights() {
      const g = this.g, R = g.R, c = g.castle, f = this.flareT > 0 ? 1 + Math.min(1.5, this.flareT) : 1;
      if (c.lit && g.home.built) {
        const base = 16 * f * (0.6 + 0.4 * this.nightK), dist = Math.max(8, this.glowR * 1.5);
        R.lightSrc.push({ x: g.home.center.x - 1.6, y: 1.4, z: g.home.center.z - 0.4, color: 0xff8a3c, base, dist, ph: 0.3, fire: true });
      }
      for (const p of c.pieces) {
        if (HearthGlow.FIRE_PIECES.has(p.type)) R.lightSrc.push({ x: p.x, y: 1.3, z: p.z, color: 0xff8a3c, base: 6, dist: 5, ph: p.uid, fire: true });
      }
      for (const p of this.firePots()) {   // fire pots light the camp, brightest at night
        R.lightSrc.push({ x: p.x, y: 1.1, z: p.z, color: 0xff9a4a, base: 5 + 9 * this.nightK, dist: 9, ph: (p.uid || 0) + p.x, fire: true });
      }
    }
    /** your fire pots and every other settler's */
    firePots() {
      const g = this.g, mine = g.castle.pieces.filter((p) => p.type === 'fire_pot');
      if (!g.mp) return mine;
      return mine.concat([...g.mp.world.pieces.values()].filter((r) => r.p.type === 'fire_pot').map((r) => r.p));
    }
    update(dt) {
      const g = this.g, c = g.castle, play = g.play, keep = g.L.keep;
      this.checkLevelUp();
      this.glowR = HearthGlow.lerp(this.glowR || 0, Math.min(c.glowRadius(), 70), Math.min(1, dt * 1.6));
      const m = this.glowMesh;
      m.visible = false;
      m.scale.setScalar(Math.max(0.01, this.glowR));
      m.position.set(keep.x, 0.06, keep.z);
      m.material.opacity = (0.35 + 0.45 * this.nightK) * (1 + 0.15 * Math.sin(play.t * 2.2)) * (this.flareT > 0 ? 1.5 : 1);
      if (this.flareT > 0) this.flareT -= dt;
      this.lightT -= dt;
      if (this.lightT <= 0) { this.lightT = 0.25; g.R.placeDynamics(); }
      const tgtNight = g.day.isNight ? 1 : g.day.warned ? 0.45 : 0;
      this.nightK = HearthGlow.lerp(this.nightK, c.hearthCap >= 5 ? 0 : tgtNight, Math.min(1, dt * 0.8));
      this.applyNight();
    }
    /** Castle Level up: flare, glow grows, snow melts, chime + card */
    checkLevelUp() {
      const g = this.g, c = g.castle, cl = c.cl();
      if (cl === this.lastCl) return;
      if (cl > this.lastCl && this.lastCl > 0) this.levelCard(cl);
      this.lastCl = cl;
      g.thaw.meltTo(c.glowRadius(), 1.6);
      g.play.player.healFull();
      g.play.syncMe();
    }
    levelCard(cl) {
      const g = this.g, row = g.castle.row(), cap = cl === 4 ? ' · ' + g.data.raw.castleLevel.capMessage : '';
      this.flareT = 2.5;
      g.sound.play('fanfare');
      const line = `${row.heroMaxHP} HP · +${row.heroAtkBonus} attack · +${row.gatherBonus} gather · glow ${row.glowRadiusM} m${cap}`;
      g.cui.banner(`Castle Level ${cl}`, line, 'cl');
    }
    applyNight() {
      const R = this.g.R, k = this.nightK, b = this.base;
      if (!b) return;
      R.sun.intensity = b.sun * (1 - 0.72 * k);
      R.sun.color.setRGB(1, HearthGlow.lerp(0.84, 0.6, k), HearthGlow.lerp(0.66, 0.75, k));
      if (this.hemi) this.hemi.intensity = b.hemi * (1 - 0.45 * k);
      R.scene.background.copy(b.bg).lerp(new THREE.Color('#0b1020'), k * 0.8);
      R.scene.fog.color.copy(b.fog).lerp(new THREE.Color('#121a30'), k * 0.8);
      if (R.bmats && Math.abs((R.bmats.night || 0) - k) > 0.02) R.bmats.setNight(k);
    }
  }

  K.HearthGlow = HearthGlow;
})(typeof window !== 'undefined' ? window : globalThis);
