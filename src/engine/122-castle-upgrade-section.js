/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* BuildingUpgradeSection: "Upgrade": what the next level gives, what it costs, and the button. */
(function (G) {
  const K = G.K;

  class BuildingUpgradeSection {
    constructor(game, panel) {
      this.g = game;
      this.c = game.castle;
      this.panel = panel;
    }

    render(piece, remote, production) {
      if (remote) return '';
      const upgrade = this.c.upgradeInfo(piece);
      if (!upgrade) return '<p>This building cannot be upgraded.</p>';
      const blocker = this.c.upgradeBlocker(piece);
      const cost = this.c.upgradeCost(piece);
      const missing = this.c.missing(cost);
      const disabled = Object.keys(missing).length || blocker ? 'disabled' : '';
      const note = blocker ? `<p>${K.PanelText.escape(blocker)}</p>` : '';
      return `<section class="ci-action"><h3>Upgrade</h3><p>${K.PanelText.escape(this.benefit(upgrade, production))}</p>` +
        `<div>${this.costs(cost, missing)}</div>${note}<button data-upgrade ${disabled}>Upgrade</button></section>`;
    }

    benefit(upgrade, production) {
      if (!upgrade.produces) return 'Improved level benefits';
      return Object.entries(upgrade.produces)
        .map(([res, n]) => `+${n - ((production && production[res]) || 0)} ${K.CastleData.resName(res)}/min`)
        .join(', ');
    }

    costs(cost, missing) {
      return Object.entries(cost).map(([res, n]) => {
        const short = missing[res];
        const shortage = short ? ` · need ${short} more` : '';
        return `<span class="${short ? 'poor' : 'enough'}">` +
          `${n} ${K.CastleData.resName(res)} (have ${this.c.amount(res)})${shortage}</span>`;
      }).join(' · ');
    }

    handle(event, selected) {
      if (!event.target.closest('[data-upgrade]')) return false;
      if (!selected || selected.remote) return true;
      this.g.upgrade(selected.p);
      this.panel.piece(selected.e);
      return true;
    }
  }

  K.BuildingUpgradeSection = BuildingUpgradeSection;
})(typeof window !== 'undefined' ? window : globalThis);
