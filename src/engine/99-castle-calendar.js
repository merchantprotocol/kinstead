/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · the calendar. Day turns to night and back, forever, and the days are counted. It wraps the
   existing DayCycle (which only knows one run of phases) and loops it, so the rest of the game just asks
   "what day is it, is it night, is the sun going down?" and listens for events:
     'warn'  the sun is going down (30 s before night)     'dusk'  night begins     'dawn'  a new day */
(function (G) {
  const K = G.K;

  class Calendar {
    /** the survival game's own cycle: a day and a night, forever (the campaign's five-phase cycle is left alone) */
    static PHASES = [{ id: 'day', kind: 'day', sec: 210 }, { id: 'night', kind: 'night', sec: 100 }];
    constructor(game) { this.g = game; this.n = 1; this.listeners = []; }
    get cycle() { return this.g.day; }
    get isNight() { return this.cycle.isNight; }
    /** the last stretch of daylight */
    get sunsetting() { return !this.isNight && !!this.cycle.warned; }
    /** how far through the night it is, 0..1 (0 by day) */
    get nightProgress() { return this.isNight ? Math.min(1, this.cycle.t / Math.max(1, this.cycle.length() || 1)) : 0; }
    on(fn) { this.listeners.push(fn); return this; }
    emit(ev) { for (const fn of this.listeners) fn(ev, this); }
    /** with a server, the clock is the server's: phase, time into it, and the day number come from `this.sync()` */
    updateSynced() {
      const [idx, t, n] = this.sync(), c = this.cycle;
      if (idx !== c.idx) { c.idx = idx; c.warned = false; if (!this.synced) { /* joining: no event */ } else if (idx === 1) this.emit({ type: 'dusk', phase: c.phase }); else { this.n = n; this.emit({ type: 'dawn', phase: c.phase }); } }
      c.t = t; this.n = n; this.synced = true;
      if (idx === 0 && !c.warned && Calendar.PHASES[0].sec - t <= 30) { c.warned = true; this.emit({ type: 'warn', phase: c.phases[1] }); }
    }
    update(dt) {
      if (this.sync) { this.updateSynced(); return; }
      for (let ev of this.cycle.tick(dt)) {
        if (ev.type === 'end') { const c = this.cycle; c.idx = 0; c.t = 0; c.warned = false; c.override = null; this.n++; ev = { type: 'dawn', phase: c.phase }; }   // night is over: loop
        this.emit(ev);
      }
    }
  }

  K.Calendar = Calendar;
})(typeof window !== 'undefined' ? window : globalThis);
