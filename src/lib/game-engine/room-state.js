const { executeRoomAction } = require('./room-action-handlers')
const { executeItemAction } = require('./item-action-handlers')
const { RESPAWN_ROOM_ID } = require('../game-data/constants')

/**
 * The few things a dead player (HP 0) may still do: rise — the one authorized
 * move, to the Plane of Rebirth — look around, and talk.
 */
function isAllowedWhileDead(action) {
  const type = typeof action === 'object' ? action.type : action
  if (type === 'chat' || type === 'look') return true
  return type === 'move' && action.authorizedMove === true && action.data?.toRoom === RESPAWN_ROOM_ID
}
const { pickupRoomItem, dropRoomItem, getRoomItems } = require('./services/room-item-service')
const { getPlayerInventory, grantItemOnce, getItemBySlug } = require('./services/inventory-service')
const { equipItem, unequipItem } = require('./services/equipment-service')
const { checkRoomGate } = require('./room-gates')
const { prisma } = require('../db-client')
const { getSpell, findSpellByCommand, isCastable } = require('../game-data/spells')
const { getSpellState, castHealSpell } = require('./services/spell-service')
const { getSkill, findSkillByCommand, isStrikeSkill, weaponFits, weaponFitReason } = require('../game-data/skills')
const { getSkillState } = require('./services/skill-service')
const { rand } = require('./battle-calculator')
const { executeStartBattle, executePlayerAttack, executePlayerFlee, resolveSupportTurn, fetchEquippedWeapon } = require('./battle-action-handlers')
const { getRoomEnemies, isProbabilistic, getRoomPriorityEnemy, rollRoomEnemyGroup } = require('../game-data/room-enemies')
const { getEnemy } = require('../game-data/enemies')
const { getRevealDefinition, getNextRevealStage, markRevealed, clearRevealed } = require('./search-reveal-state')
const { saveRoomRoster } = require('./services/room-roster-service')

const EXIT_DIRECTIONS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
  'up',
  'down',
]

/**
 * Which exit of `room` leads to `toRoomId`, or null when none does.
 *
 * Hidden passages are canonical in the room row, so this will find a reveal- or
 * lever-gated exit too. That is intended: the matching entry in ROOM_GATES is
 * what keeps an undiscovered passage shut, and routing those moves through the
 * gate check is precisely what a caller-supplied direction used to skip.
 */
function findExitDirection(room, toRoomId) {
  if (!room || !toRoomId) return null
  for (const direction of EXIT_DIRECTIONS) {
    if (room[direction] === toRoomId) return direction
  }
  return null
}

