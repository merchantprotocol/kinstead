/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · Keeper: the person who runs a workshop or farm building (farmer, cowherd, woodcutter, quarryman, miller,
   archer). Only trades that need a person get one: the hens keep the coop themselves and the silo is a grain bin, so
   neither has a keeper (their carts are pulled by the clerk). They live by their building and tell you how it is going;
   what they do all day is their trade's routine (KeeperRoutines). */
(function (G) {
  const K = G.K, TILE = K.TILE;

  class Keeper extends K.WorkerJob {
    static get WHO() {
      return {
        farm: { name: 'Farmer', sprite: 'ranger', tint: 0xe8d090 },
        barn: { name: 'Cowherd', sprite: 'warden', tint: 0xd0b080 }, woodcutter: { name: 'Woodcutter', sprite: 'ranger', tint: 0x9ac080 },
        quarry: { name: 'Quarryman', sprite: 'warden', tint: 0xc0b8a8 }, storehouse: { name: 'Miller', sprite: 'warden', tint: 0xb0c8a0 },
        watchtower: { name: 'Archer', sprite: 'ranger', tint: 0xc8e0ff },
      };
    }
    static runs(type) { return !!Keeper.WHO[type]; }
    constructor(w, p) {
      const k = Keeper.WHO[p.type], look = (K.WORKER_LOOKS || {})[k.name];
      super(w, { role: 'keep' + p.uid, sprite: look ? look.sprite : k.sprite, name: k.name, tint: look ? look.tint : k.tint, speed: 1.2 });
      this.p = p; this.wanderT = Math.random() * 3;
    }
    get post() {
      const p = this.p, [, d] = K.CastleArt.size(p.type), r = p.rot || 0, o = d / 2 + 0.9;
      return { x: p.x + Math.sin(r) * o + Math.cos(r) * 0.6, z: p.z + Math.cos(r) * o - Math.sin(r) * 0.6 };
    }
    update() { if (!this.a) { const at = this.post; if (this.g.play.nav.standable(at.x, at.z)) this.spawn(at); } }
    /** the part of this building's model that turns while someone works it (the millstone), if any */
    get spinner() { const m = this.g.meshes && this.g.meshes.get('p' + this.p.uid); return m && m.userData.spin ? m.userData.spin : null; }
    idle(e, dt) { if ((this.wanderT -= dt) > 0) return; this.wanderT = 0.5; this.w.routines.run(this, e); }
    report() {
      const g = this.g, p = this.p, c = g.castle, e = g.economy, l = e.ledger(p);
      const held = Object.entries(p.held || {}).filter(([, n]) => n >= 1).map(([r, n]) => `${Math.floor(n)} ${K.CastleData.resName(r)}`);
      const full = held.length ?
          `Your purse and storehouses are full, so I have ${held.join(', ')} stacked here. Build a storehouse and I will send it over.` : null;
      switch (p.type) {
        case 'farm': {
          const f = [...e.fields.tiles.values()].filter((t) => e.nearestFarm((t.i + 0.5) * TILE, (t.j + 0.5) * TILE) === p),
              ripe = f.filter((t) => e.fields.stage(t) === 2).length;
          return [f.length ? `I tend ${f.length} squares of wheat. ${ripe} are golden now.` :
              'I have no fields. Pick Wheat field in the drawer and draw squares around me.',
            `${l.amount('wheat')} wheat is waiting in the barn. A cart takes it to the silo every 10.`, 'The bigger the field, the more wheat.'];
        }
        case 'barn': {
          const h = e.stock.herd(p), hungry = h.filter((b) => !b.fed).length;
          return [h.length ? `${h.length} cows.` : 'No cows yet. Buy them here for 10 wheat each.',
            hungry ? `${hungry} are hungry. They need wheat in the silo or the market.` : (h.length ? 'They are fed and giving milk.' : ''),
                `${l.amount('milk')} milk and ${l.amount('beef')} beef here.`].filter(Boolean);
        }
        case 'woodcutter': case 'quarry': {
          const pr = c.producesOf(p) || {}, [r, n] = Object.entries(pr)[0] || ['wood', 0];
          return [`We cut ${n} ${K.CastleData.resName(r)} a minute${p.level >= 2 ? ' (upgraded)' : ''}.`,
              full || `It all goes straight to your stores. You hold ${c.amount(r)} of ${c.caps()[r]}.`];
        }
        case 'storehouse': {
          const caps = c.caps();
          return [`With your storehouses you can hold ${caps.wood} wood, ${caps.stone} stone, ${caps.iron} iron and ${caps.gold} gold.`,
            `Right now: ${c.amount('wood')} wood, ${c.amount('stone')} stone, ${c.amount('iron')} iron.`,
                'Another storehouse holds even more, and raiders take less.'];
        }
        case 'watchtower': return ['I shoot anything hostile within 12 m of this tower.', 'Keep the tower inside your walls and it covers the gate.'];
      }
      return ['All is well.'];
    }
  }

  K.Keeper = Keeper;
})(typeof window !== 'undefined' ? window : globalThis);
