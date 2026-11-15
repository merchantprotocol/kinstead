/* Copyright (c) 2026 Merchant Protocol. All rights reserved. */
/* Kinstead · building gameplay data: items, recipes per crafting station, wardrobe outfits, food values.
   Data only. Play mode reads it through K.BuildingInteractions (75-interactions.js). */
(function (G) {
  const K = G.K;

  /* item ids -> { name, kind, slot? (equipment), stack } */
  const ITEMS = {
    wood: { name: 'Wood', kind: 'material', stack: 50 },
    iron_ore: { name: 'Iron ore', kind: 'material', stack: 50 },
    coal: { name: 'Coal', kind: 'material', stack: 50 },
    hide: { name: 'Hide', kind: 'material', stack: 20 },
    leather: { name: 'Leather', kind: 'material', stack: 20 },
    iron_ingot: { name: 'Iron ingot', kind: 'material', stack: 20 },
    raw_meat: { name: 'Raw meat', kind: 'food', stack: 10 },
    raw_fish: { name: 'Raw fish', kind: 'food', stack: 10 },
    turnip: { name: 'Turnip', kind: 'food', stack: 20 },
    flour: { name: 'Flour', kind: 'material', stack: 20 },
    cooked_meat: { name: 'Roast meat', kind: 'food', stack: 10 },
    cooked_fish: { name: 'Grilled fish', kind: 'food', stack: 10 },
    stew: { name: 'Hearty stew', kind: 'food', stack: 5 },
    bread: { name: 'Bread', kind: 'food', stack: 10 },
    cheese: { name: 'Cheese', kind: 'food', stack: 10 },
    apple: { name: 'Winter apple', kind: 'food', stack: 20 },
    iron_sword: { name: 'Iron sword', kind: 'weapon', slot: 'mainHand', damage: 8, stack: 1 },
    keen_iron_sword: { name: 'Keen iron sword', kind: 'weapon', slot: 'mainHand', damage: 10, stack: 1 },
    iron_axe: { name: 'Iron axe', kind: 'weapon', slot: 'mainHand', damage: 9, stack: 1 },
    spear: { name: 'Spear', kind: 'weapon', slot: 'mainHand', damage: 7, reach: 2, stack: 1 },
    hunting_bow: { name: 'Hunting bow', kind: 'weapon', slot: 'mainHand', damage: 6, ranged: true, stack: 1 },
    pickaxe: { name: 'Pickaxe', kind: 'tool', slot: 'mainHand', stack: 1 },
    wood_axe: { name: 'Wood axe', kind: 'tool', slot: 'mainHand', stack: 1 },
    wooden_shield: { name: 'Wooden shield', kind: 'armor', slot: 'offHand', armor: 2, stack: 1 },
    iron_helmet: { name: 'Iron helmet', kind: 'armor', slot: 'head', armor: 3, stack: 1 },
    leather_armor: { name: 'Leather jerkin', kind: 'armor', slot: 'body', armor: 3, stack: 1 },
    mail_shirt: { name: 'Mail shirt', kind: 'armor', slot: 'body', armor: 5, stack: 1 },
    horseshoes: { name: 'Horseshoes', kind: 'tack', stack: 4 },
    saddle: { name: 'Saddle', kind: 'tack', stack: 1 },
    bridle: { name: 'Bridle', kind: 'tack', stack: 1 },
  };

  /* recipes: station = furniture interaction station; in/out are { itemId: count }; hours = game time used */
  const RECIPES = [
    { id: 'smelt_iron', name: 'Smelt iron ingot', station: 'forge', in: { iron_ore: 2, coal: 1 }, out: { iron_ingot: 1 }, hours: 0.5 },
    { id: 'iron_sword', name: 'Iron sword', station: 'anvil', in: { iron_ore: 2, wood: 1 }, out: { iron_sword: 1 }, hours: 1 },
    { id: 'iron_helmet', name: 'Iron helmet', station: 'anvil', in: { iron_ore: 2, hide: 1 }, out: { iron_helmet: 1 }, hours: 1 },
    { id: 'iron_axe', name: 'Iron axe', station: 'anvil', in: { iron_ingot: 1, wood: 2 }, out: { iron_axe: 1 }, hours: 1 },
    { id: 'mail_shirt', name: 'Mail shirt', station: 'anvil', in: { iron_ingot: 3, leather: 1 }, out: { mail_shirt: 1 }, hours: 2 },
    { id: 'pickaxe', name: 'Pickaxe', station: 'anvil', in: { iron_ore: 1, wood: 2 }, out: { pickaxe: 1 }, hours: 0.5 },
    { id: 'horseshoes', name: 'Horseshoes', station: 'anvil', in: { iron_ingot: 1 }, out: { horseshoes: 4 }, hours: 0.5 },
    { id: 'sharpen_sword', name: 'Sharpen sword', station: 'grindstone', in: { iron_sword: 1 }, out: { keen_iron_sword: 1 }, hours: 0.25 },
    { id: 'spear', name: 'Spear', station: 'workbench', in: { wood: 2, iron_ore: 1 }, out: { spear: 1 }, hours: 0.5 },
    { id: 'hunting_bow', name: 'Hunting bow', station: 'workbench', in: { wood: 2, hide: 1 }, out: { hunting_bow: 1 }, hours: 1 },
    { id: 'wood_axe', name: 'Wood axe', station: 'workbench', in: { wood: 2, iron_ore: 1 }, out: { wood_axe: 1 }, hours: 0.5 },
    { id: 'wooden_shield', name: 'Wooden shield', station: 'workbench', in: { wood: 3, hide: 1 }, out: { wooden_shield: 1 }, hours: 1 },
    { id: 'tan_leather', name: 'Tan leather', station: 'workbench', in: { hide: 2 }, out: { leather: 1 }, hours: 1 },
    { id: 'leather_armor', name: 'Leather jerkin', station: 'workbench', in: { leather: 3 }, out: { leather_armor: 1 }, hours: 1.5 },
    { id: 'saddle', name: 'Saddle', station: 'tack', in: { leather: 3, iron_ore: 1 }, out: { saddle: 1 }, hours: 2 },
    { id: 'bridle', name: 'Bridle', station: 'tack', in: { leather: 1 }, out: { bridle: 1 }, hours: 0.5 },
    { id: 'cooked_meat', name: 'Roast meat', station: 'hearth', in: { raw_meat: 1 }, out: { cooked_meat: 1 }, hours: 0.25 },
    { id: 'cooked_fish', name: 'Grilled fish', station: 'hearth', in: { raw_fish: 1 }, out: { cooked_fish: 1 }, hours: 0.25 },
    { id: 'stew', name: 'Hearty stew', station: 'hearth', in: { raw_meat: 1, turnip: 2 }, out: { stew: 1 }, hours: 0.5 },
    { id: 'bread', name: 'Bread', station: 'hearth', in: { flour: 2 }, out: { bread: 1 }, hours: 0.5 },
  ];

  /* food: hp restored, stamina, warmth (cold resistance minutes) */
  const FOOD = {
    raw_meat: { hp: 3, stamina: 0, warmth: 0, sick: 0.25 },
    raw_fish: { hp: 2, stamina: 0, warmth: 0, sick: 0.2 },
    turnip: { hp: 8, stamina: 4, warmth: 0 },
    apple: { hp: 8, stamina: 6, warmth: 0 },
    cheese: { hp: 12, stamina: 6, warmth: 0 },
    bread: { hp: 14, stamina: 10, warmth: 0 },
    cooked_fish: { hp: 18, stamina: 10, warmth: 5 },
    cooked_meat: { hp: 25, stamina: 12, warmth: 10 },
    stew: { hp: 40, stamina: 25, warmth: 30 },
  };

  /* wardrobe outfits: sprite = CharacterLibrary id the play mode should draw, tint = palette swap hint */
  const OUTFITS = [
    { id: 'traveler', name: "Traveler's cloak", sprite: 'warden', tint: 'red', warmth: 1, desc: 'Default wool cloak and tabard.' },
    { id: 'warden_plate', name: 'Warden plate', sprite: 'warden', tint: 'steel', warmth: 1, armor: 4, requires: { items: { mail_shirt: 1 } }, desc: 'Full plate over mail. Needs a mail shirt.' },
    { id: 'hunter', name: 'Hunter leathers', sprite: 'warden', tint: 'leather', warmth: 2, stealth: 2, desc: 'Quiet leathers for the woods.' },
    { id: 'fur_cloak', name: 'Fur cloak', sprite: 'warden', tint: 'fur', warmth: 4, desc: 'Heavy fur for blizzards.' },
    { id: 'noble', name: 'Noble garb', sprite: 'warden', tint: 'blue', warmth: 1, charm: 3, desc: 'Blue velvet for the great hall.' },
    { id: 'smith_apron', name: "Smith's apron", sprite: 'warden', tint: 'leather', warmth: 1, craftBonus: 1, desc: 'Faster smithing.' },
    { id: 'nightclothes', name: 'Nightclothes', sprite: 'warden', tint: 'linen', warmth: 0, sleepBonus: 0.25, desc: 'Sleep restores more.' },
    { id: 'rime_robes', name: 'Rime robes', sprite: 'witch', tint: 'blue', warmth: 3, desc: 'Frost-woven robes.' },
  ];

  /* starting stock for containers that have no saved state */
  const LOOT = {
    chest: { wood: 4, hide: 2, apple: 3 },
    pantry: { bread: 2, cheese: 2, apple: 4, raw_meat: 2, turnip: 3 },
    weapon_rack: { iron_sword: 1, spear: 1, iron_axe: 1 },
    armor_stand: { iron_helmet: 1, mail_shirt: 1 },
    tack_rack: { saddle: 1, bridle: 2 },
  };

  K.BUILDING_DATA = { ITEMS, RECIPES, FOOD, OUTFITS, LOOT, SLEEP_HOURS: 8, HOURS_PER_DAY: 24 };
})(typeof window !== 'undefined' ? window : globalThis);
