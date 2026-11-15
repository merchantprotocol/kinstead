/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;
  class BuildingMaterialSection {
    constructor(game) { this.g = game;
       this.c = game.castle;
      }
    render(id) {
      const definition = this.c.data;
      const name = K.CastleData.resName(id);
      const producers = this.producers(definition, id);
      const nodes = this.nodes(definition, id);
      const uses = this.uses(definition, id);
      const body = this.body(id, producers, nodes, uses);
      return { title: name, icon: K.CastleUI.ICON[id], body };
    }
    producers(data, id) {
      return data.pieceIds().map((type) => data.piece(type))
        .filter((piece) => piece && piece.produces && piece.produces[id])
        .map((piece) => `${piece.name}: +${piece.produces[id]}/min`);
    }
    nodes(data, id) {
      return ['tree', 'boulder', 'rubble', 'iron_rock'].map((kind) => data.node(kind))
        .filter((node) => node && node.yields && node.yields[id])
        .map((node) => `${node.name || id}: ${Object.values(node.yields).find(Boolean)} per gather`);
    }
    uses(data, id) {
      return data.pieceIds().flatMap((type) => {
        const cost = this.c.buildCost(type);
        return cost[id] ? [`${data.piece(type).name}: ${cost[id]} to build`] : [];
      });
    }
    body(id, producers, nodes, uses) {
      const caps = this.c.caps();
      const get = [...nodes, ...producers].join(' · ') || 'No direct source is defined in the game data.';
      const usedFor = uses.join(' · ') || 'No building costs list this material.';
      const special = id === 'troll_heart'
        ? '<p>Defeat the Rime Troll to earn its heart; bind it at the Keep to raise the hearth and unlock the next thaw.</p>'
        : '';
      const materials = [...new Set([...K.CastleUI.RES_ORDER, 'troll_heart'])];
      const buttons = materials.map((resource) =>
        `<button data-material="${resource}">${K.PanelText.escape(K.CastleData.resName(resource))}</button>`
      ).join('');
      return `<div class="ci-row"><span>In storage</span><b>${this.c.amount(id)} / ${caps[id] == null ? '—' : caps[id]}</b></div>` +
        `<h3>How to get more</h3><p>${K.PanelText.escape(get)}</p>${special}` +
        `<h3>Used for</h3><p>${K.PanelText.escape(usedFor)}</p><nav>${buttons}</nav>`;
    }
  }
  K.BuildingMaterialSection = BuildingMaterialSection;
})(typeof window !== 'undefined' ? window : globalThis);
