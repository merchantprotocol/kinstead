/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
(function (G) {
  const K = G.K;

  class CastleInteractionTypes {
    spec(color, cursor) {
      return {
        color,
        cursor: () => cursor,
        name: (entity) => entity.name,
        actions: (entity, game) => game.ext.actionsFor(entity),
        inspect: (entity, game) => game.ext.inspect(entity)
      };
    }

    node(verb, cursor, charges, respawn) {
      return {
        color: 0x9fd8ff,
        cursor: (entity, game) => game.nodeState(entity).charges > 0 ? cursor : 'no',
        node: { charges, respawn },
        actions: (entity) => [
          {
            id: 'gather', label: verb, icon: cursor, range: entity.r + 0.55,
            run: (game, target) => game.ext.tools.engage(target)
          },
          { id: 'inspect', label: 'Inspect', icon: 'eye', run: (game, target) => game.ext.inspect(target) }
        ],
        inspect: (entity, game) => game.ext.inspect(entity)
      };
    }

    harvestNode(id) {
      return K.CASTLE_DATA.harvestNodes.find((entry) => entry.id === id);
    }

    register() {
      const registry = K.Interactions;
      const types = [
        ['c_keep', 0xffc070, 'hand'], ['c_ruin', 0xffd27a, 'hammer'],
        ['c_site', 0xffd27a, 'pickaxe'], ['c_piece', 0x9fd8ff, 'hand'],
        ['c_rpiece', 0xffb4a0, 'hand'], ['c_rstore', 0xffd27a, 'hand'],
        ['c_rdoor', 0xffb4a0, 'hand'], ['c_barrel', 0xffd27a, 'hand'],
        ['c_door', 0xffd27a, 'hand'], ['c_rack', 0xffd27a, 'hand']
      ];
      for (const [type, color, cursor] of types) registry.register(type, this.spec(color, cursor));

      for (const [type, color] of [['c_kin', 0x8fe0a0], ['c_worker', 0xffe0a0]]) {
        const entry = this.spec(color, 'bubble');
        entry.name = (entity) => entity.name;
        registry.register(type, entry);
      }

      const nodes = [
        ['c_tree', 'Chop', 'axe', 'tree'],
        ['c_boulder', 'Break', 'pickaxe', 'boulder'],
        ['c_rubble', 'Clear', 'hand', 'rubble'],
        ['c_iron', 'Mine', 'pickaxe', 'iron_rock']
      ];
      for (const [type, verb, cursor, id] of nodes) {
        const data = this.harvestNode(id);
        const respawn = id === 'rubble' ? 1e9 : data.respawnSec;
        registry.register(type, this.node(verb, cursor, data.charges, respawn));
      }
    }
  }

  K.CastleInteractionTypes = CastleInteractionTypes;
})(typeof window !== 'undefined' ? window : globalThis);
