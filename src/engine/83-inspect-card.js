/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · InspectCard: the card shown when you inspect a castle entity ({ title, sub, body, rows }). */
(function (G) {
  const K = G.K;

  class InspectCard {
    static BY_TYPE = { c_piece: 'pieceCard', c_barrel: 'barrelCard', c_keep: 'keepCard', c_ruin: 'ruinCard', c_site: 'siteCard', c_kin: 'kinCard' };

    constructor(game) { this.g = game; }
    get c() { return this.g.castle; }
    inspect(e) {
      const method = InspectCard.BY_TYPE[e.type];
      if (method) return this[method](e);
      return this.g.nodeSpec(e) ? this.nodeCard(e) : { title: e.name, body: '' };
    }
    pieceCard(e) {
      const g = this.g, c = this.c, p = e.piece, d = g.data.piece(p.type), pr = c.producesOf(p), rows = [['Level', p.level]];
      if (pr) rows.push(['Makes', Object.entries(pr).map(([r, n]) => `+${n} ${K.CastleData.resName(r)}/min`).join(', ')]);
      if (c.isFrosted(p)) rows.push(['State', 'FROSTED (no production)']);
      else if (pr && c.isFull(p)) rows.push(['State', 'FULL: build a Storehouse or spend']);
      if (d.category === 'defense') rows.push(['HP', `${Math.ceil(p.hp)} / ${g.pieceHpMax(p)}`]);
      return { title: d.name, sub: d.category, body: d.effect, rows };
    }
    barrelCard(e) { return { title: e.name, sub: 'Outside your home', body: 'Your stores. A raider can walk off with some of it.', rows: [] }; }
    keepCard() {
      const c = this.c, raid = this.g.raid;
      const lit = 'Your castle’s heart. Raiders walk at it. Its workbench forges the Stoneblade.';
      const body = c.lit ? lit : 'Cold and roofless. Your ember lantern could light its hearth.';
      const hp = raid ? `${Math.ceil(raid.keepHp)} / ${c.keepHpMax()}` : c.keepHpMax();
      return { title: 'The Keep', sub: `Castle Level ${c.cl()}`, body, rows: [['Keep HP', hp], ['Glow', c.glowRadius() + ' m']] };
    }
    ruinCard(e) {
      const cost = K.CostText.format(this.c.buildCost(e.ruinType, { ruin: true }));
      return { title: e.name, sub: 'Ruin', body: this.g.data.piece(e.ruinType).effect, rows: [['Repair', cost]] };
    }
    siteCard() {
      const body = 'Rust-red rock: the one place an Iron mine can stand. It is outside the walls, so raiders can frost it.';
      return { title: 'Iron outcrop', sub: 'Iron Hills', body, rows: [] };
    }
    kinCard(e) {
      const h = this.g.data.hero(e.kinId);
      return { title: h.name, sub: h.role, body: this.c.kin.has(e.kinId) ? h.perk : h.found + '. Joins when ' + h.joinsWhen + '.', rows: [] };
    }
    nodeCard(e) {
      const n = this.g.nodeSpec(e), st = this.g.play.nodeState(e);
      const yields = Object.entries(n.yields).map(([r, v]) => v + ' ' + r).join(', ');
      const left = st.charges > 0 ? `${st.charges} / ${st.max}` : 'spent';
      return { title: e.name, sub: 'Resource', body: `Yields ${yields} per action (+${this.c.row().gatherBonus} from Castle Level).`, rows: [['Left', left]] };
    }
  }

  K.InspectCard = InspectCard;
})(typeof window !== 'undefined' ? window : globalThis);
