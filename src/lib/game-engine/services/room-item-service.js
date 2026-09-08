const { prisma } = require('../../db-client')
const { getPlayerInventory } = require('./inventory-service')
const { normalizeRoomItems, ROOM_ITEMS_INCLUDE } = require('./room-normalization.js')
const { countedName } = require('./item-names')

/**
 * Room items are what players leave on the ground: a shared pile per
 * (room, template) that anyone present can pick from. What a room *provides*
 * — the spare hatchet, the guard's arrow crate — is not a room item; that is
 * per player and lives in config/room-supplies.js.
 */

function formatPickupMessage(itemName, quantity) {
  return `You pick up ${countedName(itemName, quantity)}.`
}

function formatDropMessage(itemName, quantity) {
  return `You drop ${countedName(itemName, quantity)}.`
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

  // The bag's own limit. A pile is shared, so the only cap a pickup meets is
  // the player's: name it, and how far they are from it.
  const currentPlayerQty = existingPlayerItem?.quantity || 0
  const maxAllowed = template.max ?? Infinity

  if (currentPlayerQty + quantity > maxAllowed) {
    return {
      success: false,
      message:
        currentPlayerQty >= maxAllowed
          ? `Your bag already holds ${maxAllowed} ${template.name} — that is as many as it can carry.`
          : `Your bag can only hold ${maxAllowed} ${template.name}; you have room for ${maxAllowed - currentPlayerQty} more.`,
    }
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // Take from the room behind a quantity guard. Room items are shared between
    // players, so the per-player action queue cannot serialize this: two players
    // grabbing from the same pile previously both read the same quantity and
    // both wrote the same decremented value, handing out the item twice while
    // removing it once.
    const taken = await tx.roomItem.updateMany({
      where: { id: roomItemId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    })

    if (taken.count === 0) {
      // Nothing written yet, so this commits empty rather than rolling back.
      return { conflict: true }
    }

    // An emptied pile leaves no zero-quantity row behind.
    await tx.roomItem.deleteMany({ where: { id: roomItemId, quantity: { lte: 0 } } })

    // One atomic upsert against the (playerId, templateId) unique key, so a
    // pickup racing another grant for the same template adds to one stack
    // rather than inserting a second row.
    const { randomUUID } = require('crypto')
    await tx.playerItem.upsert({
      where: { playerId_templateId: { playerId, templateId: template.id } },
      create: {
        id: randomUUID(),
        playerId,
        templateId: template.id,
        quantity,
      },
      update: { quantity: { increment: quantity } },
    })

    return { conflict: false }
  })

  if (outcome.conflict) {
    return { success: false, message: 'Someone else got there first.' }
  }

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
 * Drop an item from inventory into the current room (transactional).
 *
 * @param {string} playerId
 * @param {string} playerItemId
 * @param {number} quantity
 * @param {string} playerCurrentRoom
 * @param {string | null} droppedByName - shown on the pile ("left by Sherman");
 *   the latest dropper onto a shared pile takes the credit.
 */
async function dropRoomItem(playerId, playerItemId, quantity, playerCurrentRoom, droppedByName = null) {
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

  // Equipped gear feeds the cached strMod/dexMod/magMod/defMod columns combat
  // reads. Dropping the row while it is equipped leaves the bonus applied until
  // the next equip or login, so it has to come off first.
  if (playerItem.isEquipped) {
    return { success: false, message: 'Unequip this item before dropping it.' }
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // Guarded decrement rather than an absolute write computed from the read
    // above, so a duplicate in-flight drop cannot remove the stack twice.
    const removed = await tx.playerItem.updateMany({
      where: { id: playerItemId, playerId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    })

    if (removed.count === 0) {
      return { conflict: true }
    }

    await tx.playerItem.deleteMany({ where: { id: playerItemId, quantity: { lte: 0 } } })

    const existingRoomItem = await tx.roomItem.findFirst({
      where: {
        roomId: playerCurrentRoom,
        templateId: template.id,
      },
    })

    if (existingRoomItem) {
      await tx.roomItem.update({
        where: { id: existingRoomItem.id },
        data: { quantity: { increment: quantity }, droppedByName, updatedAt: new Date() },
      })
    } else {
      const { randomUUID } = require('crypto')
      await tx.roomItem.create({
        data: {
          id: randomUUID(),
          roomId: playerCurrentRoom,
          templateId: template.id,
          quantity,
          droppedByName,
        },
      })
    }

    return { conflict: false }
  })

  if (outcome.conflict) {
    return { success: false, message: 'You no longer have that many to drop.' }
  }

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
    ...ROOM_ITEMS_INCLUDE.items,
  })

  return normalizeRoomItems(items)
}

module.exports = {
  pickupRoomItem,
  dropRoomItem,
  getRoomItems,
}
