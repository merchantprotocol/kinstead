/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · weather. Clear, flurries or a blizzard. On a server the weather is the server's (everyone sees the same
   sky at the same time); alone, it follows the same rule from your own clock. Flurries and blizzards drift snow past
   the camera, shrink how far you can see, and make the cold outside bite harder, so you want to be indoors.
     Weather   the current kind, the falling snow, and what it does to sight and strength */
(function (G) {
  const K = G.K, THREE = G.THREE;
  /** the same rule as the server's: the weather for a period number */
  const weatherFor = (period, seed) => { let h = (period * 2654435761 + seed) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; const r = (h % 1000) / 1000; return r < 0.5 ? 'clear' : r < 0.8 ? 'flurries' : 'blizzard'; };
  const KINDS = {
    clear: { fog: 1, chill: 1, flakes: 0, fall: 0, wind: 0, say: 'The sky clears.' },
    flurries: { fog: 0.75, chill: 1.3, flakes: 600, fall: 1.7, wind: 0.8, say: 'Flurries drift in. It is colder out there.' },
    blizzard: { fog: 0.45, chill: 2, flakes: 2000, fall: 3.2, wind: 5, say: 'A blizzard! You can barely see. Get indoors.' },
  };
  const SPAN = { x: 36, y: 16, z: 36 };

  class Weather {
    constructor(game) {
      this.g = game; this.kind = 'clear'; this.period = -1; this.seed = 7; this.epoch = Date.now(); this.first = true;
      const N = 2000; this.pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { this.pos[i * 3] = Math.random() * SPAN.x; this.pos[i * 3 + 1] = Math.random() * SPAN.y; this.pos[i * 3 + 2] = Math.random() * SPAN.z; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setDrawRange(0, 0);
      this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.85, depthWrite: false })); this.points.frustumCulled = false; game.group.add(this.points);
    }
    get spec() { return KINDS[this.kind]; }
    get fogScale() { return this.spec.fog; }
    get chill() { return this.spec.chill; }
    /** the server's word (or null: follow the local clock) */
    setFromServer(w) { this.server = w; this.set(w.kind); }
    set(kind) { if (!KINDS[kind] || kind === this.kind) { this.first = false; return; } const was = this.kind; this.kind = kind; if (!this.first) this.g.cui.toast(KINDS[kind].say); this.first = false; this.points.geometry.setDrawRange(0, this.spec.flakes); void was; }
    update(dt) {
      if (!this.g.mp) { const p = Math.floor((Date.now() - this.epoch) / 1000 / 150); if (p !== this.period) { this.period = p; this.set(weatherFor(p, this.seed)); } }
      const n = this.spec.flakes; if (!n) return; const me = this.g.play.me, a = this.points.geometry.attributes.position.array, s = this.spec, t = this.g.play.t;
      for (let i = 0; i < n; i++) {
        let x = this.pos[i * 3] + s.wind * dt, y = this.pos[i * 3 + 1] - s.fall * dt, z = this.pos[i * 3 + 2] + s.wind * 0.3 * dt;
        if (y < 0) y += SPAN.y; if (x > SPAN.x) x -= SPAN.x; if (z > SPAN.z) z -= SPAN.z;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        a[i * 3] = me.x - SPAN.x / 2 + x + Math.sin(t + i) * 0.15; a[i * 3 + 1] = (me.y || 0) + y - 2; a[i * 3 + 2] = me.z - SPAN.z / 2 + z;
      }
      this.points.geometry.attributes.position.needsUpdate = true;
    }
    dispose() { this.g.group.remove(this.points); this.points.geometry.dispose(); this.points.material.dispose(); }
  }

  Object.assign(K, { Weather, weatherFor });
})(typeof window !== 'undefined' ? window : globalThis);
