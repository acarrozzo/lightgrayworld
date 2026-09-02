const { prisma } = require('../../db-client')
const { getPlayerInventory } = require('./inventory-service')
const { normalizeRoomItems } = require('./room-normalization.js')
const { ROOM_LOOT } = require('../config/room-loot')

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
  const maxAllowed = template.max ?? Infinity

  if (currentPlayerQty + quantity > maxAllowed) {
    return {
      success: false,
      message: `You can only carry ${maxAllowed} of this item`,
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
        data: { quantity: { increment: quantity } },
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
  })

  return normalizeRoomItems(items)
}

/**
 * Ensure all auto-respawn items exist in the given room.
 * This function checks each item that should auto-respawn and creates it if missing.
 *
 * The set of items that belong in each room is defined declaratively in
 * config/room-loot.js (the same source of truth used by the seed). Since
 * RoomItems are deleted when fully picked up, we check each configured
 * auto-respawn item individually and recreate it if missing.
 *
 * Note: This checks each item individually, so items will respawn even if other
 * auto-respawn items are still present in the room.
 *
 * @param {string} roomId - The room ID to check for auto-respawn items
 * @returns {Promise<void>}
 */
async function ensureAutoRespawnItems(roomId) {
  try {
    const itemsToCheck = ROOM_LOOT.filter(
      (entry) => entry.roomId === roomId && entry.autoRespawn !== false
    )
    if (itemsToCheck.length === 0) {
      // No auto-respawn items configured for this room
      return
    }

    // Batch all reads instead of querying per-item: one lookup for the
    // templates and one for the room's existing items. This keeps a large
    // loot table (e.g. the Solar Office) from firing ~100 sequential queries
    // on every room entry.
    //
    // The two reads do not depend on each other — the room's existing rows are
    // filtered by room, not by the template ids — so they go out together.
    // This runs on every step between rooms, ahead of the room the player is
    // waiting to see, and each sequential round trip is felt as travel delay.
    const slugs = itemsToCheck.map((entry) => entry.slug)
    const [templates, existingItems] = await Promise.all([
      prisma.itemTemplate.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, slug: true },
      }),
      prisma.roomItem.findMany({
        where: { roomId },
        select: { templateId: true },
      }),
    ])
    const templateBySlug = new Map(templates.map((t) => [t.slug, t]))
    const existingTemplateIds = new Set(existingItems.map((item) => item.templateId))

    const { randomUUID } = require('crypto')
    const toCreate = []
    for (const entry of itemsToCheck) {
      const template = templateBySlug.get(entry.slug)
      if (!template) {
        console.warn(`[ensureAutoRespawnItems] Template not found for slug: ${entry.slug}`)
        continue
      }
      if (existingTemplateIds.has(template.id)) {
        continue
      }
      toCreate.push({
        id: randomUUID(),
        roomId,
        templateId: template.id,
        quantity: entry.quantity ?? 1,
        autoRespawn: true,
      })
    }

    if (toCreate.length > 0) {
      await prisma.roomItem.createMany({ data: toCreate })
      console.log(
        `[ensureAutoRespawnItems] Created ${toCreate.length} item(s) in room ${roomId}: ${toCreate
          .map((item) => item.templateId)
          .join(', ')}`
      )
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

