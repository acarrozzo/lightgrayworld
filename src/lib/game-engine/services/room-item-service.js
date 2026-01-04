const { prisma } = require('../../db-client')
const { getPlayerInventory, getItemBySlug } = require('./inventory-service')
const { normalizeRoomItems } = require('./room-normalization.js')

/**
 * Pluralize an item name
 * @param {string} name - The item name
 * @returns {string} - The pluralized name
 */
function pluralizeItemName(name) {
  if (!name) return name
  // Handle words ending in 'y' (e.g., berry -> berries)
  if (name.endsWith('y')) {
    return name.slice(0, -1) + 'ies'
  }
  // Handle words ending in 's', 'x', 'z', 'ch', 'sh' (add 'es')
  if (name.match(/[sxz]|[cs]h$/)) {
    return name + 'es'
  }
  // Default: add 's'
  return name + 's'
}

/**
 * Format pickup message with proper quantity and pluralization
 * @param {string} itemName - The item name
 * @param {number} quantity - The quantity being picked up
 * @returns {string} - The formatted message
 */
function formatPickupMessage(itemName, quantity) {
  if (quantity === 1) {
    return `You pick up a ${itemName}.`
  }
  const pluralName = pluralizeItemName(itemName)
  return `You pick up ${quantity} ${pluralName}.`
}

/**
 * Format drop message with proper quantity and pluralization
 * @param {string} itemName - The item name
 * @param {number} quantity - The quantity being dropped
 * @returns {string} - The formatted message
 */
function formatDropMessage(itemName, quantity) {
  if (quantity === 1) {
    return `You drop a ${itemName}.`
  }
  const pluralName = pluralizeItemName(itemName)
  return `You drop ${quantity} ${pluralName}.`
}

/**
 * Pickup an item from a room (transactional)
 *
 * @param {string} playerId
 * @param {string} roomItemId
 * @param {number} quantity
 * @param {string} playerCurrentRoom - Server-authoritative current room
 * @returns {Promise<{ success: boolean, message: string, inventory?: any[], roomItems?: any[] }>}
 */
async function pickupRoomItem(playerId, roomItemId, quantity, playerCurrentRoom) {
  if (!quantity || quantity < 1) {
    return { success: false, message: 'Invalid quantity' }
  }

  const roomItem = await prisma.roomItem.findUnique({
    where: { id: roomItemId },
    include: {
      ItemTemplate: true,
      room: { select: { roomId: true } },
    },
  })

  if (!roomItem) {
    return { success: false, message: 'Item not found' }
  }

  if (roomItem.roomId !== playerCurrentRoom) {
    return { success: false, message: 'Item is not in your current room' }
  }

  if (roomItem.quantity < quantity) {
    return { success: false, message: 'Not enough items in room' }
  }

  const template = roomItem.ItemTemplate

  const existingPlayerItem = await prisma.playerItem.findFirst({
    where: {
      playerId,
      templateId: template.id,
    },
  })

  const currentPlayerQty = existingPlayerItem?.quantity || 0
  const maxAllowed = template.maxPerPlayer ?? template.maxStack

  if (currentPlayerQty + quantity > maxAllowed) {
    return {
      success: false,
      message: `You can only carry ${maxAllowed} of this item`,
    }
  }

  await prisma.$transaction(async (tx) => {
    if (roomItem.quantity === quantity) {
      await tx.roomItem.delete({ where: { id: roomItemId } })
    } else {
      await tx.roomItem.update({
        where: { id: roomItemId },
        data: { quantity: roomItem.quantity - quantity },
      })
    }

    if (existingPlayerItem) {
      await tx.playerItem.update({
        where: { id: existingPlayerItem.id },
        data: { quantity: currentPlayerQty + quantity },
      })
    } else {
      const { randomUUID } = require('crypto')
      await tx.playerItem.create({
        data: {
          id: randomUUID(),
          playerId,
          templateId: template.id,
          quantity,
        },
      })
    }
  })

  const inventory = await getPlayerInventory(playerId)
  const roomItems = await getRoomItems(playerCurrentRoom)

  return {
    success: true,
    message: formatPickupMessage(template.name, quantity),
    inventory,
    roomItems,
  }
}

/**
 * Drop an item from inventory into the current room (transactional)
 */
