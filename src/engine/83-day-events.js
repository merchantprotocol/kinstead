/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · DayEvents: what the day brings. The sun going down and coming up, the dusk bell, Hearthbook ticks and the
   Heartfire ending. */
(function (G) {
  const K = G.K;

  class DayEvents {
    constructor(game) { this.g = game; this.prevBook = null; this.endT = null; this.endShown = false; }
    /** the looping calendar: warn, dusk and dawn */
    onCalendar(ev) {
      const g = this.g;
      if (ev.type === 'warn') { g.sound.play('horn'); g.cui.toast('The sun is going down. Get inside before the wolves come.'); }
      else if (ev.type === 'dusk') { g.sound.play('horn'); g.cui.toast(`Night ${g.calendar.n} falls. Stay inside to recover.`); }
      else if (ev.type === 'dawn') g.cui.toast(`Day ${g.calendar.n} begins.`);
    }
    /** the story day: a warning, the raid at dusk, the night settled at dawn */
    onDayEvent(ev) {
      const g = this.g;
      if (ev.type === 'warn') { g.sound.play('horn'); g.cui.warn(ev.phase); }
      else if (ev.type === 'dusk') { g.sound.play('horn'); g.startRaid(); }
      else if (ev.type === 'dawn') g.endNight(false, ev);
    }
    ringBell() {
      const ev = this.g.day.ringBell();
      if (!ev) return;
      this.g.sound.play('horn');
      this.onDayEvent(ev);
    }
    /** a Hearthbook row newly done ticks on screen */
    checkBook() {
      const hb = this.g.castle.hearthbook(), now = new Set();
      for (const s of hb.sections) for (const r of s.rows) if (r.done) now.add(s.section + ':' + r.id);
      if (this.prevBook) for (const k of now) if (!this.prevBook.has(k)) this.g.cui.bookTick(k, hb.pct);
      this.prevBook = now;
    }
    /** the troll's heart burns in the Keep: everything thaws and every zone opens */
    ending() {
      const g = this.g;
      g.thaw.thawAll(5);
      g.hearth.flare(5);
      g.sound.play('thaw');
      this.endT = 0;
      g.zones.openAll();
      g.cui.banner('Heartfire hearth · CL 5', 'The troll’s heart burns in the Keep. The glow races outward and the whole map thaws.', 'fire');
    }
    /** per frame: after the thaw, the end card */
    update(dt) {
      if (this.endT == null) return;
      this.endT += dt;
      if (this.endT <= 5.5 || this.endShown) return;
      this.endShown = true;
      this.g.cui.endCard();
      this.g.save();
    }
  }

  K.DayEvents = DayEvents;
})(typeof window !== 'undefined' ? window : globalThis);
