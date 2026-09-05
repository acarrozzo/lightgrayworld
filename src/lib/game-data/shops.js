/**
 * Single source of truth for every shop in the game.
 *
 * NOT YET PORTED: the Pajama Shaman (room 021). The original sold a flail,
 * morning star, gladius, battle axe, warhammer, claymore, long bow, arrows,
 * pajamas and slippers, from 800 to 5000 gold — a mid-game weapon shop whose
 * prices would need balancing against this version's economy rather than
 * copying across. Room 021's description still advertises it ("selling some
 * basic items"), so it is content owed, not content cut.
 *
 * Keyed by the roomId the shop stands in. Consumed by:
 *   - game-engine/room-action-handlers.js  (the `view shop` action's stock list)
 *   - app/api/shop/buy/route.ts            (authoritative "is this actually for
 *                                            sale, and is the player standing in
 *                                            the shop that sells it?" check)
 *
 * `requiresQuest`, where present, is the completed quest that opens the shop —
 * guild membership, in every case so far. It lives here rather than on the room
 * action because BOTH consumers have to honour it: hiding the stock list is not
 * what makes a purchase illegal, the buy route refusing it is.
 *
 * Prices are NOT listed here. A shop sells an item at its `ItemTemplate.value`
 * via shop-pricing.ts, so one item costs the same everywhere and a price can
 * never drift between the card the player sees and the gold they are charged.
 * Where the original priced the same item differently per shop, the template
 * value is the canonical one.
 *
 * `stock` is ordered for display: weapons, then armour, then consumables.
 *
 * @typedef {{ name: string, stock: string[], requiresQuest?: string }} Shop
 * @type {Record<string, Shop>}
 */
