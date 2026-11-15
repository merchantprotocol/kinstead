/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameProgress extends K.CastleGameEffects {
    ending() {
      this.thawAll(5);
        this.flareT = 5;
        this.sound.play('thaw');
        this.endT = 0;
      for (const b of Object.keys(this.barriers)) this.openBarrier(b);
      this.cui.banner('Heartfire hearth · CL 5', 'The troll’s heart burns in the Keep. The glow races outward and the whole map thaws.', 'fire');
    }

    /* ---------- per frame ---------- */
    /** true once enter() has finished (events can arrive before that, or after it failed) */
    get ready() { return !!(this.cui && this.tools && this.brush && this.glowMesh);
      }
    update(dt) {
      if (!this.ready) return;
      const c = this.castle, play = this.play;
        this.playTime += dt;
      // economy
      const tk = c.tick(dt);
      for (const t of tk.ticks) { if (Math.random() < 0.6) this.play.ui.float(t.piece.x, 2, t.piece.z, `+${t.n}`, 'loot', K.CastleUI.ICON[t.r]);
      this.cui.bump(t.r, true);
        }
      // the clock (no dusk before the Keep is lit)
      this.calendar.update(dt);
        // day and night loop forever
      if (this.raid) this.updateRaid(dt);
      // Castle Level up: flare, glow grows, snow melts, chime + card
      const cl = c.cl();
      if (cl !== this.lastCl) {
        if (cl > this.lastCl && this.lastCl > 0) { this.flareT = 2.5;
          this.sound.play('fanfare');
          const row = c.row();
        const levelMessage = `${row.heroMaxHP} HP · +${row.heroAtkBonus} attack · ` +
          `${row.gatherBonus} gather · glow ${row.glowRadiusM} m` +
          `${cl === 4 ? ' · ' + this.data.raw.castleLevel.capMessage : ''}`;
        this.cui.banner(`Castle Level ${cl}`, levelMessage, 'cl');
          }
        this.lastCl = cl;
          this.meltTo(c.glowRadius(), 1.6);
          play.player.healFull();
          this.play.syncMe();
      }
      if (this.melt) { this.melt.t += dt;
        this.stepMeltT = (this.stepMeltT || 0) - dt;
      if (this.stepMeltT <= 0 || this.melt.t >= this.melt.dur) { this.stepMeltT = 0.35;
        this.stepMelt(this.melt.t / this.melt.dur);
        } }
      this.checkKin(dt);
      // visuals: glow, light, night, pops, tracers, arrow, shake
      const targetR = c.glowRadius();
        this.glowR = K.CastleGameUtility.lerp(this.glowR || 0, Math.min(targetR, 70), Math.min(1, dt * 1.6));
      this.glowMesh.visible = false;
        this.glowMesh.scale.setScalar(Math.max(0.01, this.glowR));
        this.glowMesh.position.set(this.L.keep.x, 0.06, this.L.keep.z);
      this.glowMesh.material.opacity = (0.35 + 0.45 * this.nightK) * (1 + 0.15 * Math.sin(play.t * 2.2)) * (this.flareT > 0 ? 1.5 : 1);
      if (this.flareT > 0) this.flareT -= dt;
      this.lightT = (this.lightT || 0) - dt;
        if (this.lightT <= 0) { this.lightT = 0.25;
        this.R.placeDynamics();
        }
      const tgtNight = this.day.isNight ? 1 : this.day.warned ? 0.45 : 0;
      this.nightK = K.CastleGameUtility.lerp(this.nightK, c.hearthCap >= 5 ? 0 : tgtNight, Math.min(1, dt * 0.8));
        this.applyNight();
      if (this.pops) this.pops = this.pops.filter((o) => { o.userData.popT += dt; const k = Math.min(1, o.userData.popT / 0.45), q = k - 1,
      back = 1 + 2.70158 * q * q * q + 1.70158 * q * q;
        o.scale.setScalar(o.userData.s0 + (1 - o.userData.s0) * back);
        return k < 1;
        });
      this.tracers = this.tracers.filter((l) => { l.userData.t += dt; l.material.opacity = 1 - l.userData.t / 0.25;
      if (l.userData.t > 0.25) { this.group.remove(l);
        l.geometry.dispose();
        l.material.dispose();
        return false;
        } return true;
        });
      for (const m of this.meshes.values()) if (m.userData.shake > 0) { m.userData.shake -= dt;
        m.position.x += (Math.random() - 0.5) * 0.04;
        }
      for (const m of this.meshes.values()) m.traverse((o) => { if (o.userData.flame) o.scale.y = 0.85 + 0.25 * Math.sin(play.t * 11 + o.id); });
      { const fog = this.R.scene.fog, dd = this.app.rig.cur.dist, ws = this.weather.fogScale;
        if (fog) { fog.near = dd + 8 * ws;
      fog.far = dd + 32 * ws;
        } }   // the far edge of the world always fades out, at any zoom
      this.updateArrow(dt);
        this.minimap.update(dt);
        this.weather.update(dt);
        this.flags.update(dt);
        this.towers.update(dt);
      if (this.gatekeepers) this.gatekeepers.update(dt);
        this.economy.update(dt);
        this.workers.update(dt);
        this.wildGame.update(dt);
      this.forest.update(dt);
        if (this.mp) this.mp.update(dt);
        for (const p of this.castle.pieces) if (p.bridge) p.bridge.update(dt);
      this.tools.update(dt);
        this.sweep.update(dt);
        this.home.update(dt);
        this.vitals.update(dt);
        this.wild.update(dt);
      this.ramparts.update(dt);
      this.updateOcclusion(dt);
      if (this.shakeT > 0) { this.shakeT -= dt;
        const g = play.app.rig.goal;
        g.tx += (Math.random() - 0.5) * this.shakeT * 0.6;
      g.tz += (Math.random() - 0.5) * this.shakeT * 0.6;
        }
      if (this.thawSnow) { const s = this.R.snow.points;
        s.material.opacity = (s.material.opacity == null ? 1 : s.material.opacity);
      s.visible = this.endT == null || this.endT < 3;
        }
      // the ending: after the thaw, the end card
      if (this.endT != null) { this.endT += dt;
        if (this.endT > 5.5 && !this.endShown) { this.endShown = true;
        this.cui.endCard();
        this.save();
        } }
      // book ticks, HUD, save
      if (this.dirty) { this.dirty = false;
        this.cui.render();
        this.play.refreshProps();
        this.checkBook();
        this.equipBest(play.player);
        }
      this.cui.frame(dt);
      this.saveT += dt;
        if (this.saveT > 10) { this.saveT = 0;
        this.save();
        }
    }
    applyNight() {
      const R = this.R, k = this.nightK, b = this.base;
        if (!b) return;
      R.sun.intensity = b.sun * (1 - 0.72 * k);
        R.sun.color.setRGB(1, K.CastleGameUtility.lerp(0.84, 0.6, k), K.CastleGameUtility.lerp(0.66, 0.75, k));
      if (this.hemi) this.hemi.intensity = b.hemi * (1 - 0.45 * k);
      R.scene.background.copy(b.bg).lerp(new THREE.Color('#0b1020'), k * 0.8);
      R.scene.fog.color.copy(b.fog).lerp(new THREE.Color('#121a30'), k * 0.8);
      if (R.bmats && Math.abs((R.bmats.night || 0) - k) > 0.02) R.bmats.setNight(k);
    }
    goalTarget() {
      const c = this.castle, g = c.currentGoals(1)[0];
        if (!g) return null;
      const L = this.L, keep = { x: L.hearth.x, z: L.hearth.z, h: 2.4 };
      switch (g.id) {
        case 'o1': return keep;
        case 'o2': return { x: L.ruins.gatehouse.x, z: L.ruins.gatehouse.z, h: 2 };
        case 'o3': return c.lit ? { x: L.keep.x + 4.2, z: L.keep.z - 1, h: 0.6, build: true } : keep;
        case 'o4': return keep;
        case 'o5': case 'o10': return this.raid ? null : keep;
        case 'o6': return c.zoneOpen('iron_hills') ? { x: L.outcrop.x, z: L.outcrop.z, h: 1.4 } : null;
        case 'o7': return { x: L.ruins.great_hall.x, z: L.ruins.great_hall.z, h: 2 };
        case 'o8': return { x: L.ruins.smithy.x, z: L.ruins.smithy.z, h: 2 };
        case 'o9': { const s = c.pieces.find((p) => p.type === 'smithy');
          return s ? { x: s.x, z: s.z, h: 2.4 } : null;
          }
        case 'o11': return c.zoneOpen('troll_bridge') && this.troll && this.troll.alive ? { x: this.troll.x, z: this.troll.z, h: 3.4 } : null;
        case 'o12': return keep;
      }
      return null;
    }
    updateArrow() {
      if (this.survival) { this.arrow.visible = false;
        return;
        }   // no goal arrow: there are no goals
      const t = this.cui.placing ? null : this.goalTarget(), a = this.arrow;
        a.visible = !!t;
      if (!t) return;
        const y = this.play.nav.y(t.x, t.z) + t.h + 0.5 + Math.abs(Math.sin(this.play.t * 3)) * 0.35;
      a.position.set(t.x, y, t.z);
        a.rotation.y = this.play.t * 1.5;
    }
    checkBook() {
      const hb = this.castle.hearthbook(), now = new Set();
        for (const s of hb.sections) for (const r of s.rows) if (r.done) now.add(s.section + ':' + r.id);
      if (this.prevBook) for (const k of now) if (!this.prevBook.has(k)) this.cui.bookTick(k, hb.pct);
      this.prevBook = now;
    }

    /* ---------- input ---------- */
  }
  K.CastleGameProgress = CastleGameProgress;
})(typeof window !== 'undefined' ? window : globalThis);