const SEARCH_LOOT_TABLES = {
  '003b': {
    failMessage: 'You search the cabin basement but find nothing.',
    entries: [
      { message: 'You search the cabin basement and find a Blueberry!', effect: { type: 'grantItem', itemSlug: 'blueberry', quantity: 1 } },
      { message: 'You search the cabin basement and find 2 Redberries!', effect: { type: 'grantItem', itemSlug: 'redberry', quantity: 2 } },
      { message: 'You search the cabin basement and find some Cooked Meat!', effect: { type: 'grantItem', itemSlug: 'cooked-meat', quantity: 1 } },
      { message: 'You search the cabin basement and find a Crossbow Bolt!', effect: { type: 'grantItem', itemSlug: 'crossbow-bolt', quantity: 1 } },
      { message: (amount) => `You search the cabin basement and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 5, max: 25 } },
      { message: (amount) => `You search the cabin basement and find ${amount} Arrows!`, effect: { type: 'grantItem', itemSlug: 'arrow', minQty: 2, maxQty: 5 } },
      { message: 'You search the cabin basement and find a Mace!', effect: { type: 'grantItem', itemSlug: 'mace', quantity: 1 } },
      { message: 'You search the cabin basement and find a Red Potion!', effect: { type: 'grantItem', itemSlug: 'red-potion', quantity: 1 } },
      { message: 'You search the cabin basement and find a Dagger!', effect: { type: 'grantItem', itemSlug: 'dagger', quantity: 1 } },
      { message: 'You search the cabin basement and find a Long Sword!', effect: { type: 'grantItem', itemSlug: 'long-sword', quantity: 1 } },
    ],
  },
  '003bb': {
    failMessage: 'You search the destroyed basement but find nothing.',
    entries: [
      { message: 'You search the destroyed basement and find a Blueberry!', effect: { type: 'grantItem', itemSlug: 'blueberry', quantity: 1 } },
      { message: 'You search the destroyed basement and find 2 Redberries!', effect: { type: 'grantItem', itemSlug: 'redberry', quantity: 2 } },
      { message: 'You search the destroyed basement and find some Cooked Meat!', effect: { type: 'grantItem', itemSlug: 'cooked-meat', quantity: 1 } },
      { message: 'You search the destroyed basement and find a Crossbow Bolt!', effect: { type: 'grantItem', itemSlug: 'crossbow-bolt', quantity: 1 } },
      { message: (amount) => `You search the destroyed basement and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 10, max: 30 } },
      { message: (amount) => `You search the destroyed basement and find ${amount} Arrows!`, effect: { type: 'grantItem', itemSlug: 'arrow', minQty: 2, maxQty: 5 } },
      { message: 'You search the destroyed basement and find a Mace!', effect: { type: 'grantItem', itemSlug: 'mace', quantity: 1 } },
      { message: 'You search the destroyed basement and find a Red Potion!', effect: { type: 'grantItem', itemSlug: 'red-potion', quantity: 1 } },
      { message: 'You search the destroyed basement and find a Dagger!', effect: { type: 'grantItem', itemSlug: 'dagger', quantity: 1 } },
      { message: 'You search the destroyed basement and find a Long Sword!', effect: { type: 'grantItem', itemSlug: 'long-sword', quantity: 1 } },
    ],
  },

  // ==================== FOREST ====================
  // The Abandoned Campsite. Whoever left did not pack: a 1-in-2 search, then one
  // of five things off the ground, exactly the spread the original rolled.
  '130': {
    chance: 0.5,
    failMessage: 'You search the Abandoned Campsite and find nothing, you should search again.',
    entries: [
      { message: 'You search the Abandoned Campsite and find a Bluefish!', effect: { type: 'grantItem', itemSlug: 'bluefish', quantity: 1 } },
      { message: (amount) => `You search the Abandoned Campsite and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 50, max: 200 } },
      { message: 'You search the Abandoned Campsite and find a Meatball!', effect: { type: 'grantItem', itemSlug: 'meatball', quantity: 1 } },
      { message: 'You search the Abandoned Campsite and find a Purple Potion!', effect: { type: 'grantItem', itemSlug: 'purple-potion', quantity: 1 } },
      { message: 'You search the Abandoned Campsite and find a Wings Potion!', effect: { type: 'grantItem', itemSlug: 'wings-potion', quantity: 1 } },
    ],
  },

  // The Forest Dead End's iron hatchet. Not a loot roll so much as a one-off
  // find: the hatchet is here for whoever does not have one, and the search
  // stops paying out the moment you are carrying it. Losing it makes the dead
  // end worth walking back to, which is the whole point of the room.
  '129': {
    chance: 0.5,
    failMessage: 'You search the Forest and think you see something shiny in the bushes, you should search again.',
    onlyWhileMissing: {
      itemSlug: 'iron-hatchet',
      message: 'You found an Iron Hatchet here once already. Come back if you ever lose it.',
    },
    entries: [
      { message: 'You search the Forest and find an Iron Hatchet!', effect: { type: 'grantItem', itemSlug: 'iron-hatchet', quantity: 1 } },
    ],
  },

  // ==================== DARK FOREST ====================
  // Champion's Camp: "search all the scattered equipment if you can withstand
  // the beating". A 1-in-2 find, then one of eight, exactly the original's roll.
  '511': {
    chance: 0.5,
    failMessage: 'You search the camp and find nothing, you should search again.',
    entries: [
      { message: 'You search the camp and find a Ring of Strength V!', effect: { type: 'grantItem', itemSlug: 'ring-of-strength-v', quantity: 1 } },
      { message: 'You search the camp and find a Ring of Health Regen III!', effect: { type: 'grantItem', itemSlug: 'ring-of-health-regen-iii', quantity: 1 } },
      { message: 'You search the camp and find 5 Meatballs!', effect: { type: 'grantItem', itemSlug: 'meatball', quantity: 5 } },
      { message: 'You search the camp and find a piece of Iron!', effect: { type: 'grantItem', itemSlug: 'iron', quantity: 1 } },
      { message: 'You search the camp and find some Coal!', effect: { type: 'grantItem', itemSlug: 'coal', quantity: 1 } },
      { message: 'You search the camp and find a shiny piece of Mithril!', effect: { type: 'grantItem', itemSlug: 'mithril', quantity: 1 } },
      { message: 'You search the camp and find some Reds!', effect: { type: 'grantItem', itemSlug: 'reds', quantity: 1 } },
      { message: 'You search the camp and find some Yellows!', effect: { type: 'grantItem', itemSlug: 'yellows', quantity: 1 } },
    ],
  },
  // Lost in the Trees. Searching here never finds anything; the original's own
  // line. The way out is south, which somehow goes east.
  '514': {
    chance: 0,
    failMessage: 'You search the trees and somehow get even more lost.',
    entries: [],
  },
  // The Dark Keep Storeroom: a 1-in-3 rummage, one of eight supplies.
  '516b': {
    chance: 1 / 3,
    failMessage: 'You search the dark storeroom and find nothing, you should search again.',
    entries: [
      { message: 'You search the dark storeroom and find a Red Balm!', effect: { type: 'grantItem', itemSlug: 'red-balm', quantity: 1 } },
      { message: 'You search the dark storeroom and find a Blue Balm!', effect: { type: 'grantItem', itemSlug: 'blue-balm', quantity: 1 } },
      { message: 'You search the dark storeroom and find a Purple Balm!', effect: { type: 'grantItem', itemSlug: 'purple-balm', quantity: 1 } },
      { message: (amount) => `You search the dark storeroom and find ${amount} arrows!`, effect: { type: 'grantItem', itemSlug: 'arrow', minQty: 20, maxQty: 50 } },
      { message: (amount) => `You search the dark storeroom and find ${amount} bolts!`, effect: { type: 'grantItem', itemSlug: 'crossbow-bolt', minQty: 20, maxQty: 50 } },
      { message: 'You search the dark storeroom and find some Blues!', effect: { type: 'grantItem', itemSlug: 'blues', quantity: 1 } },
      { message: 'You search the dark storeroom and find some Yellows!', effect: { type: 'grantItem', itemSlug: 'yellows', quantity: 1 } },
      { message: 'You search the dark storeroom and find some Gray Matter!', effect: { type: 'grantItem', itemSlug: 'gray-matter', quantity: 1 } },
    ],
  },
  // The Dark Keep Barracks: "all sorts of elite weapons and armor". A 1-in-3
  // search through the racks, one of eight — and one of the eight is a skull.
  '516f': {
    chance: 1 / 3,
    failMessage: 'You search the barracks and find nothing, you should search again.',
    entries: [
      { message: 'You search the barracks and find a Mithril Dagger!', effect: { type: 'grantItem', itemSlug: 'mithril-dagger', quantity: 1 } },
      { message: 'You search the barracks and find a Mithril Staff!', effect: { type: 'grantItem', itemSlug: 'mithril-staff', quantity: 1 } },
      { message: 'You search the barracks and find a Flamberg!', effect: { type: 'grantItem', itemSlug: 'flamberg', quantity: 1 } },
      { message: 'You search the barracks and find a Glaive!', effect: { type: 'grantItem', itemSlug: 'glaive', quantity: 1 } },
      { message: 'You search the barracks and find a Steel Battle Staff!', effect: { type: 'grantItem', itemSlug: 'steel-battle-staff', quantity: 1 } },
      { message: (amount) => `You search the barracks and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 200, max: 500 } },
      { message: 'You search the barracks and find a Mithril Boomerang!', effect: { type: 'grantItem', itemSlug: 'mithril-boomerang', quantity: 1 } },
      { message: 'You search the barracks and find a Cursed Skull!!', effect: { type: 'grantItem', itemSlug: 'cursed-skull', quantity: 1 } },
    ],
  },

  // ==================== FOREST UNDERGROUND ====================
  // The two lived-in rooms down here — a hob goblin's hut and the kobolds' dead
  // end. Both were 1-in-3 to find anything in the original, then a coin flip
  // between berries and the matching potion.
  '111d': {
    chance: 1 / 3,
    failMessage: 'You search the Hob Goblin Hut and find nothing, you should search again.',
    entries: [
      { message: 'You search the Hob Goblin Hut and find 3 Redberries!', effect: { type: 'grantItem', itemSlug: 'redberry', quantity: 3 } },
      { message: 'You search the Hob Goblin Hut and find a Red Potion!', effect: { type: 'grantItem', itemSlug: 'red-potion', quantity: 1 } },
    ],
  },
  '115b': {
    chance: 1 / 3,
    failMessage: 'You search the Kobold Dead End and find nothing, you should search again.',
    entries: [
      { message: 'You search the Kobold Dead End and find 3 Blueberries!', effect: { type: 'grantItem', itemSlug: 'blueberry', quantity: 3 } },
      { message: 'You search the Kobold Dead End and find a Blue Potion!', effect: { type: 'grantItem', itemSlug: 'blue-potion', quantity: 1 } },
    ],
  },

  // ==================== RED TOWN SEWERS ====================
  // The Sewer Oasis's stack of folded Black Robes. Whoever keeps this place dry
  // also keeps spare clothes here, and the original never rolled for it — the
  // search always finds them. One is enough, so it stops paying out while you are
  // carrying one. (Legacy had the two branches the wrong way round and told a
  // player with no robe that they were lucky to already have one; the intent is
  // plain from the messages and is what is implemented here.)
  '232x': {
    chance: 1,
    onlyWhileMissing: {
      itemSlug: 'black-robe',
      message: 'You search the Sewer Oasis and find a neat stack of folded Black Robes. Luckily, you already have one.',
    },
    entries: [
      {
        message: 'You search the Sewer Oasis and find a neat stack of folded Black Robes! You pick one up.',
        effect: { type: 'grantItem', itemSlug: 'black-robe', quantity: 1 },
      },
    ],
  },

  // ==================== ROCKY FLATS ====================
  // The Stone Grotto and the chamber under it. Both were 1-in-2 to find anything
  // in the original, then an even roll across what somebody left behind — the
  // upper room in offerings and food, the lower one in supplies and coin.
  '321': {
    chance: 0.5,
    failMessage: 'You search the grotto and find nothing. You should search again.',
    entries: [
      { message: 'You search the grotto and find a Blue Balm!', effect: { type: 'grantItem', itemSlug: 'blue-balm', quantity: 1 } },
      { message: 'You search the grotto and find a Red Balm!', effect: { type: 'grantItem', itemSlug: 'red-balm', quantity: 1 } },
      { message: 'You search the grotto and find a Meatball!', effect: { type: 'grantItem', itemSlug: 'meatball', quantity: 1 } },
      { message: 'You search the grotto and find a Bluefish!', effect: { type: 'grantItem', itemSlug: 'bluefish', quantity: 1 } },
      { message: (amount) => `You search the grotto and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 100, max: 200 } },
    ],
  },
  '321b': {
    chance: 0.5,
    failMessage: 'You search the lower grotto and find nothing. You should search again.',
    entries: [
      { message: 'You search the lower grotto and find a Blue Potion!', effect: { type: 'grantItem', itemSlug: 'blue-potion', quantity: 1 } },
      { message: 'You search the lower grotto and find a Red Potion!', effect: { type: 'grantItem', itemSlug: 'red-potion', quantity: 1 } },
      { message: (qty) => `You search the lower grotto and find ${qty} bolts!`, effect: { type: 'grantItem', itemSlug: 'crossbow-bolt', minQty: 10, maxQty: 20 } },
      { message: (amount) => `You search the lower grotto and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 100, max: 200 } },
    ],
  },
  // The Red Fort Barracks. Racks of bandit kit, and the bandits are not using
  // all of it. 1-in-2, then an even roll across five.
  '324': {
    chance: 0.5,
    failMessage: 'You search the barracks and find nothing. You should search again.',
    entries: [
      { message: 'You search the barracks and find a Bandit Hood!', effect: { type: 'grantItem', itemSlug: 'bandit-hood', quantity: 1 } },
      { message: (qty) => `You search the barracks and find ${qty} bolts!`, effect: { type: 'grantItem', itemSlug: 'crossbow-bolt', minQty: 5, maxQty: 15 } },
      { message: 'You search the barracks and find 2 Meatballs!', effect: { type: 'grantItem', itemSlug: 'meatball', quantity: 2 } },
      { message: 'You search the barracks and find a Bluefish!', effect: { type: 'grantItem', itemSlug: 'bluefish', quantity: 1 } },
      { message: (amount) => `You search the barracks and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 100, max: 200 } },
    ],
  },

  // ==================== BLUE OCEAN ====================
  // Trapped under the storm. A coin flip, then one of ten things out of the
  // wreckage — the same table the original rolled, and most of what makes being
  // stuck here worth it.
  '410': {
    chance: 0.5,
    failMessage: 'You search the ocean and find nothing, you should search again.',
    entries: [
      { message: 'You search the ocean and find a Bluefish!', effect: { type: 'grantItem', itemSlug: 'bluefish', quantity: 1 } },
      { message: (amount) => `You search the ocean and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 100, max: 300 } },
      { message: 'You search the ocean and find a Gills Potion!', effect: { type: 'grantItem', itemSlug: 'gills-potion', quantity: 1 } },
      { message: 'You search the ocean and find a Red Balm!', effect: { type: 'grantItem', itemSlug: 'red-balm', quantity: 1 } },
      { message: 'You search the ocean and find a Wings Potion!', effect: { type: 'grantItem', itemSlug: 'wings-potion', quantity: 1 } },
      { message: 'You search the ocean and find a Purple Balm!', effect: { type: 'grantItem', itemSlug: 'purple-balm', quantity: 1 } },
      { message: 'You search the ocean and find some Blues!', effect: { type: 'grantItem', itemSlug: 'blues', quantity: 1 } },
      { message: 'You search the ocean and find some Reds!', effect: { type: 'grantItem', itemSlug: 'reds', quantity: 1 } },
      { message: 'You search the ocean and find some Greens!', effect: { type: 'grantItem', itemSlug: 'greens', quantity: 1 } },
      { message: 'You search the ocean and find some Yellows!', effect: { type: 'grantItem', itemSlug: 'yellows', quantity: 1 } },
    ],
  },

  // ==================== UNDER THE OCEAN ====================
  // The Sunken Ship's cabins and crevices. Real gear on this one: the original
  // put an off-hand sword, a steel staff and a glowing orb in the wreck.
  '489': {
    chance: 0.5,
    failMessage: 'You search the sunken ship and find nothing, you should search again.',
    entries: [
      { message: 'You search the sunken ship and find an Off Hand Sword!', effect: { type: 'grantItem', itemSlug: 'off-hand-sword', quantity: 1 } },
      { message: 'You search the sunken ship and find an Iron Nunchaku!', effect: { type: 'grantItem', itemSlug: 'iron-nunchaku', quantity: 1 } },
      { message: 'You search the sunken ship and find a Steel Staff!', effect: { type: 'grantItem', itemSlug: 'steel-staff', quantity: 1 } },
      { message: 'You search the sunken ship and find a Glowing Orb!', effect: { type: 'grantItem', itemSlug: 'glowing-orb', quantity: 1 } },
      { message: 'You search the sunken ship and find a pair of Iron Boots!', effect: { type: 'grantItem', itemSlug: 'iron-boots', quantity: 1 } },
      { message: 'You search the sunken ship and find a Red Balm!', effect: { type: 'grantItem', itemSlug: 'red-balm', quantity: 1 } },
      { message: 'You search the sunken ship and find some Blues!', effect: { type: 'grantItem', itemSlug: 'blues', quantity: 1 } },
      { message: 'You search the sunken ship and find some Reds!', effect: { type: 'grantItem', itemSlug: 'reds', quantity: 1 } },
      { message: 'You search the sunken ship and find some Greens!', effect: { type: 'grantItem', itemSlug: 'greens', quantity: 1 } },
      { message: 'You search the sunken ship and find some Yellows!', effect: { type: 'grantItem', itemSlug: 'yellows', quantity: 1 } },
    ],
  },
  // A Muddy Tunnel. Mud. Every time.
  '491': {
    chance: 1,
    failMessage: 'You search and find some mud. Big surprise.',
    entries: [
      { message: 'You search and find some mud… big surprise. [ +1 mud ]', effect: { type: 'grantItem', itemSlug: 'mud', quantity: 1 } },
    ],
  },
  // The Underwater Flower Patch, behind the Coral Door. The original's fifth and
  // sixth rolls each gave two things at once (gills and wings; coffee and tea);
  // an entry grants one effect, so they are split into their own rolls.
  '494': {
    chance: 0.5,
    failMessage: 'You search the underwater flower patch and find nothing, you should search again.',
    entries: [
      { message: 'You search the underwater flower patch and find a Ring of Strength V!', effect: { type: 'grantItem', itemSlug: 'ring-of-strength-v', quantity: 1 } },
      { message: 'You search the underwater flower patch and find a Ring of Magic V!', effect: { type: 'grantItem', itemSlug: 'ring-of-magic-v', quantity: 1 } },
      { message: 'You search the underwater flower patch and find a Blue Balm!', effect: { type: 'grantItem', itemSlug: 'blue-balm', quantity: 1 } },
      { message: 'You search the underwater flower patch and find a Red Balm!', effect: { type: 'grantItem', itemSlug: 'red-balm', quantity: 1 } },
      { message: 'You search the underwater flower patch and find a Gills Potion!', effect: { type: 'grantItem', itemSlug: 'gills-potion', quantity: 1 } },
      { message: 'You search the underwater flower patch and find a Wings Potion!', effect: { type: 'grantItem', itemSlug: 'wings-potion', quantity: 1 } },
      { message: "You search the underwater flower patch and find some Coffee! That's weird.", effect: { type: 'grantItem', itemSlug: 'coffee', quantity: 1 } },
      { message: "You search the underwater flower patch and find some Tea! That's weird.", effect: { type: 'grantItem', itemSlug: 'tea', quantity: 1 } },
      { message: 'You search the underwater flower patch and find some Blues!', effect: { type: 'grantItem', itemSlug: 'blues', quantity: 1 } },
      { message: 'You search the underwater flower patch and find some Reds!', effect: { type: 'grantItem', itemSlug: 'reds', quantity: 1 } },
      { message: 'You search the underwater flower patch and find some Greens!', effect: { type: 'grantItem', itemSlug: 'greens', quantity: 1 } },
      { message: 'You search the underwater flower patch and find some Yellows!', effect: { type: 'grantItem', itemSlug: 'yellows', quantity: 1 } },
    ],
  },
  // The Secret Underwater Cave under the quiet water. The original's ambient
  // underwater encounters occasionally had "a giant whale swim by and cough up
  // a Coral Coin"; that artifact lives here now, in place of the table's second
  // gold roll, so the cave is the one place in the world it can be found.
  '497': {
    chance: 0.5,
    failMessage: 'You search the secret underwater cave and find nothing, you should search again.',
    entries: [
      { message: 'You search the secret underwater cave and find a Ring of Strength V!', effect: { type: 'grantItem', itemSlug: 'ring-of-strength-v', quantity: 1 } },
      { message: (amount) => `You search the secret underwater cave and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 100, max: 300 } },
      { message: 'A giant whale swims past the cave mouth and coughs up a Coral Coin! [ + ARTIFACT ]', effect: { type: 'grantItem', itemSlug: 'coral-coin', quantity: 1 } },
      { message: 'You search the secret underwater cave and find a Red Balm!', effect: { type: 'grantItem', itemSlug: 'red-balm', quantity: 1 } },
      { message: 'You search the secret underwater cave and find a Purple Potion!', effect: { type: 'grantItem', itemSlug: 'purple-potion', quantity: 1 } },
      { message: 'You search the secret underwater cave and find a Purple Balm!', effect: { type: 'grantItem', itemSlug: 'purple-balm', quantity: 1 } },
      { message: 'You search the secret underwater cave and find some Blues!', effect: { type: 'grantItem', itemSlug: 'blues', quantity: 1 } },
      { message: 'You search the secret underwater cave and find some Reds!', effect: { type: 'grantItem', itemSlug: 'reds', quantity: 1 } },
      { message: 'You search the secret underwater cave and find some Greens!', effect: { type: 'grantItem', itemSlug: 'greens', quantity: 1 } },
      { message: 'You search the secret underwater cave and find some Yellows!', effect: { type: 'grantItem', itemSlug: 'yellows', quantity: 1 } },
    ],
  },
}

/**
 * Rooms with their own ambient lines, which replace the generic world-tick
 * flavour while a player is standing in them. The original wrote these as a
 * per-room roll at the end of the room script — a 1-in-5 in the Stone Grotto and
 * a 1-in-10 in the Red Fort Barracks — and they are most of what makes those two
 * rooms feel occupied.
 */
const ROOM_FLAVOR = {
  // The Dark Forest's edges: what the room descriptions say you can hear.
  '505': [
    'You hear grunting and clanging from the hill to the north.',
    'Something heavy moves through the trees, then stops.',
    'The leaves here are darker than any leaves should be.',
  ],
  '508': [
    'Strange screeching and howling carries down from the northeast.',
    'It is getting darker. It is always getting darker here.',
    'A branch cracks somewhere behind you.',
  ],
  '520': [
    'The thorns creak as something pushes through them, a long way off.',
    'You pick a thorn out of your sleeve. There will be more.',
  ],
  '516h': [
    'The crown catches what little light comes through the windows.',
    'Far to the north, a greenish pillar of light flickers over the trees.',
    'Something moves in the rafters, and then does not.',
  ],
  '321': [
    'You get an uneasy feeling that some sort of spirit is nearby.',
    'You hear a rumbling come from the ground.',
    'You feel both warm and cold at once.',
  ],
  '324': [
    'You hear a giant rat scurrying along the floor.',
    'You hear someone scream, somewhere to the north.',
    'The air from the south is warm and delicious.',
  ],
  // Under the ocean. The original rolled these as random encounters at the end
  // of every underwater room script, a 1-in-5 chance of one of nine; a few of
  // them healed you, one nipped you and one coughed up a Coral Coin. They are
  // flavour here — the healing fish and the crab are lines, not effects, and
  // the whale's coin is a search find in the Secret Underwater Cave instead.
  ...Object.fromEntries(
    ['480', '481', '482', '483', '484', '485', '486', '487', '488', '489', '493', '494', '495', '496', '497', '498', '499'].map((roomId) => [
      roomId,
      [
        'A nemo looking clown fish swims past you.',
        'A sea horse emerges from the coral.',
        'A purple and blue illuminated jellyfish slowly swims up and down from the surface.',
        'A pulsating gold and red fish swims past and you feel a surge of warmth.',
        'A glowing blue fish swims past and the water hums with something like magic.',
        'A crab nips at your toe. Ouch!',
        'You think you see a glowing squid looking beast in the distance, but then it fades from view.',
        'A shark swims past but then hurries back into the shadows.',
        'A giant whale swims by, slow as weather.',
      ],
    ])
  ),
}

// Pull a short "+5 HP" / "−1 HP" / "+10 MP" effect string out of an item action
// result so we can show it next to the action description on the battle panel.
function extractEffectText(result) {
  const data = result?.playerEvents?.[0]?.payload?.data
  if (!data) return null
  if (typeof data.hpChange === 'number' && data.hpChange !== 0) {
    const sign = data.hpChange > 0 ? '+' : ''
    return `${sign}${data.hpChange} HP`
  }
  if (typeof data.mpChange === 'number' && data.mpChange !== 0) {
    const sign = data.mpChange > 0 ? '+' : ''
    return `${sign}${data.mpChange} MP`
  }
  return null
}

/**
 * Combine two action results, carrying every channel the engine reads.
 *
 * A result has five: playerEvents, broadcastEvents, roomEvent, backgroundWork
 * and transfer. Merge sites used to copy only the one or two they happened to
 * need, which quietly dropped the rest. The costly case was an auto-provoked
 * battle won in a single turn: its `backgroundWork` — the promise carrying the
 * drop grants' inventory refresh and the level-up event — was discarded, so the
 * loot and the new level did not appear until the player refreshed, and the room
 * never heard the fight start.
 */
function mergeActionResults(base, extra) {
  if (!extra) return base
  const merged = { ...base }

  if (extra.playerEvents?.length) {
    merged.playerEvents = [...(base.playerEvents ?? []), ...extra.playerEvents]
  }
  if (extra.broadcastEvents?.length) {
    merged.broadcastEvents = [...(base.broadcastEvents ?? []), ...extra.broadcastEvents]
  }

  // Only one of each can be acted on, so whatever the base result already
  // decided wins; the incoming result fills the slot only if it is empty.
  if (!merged.roomEvent && extra.roomEvent) merged.roomEvent = extra.roomEvent
  if (!merged.transfer && extra.transfer) merged.transfer = extra.transfer

  if (extra.backgroundWork) {
    merged.backgroundWork = base.backgroundWork
      ? Promise.all([base.backgroundWork, extra.backgroundWork]).then(
          ([fromBase, fromExtra]) => [...(fromBase ?? []), ...(fromExtra ?? [])]
        )
      : extra.backgroundWork
  }

  return merged
}

// Combine the original action result with the support-turn events. If the
// support turn ended the battle with defeat, that takes over.
function mergeSupportTurnIntoResult(base, supportTurn) {
  return mergeActionResults(base, supportTurn)
}

/**
 * Rooms that hurt you for standing in them. The Thorny Path (520) rolled a
 * 1-in-3 on every page load — "ouch! you run into a thorn bush!" for 50 to 100
 * HP — and that is what it does here on every turn action taken in the room.
 * The thorns never finish anyone: the floor is 1 HP, because dying to a bush
 * with nothing to fight back against is not a death the death card can
 * explain, and the original's own version left the player at whatever was
 * left (often nothing, which was a bug, not a design).
 *
 * @type {Record<string, { chance: number, min: number, max: number, message: (n: number) => string }>}
 */
const ROOM_HAZARDS = {
  '520': {
    chance: 1 / 3,
    min: 50,
    max: 100,
    message: (damage) => `Ouch! You run into a thorn bush! [ -${damage} HP ]`,
  },
}

// Actions that consume a "turn" and may trigger a spawn check in probabilistic rooms.
// Free actions (chat, look, examine_*, accept_quest, complete_quest) do not.
// attack and move are handled separately (attack triggers battle directly; move triggers on entry).
const TURN_ACTIONS = new Set([
  'rest',
  'search',
  'use_item',
  'equip_item',
  'unequip_item',
  'pickup_item',
  'drop_item',
])

class RoomState {
  constructor(roomId) {
    this.roomId = roomId
    this.players = new Map()
    this.activeBattles = new Map()
    // Per-player enemy state for probabilistic rooms.
    // Map<playerId, { roster: string[] }>
    // roster = the set of enemy slugs currently present; out of battle the player may
    // attack any of them. Empty roster = no enemies present. Key absent = not yet rolled.
    this.playerEnemyState = new Map()
    this.lastActionAt = null
    this.lastTickPlayerCount = null
    this.lastAmbientHintAt = 0
  }

  addPlayer(playerState) {
    if (!playerState?.id) return
    this.players.set(playerState.id, { ...playerState })
    if (getRevealDefinition(this.roomId)) {
      clearRevealed(playerState.id, this.roomId)
    }
  }

  removePlayer(playerId) {
    this.players.delete(playerId)
    this.playerEnemyState.delete(playerId)
    if (getRevealDefinition(this.roomId)) {
      clearRevealed(playerId, this.roomId)
    }
    const battle = this.activeBattles.get(playerId)
    if (battle) {
      battle.end()
      this.activeBattles.delete(playerId)
      prisma.user.update({ where: { id: playerId }, data: { inFight: false } }).catch(() => {})
    }
  }

  // --- Per-player enemy state helpers (probabilistic rooms) ---
  //
  // Enemies present for a player are a flat roster: out of battle the player may
  // attack any of them. Index 0 is the default target for the bare 'attack' action
  // and there is no post-battle grace.

  // Fire-and-forget: mirror this player's current in-memory roster to the DB so it
  // survives a page refresh / reconnect. An empty roster deletes the persisted row.
  // NOT called from removePlayer — a disconnect must leave the DB row intact so the
  // roster can be restored on the next login.
  syncRosterToDb(playerId) {
    const slugs = this.playerEnemyState.get(playerId)?.roster ?? []
    saveRoomRoster(playerId, this.roomId, slugs).catch(() => {})
  }

  // A present enemy slug (roster[0]), used as a default target for the bare
  // 'attack' action.
  getPlayerActiveEnemy(playerId) {
    return this.playerEnemyState.get(playerId)?.roster?.[0] ?? null
  }

  // Returns a present enemy slug (roster[0]), or null.
  getPlayerEnemySlug(playerId) {
    return this.playerEnemyState.get(playerId)?.roster?.[0] ?? null
  }

  // The full list of enemies currently present for this player.
  getPlayerEnemyRoster(playerId) {
    return this.playerEnemyState.get(playerId)?.roster ?? []
  }

  setPlayerActiveEnemy(playerId, slug) {
    this.playerEnemyState.set(playerId, { roster: slug ? [slug] : [] })
    this.syncRosterToDb(playerId)
  }

  // Seeds the full roster of present enemies (used on room entry to place a fresh
  // wave, or to restore a roster persisted across a room transition).
  setPlayerEnemyRoster(playerId, slugs) {
    this.playerEnemyState.set(playerId, { roster: Array.isArray(slugs) ? slugs : [] })
    this.syncRosterToDb(playerId)
  }

  // Removes one defeated enemy (by slug) from the roster after a battle win.
  // No grace period — the next turn action can immediately provoke another enemy.
  // Returns the number still present.
  removeEnemyFromRoster(playerId, slug) {
    const state = this.playerEnemyState.get(playerId)
    const roster = state?.roster ? [...state.roster] : []
    const idx = roster.indexOf(slug)
    if (idx !== -1) roster.splice(idx, 1)
    this.playerEnemyState.set(playerId, { roster })
    this.syncRosterToDb(playerId)
    return roster.length
  }

  clearPlayerEnemyState(playerId) {
    this.playerEnemyState.delete(playerId)
    // Deletes the persisted row (roster now empty) so a cleared/abandoned room
    // isn't restored on the next login.
    this.syncRosterToDb(playerId)
  }

  // True if any aggressive enemy is present in the player's roster. Used to block
  // movement — the player cannot leave while hostiles remain.
  hasHostileEnemies(playerId) {
    return this.getPlayerEnemyRoster(playerId).some((slug) => getEnemy(slug)?.isAggressive)
  }

  // Picks the HOSTILE (aggressive) enemy to engage the player first, or null.
  // The room's designated `priority` enemy strikes first when it is present and
  // aggressive; otherwise a random present hostile is chosen.
  pickHostileTarget(slugs) {
    const hostiles = slugs.filter((slug) => getEnemy(slug)?.isAggressive)
    if (!hostiles.length) return null
    const prioritySlug = getRoomPriorityEnemy(this.roomId)
    if (prioritySlug && hostiles.includes(prioritySlug)) return prioritySlug
    return hostiles[Math.floor(Math.random() * hostiles.length)]
  }

  // Rolls a fresh wave (the whole group at once) only when nothing is present.
  // Returns { spawned: string[] } for a newly-rolled wave, or null otherwise.
  maybeSpawnEnemy(playerId) {
    if (!isProbabilistic(this.roomId)) return null

    const battle = this.activeBattles.get(playerId)
    if (battle?.isActive) return null

    // Enemies already present — no new wave (engagement handled by caller).
    if (this.playerEnemyState.get(playerId)?.roster?.length) return null

    const group = rollRoomEnemyGroup(this.roomId)
    this.playerEnemyState.set(playerId, { roster: group })
    // Persist only when a wave actually spawned; a miss leaves the (empty) state
    // unchanged, so there's nothing new to write.
    if (group.length) this.syncRosterToDb(playerId)
    return group.length ? { spawned: group } : null
  }

  // Maps a list of enemy slugs to full enemy objects (for client display payloads).
  buildEnemyList(slugs) {
    return slugs.map((slug) => getEnemy(slug)).filter(Boolean)
  }

  updatePlayer(playerId, updater) {
    const player = this.players.get(playerId)
    if (!player) return
    const updated = typeof updater === 'function' ? updater({ ...player }) : player
    this.players.set(playerId, updated)
  }

  getState() {
    return {
      roomId: this.roomId,
      playerCount: this.players.size,
      lastActionAt: this.lastActionAt,
    }
  }

  getTickUpdate(now = Date.now()) {
    const playerCount = this.players.size
    
    // Always get ambient data (no longer conditional)
    const ambientData = this.buildAmbientData(now)
    
    // Always return an update - world tick IS the display
    // Track player count changes but always return update when players are present
    const playerCountChanged =
      this.lastTickPlayerCount === null || this.lastTickPlayerCount !== playerCount

    this.lastTickPlayerCount = playerCount

    // Always return an update object when there are players
    // This ensures world ticks always occur every 5 seconds
    return {
      playerCount,
      ambientData: ambientData || null,
    }
  }

  async executeAction(action, playerId, currentTickNumber, nextTickAt) {
    // First, check if this is a room-specific action
    const actionName = action.type || action
    const actionData = typeof action === 'object' ? (action.data ?? {}) : {}

    // HP 0 is dead. The player lies where they fell, the death card open, and
    // nothing they try goes through — not a step, a search, a potion or a
    // fight — except rising, looking around, and talking.
    const live = this.players.get(playerId)
    if (live && (live.hp ?? 1) <= 0 && !isAllowedWhileDead(action)) {
      return this.createErrorResult(actionName, "You're dead. Rise in the Plane of Rebirth first.")
    }
    const roomSpecificResult = await executeRoomAction(
      this.roomId,
      actionName,
      playerId,
      this,
      currentTickNumber,
      nextTickAt,
      actionData
    )

    // If room-specific handler returned a result, use it
    if (roomSpecificResult !== null) {
      return roomSpecificResult
    }

    // A typed "cast fireball" / "fireball" is the same as the Spells button.
    if (typeof action.type === 'string' && action.type !== 'cast_spell') {
      const typedSpell = findSpellByCommand(action.type)
      if (typedSpell && (/^cast\s/i.test(action.type) || typedSpell.kind !== 'buff')) {
        return await this.executeCastSpell({ type: 'cast_spell', data: { spellId: typedSpell.id } }, playerId)
      }
    }

    // A typed "slice" / "use magic strike" is the same as the Skills button.
    // Only strikes answer to a command; passives are not something you do.
    if (typeof action.type === 'string' && action.type !== 'use_skill') {
      const typedSkill = findSkillByCommand(action.type)
      if (typedSkill) {
        return await this.executeUseSkill({ type: 'use_skill', data: { skillId: typedSkill.id } }, playerId)
      }
    }

    // Otherwise, fall back to standard actions
    let result
    switch (action.type) {
      case 'attack':
        return await this.executeAttack(playerId)
      case 'cast_spell':
        return await this.executeCastSpell(action, playerId)
      case 'use_skill':
        return await this.executeUseSkill(action, playerId)
      case 'start_battle':
        return await executeStartBattle(action, playerId, this)
      case 'player_attack':
        return await executePlayerAttack(action, playerId, this)
      case 'player_flee':
        return await executePlayerFlee(action, playerId, this)
      case 'pickup_item':
        result = await this.executePickupItem(action, playerId)
        break
      case 'drop_item':
        result = await this.executeDropItem(action, playerId)
        break
      case 'move':
        return await this.executeMove(action, playerId)
      case 'chat':
        return this.executeChat(action, playerId)
      case 'search':
        result = await this.executeSearch(playerId)
        break
      case 'rest':
        result = await this.executeRest(playerId)
        break
      case 'look':
        return this.executeLook(action, playerId)
      case 'examine_item':
        return this.executeExamineItem(action, playerId)
      case 'examine_player_item':
        return this.executeExaminePlayerItem(action, playerId)
      case 'use_item':
        result = await this.executeUseItem(action, playerId, currentTickNumber, nextTickAt)
        break
      case 'equip_item':
        result = await this.executeEquipItem(action, playerId)
        break
      case 'unequip_item':
        result = await this.executeUnequipItem(action, playerId)
        break
      case 'accept_quest':
        return await this.executeAcceptQuest(action, playerId)
      case 'complete_quest':
        return await this.executeCompleteQuest(action, playerId)
      default:
        return this.createErrorResult(action.type, `Unknown action type: ${action.type}`)
    }

    // After a TURN_ACTION completes, the room's hazard (if it has one) bites,
    // then check for enemy spawn in probabilistic rooms.
    if (result?.success && TURN_ACTIONS.has(action.type)) {
      result = await this.appendHazardEvents(result, playerId)
      result = await this.appendSpawnEvents(result, playerId)
    }

    return result
  }

  // The room's environmental hazard, rolled once per turn action. Damage is
  // written with a single guarded UPDATE that floors at 1 HP and skips the
  // dead, so a thorn bush can neither kill nor revive anyone.
  async appendHazardEvents(result, playerId) {
    const hazard = ROOM_HAZARDS[this.roomId]
    if (!hazard) return result
    if (this.activeBattles.get(playerId)?.isActive) return result
    if (Math.random() >= hazard.chance) return result

    const damage = hazard.min + Math.floor(Math.random() * (hazard.max - hazard.min + 1))
    const rows = await prisma.$queryRawUnsafe(
      `UPDATE "User" SET hp = GREATEST(1, hp - $2) WHERE id = $1 AND hp > 0 RETURNING hp, mp`,
      playerId,
      damage
    )
    const row = rows[0]
    if (!row) return result
    const hp = Number(row.hp)
    this.updatePlayer(playerId, (state) => ({ ...state, hp }))

    return {
      ...result,
      playerEvents: [
        ...(result.playerEvents ?? []),
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('room_hazard', 'danger', hazard.message(damage), { hp, mp: Number(row.mp) }),
        },
      ],
    }
  }

  // After a turn action: resolve enemy presence and append notification / auto-battle
  // events. Announces a freshly-rolled wave (all enemies at once), then — if any hostile
  // enemy is present — a random one of them attacks the player. No post-battle grace.
  async appendSpawnEvents(result, playerId) {
    if (!isProbabilistic(this.roomId)) return result

    const battle = this.activeBattles.get(playerId)
    if (battle?.isActive) return result

    const spawned = this.maybeSpawnEnemy(playerId)

    const roster = this.getPlayerEnemyRoster(playerId)
    if (!roster.length) return result

    // Announce a freshly-rolled wave (the whole group at once).
    if (spawned?.spawned?.length) {
      const enemies = this.buildEnemyList(roster)
      const names = enemies.map((e) => e.name)
      const message = enemies.length === 1
        ? `A ${names[0]} emerges from the darkness!`
        : `${enemies.length} enemies emerge from the darkness: ${names.join(', ')}!`

      result = {
        ...result,
        playerEvents: [
          ...(result.playerEvents ?? []),
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload(
              'enemy_spawn',
              'danger',
              message,
              { enemySlug: roster[0], enemyName: enemies[0]?.name, enemy: enemies[0], enemies }
            ),
          },
        ],
      }
    }

    // The priority (or a random) present hostile enemy attacks the player.
    // The enemy only gets the ambush free hit when it FRESHLY spawned this turn
    // (you were caught off guard). An enemy that was already present and known is
    // engaged without advantage — consistent with a deliberate attack.
    const targetSlug = this.pickHostileTarget(roster)
    if (targetSlug) {
      const isAmbush = Boolean(spawned?.spawned?.length)
      const battleResult = await executeStartBattle(
        { type: 'start_battle', data: { enemySlug: targetSlug, isAutoInitiated: isAmbush } },
        playerId,
        this
      )
      // Merge every channel, not just the player events: a one-turn kill here
      // carries its reward persistence on `backgroundWork`, and the room's
      // "engages a ..." line on `broadcastEvents`.
      result = mergeActionResults(result, battleResult)
    }

    return result
  }

  async executePickupItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('pickup_item', 'Player not found in this room')
    }

    const { roomItemId, quantity = 1 } = action.data || {}
    if (!roomItemId) {
      return this.createErrorResult('pickup_item', 'Room item ID is required')
    }

    this.touchActivity()

    const result = await pickupRoomItem(playerId, roomItemId, quantity, this.roomId)

    if (!result.success) {
      return this.createErrorResult('pickup_item', result.message)
    }

    return {
      success: true,
      action: 'pickup_item',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('pickup_item', 'success', result.message, {
            inventory: result.inventory,
            roomItems: result.roomItems,
          }),
        },
      ],
      broadcastEvents: [
        {
          event: 'room:items:update',
          targetRoomId: this.roomId,
          payload: {
            roomId: this.roomId,
            items: result.roomItems,
          },
        },
      ],
    }
  }

  async executeDropItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('drop_item', 'Player not found in this room')
    }

    const { playerItemId, quantity = 1 } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('drop_item', 'Player item ID is required')
    }

    this.touchActivity()

    const result = await dropRoomItem(playerId, playerItemId, quantity, this.roomId)

    if (!result.success) {
      return this.createErrorResult('drop_item', result.message)
    }

    return {
      success: true,
      action: 'drop_item',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('drop_item', 'success', result.message, {
            inventory: result.inventory,
            roomItems: result.roomItems,
          }),
        },
      ],
      broadcastEvents: [
        {
          event: 'room:items:update',
          targetRoomId: this.roomId,
          payload: {
            roomId: this.roomId,
            items: result.roomItems,
          },
        },
      ],
    }
  }

  async executeMove(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      console.log(`[RoomState:${this.roomId}] executeMove - Player ${playerId} not found`)
      return this.createErrorResult('move', 'Player not found in this room')
    }

    const activeBattle = this.activeBattles.get(playerId)
    if (activeBattle && activeBattle.isActive) {
      return this.createErrorResult('move', 'You cannot leave while in combat. Fight or flee.')
    }

    // Cannot leave while any hostile (aggressive) enemy is still present. Passive
    // enemies do not block movement and persist with the player across the move.
    if (this.hasHostileEnemies(playerId)) {
      return this.createErrorResult('move', 'You cannot leave while hostile enemies are here. Defeat them first.')
    }

    // The source is always the room this RoomState represents — the room the
    // player is demonstrably standing in. It is never taken from the action
    // payload: a caller-supplied `fromRoom` would aim both the reachability
    // lookup and the gate check below at a different room's exits.
    const fromRoom = this.roomId
    const toRoom = action.data?.toRoom
    if (!toRoom) {
      console.log(`[RoomState:${this.roomId}] executeMove - No destination room provided`)
      return this.createErrorResult('move', 'No destination room provided')
    }

    // Only server code paths set `authorizedMove`, and only after deciding the
    // destination themselves: a fixed teleport-network room, a grant the server
    // just issued (guild lair, respawn, flee retreat), or a party member being
    // pulled behind a leader who already teleported. It sits on the action
    // rather than in `action.data`, which is the half built from client input.
    const authorizedMove = action.authorizedMove === true

    // 1. REACHABILITY VALIDATION (primary constraint)
    // The direction is derived from the source room's own exits rather than
    // taken from the caller. Trusting a supplied direction meant an omitted one
    // skipped this check *and* the gate check below — the whole point of the
    // move pipeline — so an arbitrary destination travelled as a free teleport.
    let direction = null
    if (!authorizedMove) {
      try {
        // The socket layer has usually just read this room's exits itself, to
        // derive the direction for the room enter/leave messaging before the
        // move reached the engine. Like `authorizedMove`, `sourceExits` sits on
        // the action rather than in `action.data`, so it can only have been put
        // there by server code — the client-facing handlers refuse a raw `move`
        // outright. It is still only honoured when it describes the room the
        // player is demonstrably standing in; anything else falls back to the
        // database. Re-querying here was a fourth round trip on every step.
        const providedExits = action.sourceExits
        const sourceRoom =
          providedExits && providedExits.roomId === fromRoom
            ? providedExits
            : await prisma.room.findUnique({
                where: { roomId: fromRoom },
                select: {
                  roomId: true,
                  north: true,
                  northeast: true,
                  east: true,
                  southeast: true,
                  south: true,
                  southwest: true,
                  west: true,
                  northwest: true,
                  up: true,
                  down: true,
                },
              })

        if (!sourceRoom) {
          console.log(`[RoomState:${this.roomId}] executeMove - Source room ${fromRoom} not found`)
          return this.createErrorResult('move', 'Source room not found')
        }

        direction = findExitDirection(sourceRoom, toRoom)
        if (!direction) {
          console.log(`[RoomState:${this.roomId}] executeMove - No exit from ${fromRoom} leads to ${toRoom}`)
          return this.createErrorResult('move', `You don't see an exit in that direction`)
        }
      } catch (error) {
        console.error(`[RoomState:${this.roomId}] executeMove - Error validating reachability:`, error)
        return this.createErrorResult('move', 'Failed to validate room connection')
      }
    }

    // 2. GATE CHECK (additional constraint, only if reachability passes)
    let gatePassMessage = null
    let gatePassInventory = null
    if (direction) {
      const gateResult = await checkRoomGate(fromRoom, direction, playerId)
      if (gateResult && !gateResult.allowed) {
        console.log(`[RoomState:${this.roomId}] executeMove - Gate blocked ${player.username} from ${fromRoom} going ${direction}`)
        const gate = gateResult.gate
        const message = gate.message || "You cannot pass through this way."

        if (gate.silent) {
          return this.createErrorResult('move', message)
        }

        return {
          success: false,
          action: 'move',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: this.createFeedbackPayload('move', 'failure', message, {
                roomId: this.roomId,
                showModal: true,
                modalContent: gate.modalContent || message,
              }),
            },
          ],
        }
      }
      if (gateResult?.onPass) {
        // A gate that charges for the crossing can also report what the crossing
        // produced. Digging the next level of the Neverending Mine out is the
        // case that needs it: `down` is a pickaxe swing as well as a move, so
        // the ore it turns up rides back on the move's own feedback rather than
        // disappearing silently.
        const passed = await gateResult.onPass(playerId)
        if (passed?.message) gatePassMessage = passed.message
        if (passed?.inventory) gatePassInventory = passed.inventory
      }
    }

    // 3. MOVEMENT EXECUTION (both validations passed)
    console.log(`[RoomState:${this.roomId}] executeMove - ${player.username} moving from ${fromRoom} to ${toRoom}`)

    this.touchActivity()
    // Persist the full roster (passive enemies only — hostiles block the move above)
    // so the same wave is restored if the player returns to this room.
    const departingEnemyRoster = this.getPlayerEnemyRoster(playerId)
    this.removePlayer(playerId)

    const toRoomName = action.data?.toRoomName || toRoom
    const roomData = action.data?.roomData
    const message = direction ? `You travel ${direction}` : `You teleport to ${toRoomName}`

    return {
      success: true,
      action: 'move',
      data: { fromRoom, toRoom, toRoomName, roomData },
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('move', 'success', message, {
            toRoom,
            toRoomName,
            roomData,
            direction,
            ...(gatePassInventory ? { inventory: gatePassInventory } : {}),
          }),
        },
        ...(gatePassMessage
          ? [
              {
                event: 'action:feedback',
                payload: this.createFeedbackPayload('move', 'success', gatePassMessage, { roomId: toRoom }),
              },
            ]
          : []),
      ],
      broadcastEvents: [
        {
          event: 'room:player-moved',
          payload: {
            playerId,
            username: player.username,
            fromRoom,
            toRoom,
          },
          targetRoomId: fromRoom,
        },
        {
          event: 'room:player-moved',
          payload: {
            playerId,
            username: player.username,
            fromRoom,
            toRoom,
          },
          targetRoomId: toRoom,
        },
      ],
      transfer: {
        toRoomId: toRoom,
        fromRoomId: this.roomId,
        fromRoomEnemyRoster: departingEnemyRoster,
        playerState: {
          ...player,
          roomId: toRoom,
        },
      },
    }
  }

  executeChat(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('chat', 'Player not found in this room')
    }

    const message = action.data?.message?.toString().trim()
    if (!message) {
      return this.createErrorResult('chat', 'Message cannot be empty')
    }

    this.touchActivity()

    const timestamp = new Date()
    const chatId = `${playerId}-${timestamp.getTime()}`

    const payload = {
      id: chatId,
      userId: playerId,
      username: player.username,
      level: player.level ?? 1,
      message,
      timestamp,
      roomId: this.roomId,
    }

    console.log(`[RoomState:${this.roomId}] Broadcasting chat message from ${player.username}: "${message}"`)

    return {
      success: true,
      action: 'chat',
      broadcastEvents: [
        {
          event: 'chat-message',
          payload,
        },
      ],
    }
  }

  async executeAttack(playerId, { spell = null, skill = null } = {}) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('attack', 'Player not found in this room')
    }

    const activeBattle = this.activeBattles.get(playerId)
    if (activeBattle && activeBattle.isActive) {
      return await executePlayerAttack({ type: 'player_attack', data: { spell, skill } }, playerId, this)
    }

    let target = null

    if (isProbabilistic(this.roomId)) {
      // For probabilistic rooms, use the player's currently spawned enemy.
      const activeSlug = this.getPlayerActiveEnemy(playerId)
      target = activeSlug ? getEnemy(activeSlug) : null
    } else {
      const roomEnemyData = getRoomEnemies(this.roomId)
      const slugs = roomEnemyData?.enemies ?? []
      const enemies = slugs.map((s) => getEnemy(s)).filter(Boolean)
      target = enemies.find((e) => e.isAggressive) ?? enemies[0] ?? null
    }

    if (!target) {
      this.touchActivity()
      return {
        success: true,
        action: 'attack',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload(
              'attack',
              'info',
              spell ? `There is nothing here to cast ${spell.def.name} at.` : 'Nothing to attack here.'
            ),
          },
        ],
      }
    }

    return await executeStartBattle({ type: 'start_battle', data: { enemySlug: target.slug, spell, skill } }, playerId, this)
  }

  /**
   * Strike with a skill the player knows — Slice, Smash, Aim or Magic Strike.
   *
   * A strike is the turn's attack with the skill's bonus on it (and, like a
   * spell, it can open a fight). The weapon has to fit: Slice wants one hand,
   * Smash two, Aim a ranged weapon, Magic Strike anything. The friendly checks
   * here (known, fits, affordable) produce the messages; the guarded MP charge
   * in the battle handler is what makes a double click safe.
   */
  async executeUseSkill(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('use_skill', 'Player not found in this room')
    }

    const skillId = action?.data?.skillId
    const skill = typeof skillId === 'string' ? getSkill(skillId) || findSkillByCommand(skillId) : null
    if (!skill) {
      return this.createErrorResult('use_skill', 'Unknown skill.')
    }
    if (!isStrikeSkill(skill)) {
      return this.createErrorResult('use_skill', `${skill.name} works on its own — there is nothing to use.`)
    }

    const [state, gear] = await Promise.all([getSkillState(playerId), fetchEquippedWeapon(playerId)])
    if (!state) {
      return this.createErrorResult('use_skill', 'Could not load your skills.')
    }
    const level = state.skills[skill.column] || 0
    if (level < 1) {
      return this.createErrorResult('use_skill', `You haven't learned ${skill.name} yet.`)
    }
    if (!weaponFits(skill, gear)) {
      return this.createErrorResult('use_skill', `${weaponFitReason(skill, gear)} to ${skill.name}.`)
    }

    const cost = skill.castCost(level)
    if (state.mp < cost) {
      return this.createErrorResult('use_skill', `You don't have enough MP to ${skill.name}! It costs ${cost} MP and you have ${state.mp}.`)
    }

    this.touchActivity()
    return await this.executeAttack(playerId, { skill: { def: skill, level, cost } })
  }

  /**
   * Cast a spell the player knows.
   *
   * Attack spells are strikes: in a fight they are the turn's attack, and out
   * of one they open the fight the way "attack" does — the original let you
   * lead with a Fireball. Healing works anywhere; inside a fight it is a support
   * turn, so the enemy still swings. Buffs (wings, iron skin, ...) have no
   * handler yet and are refused before anything is spent.
   */
  async executeCastSpell(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('cast_spell', 'Player not found in this room')
    }

    const spellId = action?.data?.spellId
    const spell = typeof spellId === 'string' ? getSpell(spellId) || findSpellByCommand(spellId) : null
    if (!spell) {
      return this.createErrorResult('cast_spell', 'Unknown spell.')
    }
    if (!isCastable(spell)) {
      return this.createErrorResult('cast_spell', `${spell.name} cannot be cast yet.`)
    }

    const state = await getSpellState(playerId)
    if (!state) {
      return this.createErrorResult('cast_spell', 'Could not load your spells.')
    }
    const level = state.spells[spell.column] || 0
    if (level < 1) {
      return this.createErrorResult('cast_spell', `You don't know the ${spell.name} spell.`)
    }

    this.touchActivity()

    if (spell.kind === 'attack') {
      const cost = spell.castCost(level, state.effectiveMag)
      // The friendly refusal; the guarded MP charge in the battle handler is
      // what actually makes the cast safe against a second click.
      if (state.mp < cost) {
        return this.createErrorResult('cast_spell', `You don't have enough MP to cast ${spell.name}! It costs ${cost} MP and you have ${state.mp}.`)
      }
      return await this.executeAttack(playerId, { spell: { def: spell, level, cost } })
    }

    // kind === 'heal'
    const heal = await castHealSpell(playerId, spell, rand)
    if (heal.success === false) {
      return this.createErrorResult('cast_spell', heal.message)
    }

    this.updatePlayer(playerId, (s) => ({ ...s, hp: heal.hp, mp: heal.mp }))

    const message = `You cast ${spell.name} for ${heal.cost} MP and restore ${heal.hpChange} HP. [ ${heal.text} ]`
    let result = {
      success: true,
      action: 'cast_spell',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('cast_spell', 'success', message, {
            roomId: this.roomId,
            hp: heal.hp,
            mp: heal.mp,
            hpChange: heal.hpChange,
            mpChange: heal.mpChange,
            spell: {
              id: spell.id,
              name: spell.name,
              level: heal.level,
              cost: heal.cost,
              icon: spell.icon,
              hue: spell.hue,
              amount: heal.amount,
              rolls: heal.rolls,
              text: heal.text,
            },
          }),
        },
      ],
    }

    // Healing mid-fight spends the turn: the enemy answers, exactly as it does
    // for a potion.
    if (this.activeBattles.get(playerId)?.isActive) {
      const supportTurn = await resolveSupportTurn(playerId, this, {
        kind: 'cast_spell',
        itemSlug: spell.id,
        itemName: spell.name,
        itemMetadata: { icon: spell.icon },
        actionVerb: 'cast',
        effectText: `+${heal.hpChange} HP`,
      })
      return mergeSupportTurnIntoResult(result, supportTurn)
    }

    // Out of a fight it is a turn action like rest: something may notice.
    return await this.appendSpawnEvents(result, playerId)
  }

  async executeSearch(playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('search', 'Player not found in this room')
    }

    this.touchActivity()

    const revealDef = getRevealDefinition(this.roomId)
    if (revealDef) {
      // The next passage this room still hides — the only one for most rooms,
      // the next in order for a staged room like the Dark Grove.
      const stage = getNextRevealStage(playerId, this.roomId)
      if (!stage) {
        return {
          success: true,
          action: 'search',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: this.createFeedbackPayload(
                'search',
                'info',
                revealDef.exhaustedMessage || 'You search the room again and find nothing new.'
              ),
            },
          ],
        }
      }
      const chance = stage.chance ?? 1
      if (Math.random() >= chance) {
        return {
          success: true,
          action: 'search',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: this.createFeedbackPayload('search', 'info', stage.failMessage),
            },
          ],
        }
      }
      // Staged rooms track each passage by direction; single ones by room.
      markRevealed(playerId, this.roomId, Array.isArray(revealDef.stages) ? stage.direction : null)
      const { getRoomStateNote: getRevealStateNote } = require('./search-reveal-state')
      return {
        success: true,
        action: 'search',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload('search', 'success', stage.successMessage, {
              stateNote: getRevealStateNote(playerId, this.roomId) ?? stage.stateNote,
              roomPatch: { [stage.direction]: stage.toRoom },
            }),
          },
        ],
      }
    }

    const lootTable = SEARCH_LOOT_TABLES[this.roomId]
    if (!lootTable) {
      return {
        success: true,
        action: 'search',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload('search', 'success', 'You search the room and find nothing.'),
          },
        ],
      }
    }

    // A one-off find (the Forest Dead End's iron hatchet) stops paying out once
    // the player is carrying it, rather than rolling and silently capping.
    if (lootTable.onlyWhileMissing) {
      const { playerHasItem } = require('./services/inventory-service')
      if (await playerHasItem(playerId, lootTable.onlyWhileMissing.itemSlug)) {
        return {
          success: true,
          action: 'search',
          playerEvents: [
            {
              event: 'action:feedback',
              payload: this.createFeedbackPayload('search', 'info', lootTable.onlyWhileMissing.message),
            },
          ],
        }
      }
    }

    // Chance of finding anything at all. Defaults to the 50/50 the first search
    // rooms used; the authored rooms below set their own odds.
    if (Math.random() >= (lootTable.chance ?? 0.5)) {
      return {
        success: true,
        action: 'search',
        playerEvents: [
          {
            event: 'action:feedback',
            payload: this.createFeedbackPayload('search', 'info', lootTable.failMessage),
          },
        ],
      }
    }

    // Roll loot
    const roll = Math.floor(Math.random() * lootTable.entries.length)
    const entry = lootTable.entries[roll]
    let message

    let updatedInventory = null

    if (entry.effect.type === 'grantCurrency') {
      const amount = Math.floor(Math.random() * (entry.effect.max - entry.effect.min + 1)) + entry.effect.min
      message = entry.message(amount)
      await prisma.user.update({
        where: { id: playerId },
        data: { currency: { increment: amount } },
      })
    } else if (entry.effect.type === 'grantItem') {
      let qty = entry.effect.quantity || 1
      if (entry.effect.minQty != null && entry.effect.maxQty != null) {
        qty = Math.floor(Math.random() * (entry.effect.maxQty - entry.effect.minQty + 1)) + entry.effect.minQty
        message = entry.message(qty)
      } else {
        message = entry.message
      }
      const result = await grantItemOnce(playerId, entry.effect.itemSlug, qty)
      updatedInventory = result.inventory ?? null
    }

    return {
      success: true,
      action: 'search',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('search', 'success', message, {
            ...(updatedInventory ? { inventory: updatedInventory } : {}),
          }),
        },
      ],
    }
  }

  // Shared rest implementation.
  //   - Standard rest (overchargeBonus 0): recovers physical/mental training amounts, capped at max.
  //   - Overcharge rest (overchargeBonus > 0): sets HP/MP to max + bonus.
  async applyRest(playerId, { action, overchargeBonus = 0, overchargeMessage, fullRestore = false, fullRestoreMessage } = {}) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult(action, 'Player not found in this room')
    }

    const activeBattle = this.activeBattles.get(playerId)
    if (activeBattle && activeBattle.isActive) {
      return this.createErrorResult(action, 'You cannot rest during combat.')
    }

    this.touchActivity()

    // Read live vitals from the DB, not the in-memory players map. Battle damage
    // only writes to the DB (see battle-action-handlers), so the in-memory hp/mp
    // can be stale-high after a fight. Resting off the stale value would report a
    // full/overcharged heal while leaving the real (low) DB hp untouched.
    const liveStats = await prisma.user.findUnique({
      where: { id: playerId },
      select: { hp: true, mp: true, hpMax: true, mpMax: true, physicalTraining: true, mentalTraining: true },
    })
    if (!liveStats) {
      return this.createErrorResult(action, 'Could not load your stats.')
    }

    const hpMax = liveStats.hpMax ?? player.hpMax ?? 10
    const mpMax = liveStats.mpMax ?? player.mpMax ?? 2

    let newHp
    let newMp
    let message

    if (overchargeBonus > 0) {
      newHp = hpMax + overchargeBonus
      newMp = mpMax + overchargeBonus
      message = overchargeMessage ?? `Your HP and MP are fully restored, plus an extra +${overchargeBonus} to each.`
    } else if (fullRestore) {
      // Restore to full without overcharging. An already-overcharged player
      // keeps the overcharge — resting is never allowed to take vitals away.
      newHp = Math.max(liveStats.hp ?? 0, hpMax)
      newMp = Math.max(liveStats.mp ?? 0, mpMax)
      message = fullRestoreMessage ?? 'Your HP and MP are fully restored.'
    } else {
      const pt = liveStats.physicalTraining ?? player.physicalTraining ?? 1
      const mt = liveStats.mentalTraining ?? player.mentalTraining ?? 0
      const curHp = liveStats.hp ?? 0
      const curMp = liveStats.mp ?? 0

      // Recovery only ever increases vitals. If the player is overcharged
      // (hp/mp above max), preserve the overcharge instead of capping it away.
      newHp = Math.max(curHp, Math.min(hpMax, curHp + pt))
      newMp = Math.max(curMp, Math.min(mpMax, curMp + mt))
      const hpGained = Math.max(0, newHp - curHp)
      const mpGained = Math.max(0, newMp - curMp)

      if (hpGained === 0 && mpGained === 0) {
        // Keep the in-memory map aligned with the live DB values we just read.
        this.updatePlayer(playerId, (state) => ({ ...state, hp: newHp, mp: newMp }))
        return {
          success: true,
          action,
          playerEvents: [
            {
              event: 'action:feedback',
              payload: this.createFeedbackPayload(action, 'success', 'You already have full HP and MP.', { hp: newHp, mp: newMp }),
            },
          ],
        }
      }

      const parts = []
      if (hpGained > 0) parts.push(`${hpGained} HP`)
      if (mpGained > 0) parts.push(`${mpGained} MP`)
      message = `You recover ${parts.join(' and ')}.`
    }

    this.updatePlayer(playerId, (state) => ({ ...state, hp: newHp, mp: newMp }))
    await prisma.user.update({ where: { id: playerId }, data: { hp: newHp, mp: newMp } })

    return {
      success: true,
      action,
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload(action, 'success', message, { hp: newHp, mp: newMp }),
        },
      ],
    }
  }

  async executeRest(playerId) {
    return this.applyRest(playerId, { action: 'rest' })
  }

  // Lobby (room 999) rest: overcharges HP and MP to 10 above their max.
  async executeLobbyRest(playerId) {
    return this.applyRest(playerId, {
      action: 'rest in lobby',
      overchargeBonus: 10,
      overchargeMessage: 'You rest near the fountain. Your HP and MP are fully restored, plus an extra +10 to each.',
    })
  }

  // Waterfall (room 020) rest: overcharges HP and MP to 10 above their max.
  async executeWaterfallRest(playerId) {
    return this.applyRest(playerId, {
      action: 'rest at waterfall',
      overchargeBonus: 10,
      overchargeMessage: 'You rest beneath the waterfall. Your HP and MP are fully restored, plus an extra +10 to each.',
    })
  }

  executeLook(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('look', 'Player not found in this room')
    }

    this.touchActivity()

    const roomName = action?.data?.roomName || this.roomId
    const message = `You look around: ${roomName}`

    return {
      success: true,
      action: 'look',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('look', 'success', message, {
            roomId: this.roomId,
            playerCount: this.players.size,
          }),
        },
      ],
    }
  }

  async executeExamineItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('examine_item', 'Player not found in this room')
    }

    const { roomItemId } = action.data || {}
    if (!roomItemId) {
      return this.createErrorResult('examine_item', 'Room item ID is required')
    }

    this.touchActivity()

    // Get all room items to find the one being examined
    const roomItems = await getRoomItems(this.roomId)
    const item = roomItems.find((item) => item.id === roomItemId)

    if (!item) {
      return this.createErrorResult('examine_item', 'Item not found in this room')
    }

    const itemName = item.template.name
    const itemDescription = item.template.description || 'You see nothing special about it.'
    const message = `You examine the ${itemName}. ${itemDescription}`

    return {
      success: true,
      action: 'examine_item',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('examine_item', 'success', message, {
            roomId: this.roomId,
            itemName,
            itemDescription,
          }),
        },
      ],
    }
  }

  async executeExaminePlayerItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('examine_player_item', 'Player not found in this room')
    }

    const { playerItemId } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('examine_player_item', 'Player item ID is required')
    }

    this.touchActivity()

    // Get player inventory to find the item being examined
    const inventory = await getPlayerInventory(playerId)
    const item = inventory.find((item) => item.id === playerItemId)

    if (!item) {
      return this.createErrorResult('examine_player_item', 'Item not found in your inventory')
    }

    const itemName = item.template.name
    const itemDescription = item.template.description || 'You see nothing special about it.'
    const message = `You examine the ${itemName}. ${itemDescription}`

    return {
      success: true,
      action: 'examine_player_item',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('examine_player_item', 'success', message, {
            itemName,
            itemDescription,
          }),
        },
      ],
    }
  }

  async executeUseItem(action, playerId, currentTickNumber, nextTickAt) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('use_item', 'Player not found in this room')
    }

    const { playerItemId, action: itemAction } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('use_item', 'Player item ID is required')
    }
    if (!itemAction) {
      return this.createErrorResult('use_item', 'Item action is required')
    }

    this.touchActivity()

    // Get player inventory to find the item being used
    const inventory = await getPlayerInventory(playerId)
    const item = inventory.find((item) => item.id === playerItemId)

    if (!item) {
      return this.createErrorResult('use_item', 'Item not found in your inventory')
    }

    const itemSlug = item.template.slug
    if (!itemSlug) {
      return this.createErrorResult('use_item', 'Item slug not found')
    }

    // Capture item identity before the action runs — the item may be consumed.
    const itemName = item.template.name
    const itemMetadata = item.template.metadata || null

    // Execute the item-specific action
    const itemActionResult = await executeItemAction(
      itemSlug,
      itemAction,
      playerId,
      this,
      currentTickNumber,
      nextTickAt,
      playerItemId,
      item
    )

    if (itemActionResult === null) {
      return this.createErrorResult('use_item', `Action "${itemAction}" is not available for this item`)
    }

    // If the player is in battle, the item use also costs a turn — the enemy strikes.
    if (itemActionResult.success && this.activeBattles.get(playerId)?.isActive) {
      const effectText = extractEffectText(itemActionResult)
      const supportTurn = await resolveSupportTurn(playerId, this, {
        kind: 'use_item',
        itemSlug,
        itemName,
        itemMetadata,
        actionVerb: itemAction,
        effectText,
      })
      return mergeSupportTurnIntoResult(itemActionResult, supportTurn)
    }

    return itemActionResult
  }

  async executeEquipItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('equip_item', 'Player not found in this room')
    }

    const { playerItemId } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('equip_item', 'Player item ID is required')
    }

    this.touchActivity()

    const result = await equipItem(playerId, playerItemId)

    if (!result.success) {
      return this.createErrorResult('equip_item', result.message)
    }

    const baseResult = {
      success: true,
      action: 'equip_item',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('equip_item', 'success', result.message, {
            inventory: result.inventory,
            player: result.player,
          }),
        },
      ],
    }

    if (this.activeBattles.get(playerId)?.isActive) {
      const supportTurn = await resolveSupportTurn(playerId, this, {
        kind: 'equip_item',
        itemSlug: result.item?.slug,
        itemName: result.item?.name,
        itemMetadata: result.item?.metadata ?? null,
        actionVerb: 'equip',
        effectText: null,
      })
      return mergeSupportTurnIntoResult(baseResult, supportTurn)
    }

    return baseResult
  }

  async executeUnequipItem(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('unequip_item', 'Player not found in this room')
    }

    const { playerItemId } = action.data || {}
    if (!playerItemId) {
      return this.createErrorResult('unequip_item', 'Player item ID is required')
    }

    this.touchActivity()

    const result = await unequipItem(playerId, playerItemId)

    if (!result.success) {
      return this.createErrorResult('unequip_item', result.message)
    }

    const baseResult = {
      success: true,
      action: 'unequip_item',
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload('unequip_item', 'success', result.message, {
            inventory: result.inventory,
            player: result.player,
          }),
        },
      ],
    }

    if (this.activeBattles.get(playerId)?.isActive) {
      const supportTurn = await resolveSupportTurn(playerId, this, {
        kind: 'unequip_item',
        itemSlug: result.item?.slug,
        itemName: result.item?.name,
        itemMetadata: result.item?.metadata ?? null,
        actionVerb: 'unequip',
        effectText: null,
      })
      return mergeSupportTurnIntoResult(baseResult, supportTurn)
    }

    return baseResult
  }

  async executeAcceptQuest(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('accept_quest', 'Player not found in this room')
    }

    const { questId, choiceId } = action.data || {}
    if (!questId) {
      return this.createErrorResult('accept_quest', 'Quest ID is required')
    }

    this.touchActivity()

    const { playerAcceptQuest, getQuestDef } = require('./services/quest-service')

    // Load quest definition early to validate room context
    const questDef = getQuestDef(questId)
    if (!questDef) {
      return this.createErrorResult('accept_quest', 'Quest not found')
    }

    // Validate that player is in the quest giver's room
    if (!questDef.giver || !questDef.giver.roomId) {
      return this.createErrorResult('accept_quest', 'Quest giver information is missing')
    }

    if (this.roomId !== questDef.giver.roomId) {
      const npcName = this.getNpcFriendlyName(questDef.giver.npcId || 'the quest giver', questDef.giver)
      return this.createErrorResult('accept_quest', `You need to speak to ${npcName} to do that.`)
    }

    // playerAcceptQuest: sets data.accepted=true, immediately completes no-requirement quests
    const result = await playerAcceptQuest(playerId, questId)

    if (!result.success) {
      return this.createErrorResult('accept_quest', result.error || 'Failed to accept quest')
    }

    const questTitle = questDef.title || questId
    // If the quest was immediately completed (no requirements), include full reward data
    const isCompleted = result.player != null
    const feedbackMessage = isCompleted
      ? `Quest completed: ${questTitle}`
      : `Quest accepted: ${questTitle}`

    const data = {
      roomId: this.roomId,
      quests: result.quests,
      ...(isCompleted ? { player: result.player, inventory: result.inventory } : {}),
    }

    const playerEvents = [
      {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('accept_quest', 'success', feedbackMessage, data),
      },
    ]

    if (result.levelUp?.leveled) {
      playerEvents.push({ event: 'player:level-up', payload: result.levelUp })
    }

    return {
      success: true,
      action: 'accept_quest',
      playerEvents,
    }
  }

  async executeCompleteQuest(action, playerId) {
    const player = this.players.get(playerId)
    if (!player) {
      return this.createErrorResult('complete_quest', 'Player not found in this room')
    }

    const { questId } = action.data || {}
    if (!questId) {
      return this.createErrorResult('complete_quest', 'Quest ID is required')
    }

    this.touchActivity()

    const { completeQuest, getQuestDef } = require('./services/quest-service')
    
    // Load quest definition early to validate room context
    const questDef = getQuestDef(questId)
    if (!questDef) {
      return this.createErrorResult('complete_quest', 'Quest not found')
    }

    // Validate that player is in the quest giver's room
    if (!questDef.giver || !questDef.giver.roomId) {
      return this.createErrorResult('complete_quest', 'Quest giver information is missing')
    }

    if (this.roomId !== questDef.giver.roomId) {
      const npcName = this.getNpcFriendlyName(questDef.giver.npcId || 'the quest giver', questDef.giver)
      return this.createErrorResult('complete_quest', `You need to speak to ${npcName} to do that.`)
    }

    const result = await completeQuest(playerId, questId)

    if (!result.success) {
      return this.createErrorResult('complete_quest', result.error || 'Failed to complete quest')
    }

    const questTitle = questDef ? questDef.title : questId

    // Build rewards message. Item rewards are enriched with their template name
    // (and icon) so the completion modal and feedback text can display them.
    const rewards = questDef?.rewards || []
    const enrichedRewards = []
    const rewardMessages = []
    for (const reward of rewards) {
      if (reward.type === 'currency') {
        enrichedRewards.push(reward)
        rewardMessages.push(`${reward.amount} gold`)
      } else if (reward.type === 'xp') {
        enrichedRewards.push(reward)
        rewardMessages.push(`${reward.amount} XP`)
      } else if (reward.type === 'item') {
        const template = await getItemBySlug(reward.itemSlug)
        const name = template?.name || reward.itemSlug
        const quantity = reward.quantity || 1
        enrichedRewards.push({ ...reward, name, quantity, icon: template?.icon || null })
        rewardMessages.push(quantity > 1 ? `${name} x${quantity}` : name)
      } else {
        enrichedRewards.push(reward)
      }
    }
    const rewardText = rewardMessages.length > 0 ? ` You received: ${rewardMessages.join(', ')}.` : ''

    // Build quest chain message if new quests were started
    let questChainData = null
    let toastMessage = null
    if (result.startedQuestIds && result.startedQuestIds.length > 0) {
      const { getQuestDef } = require('./services/quest-service')
      
      // Map quest IDs to quest definitions and format as "(number) title"
      const questEntries = result.startedQuestIds
        .map(questId => {
          const def = getQuestDef(questId)
          return def ? { number: def.number, title: def.title } : null
        })
        .filter(Boolean)
        .sort((a, b) => a.number - b.number)
        .map(q => `(${q.number}) ${q.title}`)
      
      const formattedMessage = `New quests: ${questEntries.join(', ')}.`
      
      questChainData = {
        startedQuestIds: result.startedQuestIds,
        message: formattedMessage,
      }
      toastMessage = formattedMessage
    }

    // Build new quest entries for the rewards panel
    const newQuestTitles = (result.startedQuestIds || [])
      .map(id => {
        const def = getQuestDef(id)
        return def ? { title: `(${def.number}) ${def.title}`, objective: def.objective || null } : null
      })
      .filter(Boolean)

    const data = {
      roomId: this.roomId,
      quests: result.quests,
      inventory: result.inventory,
      player: result.player,
      showModal: true,
      modalContent: {
        type: 'icon',
        icon: questDef.giver?.icon || 'scroll',
        iconColor: 'yellow-400',
        title: questDef.giver?.name || 'Quest Complete',
        header: 'Quest Complete!',
        message: questDef.completionDialog || null,
      },
      questComplete: {
        questTitle: questDef.title,
        rewards: enrichedRewards,
        levelUp: result.levelUp?.leveled ? result.levelUp : null,
        newQuestTitles,
      },
    }

    // Add quest chain data if quests were started
    if (questChainData) {
      data.questChain = questChainData
      data.toast = toastMessage
    }

    const playerEvents = [
      {
        event: 'action:feedback',
        payload: this.createFeedbackPayload('complete_quest', 'success', `Quest completed: ${questTitle}.${rewardText}`, data),
      },
    ]

    if (result.levelUp?.leveled) {
      playerEvents.push({ event: 'player:level-up', payload: result.levelUp })
    }

    return {
      success: true,
      action: 'complete_quest',
      playerEvents,
    }
  }

  createFeedbackPayload(action, outcome, message, data = {}) {
    const ts = Date.now()
    return {
      action,
      message,
      outcome,
      ts,
      timestamp: new Date(ts).toISOString(),
      success: outcome === 'success',
      data,
    }
  }

  createErrorResult(action, message) {
    return {
      success: false,
      action,
      message,
      playerEvents: [
        {
          event: 'action:feedback',
          payload: this.createFeedbackPayload(action, 'failure', message),
        },
      ],
    }
  }

  /**
   * Convert npcId to friendly name for error messages
   * @param {string} npcId - The NPC ID
   * @returns {string} Friendly NPC name
   */
  /**
   * Display name for a quest giver, for "you need to speak to X" messages.
   *
   * Reads `giver.name` from quests.json — the same field the NPC card renders —
   * so a new quest giver never has to be registered in a second place. The
   * npcId is only ever the last-resort fallback.
   */
  getNpcFriendlyName(npcId, giver = null) {
    if (giver?.name) return giver.name
    if (npcId === 'old_man') return 'the Old Man'
    return npcId
  }

  touchActivity() {
    this.lastActionAt = Date.now()
  }

  buildAmbientData(now) {
    // Removed MIN_AMBIENT_INTERVAL_MS restriction - ambient data is part of every world tick
    const hasPlayers = this.players.size > 0

    if (!hasPlayers) {
      return null
    }

    // Update timestamp every time (no interval check)
    // Ambient data generates on every world tick (every 5 seconds)
    this.lastAmbientHintAt = now

    // A room with its own authored lines uses them instead of the generic set.
    const flavorSnippets = ROOM_FLAVOR[this.roomId] ?? [
      'A faint breeze rustles through the area.',
      'You hear distant footsteps echo briefly.',
      'The lights flicker for just a moment.',
      'Something unseen shifts in the shadows.',
    ]

    const flavor = flavorSnippets[Math.floor(Math.random() * flavorSnippets.length)]

    return {
      type: 'flavor',
      message: flavor,
      timestamp: now,
    }
  }
}

module.exports = {
  RoomState,
  SEARCH_LOOT_TABLES,
  ROOM_FLAVOR,
  ROOM_HAZARDS,
  // Exported for tests: this is the plumbing that decides which of an action
  // result's five channels survive a merge, and losing one is silent at runtime.
  mergeActionResults,
}
