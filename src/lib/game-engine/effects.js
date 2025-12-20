const {
  grantItemOnce,
  getPlayerInventory,
  getItemBySlug,
  playerHasItem,
} = require('./services/inventory-service')

/**
 * Effect: Grant a personal item, respecting maxPerPlayer.
 * Returns effect result with updated inventory snapshot.
 */
async function grantPersonalItemOnce(playerId, itemSlug, quantity = 1) {
  const result = await grantItemOnce(playerId, itemSlug, quantity)
  return {
    success: result.granted,
    message: result.reason,
    inventory: result.inventory,
  }
}

module.exports = {
  grantPersonalItemOnce,
  getPlayerInventory,
  getItemBySlug,
  playerHasItem,
}

