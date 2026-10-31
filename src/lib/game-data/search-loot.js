/**
 * What a room's Search can turn up: per room, the chance of finding anything
 * at all and the even roll across its entries. Pure data, so the seed can read
 * it (`Room.hasSearch` is derived from this table and the reveal definitions),
 * and the World Tool's items page can say where an item is found.
 *
 * `chance` defaults to the coin flip the first rooms used. `onlyWhileMissing`
 * stops a one-off find (the Forest Dead End's hatchet) paying out while the
 * player carries it. A room with no entry here and no reveal definition
 * (search-reveal-state.js) answers "You search the room and find nothing."
 *
 * The roll itself is RoomState.executeSearch (game-engine/room-state.js).
 */
const SEARCH_LOOT_TABLES = {
  // ==================== MOUNTAINS ====================
  // The Abandoned Campsite & Lift: a coin flip, then one of ten things left
  // behind by whoever abandoned it — the original's spread, potions included.
  '606': {
    chance: 0.5,
    failMessage: 'You search the Abandoned Mountain Lift and find nothing, you should search again.',
    entries: [
      { message: 'You search the Abandoned Mountain Lift and find a Bluefish!', effect: { type: 'grantItem', itemSlug: 'bluefish', quantity: 1 } },
      { message: (amount) => `You search the Abandoned Mountain Lift and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 100, max: 300 } },
      { message: 'You search the Abandoned Mountain Lift and find a Gills Potion!', effect: { type: 'grantItem', itemSlug: 'gills-potion', quantity: 1 } },
      { message: 'You search the Abandoned Mountain Lift and find a Red Balm!', effect: { type: 'grantItem', itemSlug: 'red-balm', quantity: 1 } },
      { message: 'You search the Abandoned Mountain Lift and find a Wings Potion!', effect: { type: 'grantItem', itemSlug: 'wings-potion', quantity: 1 } },
      { message: 'You search the Abandoned Mountain Lift and find a Purple Balm!', effect: { type: 'grantItem', itemSlug: 'purple-balm', quantity: 1 } },
      { message: 'You search the Abandoned Mountain Lift and find some Blues!', effect: { type: 'grantItem', itemSlug: 'blues', quantity: 1 } },
      { message: 'You search the Abandoned Mountain Lift and find some Reds!', effect: { type: 'grantItem', itemSlug: 'reds', quantity: 1 } },
      { message: 'You search the Abandoned Mountain Lift and find some Greens!', effect: { type: 'grantItem', itemSlug: 'greens', quantity: 1 } },
      { message: 'You search the Abandoned Mountain Lift and find some Yellows!', effect: { type: 'grantItem', itemSlug: 'yellows', quantity: 1 } },
    ],
  },
  // The Cathedral Graveyard: the dead were buried with things. A coin flip,
  // then one of ten.
  '616': {
    chance: 0.5,
    failMessage: 'You search the cathedral graveyard and find nothing, you should search again.',
    entries: [
      { message: 'You search the cathedral graveyard and find an Off Hand Sword!', effect: { type: 'grantItem', itemSlug: 'off-hand-sword', quantity: 1 } },
      { message: 'You search the cathedral graveyard and find an Iron Sword!', effect: { type: 'grantItem', itemSlug: 'iron-sword', quantity: 1 } },
      { message: (amount) => `You search the cathedral graveyard and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 300, max: 700 } },
      { message: 'You search the cathedral graveyard and find a Glowing Orb!', effect: { type: 'grantItem', itemSlug: 'glowing-orb', quantity: 1 } },
      { message: 'You search the cathedral graveyard and find a pair of Iron Boots!', effect: { type: 'grantItem', itemSlug: 'iron-boots', quantity: 1 } },
      { message: 'You search the cathedral graveyard and find a Red Balm!', effect: { type: 'grantItem', itemSlug: 'red-balm', quantity: 1 } },
      { message: 'You search the cathedral graveyard and find a Blue Balm!', effect: { type: 'grantItem', itemSlug: 'blue-balm', quantity: 1 } },
      { message: 'You search the cathedral graveyard and find some Reds!', effect: { type: 'grantItem', itemSlug: 'reds', quantity: 1 } },
      { message: 'You search the cathedral graveyard and find some Greens!', effect: { type: 'grantItem', itemSlug: 'greens', quantity: 1 } },
      { message: 'You search the cathedral graveyard and find some Blues!', effect: { type: 'grantItem', itemSlug: 'blues', quantity: 1 } },
    ],
  },
  // The Spider Cave Entrance. The original's search here: a coin flip, and a
  // Wooden Necklace in the rocks for whoever does not already have one — "you
  // leave it for the next adventurer" once you do.
  '007': {
    chance: 0.5,
    failMessage: 'You search the Cave Entrance and think you see something in the rocks, you should search again.',
    onlyWhileMissing: {
      itemSlug: 'wooden-necklace',
      message: 'You find a Wooden Necklace, but you already have one, so you leave it for the next adventurer.',
    },
    entries: [
      { message: 'You search the Cave Entrance and find a Wooden Necklace!', effect: { type: 'grantItem', itemSlug: 'wooden-necklace', quantity: 1 } },
    ],
  },
  // The Swampy Marsh. A coin flip, then one of ten things out of the mud —
  // the original's spread, bitchin' Battle Axe included.
  '013': {
    chance: 0.5,
    failMessage: 'You search the swampy marsh but find nothing.',
    entries: [
      { message: 'You search the swampy marsh and find 2 Blueberries!', effect: { type: 'grantItem', itemSlug: 'blueberry', quantity: 2 } },
      { message: 'You search the swampy marsh and find 4 Redberries!', effect: { type: 'grantItem', itemSlug: 'redberry', quantity: 4 } },
      { message: 'You search the swampy marsh and find 10 bolts!', effect: { type: 'grantItem', itemSlug: 'crossbow-bolt', quantity: 10 } },
      { message: 'You search the swampy marsh and find 2 bolts!', effect: { type: 'grantItem', itemSlug: 'crossbow-bolt', quantity: 2 } },
      { message: (amount) => `You search the swampy marsh and find ${amount} gold!`, effect: { type: 'grantCurrency', min: 10, max: 30 } },
      { message: (amount) => `You search the swampy marsh and find ${amount} arrows!`, effect: { type: 'grantItem', itemSlug: 'arrow', minQty: 2, maxQty: 4 } },
      { message: "You search the swampy marsh and find a bitchin' Battle Axe!", effect: { type: 'grantItem', itemSlug: 'battle-axe', quantity: 1 } },
      { message: 'You search the swampy marsh and find a Red Potion!', effect: { type: 'grantItem', itemSlug: 'red-potion', quantity: 1 } },
      { message: 'You search the swampy marsh and find a Morning Star!', effect: { type: 'grantItem', itemSlug: 'morning-star', quantity: 1 } },
      { message: 'You search the swampy marsh and find a Long Sword!', effect: { type: 'grantItem', itemSlug: 'long-sword', quantity: 1 } },
    ],
  },
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

module.exports = { SEARCH_LOOT_TABLES }
