/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* BuildingStatusSection: "How it's doing": owner, health, level, condition, production, worker and payback. */
(function (G) {
  const K = G.K;

  class BuildingStatusSection {
    constructor(game) {
      this.g = game;
      this.c = game.castle;
    }

    render(piece, remote, production) {
      const row = K.PanelText.row;
      const hpMax = this.g.pieceHpMax(piece);
      const hp = Number.isFinite(piece.hp) ? Math.ceil(piece.hp) : hpMax;
      const rows = [
        row('Owner', this.ownerText(piece, remote)),
        row('Health', `${hp} / ${hpMax}`),
        row('Level', piece.level || 1),
        row('Condition', remote ? 'Other player’s building' : this.condition(piece, production)),
      ];
      if (!remote) rows.push(...this.roleRows(piece));
      if (production) rows.push(row('Producing', this.productionText(production)));
      if (!remote) rows.push(...this.ownerOnlyRows(piece));
      return `<h3>How it’s doing</h3>${rows.join('')}`;
    }

    ownerText(piece, remote) {
      if (!remote) return 'You';
      const mp = this.g.mp;
      const owners = mp && mp.world && mp.world.owners;
      const name = (owners && owners[piece.owner]) || 'Another player';
      const team = mp ? mp.teamId(piece.owner) : null;
      const suffix = team != null ? ` · Team ${K.PanelText.escape(team)}` : '';
      return K.PanelText.escape(name) + suffix;
    }

    /** a gatekeeper tower and the gate it keeps */
    roleRows(piece) {
      const row = K.PanelText.row;
      const rows = [];
      if (piece.gatekeeper) rows.push(row('Archer', 'Gatekeeper'));
      if (piece.keeperGate) {
        const gateName = K.PanelText.escape(this.g.data.piece(piece.keeperGate.type).name);
        rows.push(row('Role', `Gatekeeper · ${gateName}`));
      }
      return rows;
    }

    /** rows only the owner sees: the worker's report and upgrade payback */
    ownerOnlyRows(piece) {
      const row = K.PanelText.row;
      const rows = [];
      const report = this.workerReport(piece);
      if (report) rows.push(row('Worker', K.PanelText.escape(report)));
      const payback = this.c.upgradePayback(piece);
      if (payback != null) rows.push(row('Upgrade payback', `${payback.toFixed(1)} min`));
      return rows;
    }

    workerReport(piece) {
      if (!this.g.workers) return null;
      const job = this.g.workers.jobs.find((item) => item.p === piece);
      return job && job.report ? job.report().join(' ') : null;
    }

    condition(piece, production) {
      if (this.c.isFrosted(piece)) return 'Frosted — production stopped';
      if (this.c.isFull(piece)) return 'Full';
      return production ? 'Working' : 'Idle';
    }

    productionText(production) {
      return Object.entries(production).map(([res, n]) => `+${n} ${K.CastleData.resName(res)}/min`).join(', ');
    }
  }

  K.BuildingStatusSection = BuildingStatusSection;
})(typeof window !== 'undefined' ? window : globalThis);
