const { prisma } = require('../../db-client')

/**
 * Get a player's inventory with template details, shaped for UI.
 * @param {string} playerId - The player's ID
 * @param {Object} tx - Optional transaction client (defaults to global prisma)
 */
async function getPlayerInventory(playerId, tx = null) {
  const client = tx || prisma
  const items = await client.playerItem.findMany({
    where: { playerId },
    include: {
      ItemTemplate: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          maxStack: true,
          maxPerPlayer: true,
          value: true,
          canSell: true,
          canDrop: true,
          equipSlot: true,
          weaponCategory: true,
          metadata: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    isEquipped: item.isEquipped,
    slot: item.slot,
    template: item.ItemTemplate,
  }))
}

/**
 * Fetch an item template by slug.
 */
async function getItemBySlug(slug) {
  return prisma.itemTemplate.findUnique({
    where: { slug },
  })
}

/**
 * Check if the player already has an item by slug.
 */
async function playerHasItem(playerId, itemSlug) {
  const template = await getItemBySlug(itemSlug)
  if (!template) return false

  const existing = await prisma.playerItem.findFirst({
    where: { playerId, templateId: template.id },
  })

  return Boolean(existing)
}

/**
 * Grant an item respecting maxPerPlayer and stacking rules.
 */
async function grantItemOnce(playerId, itemSlug, quantity = 1, tx = null) {
  const client = tx || prisma
  const template = await getItemBySlug(itemSlug)
  if (!template) {
    return { granted: false, reason: 'Item not found', inventory: null }
  }

  const existing = await client.playerItem.findFirst({
    where: { playerId, templateId: template.id },
  })

  // Enforce maxPerPlayer/maxStack; if neither is set there's no cap
  const limit = template.maxPerPlayer ?? template.maxStack ?? Infinity
  const currentQty = existing?.quantity ?? 0

  if (currentQty >= limit) {
    return {
      granted: false,
      reason: 'Max quantity reached for this item',
      // Skip the inventory refetch when running inside a caller's transaction;
      // the caller refetches once the transaction commits.
      inventory: tx ? null : await getPlayerInventory(playerId),
    }
  }

  if (existing) {
    const newQty = Math.min(currentQty + quantity, limit)
    await client.playerItem.update({
      where: { id: existing.id },
      data: {
        quantity: newQty,
        updatedAt: new Date(),
      },
    })
  } else {
    // Generate a unique ID for the new PlayerItem (schema doesn't have @default)
    const { randomUUID } = require('crypto')
    await client.playerItem.create({
      data: {
        id: randomUUID(),
        playerId,
        templateId: template.id,
        quantity: Math.min(quantity, limit),
      },
    })
  }

  return {
    granted: true,
    reason: 'Item granted',
    inventory: tx ? null : await getPlayerInventory(playerId),
  }
}

/**
 * Remove an item from player inventory by slug and quantity
 * @param {string} playerId - The player's ID
 * @param {string} itemSlug - The item slug
 * @param {number} quantity - The quantity to remove
 * @param {Object} tx - Optional transaction client (defaults to global prisma)
 * @returns {Promise<Object>} Result with success status and updated inventory
 */
async function removeItemBySlug(playerId, itemSlug, quantity = 1, tx = null) {
  const client = tx || prisma
  const template = await getItemBySlug(itemSlug)
  if (!template) {
    return { success: false, error: 'Item not found', inventory: null }
  }

  const playerItem = await client.playerItem.findFirst({
    where: {
      playerId,
      templateId: template.id,
    },
  })

  if (!playerItem || playerItem.quantity < quantity) {
    return { success: false, error: 'Not enough items in inventory', inventory: null }
  }

  // Remove item
  if (playerItem.quantity === quantity) {
    await client.playerItem.delete({
      where: { id: playerItem.id },
    })
  } else {
    await client.playerItem.update({
      where: { id: playerItem.id },
      data: { quantity: playerItem.quantity - quantity },
    })
  }

  const inventory = await getPlayerInventory(playerId, tx)

  return {
    success: true,
    inventory,
  }
}

module.exports = {
  getPlayerInventory,
  getItemBySlug,
  playerHasItem,
  grantItemOnce,
  removeItemBySlug,
}

