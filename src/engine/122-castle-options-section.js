/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* BuildingOptionsSection: "Options": the building's own actions (enter, open, feed…), as buttons. */
(function (G) {
  const K = G.K;

  class BuildingOptionsSection {
    constructor(game) {
      this.g = game;
      this.hidden = ['inspect', 'demolish', 'upgrade'];
    }

    available(entity) {
      return this.g.actionsFor(entity).filter((action) => !this.hidden.includes(action.id));
    }

    render(available) {
      if (!available.length) return '';
      const buttons = available.map((action) => {
        const id = K.PanelText.escape(action.id);
        return `<button data-building-action="${id}">${K.PanelText.escape(action.label)}</button>`;
      }).join('');
      return `<section class="ci-action"><h3>Options</h3>${buttons}</section>`;
    }

    handle(event, selected) {
      const button = event.target.closest('[data-building-action]');
      if (!button || !selected) return false;
      const action = selected.available.find((item) => item.id === button.dataset.buildingAction);
      if (action) this.g.play.doAction(selected.e, action, false);
      return true;
    }
  }

  K.BuildingOptionsSection = BuildingOptionsSection;
})(typeof window !== 'undefined' ? window : globalThis);
