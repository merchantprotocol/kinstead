/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K, THREE = G.THREE;
  const { TILE, CastleArt } = K;

  class CastleGameCalendar extends K.CastleGameRaidLoop {
    addBarrier(zone, b) {
      const w = b.x1 - b.x0, d = b.z1 - b.z0, x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2, m = this.art.ice(w, 2.4, d, zone.length * 5);
      const nav = this.play.nav, prev = [];   // remember each tile's walkability: bridge decks stand on chasm terrain
      this.rectTiles(x, z, w + 0.6, d + 0.6, 0, (i, j) => { const k = j * nav.w + i; prev.push([k, nav.walk[k]]); nav.walk[k] = 0; });
      this.place(m, x, z, 0); this.barriers[zone] = { m, x, z, w, d, prev };
    }
    openBarrier(zone) {
      const b = this.barriers[zone]; if (!b) return; this.group.remove(b.m); delete this.barriers[zone];
      const nav = this.play.nav; for (const [k, v] of b.prev) if (!this.occ[k]) nav.walk[k] = v;
      this.puff(b.x, b.z); this.sound.play('crack');
      this.cui.toast(zone === 'iron_hills' ? 'Dawn: a thaw wave opens the Iron Hills (north-east). Iron rocks, an outcrop for a mine… and a figure in the ice.' : 'Dawn: the frost on the bridge breaks. The Rime Troll waits on the far side.');
    }

    /* ---------- the day ---------- */
    /* the sun going down and coming up */
    onCalendar(ev) {
      if (ev.type === 'warn') { this.sound.play('horn'); this.cui.toast('The sun is going down. Get inside before the wolves come.'); }
      else if (ev.type === 'dusk') { this.sound.play('horn'); this.cui.toast(`Night ${this.calendar.n} falls. Stay inside to recover.`); }
      else if (ev.type === 'dawn') this.cui.toast(`Day ${this.calendar.n} begins.`);
    }
    onDayEvent(ev) {
      if (ev.type === 'warn') { this.sound.play('horn'); this.cui.warn(ev.phase); }
      else if (ev.type === 'dusk') { this.sound.play('horn'); this.startRaid(); }
      else if (ev.type === 'dawn') this.endNight(false, ev);
    }
    changed() { this.dirty = true; }

    /* ---------- effects ---------- */
  }
  K.CastleGameCalendar = CastleGameCalendar;
})(typeof window !== 'undefined' ? window : globalThis);
