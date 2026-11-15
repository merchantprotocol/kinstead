/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · CastleInteractionTypes: registers every castle entity type (the Keep, pieces, barrels, kin, resource nodes...)
   with the interaction registry. Actions and the inspect card come from the running CastleGame (play.ext). */
(function (G) {
  const K = G.K;

  class CastleInteractionTypes {
    /* colour and cursor of each clickable castle entity */
    static ENTITIES = {
      c_keep: [0xffc070, 'hand'], c_ruin: [0xffd27a, 'hammer'], c_site: [0xffd27a, 'pickaxe'], c_piece: [0x9fd8ff, 'hand'],
      c_rpiece: [0xffb4a0, 'hand'], c_rstore: [0xffd27a, 'hand'], c_rdoor: [0xffb4a0, 'hand'], c_barrel: [0xffd27a, 'hand'],
      c_door: [0xffd27a, 'hand'], c_rack: [0xffd27a, 'hand'], c_kin: [0x8fe0a0, 'bubble'], c_worker: [0xffe0a0, 'bubble'],
    };
    /* resource nodes: entity type -> [verb, cursor, harvest node id, endless (never regrows)] */
    static NODES = {
      c_tree: ['Chop', 'axe', 'tree', false],
      c_boulder: ['Break', 'pickaxe', 'boulder', false],
      c_rubble: ['Clear', 'hand', 'rubble', true],
      c_iron: ['Mine', 'pickaxe', 'iron_rock', false],
    };

    constructor(registry, data) { this.reg = registry; this.data = data; }
    castleOf(game) { return game.ext; }
    registerAll() {
      for (const [type, [color, cursor]] of Object.entries(CastleInteractionTypes.ENTITIES)) this.reg.register(type, this.entitySpec(color, cursor));
      for (const [type, [verb, cursor, id, endless]] of Object.entries(CastleInteractionTypes.NODES)) {
        const n = this.data.harvestNodes.find((h) => h.id === id);
        this.reg.register(type, this.nodeSpec(verb, cursor, n.charges, endless ? 1e9 : n.respawnSec));
      }
    }
    entitySpec(color, cursor) {
      return {
        color,
        cursor: () => cursor,
        name: (e) => e.name,
        actions: (e, game) => this.castleOf(game).actionsFor(e),
        inspect: (e, game) => this.castleOf(game).inspect(e),
      };
    }
    nodeSpec(verb, cursor, charges, respawn) {
      return {
        color: 0x9fd8ff,
        cursor: (e, game) => (game.nodeState(e).charges > 0 ? cursor : 'no'),
        node: { charges, respawn },
        actions: (e) => [
          { id: 'gather', label: verb, icon: cursor, range: e.r + 0.55, run: (game, x) => this.castleOf(game).tools.engage(x) },
          { id: 'inspect', label: 'Inspect', icon: 'eye', run: (game, x) => game.inspect(x) },
        ],
        inspect: (e, game) => this.castleOf(game).inspect(e),
      };
    }
  }

  K.CastleInteractionTypes = CastleInteractionTypes;
  new CastleInteractionTypes(K.Interactions, K.CASTLE_DATA).registerAll();
})(typeof window !== 'undefined' ? window : globalThis);
