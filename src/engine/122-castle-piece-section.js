/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class BuildingPieceSection {
    constructor(game, panel) { this.g = game;
       this.c = game.castle;
       this.panel = panel;
      }
    render(entity) {
      const remote = entity.type === 'c_rpiece';
      const piece = remote ? entity.rec.p : entity.piece;
      const definition = this.g.data.piece(piece.type);
      if (!definition) return null;
      const production = remote ? null : this.c.producesOf(piece);
      const stock = remote ? {} : this.g.economy ? this.g.economy.ledger(piece).goods : {};
      const rows = this.statusRows(piece, remote, production);
      const holdings = this.holdingRows(piece, remote, stock);
      const actions = this.actionRows(entity, piece, remote, production);
      this.panel.selected = { e: entity, p: piece, remote, available: this.availableActions(entity) };
      const body = `<p>${K.PanelText.escape(definition.effect || K.CastleUI.SHORT[piece.type] || 'A castle building.')}</p>` +
        `<h3>How it’s doing</h3>${rows.join('')}<h3>What it holds</h3>` +
        `${holdings.join('') || '<p>Nothing is stored here yet.</p>'}${actions.join('')}`;
      return { title: definition.name, icon: this.g.cui.art.html(piece.type, K.CastleUI.PIECE_ICON[piece.type], 84), body };
    }
    statusRows(piece, remote, production) {
      const owners = this.g.mp && this.g.mp.world && this.g.mp.world.owners;
      const owner = remote ? owners && owners[piece.owner] || 'Another player' : 'You';
      const team = remote && this.g.mp ? this.g.mp.teamId(piece.owner) : null;
      const hpMax = this.g.pieceHpMax(piece);
      const condition = remote ? 'Other player’s building' : this.condition(piece, production);
      const rows = [
        this.row('Owner', `${K.PanelText.escape(owner)}${team != null ? ` · Team ${K.PanelText.escape(team)}` : ''}`),
        this.row('Health', `${Number.isFinite(piece.hp) ? Math.ceil(piece.hp) : hpMax} / ${hpMax}`),
        this.row('Level', piece.level || 1),
        this.row('Condition', condition)
      ];
      if (!remote && piece.gatekeeper) rows.push(this.row('Archer', 'Gatekeeper'));
      if (!remote && piece.keeperGate) rows.push(this.row('Role', `Gatekeeper · ${K.PanelText.escape(this.g.data.piece(piece.keeperGate.type).name)}`));
      if (production) rows.push(this.row('Producing', this.productionText(production)));
      if (!remote && this.g.workers) {
        const job = this.g.workers.jobs.find((item) => item.p === piece);
        if (job && job.report) rows.push(this.row('Worker', K.PanelText.escape(job.report().join(' '))));
      }
      if (!remote) {
        const payback = this.c.upgradePayback(piece);
        if (payback != null) rows.push(this.row('Upgrade payback', `${payback.toFixed(1)} min`));
      }
      return rows;
    }
    condition(piece, production) {
      if (this.c.isFrosted(piece)) return 'Frosted — production stopped';
      if (this.c.isFull(piece)) return 'Full';
      return production ? 'Working' : 'Idle';
    }
    productionText(production) {
      return Object.entries(production).map(([r, n]) => `+${n} ${K.CastleData.resName(r)}/min`).join(', ');
    }
    holdingRows(piece, remote, stock) {
      const rows = [];
      if (Object.keys(stock).length) {
        const stored = Object.entries(stock).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', ');
        rows.push(this.row('Stored', stored));
      }
      if (!remote && ['coop', 'barn'].includes(piece.type)) {
        const herd = this.g.economy.stock.herd(piece);
        const kind = piece.type === 'coop' ? 'hen' : 'cow';
        rows.push(this.row('Animals', `${herd.length} ${kind}${herd.length === 1 ? '' : 's'}`));
      }
      return rows;
    }
    actionRows(entity, piece, remote, production) {
      const actions = [];
      if (!remote) this.addUpgrade(actions, piece, production);
      if (!remote) this.addDemolition(actions, piece);
      const available = this.availableActions(entity);
      if (available.length) actions.unshift(this.options(available));
      if (!remote && ['coop', 'barn'].includes(piece.type)) actions.unshift(this.orderHtml(piece));
      return actions;
    }
    addUpgrade(actions, piece, production) {
      const upgrade = this.c.upgradeInfo(piece);
      if (!upgrade) return actions.push('<p>This building cannot be upgraded.</p>');
      const blocker = this.c.upgradeBlocker(piece);
      const cost = this.c.upgradeCost(piece);
      const missing = this.c.missing(cost);
      const benefit = upgrade.produces
        ? Object.entries(upgrade.produces).map(([r, n]) => `+${n - (production && production[r] || 0)} ${K.CastleData.resName(r)}/min`).join(', ')
        : 'Improved level benefits';
      const costs = Object.entries(cost).map(([r, n]) => {
        const poor = missing[r];
        const shortage = poor ? ` · need ${poor} more` : '';
        return `<span class="${poor ? 'poor' : 'enough'}">` +
          `${n} ${K.CastleData.resName(r)} (have ${this.c.amount(r)})${shortage}</span>`;
      }).join(' · ');
      const blocked = Object.keys(missing).length || blocker;
      actions.push(`<section class="ci-action"><h3>Upgrade</h3><p>${K.PanelText.escape(benefit)}</p><div>${costs}</div>` +
        `${blocker ? `<p>${K.PanelText.escape(blocker)}</p>` : ''}<button data-upgrade ${blocked ? 'disabled' : ''}>Upgrade</button></section>`);
    }
    addDemolition(actions, piece) {
      if (!this.c.canDemolish(piece)) return;
      const refund = Object.entries(this.c.refundFor(piece)).map(([r, n]) => `${n} ${K.CastleData.resName(r)}`).join(', ') || 'nothing';
      actions.push(
        `<section class="ci-danger"><h3>Take down</h3><p>Refund: ${K.PanelText.escape(refund)}</p>` +
        '<button data-takedown>Take down…</button></section>'
      );
    }
    availableActions(entity) {
      return this.g.actionsFor(entity).filter((action) => !['inspect', 'demolish', 'upgrade'].includes(action.id));
    }
    options(available) {
      const buttons = available.map((action) =>
        `<button data-building-action="${K.PanelText.escape(action.id)}">` +
        `${K.PanelText.escape(action.label)}</button>`
      ).join('');
      return `<section class="ci-action"><h3>Options</h3>${buttons}</section>`;
    }
    orderHtml(piece) {
      const orders = this.g.economy.stock.orders;
      const order = orders.get(piece);
      const herd = this.g.economy.stock.herd(piece);
      const kind = piece.type === 'coop' ? 'chicken' : 'cow';
      const price = K.LIVESTOCK[kind].price;
      const waiting = herd.length >= order.target ? 'Target reached' : this.g.economy.wheatHeld() < price
        ? 'Paused: not enough wheat' : `Next purchase in ${Math.max(0, Math.ceil(order.remaining))}s`;
      return `<section class="ci-action"><h3>Buy regularly</h3><p>Keep ${kind}s at ${order.target} · ${K.PanelText.escape(waiting)}</p>` +
        `<button data-order-target="${order.target - 1}" ${order.target <= 1 ? 'disabled' : ''}>−</button>` +
        `<button data-order-target="${order.target + 1}" ${order.target >= K.LIVESTOCK[kind].max ? 'disabled' : ''}>+</button>` +
        `<button data-order-toggle>${order.enabled ? 'Turn off' : 'Turn on'} · ${price} wheat each</button></section>`;
    }
    row(label, value) { return `<div class="ci-row"><span>${K.PanelText.escape(label)}</span><b>${value}</b></div>`;
      }
  }
  K.BuildingPieceSection = BuildingPieceSection;
})(typeof window !== 'undefined' ? window : globalThis);
