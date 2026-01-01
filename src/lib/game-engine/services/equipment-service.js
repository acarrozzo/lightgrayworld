const { prisma } = require('../../db-client')
const { getPlayerInventory } = require('./inventory-service')

/**
 * Equip an item to its designated slot.
 * Automatically unequips any item currently in that slot.
 * 
 * @param {string} playerId - The player's ID
 * @param {string} playerItemId - The PlayerItem ID to equip
 * @returns {Promise<{success: boolean, message?: string, inventory?: Array}>}
 */
async function equipItem(playerId, playerItemId) {
  // Validate playerItem exists and belongs to player (include ItemTemplate)
  const playerItem = await prisma.playerItem.findUnique({
    where: { id: playerItemId },
    include: {
      ItemTemplate: {
        select: {
          id: true,
          slug: true,
          name: true,
          equipSlot: true,
        },
      },
    },
  })

  if (!playerItem || playerItem.playerId !== playerId) {
    return {
      success: false,
      message: 'Item not found in your inventory',
    }
  }

  // Validate quantity
  if (playerItem.quantity < 1) {
    return {
      success: false,
      message: 'Cannot equip item with quantity less than 1',
    }
  }

  // Validate template.equipSlot (server-side enforcement)
  if (!playerItem.ItemTemplate || playerItem.ItemTemplate.equipSlot === null) {
    return {
      success: false,
      message: 'This item cannot be equipped',
    }
  }

  // Determine target slot from template
  const targetSlot = playerItem.ItemTemplate.equipSlot

  // Perform all operations in a single transaction
  await prisma.$transaction(async (tx) => {
    // Find any PlayerItem currently equipped in the target slot
    const currentlyEquipped = await tx.playerItem.findFirst({
      where: {
        playerId,
        slot: targetSlot,
        isEquipped: true,
      },
    })

    // Unequip previous item if found
    if (currentlyEquipped) {
      await tx.playerItem.update({
        where: { id: currentlyEquipped.id },
        data: {
          isEquipped: false,
          slot: null,
        },
      })
    }

    // Equip the selected item
    await tx.playerItem.update({
      where: { id: playerItemId },
      data: {
        isEquipped: true,
        slot: targetSlot,
      },
    })
  })

  // Return updated inventory (includes isEquipped, slot, template.equipSlot)
  const inventory = await getPlayerInventory(playerId)

  return {
    success: true,
    message: `Equipped ${playerItem.ItemTemplate.name}`,
    inventory,
  }
}

/**
 * Unequip an item.
 * 
 * @param {string} playerId - The player's ID
 * @param {string} playerItemId - The PlayerItem ID to unequip
 * @returns {Promise<{success: boolean, message?: string, inventory?: Array}>}
 */
async function unequipItem(playerId, playerItemId) {
  // Validate playerItem exists and belongs to player (include ItemTemplate)
  const playerItem = await prisma.playerItem.findUnique({
    where: { id: playerItemId },
    include: {
      ItemTemplate: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  })

  if (!playerItem || playerItem.playerId !== playerId) {
    return {
      success: false,
      message: 'Item not found in your inventory',
    }
  }

  // Validate isEquipped
  if (playerItem.isEquipped !== true) {
    return {
      success: false,
      message: 'This item is not equipped',
    }
  }

  // Perform operation in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.playerItem.update({
      where: { id: playerItemId },
      data: {
        isEquipped: false,
        slot: null,
      },
    })
  })

  // Return updated inventory (includes isEquipped, slot, template.equipSlot)
  const inventory = await getPlayerInventory(playerId)

  return {
    success: true,
    message: `Unequipped ${playerItem.ItemTemplate.name}`,
    inventory,
  }
}

module.exports = {
  equipItem,
  unequipItem,
}

