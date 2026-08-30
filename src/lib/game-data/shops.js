/**
 * Single source of truth for every shop in the game.
 *
 * Keyed by the roomId the shop stands in. Consumed by:
 *   - game-engine/room-action-handlers.js  (the `view shop` action's stock list)
 *   - app/api/shop/buy/route.ts            (authoritative "is this actually for
 *                                            sale, and is the player standing in
 *                                            the shop that sells it?" check)
 *
 * Prices are NOT listed here. A shop sells an item at its `ItemTemplate.value`
 * via shop-pricing.ts, so one item costs the same everywhere and a price can
 * never drift between the card the player sees and the gold they are charged.
 * Where the original priced the same item differently per shop, the template
 * value is the canonical one.
 *
 * `stock` is ordered for display: weapons, then armour, then consumables.
 *
 * @typedef {{ name: string, stock: string[] }} Shop
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

  // The Wizard's Guild stall. Guild membership is checked by the room action,
  // not here — this is only the stock list.
  '225': {
    name: "Wizard's Guild Store",
    stock: [
      'wand',
      'wizard-staff',
      'gray-wand',
      'wizard-hat',
      'gray-robe',
      'ring-of-magic-v',
      'ring-of-mana-regen-iii',
      'blue-potion',
      'blue-balm',
    ],
  },

  // The Warrior's Guild stall, likewise gated by the room action.
  '226': {
    name: "Warrior's Guild Store",
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

  // The Shady Shop, hidden behind the alley banners: ammunition by the sack,
  // the four stat capsules, and one very expensive necklace. No questions either way.
  '236': {
    name: 'Shady Shop',
    stock: ['arrow', 'crossbow-bolt', 'reds', 'greens', 'blues', 'yellows', 'vapor-necklace'],
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

module.exports = { SHOPS, getShop, shopSellsItem }