const SHOPS = {
  // ==================== GRASSY FIELD ====================
  '006': {
    name: 'General Store',
    stock: [
      'dagger',
      'basic-staff',
      'mace',
      'broad-sword',
      'long-sword',
      'kite-shield',
      'buckler',
      'basic-hood',
      'padded-armor',
      'black-gloves',
      'black-boots',
      'red-potion',
      'blue-potion',
    ],
  },

  // ==================== RED TOWN ====================
  // Broccoli Rob's Veggie Stand — the farm stall on the road in.
  '207': {
    name: "Broccoli Rob's Veggie Stand",
    stock: ['veggies', 'redberry', 'blueberry'],
  },

  // Adam's General Store — the broadest stock in town. The original also sold an
  // antidote potion; there is no poison status effect yet, so it is left out
  // rather than sold as a no-op.
  '216': {
    name: "Adam's General Store",
    stock: [
      'dagger',
      'long-sword',
      'arrow',
      'crossbow-bolt',
      'redberry',
      'blueberry',
      'meatball',
      'bluefish',
      'red-potion',
      'blue-potion',
      'purple-potion',
      'red-balm',
      'blue-balm',
      'purple-balm',
      'wings-potion',
      'gills-potion',
    ],
  },

  // Todd's Pub & Inn — drinks only, no gear.
  '220': {
    name: "Todd's Pub & Inn",
    stock: [
      'red-potion',
      'blue-potion',
      'purple-potion',
      'red-balm',
      'blue-balm',
      'purple-balm',
      'wings-potion',
      'gills-potion',
    ],
  },

  // The Wizard's Guild stall, open to members only (`requiresQuest`).
  '225': {
    name: "Wizard's Guild Store",
    requiresQuest: 'quest_wizardsguild_000',
    stock: [
      'wand',
      'wizard-staff',
      'gray-wand',
      // The guild's own forge work, and the reason a member shops here rather
      // than at Adam's: a one-handed and a two-handed iron staff.
      'iron-staff',
      'iron-battle-staff',
      'wizard-hat',
      'gray-robe',
      'ring-of-magic-v',
      'ring-of-mana-regen-iii',
      'blue-potion',
      'blue-balm',
    ],
  },

  // The Warrior's Guild stall, likewise members only.
  '226': {
    name: "Warrior's Guild Store",
    requiresQuest: 'quest_warriorsguild_000',
    stock: [
      'iron-dagger',
      'iron-sword',
      'polearm',
      'iron-2h-sword',
      'ring-of-strength-v',
      'ring-of-health-regen-v',
      'meatball',
      'red-balm',
    ],
  },

  // Michael's Weapon Shop — blades floor to ceiling, and the high end of them.
  '227': {
    name: "Michael's Weapon Shop",
    stock: [
      'gladius',
      'three-chained-flail',
      'giant-club',
      'great-white-sword',
      'guardian-blade',
      'claymore',
      'polearm',
      'bone-cudgel',
      'hammerhead-hammer',
      'humongous-battleaxe',
      'hand-crossbow',
      'compound-crossbow',
      'black-crossbow',
      'off-hand-dagger',
    ],
  },

  // Vincenzo's Meat & Produce Stand.
  '229': {
    name: "Vincenzo's Meat & Produce Stand",
    stock: ['cooked-meat', 'meatball', 'bluefish', 'veggies'],
  },

  // Red Town Stables, outside the Grand Gate. The original posted the board and
  // left it "COMING SOON"; the stalls are open now, at the prices it advertised.
  // Ordered cheapest first — this is a ladder you climb over a very long time.
  '237': {
    name: 'Red Town Stables',
    stock: [
      'pony',
      'stallion',
      'clydesdale',
      'thoroughbred',
      'donkey',
      'mule',
      'mustang',
      'unicorn',
    ],
  },

  // The Shady Shop, hidden behind the alley banners: ammunition by the sack,
  // the four stat capsules, and one very expensive necklace. No questions either way.
  '236': {
    name: 'Shady Shop',
    stock: ['arrow', 'crossbow-bolt', 'reds', 'greens', 'blues', 'yellows', 'vapor-necklace'],
  },

  // ==================== ROCKY FLATS ====================
  // The Mining Guild's supply shop — the strange dwarf with the perfectly
  // ordered display, consolidated into the guild hall along with the rest of the
  // interior. Membership is checked by the room action, not here.
  //
  // Ordered as the original's list was: the pick and hammer of each tier
  // together, cheapest tier first. A better pick digs a better seam; a better
  // hammer works a better metal at the forge.
  '308': {
    name: 'Mining Guild Supply Shop',
    requiresQuest: 'quest_miningguild_000',
    stock: [
      'pickaxe',
      'hammer',
      'iron-pickaxe',
      'iron-hammer',
      'steel-pickaxe',
      'steel-hammer',
      'mithril-pickaxe',
      'mithril-hammer',
    ],
  },

  // The Silver Shop on the north side of the Dwarf Village square. One very
  // well-dressed dwarf selling exactly what he is wearing, at exactly the prices
  // the Babylon Gardens chest and the Silver Vault are an alternative to.
  '310': {
    name: 'Silver Shop',
    stock: [
      'silver-sword',
      'silver-2h-sword',
      'silver-staff',
      'silver-boomerang',
      'silver-bow',
      'silver-crossbow',
      'silver-shield',
      'silver-helmet',
      'silver-breastplate',
      'silver-gauntlets',
      'silver-boots',
      'silver-ring',
      'silver-necklace',
    ],
  },

  // ==================== DARK FOREST ====================
  // The Ranger's Guild shop, up in the tree tops: Guild Merchant Flynn's bows,
  // crossbows, boomerangs and the green leathers, members only. The original
  // also listed three Black weapons and commented them out; they stay out.
  // Ammo is sold by the round at the item's own value, as Adam's sells it.
  '515e': {
    name: 'Ranger Shop',
    requiresQuest: 'quest_rangersguild_000',
    stock: [
      'mithril-boomerang',
      'mithril-bow',
      'mithril-crossbow',
      'greenhorn-bow',
      'ranger-crossbow',
      'ranger-hood',
      'ranger-cloak',
      'ranger-gloves',
      'ranger-boots',
      'ranger-amulet',
      'arrow',
      'crossbow-bolt',
    ],
  },
}

/** The shop standing in a room, or null. */
function getShop(roomId) {
  return SHOPS[roomId] || null
}

/**
 * Whether a room's shop sells a given item. The authoritative check behind a
 * purchase — a client that names any other slug is not buying from this shop.
 */
function shopSellsItem(roomId, itemSlug) {
  const shop = SHOPS[roomId]
  return !!shop && shop.stock.includes(itemSlug)
}

/** The quest that must be completed to trade here, or null if anyone may. */
function shopRequiresQuest(roomId) {
  return SHOPS[roomId]?.requiresQuest ?? null
}

module.exports = { SHOPS, getShop, shopSellsItem, shopRequiresQuest }
