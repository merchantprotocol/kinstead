/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · TownNight: bedtime for the townsfolk. From the sunset warning till dawn every worker finishes what they are
   carrying, walks to the bunkhouse and goes in (hidden: they are asleep in the bunks); with no bunkhouse they sleep in your
   cottage; with neither they huddle round the Keep's fire till morning. At dawn they come out of the door a moment apart. */
(function (G) {
  const K = G.K, TILE = K.TILE;

  class TownNight {
    constructor(workers) { this.w = workers; this.g = workers.g; }
    /** evening till dawn (from the sunset warning, so they are indoors before the wolves come) */
    get bedtime() { const g = this.g; return !!(g.isNightish && g.isNightish()); }
    /** where this worker sleeps */
    bed(job) {
      const g = this.g, bh = g.halls && g.halls.bunkhouse, n = Math.max(0, this.w.jobs.indexOf(job));
      if (bh) return { door: K.WorkSpots.door(bh.spec), inside: this.bunk(bh.spec, n), kind: 'bunkhouse' };
      if (g.home && g.home.built) return { door: g.home.doorPoint, inside: g.home.center, kind: 'cottage' };
      const k = g.L.keep, ang = n * 0.9 + 1.2, r = (k.r || 2.3) + 1.6;
      return { fire: true, x: k.x + Math.cos(ang) * r, z: k.z + Math.sin(ang) * r, face: { x: k.x, z: k.z }, kind: 'fire' };
    }
    /** a spot on the bunk-room floor, spread out by worker */
    bunk(spec, n) {
      const fw = spec.footprint.w, fh = spec.footprint.h, i = n % 4, j = Math.floor(n / 4) % 2;
      const p = { x: (spec.x + fw * (0.25 + 0.17 * i)) * TILE, z: (spec.z + fh * (0.4 + 0.2 * j)) * TILE };
      return this.g.play.nav.standable(p.x, p.z) ? p : K.WorkSpots.inside(spec);
    }
    /** walk to bed and turn in (or keep warm by the fire) */
    turnIn(job, e) {
      if (job.asleep) return;
      if (job.huddled) { e.work(4, 'warm', job.huddled.face); return; }
      const bed = this.bed(job);
      if (bed.fire) { e.go(bed.x, bed.z).then(() => { job.huddled = bed; }).work(4, 'warm', bed.face); return; }
      e.go(bed.door.x, bed.door.z).go(bed.inside.x, bed.inside.z).then(() => { job.asleep = true; job.show(false); job.sleptAt = bed; });
    }
    /** morning: out of the door and back to work */
    wake(job, e) {
      const b = job.sleptAt; job.asleep = false; job.huddled = null; job.sleptAt = null;
      if (!b) { job.show(true); return; }
      const a = job.a; a.x = b.inside.x; a.z = b.inside.z; a.path = null;
      const line = TownNight.MORNING[Math.floor(Math.random() * TownNight.MORNING.length)];
      e.pause(Math.random() * 4).then(() => job.show(true)).go(b.door.x, b.door.z).say(line, 2.5);
    }
  }
  TownNight.MORNING = ['Up and at it.', 'Another day.', 'Right then, to work.'];

  K.TownNight = TownNight;
})(typeof window !== 'undefined' ? window : globalThis);
