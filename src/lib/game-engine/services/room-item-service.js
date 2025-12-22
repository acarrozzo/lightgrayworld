const { prisma } = require('../../db-client')
const { getPlayerInventory } = require('./inventory-service')
const { normalizeRoomItems } = require('./room-normalization.js')

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
    message: `You pick up the ${template.name}.`,
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
    message: `You drop the ${template.name}.`,
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
        },
      },
    },
  })

  return normalizeRoomItems(items)
}

module.exports = {
  pickupRoomItem,
  dropRoomItem,
  getRoomItems,
}

