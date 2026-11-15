/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the hero's big sweeping swing. One swing cuts a wide arc in front of the hero and hurts
   EVERYTHING hostile inside it, not just the one you clicked. Clicking faster swings faster (down to a
   short minimum gap); standing next to a foe keeps swinging on the weapon's normal rhythm.

     SwingArc      the crescent of light that sweeps across the ground (visual only)
     SweepAttack   who is inside the arc, the swing itself, and the click-to-swing rule */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const RADIUS = 2.7, ARC = Math.PI * 0.85, MIN_GAP = 0.16, REACH_FOR_CLICK = 2.3, HIT_DELAY = 0.18, AUTO_WINDOW = 1.0;   // after the last click the hero keeps swinging for 1 s, then stops
  const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

  /** A flat crescent that sweeps across the ground and fades. */
  class SwingArc {
    constructor(group) {
      this.group = group; this.live = [];
      this.mat = new THREE.MeshBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    }
    play(x, y, z, facing, radius, arc) {
      const geo = new THREE.RingGeometry(radius * 0.74, radius, 32, 1, -facing - arc / 2, arc), mesh = new THREE.Mesh(geo, this.mat.clone());
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.renderOrder = 5; this.group.add(mesh);
      this.live.push({ mesh, t: 0 });
    }
    update(dt) {
      this.live = this.live.filter((s) => {
        s.t += dt; const k = s.t / 0.24; s.mesh.material.opacity = 0.8 * (1 - k * k); s.mesh.scale.setScalar(0.75 + k * 0.4);
        if (k < 1) return true; this.group.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); return false;
      });
    }
    dispose() { for (const s of this.live) { this.group.remove(s.mesh); s.mesh.geometry.dispose(); s.mesh.material.dispose(); } this.live = []; this.mat.dispose(); }
  }

  class SweepAttack {
    constructor(game) { this.g = game; this.arc = new SwingArc(game.group); this.lastSwing = -9; this.lastClick = -9; this.guard = null; }
    get play() { return this.g.play; }
    /** the tool in hand decides how hard, how fast and how wide you can fight */
    get combat() { return this.g.tools.tool.combat; }
    isFoe(a) { return !!a && a !== this.play.me && a.alive && (a.hostile || (a.remote && !!this.g.mp && !this.g.mp.mayUse(a.pid))) && this.play.actors.includes(a); }   // other players are fair game unless they are on your team
    /** is this foe inside the sweep, given where the hero faces? (anything touching the hero counts too) */
    inArc(a, facing) {
      const cb = this.combat, me = this.play.me, dx = a.x - me.x, dz = a.z - me.z, d = Math.hypot(dx, dz) - (a.r || 0.3);
      if (d > cb.radius) return false; if (d < 0.5) return true;
      return Math.abs(wrap(Math.atan2(dz, dx) - facing)) <= cb.arc / 2;
    }
    victims(facing) { return this.play.actors.filter((a) => this.isFoe(a) && this.inArc(a, facing)); }
    /** one big swing toward `target`: everything in the arc is hit a beat later, as the blade passes */
    swing(target, auto = false) {
      const P = this.play, me = P.me; if (!me.alive) return;
      const facing = Math.atan2(target.z - me.z, target.x - me.x), hits = this.victims(facing);
      if (auto && (P.t - this.lastClick > AUTO_WINDOW || !hits.length)) { P.target = null; return; }   // you stopped clicking, or there is nothing there: stand down
      P.face(me, target); me.cdT = me.cd; me.view.setState('attack'); this.lastSwing = P.t;
      const cb = this.combat; me.dmgScale = cb.scale;   // work tools hit softer than the sword
      this.arc.play(me.x, (me.y || 0) + 0.5, me.z, facing, cb.radius, cb.arc);
      this.g.sound.play('swish');
      for (const v of hits) P.pending.push({ t: HIT_DELAY, a: me, b: v, reach: cb.radius + 1.5 });
    }
    /** a left-click on a foe with the sword out: swing now if one is close (as fast as you can click), else let play walk over */
    clickFoe(e, tool) {
      if (!this.isFoe(e)) return false;   // any tool defends you, the sword best
      const P = this.play, me = P.me; if (!me.alive) return false;
      if (P.dist(me, e) > REACH_FOR_CLICK + (e.r || 0)) return false;
      this.lastClick = P.t; P.target = e; P.intent = null; P.cancelChannel(); me.path = null; e.aggro = true;
      if (P.t - this.lastSwing >= tool.combat.gap) this.swing(e);
      return true;
    }
    /** you were hit: from now on you fight back at whoever did it, without a click (not while you are walking away) */
    defend(attacker) { if (this.isFoe(attacker)) this.guard = { foe: attacker, until: this.play.t + 3 }; }
    update(dt) {
      this.arc.update(dt); const g = this.guard, P = this.play, me = P.me; if (!g) return;
      if (!me.alive || P.t > g.until || !this.isFoe(g.foe)) { this.guard = null; return; }
      if (me.path || P.t - this.lastSwing < this.combat.gap) return;                       // walking away, or still recovering
      const d = P.dist(me, g.foe) - (g.foe.r || 0.3), tool = this.g.tools.tool;
      if (tool.ranged && this.g.castle.amount('arrow') > 0) { if (d < 14) { this.g.tools.archery.shoot(g.foe.x, g.foe.z); this.lastSwing = P.t; } return; }
      if (d <= this.combat.radius) { P.cancelChannel(); this.swing(g.foe); g.until = P.t + 3; }   // keeps going while it keeps fighting you
    }
    dispose() { this.arc.dispose(); }
  }

  Object.assign(K, { SwingArc, SweepAttack });
})(typeof window !== 'undefined' ? window : globalThis);
