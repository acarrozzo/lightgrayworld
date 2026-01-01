const { prisma } = require('../../db-client')

/**
 * Get a player's inventory with template details, shaped for UI.
 */
async function getPlayerInventory(playerId) {
  const items = await prisma.playerItem.findMany({
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
async function grantItemOnce(playerId, itemSlug, quantity = 1) {
  const template = await getItemBySlug(itemSlug)
  if (!template) {
    return { granted: false, reason: 'Item not found', inventory: null }
  }

  const existing = await prisma.playerItem.findFirst({
    where: { playerId, templateId: template.id },
  })

  // Enforce maxPerPlayer (defaults to maxStack when provided)
  const limit = template.maxPerPlayer ?? template.maxStack ?? quantity
  const currentQty = existing?.quantity ?? 0

  if (currentQty >= limit) {
    return {
      granted: false,
      reason: 'Max quantity reached for this item',
      inventory: await getPlayerInventory(playerId),
    }
  }

  if (existing) {
    const newQty = Math.min(currentQty + quantity, limit)
    await prisma.playerItem.update({
      where: { id: existing.id },
      data: {
        quantity: newQty,
        updatedAt: new Date(),
      },
    })
  } else {
    // Generate a unique ID for the new PlayerItem (schema doesn't have @default)
    const { randomUUID } = require('crypto')
    await prisma.playerItem.create({
      data: {
        id: randomUUID(),
        playerId,
        templateId: template.id,
        quantity: Math.min(quantity, limit),
      },
    })
  }

  const inventory = await getPlayerInventory(playerId)

  return {
    granted: true,
    reason: 'Item granted',
    inventory,
  }
}

module.exports = {
  getPlayerInventory,
  getItemBySlug,
  playerHasItem,
  grantItemOnce,
}

