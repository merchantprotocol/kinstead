/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · staying alive. Outside, your strength slowly drains (never to death: only wolves, bears and raiders
   can kill you). Inside your house it does not drain at all, and slowly grows back. How you recover:
     food     the main way: a little food gives a good chunk back
     the house   strength creeps up slowly while you are indoors
     sleep    the last resort: lie in your bed and the creep is twice as fast (still slow, and food is much better)
   Class: Vitals (the drain, the creep, sleeping, and the warning). */
(function (G) {
  const K = G.K;
  const DRAIN_PER_SEC = 0.15;      // outside: about one strength every seven seconds
  const HOME_PER_SEC = 1 / 12;     // inside: one strength every twelve seconds
  const SLEEP_FACTOR = 2;          // asleep: twice that

  class Vitals {
    constructor(game) {
      this.g = game; this.acc = 0; this.warned = false; this.sleeping = false; this.hpAtSleep = 0;
      this.veil = document.createElement('div'); this.veil.id = 'cSleep'; this.veil.hidden = true; this.veil.innerHTML = '<div><b>Sleeping…</b><span>Strength comes back slowly. Food is much faster. Click to wake.</span></div>';
      this.veil.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.wake(); }); game.cui.root.appendChild(this.veil);
      this.hook();
    }
    get play() { return this.g.play; }
    get player() { return this.play.player; }
    get hpMax() { return this.player.stats().hpMax; }
    get weak() { return this.player.hp < this.hpMax * 0.3; }
    get floor() { return Math.max(2, Math.round(this.hpMax * 0.06)); }
    get home() { const me = this.play.me; return this.g.home.inside(me.x, me.z); }
    /** the bed's "Sleep" (the building system's instant full heal is replaced) */
    hook() {
      const reg = K.Interactions, v = this, orig = reg.get('bed') || {}, base = orig.baseActions || orig.actions;
      reg.register('bed', Object.assign({}, orig, { baseActions: base, actions: (e, game) => [{ id: 'sleep', label: 'Sleep (slow recovery)', icon: 'hand', range: e.range, run: () => v.sleep() }].concat((base ? base(e, game) : []).filter((a) => a.id !== 'sleep' && a.id !== 'rest')) }));
    }
    sleep() {
      const g = this.g, P = this.play; if (this.sleeping || !P.me.alive) return;
      if (!this.home) { g.cui.toast('You can only sleep inside your house.'); return; }
      if (this.player.hp >= this.hpMax) { g.cui.toast('You are not tired. Strength is full.'); return; }
      this.sleeping = true; this.hpAtSleep = this.player.hp; this.veil.hidden = false; P.channel({ label: 'Sleeping…', time: 1e9, anim: 'idle', onDone() {} }); g.sound.play('whump');
    }
    wake() { if (!this.sleeping) return; this.sleeping = false; this.veil.hidden = true; this.play.cancelChannel(); this.g.cui.toast('You wake.'); }
    update(dt) {
      const P = this.play; if (!P.me.alive) { if (this.sleeping) this.wake(); return; }
      const p = this.player, max = this.hpMax;
      if (this.sleeping && (p.hp < this.hpAtSleep - 0.5 || !this.home || !P.ch)) { this.wake(); }   // hurt, moved, or interrupted
      if (this.sleeping) this.hpAtSleep = p.hp;
      if (this.home) {
        if (p.hp < max) { this.acc += dt * HOME_PER_SEC * (this.sleeping ? SLEEP_FACTOR : 1); if (this.acc >= 1) { this.acc -= 1; p.heal(1); } } else this.acc = 0;
      } else {
        this.acc += dt * DRAIN_PER_SEC;
        if (this.acc >= 1) { this.acc -= 1; if (p.hp > this.floor) p.hurt(1); }   // hunger and cold wear you down to a bare minimum, never to death
      }
      if (this.weak && !this.warned) { this.warned = true; g_toast(this.g); }
      else if (this.warned && p.hp > max * 0.5) this.warned = false;
    }
    dispose() { this.veil.remove(); }
  }
  const g_toast = (g) => g.cui.toast('You are getting weak. Eat something, or rest in your house.');

  K.Vitals = Vitals;
})(typeof window !== 'undefined' ? window : globalThis);