async function dropRoomItem(playerId, playerItemId, quantity, playerCurrentRoom) {
  if (!quantity || quantity < 1) {
    return { success: false, message: 'Invalid quantity' }
  }

  const playerItem = await prisma.playerItem.findUnique({
    where: { id: playerItemId },
    include: { ItemTemplate: true },
  })

  if (!playerItem || playerItem.playerId !== playerId) {
    return { success: false, message: 'Item not found in your inventory' }
  }

  if (playerItem.quantity < quantity) {
    return { success: false, message: 'You do not have that many' }
  }

  const template = playerItem.ItemTemplate

  if (template.canDrop === false) {
    return { success: false, message: 'This item cannot be dropped.' }
  }

  await prisma.$transaction(async (tx) => {
    if (playerItem.quantity === quantity) {
      await tx.playerItem.delete({ where: { id: playerItemId } })
    } else {
      await tx.playerItem.update({
        where: { id: playerItemId },
        data: { quantity: playerItem.quantity - quantity },
      })
    }

    const existingRoomItem = await tx.roomItem.findFirst({
      where: {
        roomId: playerCurrentRoom,
        templateId: template.id,
      },
    })

    if (existingRoomItem) {
      await tx.roomItem.update({
        where: { id: existingRoomItem.id },
        data: { quantity: existingRoomItem.quantity + quantity },
      })
    } else {
      const { randomUUID } = require('crypto')
      await tx.roomItem.create({
        data: {
          id: randomUUID(),
          roomId: playerCurrentRoom,
          templateId: template.id,
          quantity,
        },
      })
    }
  })

  const inventory = await getPlayerInventory(playerId)
  const roomItems = await getRoomItems(playerCurrentRoom)

  return {
    success: true,
    message: formatDropMessage(template.name, quantity),
    inventory,
    roomItems,
  }
}

async function getRoomItems(roomId) {
  const items = await prisma.roomItem.findMany({
    where: { roomId },
    include: {
      ItemTemplate: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          canSell: true,
          canDrop: true,
          equipSlot: true,
        },
      },
    },
    orderBy: {
      ItemTemplate: {
        name: 'asc'
      }
    },
  })

  return normalizeRoomItems(items)
}

/**
 * Ensure all auto-respawn items exist in the given room.
 * This function checks each item that should auto-respawn and creates it if missing.
 * 
 * Since RoomItems are deleted when picked up, we use a known configuration mapping
 * to determine which items should exist in each room. For each item in the room's
 * configuration, we check if it exists and create it if missing.
 * 
 * Note: This checks each item individually, so items will respawn even if other
 * auto-respawn items are still present in the room.
 * 
 * @param {string} roomId - The room ID to check for auto-respawn items
 * @returns {Promise<void>}
 */
async function ensureAutoRespawnItems(roomId) {
  try {
    const knownAutoRespawnItems = {
      '001': ['welcome-book'],
      '004': ['flower'],
      '006': ['shovel'],
      '007': ['short-sword'],
      '020': ['mace', 'bo', 'basic-shield', 'blue-hood', 'padded-armor', 'black-gloves', 'black-boots'],
      '088': ['master-sword'],
    }
    
    const itemsToCheck = knownAutoRespawnItems[roomId]
    if (!itemsToCheck || itemsToCheck.length === 0) {
      // No known auto-respawn items for this room
      return
    }
    
    // For each known auto-respawn item, check if it exists and create if missing
    for (const itemSlug of itemsToCheck) {
      const template = await getItemBySlug(itemSlug)
      if (!template) {
        console.warn(`[ensureAutoRespawnItems] Template not found for slug: ${itemSlug}`)
        continue
      }
      
      // Check if this item currently exists in the room
      const existingItem = await prisma.roomItem.findFirst({
        where: {
          roomId,
          templateId: template.id,
        },
      })
      
      // If the item doesn't exist, create it with autoRespawn: true
      if (!existingItem) {
        const { randomUUID } = require('crypto')
        await prisma.roomItem.create({
          data: {
            id: randomUUID(),
            roomId,
            templateId: template.id,
            quantity: 1,
            autoRespawn: true,
          },
        })
        console.log(`[ensureAutoRespawnItems] Created ${itemSlug} in room ${roomId}`)
      }
    }
  } catch (error) {
    console.error(`[ensureAutoRespawnItems] Error ensuring auto-respawn items for room ${roomId}:`, error)
    // Don't throw - this is a non-critical operation
  }
}

module.exports = {
  pickupRoomItem,
  dropRoomItem,
  getRoomItems,
  ensureAutoRespawnItems,
}

