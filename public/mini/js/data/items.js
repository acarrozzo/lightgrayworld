// Light Gray Mini: items. The names are Light Gray RPG's own.
//
// Gear sits in one of five slots, one line per stat (DEF gets two):
//   sword -> STR, ranged -> DEX, shield and armor -> DEF, staff -> MAG.
//
// Numbers: training gear, the Long Sword, the Battle Axe, the bows and the iron
// and steel swords carry the main game's values. Shields, armor and the top
// tier are scaled down (MINI), because the Mini reaches Star City around level
// 20, not level 50, and a 20 DEF shield at level 3 ends the Grassy Field.
// Prices past the Basic Shop are the Mini's own for the same reason.

export const ITEMS = {
  // swords (STR)
  'training-sword': { name: 'Training Sword', slot: 'sword', str: 3, value: 50 },
  'long-sword': { name: 'Long Sword', slot: 'sword', str: 5, value: 400 },
  'battle-axe': { name: 'Battle Axe', slot: 'sword', str: 11 },
  'iron-sword': { name: 'Iron Sword', slot: 'sword', str: 18, value: 900 },
  'steel-sword': { name: 'Steel Sword', slot: 'sword', str: 27, value: 2600 },
  'mithril-sword': { name: 'Mithril Sword', slot: 'sword', str: 40 },              // MINI (60)

  // ranged (DEX). A bow shoots straight; the boomerang comes back.
  boomerang: { name: 'Boomerang', slot: 'ranged', dex: 3 },
  'wooden-bow': { name: 'Wooden Bow', slot: 'ranged', dex: 8, arrow: true },
  'long-bow': { name: 'Long Bow', slot: 'ranged', dex: 11, arrow: true },
  'iron-bow': { name: 'Iron Bow', slot: 'ranged', dex: 18, arrow: true, value: 800 },
  'steel-bow': { name: 'Steel Bow', slot: 'ranged', dex: 27, arrow: true, value: 2400 }, // MINI (33)

  // shields (DEF)
  'training-shield': { name: 'Training Shield', slot: 'shield', def: 3 },
  'kite-shield': { name: 'Kite Shield', slot: 'shield', def: 8, value: 400 },       // MINI (20, -5 DEX, -5 MAG)
  'iron-shield': { name: 'Iron Shield', slot: 'shield', def: 14, value: 700 },      // MINI (25)
  'steel-shield': { name: 'Steel Shield', slot: 'shield', def: 22, value: 2000 },   // MINI (55)

  // armor (DEF)
  'training-armor': { name: 'Training Armor', slot: 'armor', def: 3 },
  'padded-armor': { name: 'Padded Armor', slot: 'armor', def: 6, value: 500 },      // MINI (13)
  'leather-armor': { name: 'Leather Armor', slot: 'armor', def: 10, value: 600 },
  'iron-armor': { name: 'Iron Armor', slot: 'armor', def: 16, value: 900 },         // MINI (30)
  'steel-armor': { name: 'Steel Armor', slot: 'armor', def: 26, value: 2600 },      // MINI (60)

  // staffs (MAG)
  'basic-staff': { name: 'Basic Staff', slot: 'staff', mag: 3, value: 200 },
  wand: { name: 'Wand', slot: 'staff', mag: 9 },
  'iron-staff': { name: 'Iron Staff', slot: 'staff', mag: 12, value: 800 },         // MINI (10, +3 STR)
  'steel-staff': { name: 'Steel Staff', slot: 'staff', mag: 22, value: 2400 },

  // food and potions
  redberry: { name: 'Redberry', plural: 'Redberries', use: { hp: 5 }, value: 10, icon: 'redberry', cap: 20 },
  blueberry: { name: 'Blueberry', plural: 'Blueberries', use: { mp: 5 }, value: 10, icon: 'blueberry', cap: 20 },
  'raw-meat': { name: 'Raw Meat', use: { hp: 25 }, value: 2, icon: 'meat' },
  'cooked-meat': { name: 'Cooked Meat', use: { hp: 50 }, value: 5, icon: 'cooked' },
  'red-potion': { name: 'Red Potion', plural: 'Red Potions', use: { hp: 100 }, value: 100, icon: 'potion' },
  'blue-potion': { name: 'Blue Potion', plural: 'Blue Potions', use: { mp: 100 }, value: 100, icon: 'bluepotion' },
  'purple-potion': { name: 'Purple Potion', plural: 'Purple Potions', use: { hp: 200, mp: 200 }, value: 400, icon: 'purplepotion' },

  // things people want
  flower: { name: 'Yellow Flower', quest: true, icon: 'flower', cap: 1 },
  'scorpion-tail': { name: 'Scorpion Tail', plural: 'Scorpion Tails', quest: true, icon: 'tail' },
  'gold-key': { name: 'Gold Key', quest: true, icon: 'key' },
  'bat-wing': { name: 'Bat Wing', plural: 'Bat Wings', quest: true, icon: 'wing' },
  'goblin-cloak': { name: 'Goblin Cloak', quest: true, icon: 'cloak', cap: 1 },
  hatchet: { name: 'Hatchet', quest: true, icon: 'hatchet', cap: 1 },
  wood: { name: 'Wood', quest: true, icon: 'wood', cap: 20 },

  // what opens the world
  'wooden-boat': { name: 'Wooden Boat', quest: true, icon: 'boat', cap: 1 },
  gills: { name: 'Gills', quest: true, icon: 'gills', cap: 1 },
  wings: { name: 'Wings', quest: true, icon: 'wing', cap: 1 },
};

export const SLOT_LABEL = { sword: 'Sword', ranged: 'Ranged', shield: 'Shield', armor: 'Armor', staff: 'Staff' };

/** "+3 STR", "100 HP" */
export function statLine(item) {
  const parts = [];
  for (const k of ['str', 'dex', 'def', 'mag']) {
    if (item[k]) parts.push(`${item[k] > 0 ? '+' : ''}${item[k]} ${k.toUpperCase()}`);
  }
  if (item.use) {
    if (item.use.hp) parts.push(`${item.use.hp} HP`);
    if (item.use.mp) parts.push(`${item.use.mp} MP`);
  }
  return parts.join(' ');
}

/** "3 Red Potions", "5 Cooked Meat", "Gold Key" */
export function countName(slug, n) {
  const item = ITEMS[slug];
  if (n <= 1) return item.name;
  return `${n} ${item.plural || item.name}`;
}
