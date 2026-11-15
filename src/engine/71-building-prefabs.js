/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Building prefab configurations. The catalogue owns the available templates. */
(function (G) {
  class BuildingPrefabs {
    static DATA = {
    cottage: {
      name: 'Cottage', desc: 'Timber-framed thatched cottage: kitchen + bedroom',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 9 }, walls: 'timber', roof: { style: 'gable', material: 'thatch' }, interiorFloor: 'planks', wallH: 2.1,
        rooms: [{ id: 'kitchen', type: 'kitchen', x: 0, z: 0, w: 5, h: 9 }, { id: 'bed', type: 'bedroom', x: 5, z: 0, w: 7, h: 9 }],
        doors: [{ x: 2, z: 8, side: 's', w: 2 }, { x: 5, z: 5, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 8, z: 8, side: 's', w: 2 }, { x: 11, z: 4, side: 'e', w: 1 }, { x: 7, z: 0, side: 'n', w: 1 }, { x: 0, z: 6, side: 'w', w: 1 }],
        furniture: [
          { type: 'hearth', x: 0, z: 1, rot: 1 }, { type: 'pantry', x: 2, z: 0, rot: 0 }, { type: 'table', x: 2, z: 3, rot: 0 },
          { type: 'chair', x: 1, z: 4, rot: 1 }, { type: 'barrel', x: 4, z: 0 }, { type: 'sack', x: 0, z: 8 }, { type: 'sack', x: 4, z: 8 }, { type: 'shelf', x: 1, z: 7, rot: 0 },
          { type: 'bed', x: 9, z: 0, rot: 0 }, { type: 'chest', x: 9, z: 3, rot: 0 }, { type: 'wardrobe', x: 6, z: 0, rot: 0 }, { type: 'rug', x: 6, z: 4, rot: 0 },
          { type: 'bookshelf', x: 11, z: 5, rot: 3 }, { type: 'candle', x: 8, z: 0 }, { type: 'chair', x: 10, z: 7, rot: 2 },
        ],
      }),
    },
    smithy: {
      name: 'Smithy', desc: 'Stone forge workshop with a storage room',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 9 }, walls: 'stone', roof: { style: 'gable', material: 'slate' }, interiorFloor: 'flagstone', wallH: 2.2,
        rooms: [{ id: 'forge', type: 'smithy', x: 0, z: 0, w: 8, h: 9 }, { id: 'store', type: 'storage', x: 8, z: 0, w: 4, h: 9 }],
        doors: [{ x: 3, z: 8, side: 's', w: 2 }, { x: 8, z: 4, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 6, z: 8, side: 's', w: 1 }, { x: 0, z: 5, side: 'w', w: 1 }, { x: 11, z: 3, side: 'e', w: 1 }, { x: 5, z: 0, side: 'n', w: 1 }],
        furniture: [
          { type: 'forge', x: 1, z: 0, rot: 0 }, { type: 'anvil', x: 2, z: 3 }, { type: 'grindstone', x: 6, z: 1 }, { type: 'workbench', x: 4, z: 0, rot: 0 },
          { type: 'weapon_rack', x: 0, z: 6, rot: 1 }, { type: 'barrel', x: 6, z: 7 }, { type: 'sack', x: 7, z: 7 },
          { type: 'chest', x: 10, z: 0, rot: 0 }, { type: 'shelf', x: 8, z: 0, rot: 0 }, { type: 'barrel', x: 11, z: 7 }, { type: 'barrel', x: 10, z: 7 },
          { type: 'sack', x: 11, z: 5 }, { type: 'crate', x: 8, z: 7 }, { type: 'armor_stand', x: 11, z: 2 },
          { type: 'quench_tub', x: 1, z: 3 }, { type: 'shield_rack', x: 0, z: 4, rot: 1 }, { type: 'weapon_rack', x: 7, z: 2, rot: 3 }, { type: 'material_pile', x: 9, z: 3, state: { kind: 'ore' } },
        ],
      }),
    },
    stable: {
      name: 'Stable', desc: 'Timber stable with three stalls and a tack room',
      make: () => ({
        footprint: { shape: 'rect', w: 14, h: 10 }, walls: 'timber', roof: { style: 'gable', material: 'shingle' }, interiorFloor: 'straw', wallH: 2.3,
        rooms: [{ id: 'stalls', type: 'stable', x: 0, z: 0, w: 10, h: 10 }, { id: 'tack', type: 'tack', x: 10, z: 0, w: 4, h: 10 }],
        doors: [{ x: 4, z: 9, side: 's', w: 2 }, { x: 10, z: 6, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 1, z: 9, side: 's', w: 2 }, { x: 7, z: 9, side: 's', w: 2 }, { x: 13, z: 4, side: 'e', w: 1 }, { x: 0, z: 6, side: 'w', w: 1 }],
        furniture: [
          { type: 'stall', x: 0, z: 0, rot: 0 }, { type: 'stall', x: 3, z: 0, rot: 0 }, { type: 'stall', x: 6, z: 0, rot: 0 },
          { type: 'horse', x: 1, z: 0, rot: 0, state: { horseId: 'bramble', coat: 'bay' } }, { type: 'horse', x: 7, z: 0, rot: 0, state: { horseId: 'ash', coat: 'grey' } },
          { type: 'trough', x: 4, z: 5, rot: 0 }, { type: 'hay_bale', x: 0, z: 8 }, { type: 'hay_bale', x: 9, z: 8 }, { type: 'hay_bale', x: 9, z: 7 },
          { type: 'tack_rack', x: 11, z: 0, rot: 0 }, { type: 'chest', x: 12, z: 9, rot: 2 }, { type: 'barrel', x: 13, z: 0 }, { type: 'bench', x: 13, z: 7, rot: 3 },
        ],
      }),
    },
    market_hall: {
      name: 'Market hall', desc: 'A big painted market hall in four sections: wheat and bread, meat and eggs, weapons, raw materials',
      make: () => ({
        footprint: { shape: 'rect', w: 20, h: 14 }, walls: 'plaster', roof: { style: 'gable', material: 'tiles' }, interiorFloor: 'planks', wallH: 2.4,
        rooms: [{ id: 'grain', type: 'storage', name: 'Wheat & bread', x: 0, z: 0, w: 10, h: 6 }, { id: 'meat', type: 'kitchen', name: 'Meat & eggs', floor: 'flagstone', x: 10, z: 0, w: 10, h: 6 }, { id: 'arms', type: 'armory', name: 'Weapons', x: 0, z: 6, w: 10, h: 8 }, { id: 'goods', type: 'storage', name: 'Raw materials', floor: 'flagstone', x: 10, z: 6, w: 10, h: 8 }],
        doors: [{ x: 4, z: 13, side: 's', w: 2 }, { x: 14, z: 13, side: 's', w: 2 }, { x: 4, z: 6, side: 'n', w: 2, kind: 'interior' }, { x: 14, z: 6, side: 'n', w: 2, kind: 'interior' }, { x: 10, z: 9, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 1, z: 13, side: 's', w: 2 }, { x: 8, z: 13, side: 's', w: 1 }, { x: 17, z: 13, side: 's', w: 2 }, { x: 0, z: 3, side: 'w', w: 1 }, { x: 0, z: 10, side: 'w', w: 1 }, { x: 19, z: 3, side: 'e', w: 1 }, { x: 19, z: 10, side: 'e', w: 1 }, { x: 7, z: 0, side: 'n', w: 1 }, { x: 13, z: 0, side: 'n', w: 1 }],
        furniture: [
          // wheat & bread
          { type: 'wheat_sheaf', x: 0, z: 0 }, { type: 'wheat_sheaf', x: 1, z: 0 }, { type: 'wheat_sheaf', x: 0, z: 1 }, { type: 'bread_rack', x: 2, z: 0, rot: 0 }, { type: 'bread_rack', x: 4, z: 0, rot: 0 },
          { type: 'flour_sack', x: 0, z: 4 }, { type: 'flour_sack', x: 0, z: 5 }, { type: 'flour_sack', x: 1, z: 5 }, { type: 'hay_bale', x: 8, z: 0 }, { type: 'hay_bale', x: 9, z: 0 }, { type: 'wheat_sheaf', x: 9, z: 1 },
          { type: 'counter', x: 2, z: 3, rot: 0, state: { goods: 'bread' } }, { type: 'counter', x: 6, z: 3, rot: 0, state: { goods: 'wheat' } }, { type: 'hanging_sign', x: 3, z: 2, state: { icon: 'bread' } }, { type: 'hanging_sign', x: 7, z: 2, state: { icon: 'wheat' } },
          // meat & eggs
          { type: 'meat_hooks', x: 11, z: 0, rot: 0 }, { type: 'meat_hooks', x: 13, z: 0, rot: 0 }, { type: 'chopping_block', x: 15, z: 0 }, { type: 'egg_basket', x: 18, z: 0 }, { type: 'egg_basket', x: 19, z: 0 }, { type: 'egg_basket', x: 19, z: 1 }, { type: 'barrel', x: 10, z: 0 },
          { type: 'counter', x: 11, z: 3, rot: 0, state: { goods: 'meat' } }, { type: 'counter', x: 16, z: 3, rot: 0, state: { goods: 'eggs' } }, { type: 'hanging_sign', x: 12, z: 2, state: { icon: 'ham' } }, { type: 'hanging_sign', x: 17, z: 2, state: { icon: 'egg' } },
          // weapons
          { type: 'weapon_rack', x: 0, z: 7, rot: 1 }, { type: 'weapon_rack', x: 0, z: 11, rot: 1 }, { type: 'shield_rack', x: 1, z: 6, rot: 0 }, { type: 'shield_rack', x: 7, z: 6, rot: 0 }, { type: 'armor_stand', x: 3, z: 8 }, { type: 'armor_stand', x: 6, z: 8 },
          { type: 'counter', x: 3, z: 10, rot: 0, state: { goods: 'weapons' } }, { type: 'grindstone', x: 8, z: 9 }, { type: 'chest', x: 8, z: 12, rot: 2 }, { type: 'hanging_sign', x: 4, z: 9, state: { icon: 'sword' } }, { type: 'rug', x: 2, z: 11, rot: 0, state: { color: 'red' } },
          // raw materials
          { type: 'material_pile', x: 18, z: 7, rot: 3, state: { kind: 'wood' } }, { type: 'material_pile', x: 18, z: 9, rot: 3, state: { kind: 'stone' } }, { type: 'material_pile', x: 18, z: 11, rot: 3, state: { kind: 'ore' } },
          { type: 'crate', x: 11, z: 7 }, { type: 'crate', x: 12, z: 7 }, { type: 'barrel', x: 11, z: 8 }, { type: 'counter', x: 12, z: 10, rot: 0, state: { goods: 'ore' } }, { type: 'sack', x: 11, z: 12 }, { type: 'crate', x: 12, z: 12 }, { type: 'hanging_sign', x: 13, z: 9, state: { icon: 'logs' } },
        ],
      }),
    },
    bakery: {
      name: 'Bakery', desc: 'Whitewashed bakery with an orange tile roof: bread ovens, flour, a shop with bread racks',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 9 }, walls: 'timber', roof: { style: 'gable', material: 'tiles' }, interiorFloor: 'planks', wallH: 2.2,
        rooms: [{ id: 'bake', type: 'bakery', x: 0, z: 0, w: 7, h: 9 }, { id: 'shop', type: 'shop', name: 'Bread shop', x: 7, z: 0, w: 5, h: 9 }],
        doors: [{ x: 8, z: 8, side: 's', w: 2 }, { x: 7, z: 4, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 2, z: 8, side: 's', w: 2 }, { x: 11, z: 8, side: 's', w: 1 }, { x: 0, z: 5, side: 'w', w: 1 }, { x: 9, z: 0, side: 'n', w: 1 }, { x: 11, z: 3, side: 'e', w: 1 }],
        furniture: [
          { type: 'oven', x: 0, z: 0, rot: 0 }, { type: 'oven', x: 3, z: 0, rot: 0 }, { type: 'barrel', x: 6, z: 0 }, { type: 'kneading_table', x: 2, z: 4, rot: 0 }, { type: 'bread_rack', x: 6, z: 6, rot: 3 },
          { type: 'flour_sack', x: 0, z: 7 }, { type: 'flour_sack', x: 0, z: 8 }, { type: 'flour_sack', x: 1, z: 8 }, { type: 'wheat_sheaf', x: 5, z: 8 }, { type: 'sack', x: 4, z: 8 },
          { type: 'bread_rack', x: 7, z: 0, rot: 0 }, { type: 'bread_rack', x: 10, z: 0, rot: 0 }, { type: 'counter', x: 8, z: 3, rot: 0, state: { goods: 'bread' } }, { type: 'hanging_sign', x: 9, z: 5, state: { icon: 'bread' } }, { type: 'bench', x: 10, z: 6, rot: 3 },
        ],
      }),
    },
    butcher: {
      name: 'Butcher', desc: 'Butcher shop with a red tile roof: hanging meat, chopping blocks and a meat counter',
      make: () => ({
        footprint: { shape: 'rect', w: 10, h: 8 }, walls: 'timber', roof: { style: 'gable', material: 'tiles' }, interiorFloor: 'flagstone', wallH: 2.2,
        rooms: [{ id: 'cut', type: 'butcher', x: 0, z: 0, w: 5, h: 8 }, { id: 'shop', type: 'shop', name: 'Meat counter', floor: 'flagstone', x: 5, z: 0, w: 5, h: 8 }],
        doors: [{ x: 6, z: 7, side: 's', w: 2 }, { x: 5, z: 3, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 2, z: 7, side: 's', w: 2 }, { x: 9, z: 3, side: 'e', w: 1 }, { x: 7, z: 0, side: 'n', w: 1 }, { x: 0, z: 4, side: 'w', w: 1 }],
        furniture: [
          { type: 'meat_hooks', x: 0, z: 0, rot: 0 }, { type: 'meat_hooks', x: 2, z: 0, rot: 0 }, { type: 'crate', x: 4, z: 0 }, { type: 'chopping_block', x: 1, z: 3 }, { type: 'chopping_block', x: 3, z: 3 },
          { type: 'barrel', x: 0, z: 6 }, { type: 'flour_sack', x: 0, z: 7 }, { type: 'barrel', x: 4, z: 7 },
          { type: 'meat_hooks', x: 5, z: 0, rot: 0 }, { type: 'meat_hooks', x: 8, z: 0, rot: 0 }, { type: 'counter', x: 6, z: 3, rot: 0, state: { goods: 'meat' } }, { type: 'egg_basket', x: 9, z: 5 }, { type: 'barrel', x: 5, z: 6 }, { type: 'hanging_sign', x: 7, z: 5, state: { icon: 'cleaver' } },
        ],
      }),
    },
    library: {
      name: 'Alchemist library', desc: 'Pale stone library with a purple roof: shelves of books, potion shelves, a bubbling cauldron',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 10 }, walls: 'stone', roof: { style: 'gable', material: 'tiles' }, interiorFloor: 'planks', wallH: 2.4,
        rooms: [{ id: 'books', type: 'library', x: 0, z: 0, w: 7, h: 10 }, { id: 'lab', type: 'lab', x: 7, z: 0, w: 5, h: 10 }],
        doors: [{ x: 3, z: 9, side: 's', w: 2 }, { x: 7, z: 5, side: 'w', w: 2, kind: 'interior' }],
        windows: [{ x: 1, z: 9, side: 's', w: 1 }, { x: 9, z: 9, side: 's', w: 2 }, { x: 0, z: 3, side: 'w', w: 1 }, { x: 0, z: 6, side: 'w', w: 1 }, { x: 6, z: 0, side: 'n', w: 1 }, { x: 11, z: 4, side: 'e', w: 1 }],
        furniture: [
          { type: 'bookshelf', x: 0, z: 0, rot: 0 }, { type: 'bookshelf', x: 2, z: 0, rot: 0 }, { type: 'bookshelf', x: 4, z: 0, rot: 0 }, { type: 'bookshelf', x: 0, z: 1, rot: 1 }, { type: 'bookshelf', x: 0, z: 4, rot: 1 }, { type: 'bookshelf', x: 0, z: 7, rot: 1 },
          { type: 'rug', x: 2, z: 4, rot: 0, state: { color: 'blue' } }, { type: 'table', x: 3, z: 4, rot: 0 }, { type: 'chair', x: 2, z: 5, rot: 1 }, { type: 'chair', x: 5, z: 4, rot: 3 }, { type: 'candle', x: 6, z: 1 },
          { type: 'book_pile', x: 5, z: 7 }, { type: 'book_pile', x: 1, z: 8 }, { type: 'globe', x: 6, z: 8 },
          { type: 'cauldron', x: 8, z: 2, rot: 0 }, { type: 'potion_shelf', x: 7, z: 0, rot: 0 }, { type: 'potion_shelf', x: 10, z: 0, rot: 0 }, { type: 'potion_shelf', x: 11, z: 6, rot: 3 },
          { type: 'alchemy_table', x: 9, z: 7, rot: 0 }, { type: 'potion_crate', x: 7, z: 9 }, { type: 'candle', x: 11, z: 2 }, { type: 'book_pile', x: 10, z: 4 },
        ],
      }),
    },
    bunkhouse: {
      name: 'Bunkhouse', desc: 'Long timber bunkhouse with a thatched roof: bunks for your workers and a stove',
      make: () => ({
        footprint: { shape: 'rect', w: 12, h: 8 }, walls: 'timber', roof: { style: 'gable', material: 'thatch' }, interiorFloor: 'planks', wallH: 2.1,
        rooms: [{ id: 'bunks', type: 'bedroom', name: 'Bunk room', x: 0, z: 0, w: 12, h: 8 }],
        doors: [{ x: 5, z: 7, side: 's', w: 2 }],
        windows: [{ x: 1, z: 7, side: 's', w: 2 }, { x: 9, z: 7, side: 's', w: 2 }, { x: 0, z: 3, side: 'w', w: 1 }, { x: 11, z: 3, side: 'e', w: 1 }, { x: 5, z: 0, side: 'n', w: 2 }],
        furniture: [
          { type: 'bunk', x: 0, z: 0, rot: 0 }, { type: 'bunk', x: 2, z: 0, rot: 0 }, { type: 'bunk', x: 8, z: 0, rot: 0 }, { type: 'bunk', x: 10, z: 0, rot: 0 },
          { type: 'bunk', x: 0, z: 4, rot: 0 }, { type: 'bunk', x: 10, z: 4, rot: 0 },
          { type: 'hearth', x: 5, z: 0, rot: 0 }, { type: 'table', x: 5, z: 3, rot: 0 }, { type: 'bench', x: 4, z: 3, rot: 1 }, { type: 'bench', x: 7, z: 3, rot: 3 },
          { type: 'chest', x: 3, z: 6, rot: 2 }, { type: 'chest', x: 8, z: 6, rot: 2 }, { type: 'candle', x: 4, z: 0 },
        ],
      }),
    },
    keep: {
      name: 'Keep', desc: 'Stone manor (L-shaped): great hall, armory, kitchen, bedroom, wardrobe room',
      make: () => ({
        footprint: { shape: 'L', w: 18, h: 16, notch: { corner: 'ne', w: 7, h: 7 } }, walls: 'stone', roof: { style: 'hip', material: 'slate' }, interiorFloor: 'flagstone', wallH: 2.6,
        rooms: [
          { id: 'hall', type: 'hall', x: 0, z: 0, w: 11, h: 7 }, { id: 'armory', type: 'armory', x: 0, z: 7, w: 6, h: 9 },
          { id: 'kitchen', type: 'kitchen', x: 6, z: 7, w: 5, h: 9 }, { id: 'bed', type: 'bedroom', x: 11, z: 7, w: 7, h: 5 }, { id: 'robes', type: 'wardrobe', x: 11, z: 12, w: 7, h: 4 },
        ],
        doors: [
          { x: 10, z: 3, side: 'e', w: 2 }, { x: 8, z: 15, side: 's', w: 2 },
          { x: 2, z: 7, side: 'n', w: 2, kind: 'interior' }, { x: 7, z: 7, side: 'n', w: 2, kind: 'interior' }, { x: 11, z: 9, side: 'w', w: 2, kind: 'interior' }, { x: 14, z: 12, side: 'n', w: 2, kind: 'interior' },
        ],
        windows: [{ x: 3, z: 0, side: 'n', w: 1 }, { x: 7, z: 0, side: 'n', w: 1 }, { x: 0, z: 3, side: 'w', w: 1 }, { x: 0, z: 11, side: 'w', w: 1 }, { x: 3, z: 15, side: 's', w: 1 }, { x: 13, z: 15, side: 's', w: 2 }, { x: 17, z: 9, side: 'e', w: 1 }, { x: 14, z: 7, side: 'n', w: 1 }],
        furniture: [
          { type: 'hearth', x: 4, z: 0, rot: 0 }, { type: 'long_table', x: 2, z: 3, rot: 0 }, { type: 'bench', x: 2, z: 2, rot: 2 }, { type: 'bench', x: 5, z: 2, rot: 2 }, { type: 'chair', x: 7, z: 3, rot: 3 },
          { type: 'banner', x: 1, z: 0, rot: 0 }, { type: 'banner', x: 9, z: 0, rot: 0 }, { type: 'rug', x: 3, z: 5, rot: 1 }, { type: 'candle', x: 0, z: 6 }, { type: 'bookshelf', x: 0, z: 1, rot: 1 },
          { type: 'weapon_rack', x: 0, z: 8, rot: 1 }, { type: 'weapon_rack', x: 0, z: 12, rot: 1 }, { type: 'armor_stand', x: 4, z: 9 }, { type: 'armor_stand', x: 4, z: 12 }, { type: 'chest', x: 2, z: 15, rot: 2 }, { type: 'grindstone', x: 3, z: 11 },
          { type: 'hearth', x: 6, z: 8, rot: 1 }, { type: 'pantry', x: 9, z: 15, rot: 2 }, { type: 'table', x: 8, z: 11, rot: 0 }, { type: 'barrel', x: 10, z: 8 }, { type: 'sack', x: 10, z: 13 },
          { type: 'bed', x: 15, z: 7, rot: 0 }, { type: 'chest', x: 15, z: 10, rot: 0 }, { type: 'candle', x: 17, z: 7 }, { type: 'rug', x: 12, z: 9, rot: 1 },
          { type: 'wardrobe', x: 16, z: 12, rot: 3 }, { type: 'wardrobe', x: 11, z: 14, rot: 1 }, { type: 'armor_stand', x: 13, z: 15 }, { type: 'shelf', x: 16, z: 15, rot: 2 },
        ],
      }),
    },
  };
    static get(key) { return this.DATA[key] || null; }
  }
  G.K.BuildingPrefabs = BuildingPrefabs;
})(typeof window !== 'undefined' ? window : globalThis);
