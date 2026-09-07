const { prisma } = require('../../db-client')
const { getPlayerInventory } = require('./inventory-service')

/** The player projection an equip result carries back to the client. */
const PLAYER_SELECT = {
  id: true,
  username: true,
  level: true,
  hp: true,
  hpMax: true,
  mp: true,
  mpMax: true,
  currentRoom: true,
  isActive: true,
  xp: true,
  cp: true,
  tp: true,
  sp: true,
  currency: true,
  physicalTraining: true,
  mentalTraining: true,
  str: true,
  dex: true,
  mag: true,
  def: true,
  strMod: true,
  dexMod: true,
  magMod: true,
  defMod: true,
  uIcon: true,
  uIconColor: true,
}

const MOD_SELECT = { strMod: true, dexMod: true, magMod: true, defMod: true }

/**
 * Sum the stat modifiers of a set of equipped rows (each with its
 * ItemTemplate.metadata). Lenient: only the four known stats count, anything
 * else in `statMods` is ignored.
 * @param {Array<{ ItemTemplate?: { metadata?: any } | null }>} equippedItems
 * @returns {{ str: number, dex: number, mag: number, def: number }}
 */
function sumStatMods(equippedItems) {
  const totals = { str: 0, dex: 0, mag: 0, def: 0 }
  for (const item of equippedItems) {
    const statMods = item?.ItemTemplate?.metadata?.statMods
    if (!statMods || typeof statMods !== 'object') continue
    for (const key of Object.keys(totals)) {
      if (typeof statMods[key] === 'number') totals[key] += statMods[key]
    }
  }
  return totals
}

/**
 * Recompute stat modifiers from all equipped items and update the User row.
 *
 * Pass `tx` to run inside a transaction the caller holds, so the mods land
 * with the equip change they describe; pass `select` to get the updated
 * player row back in that shape instead of just the four mods (one round
 * trip instead of a follow-up read).
 *
 * @param {string} playerId - The player's ID
 * @param {{ tx?: import('@prisma/client').Prisma.TransactionClient|null, select?: Object|null }} [options]
 * @returns {Promise<{strMod: number, dexMod: number, magMod: number, defMod: number}|Object>}
 */
async function recomputeStatMods(playerId, options = {}) {
  const { tx = null, select = null } = options
  const db = tx || prisma

  const equippedItems = await db.playerItem.findMany({
    where: { playerId, isEquipped: true },
    include: { ItemTemplate: { select: { metadata: true } } },
  })
  const totals = sumStatMods(equippedItems)

  const player = await db.user.update({
    where: { id: playerId },
    data: { strMod: totals.str, dexMod: totals.dex, magMod: totals.mag, defMod: totals.def },
    select: select || MOD_SELECT,
  })

  return select ? player : { strMod: player.strMod, dexMod: player.dexMod, magMod: player.magMod, defMod: player.defMod }
}

/**
 * Equip an item to its designated slot.
 * Automatically unequips any item currently in that slot.
 * 
 * @param {string} playerId - The player's ID
 * @param {string} playerItemId - The PlayerItem ID to equip
 * @returns {Promise<{success: boolean, message?: string, inventory?: Array, player?: Object}>}
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
          metadata: true,
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
  const metadata = playerItem.ItemTemplate.metadata || {}
  const isTwoHanded = metadata.isTwoHanded === true

  // Check if equipping OFF_HAND while MAIN_HAND has a two-handed item
  if (targetSlot === 'OFF_HAND') {
    const mainHandItem = await prisma.playerItem.findFirst({
      where: {
        playerId,
        slot: 'MAIN_HAND',
        isEquipped: true,
      },
      include: {
        ItemTemplate: {
          select: {
            metadata: true,
          },
        },
      },
    })

    if (mainHandItem && mainHandItem.ItemTemplate) {
      const mainHandMetadata = mainHandItem.ItemTemplate.metadata || {}
      if (mainHandMetadata.isTwoHanded === true) {
        return {
          success: false,
          message: 'Cannot equip off-hand item while wielding a two-handed weapon',
        }
      }
    }
  }

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

    // If equipping a two-handed MAIN_HAND item, unequip any OFF_HAND item
    if (targetSlot === 'MAIN_HAND' && isTwoHanded) {
      const offHandItem = await tx.playerItem.findFirst({
        where: {
          playerId,
          slot: 'OFF_HAND',
          isEquipped: true,
        },
      })

      if (offHandItem) {
        await tx.playerItem.update({
          where: { id: offHandItem.id },
          data: {
            isEquipped: false,
            slot: null,
          },
        })
      }
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

  // Recompute stat mods after equip
  await recomputeStatMods(playerId)

  // Return updated inventory and player with mod totals
  const inventory = await getPlayerInventory(playerId)
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: PLAYER_SELECT,
  })

  return {
    success: true,
    message: `Equipped ${playerItem.ItemTemplate.name}`,
    inventory,
    player,
    item: {
      slug: playerItem.ItemTemplate.slug,
      name: playerItem.ItemTemplate.name,
      metadata: playerItem.ItemTemplate.metadata || null,
    },
  }
}

/**
 * Unequip an item.
 * 
 * @param {string} playerId - The player's ID
 * @param {string} playerItemId - The PlayerItem ID to unequip
 * @returns {Promise<{success: boolean, message?: string, inventory?: Array, player?: Object}>}
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
          metadata: true,
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

  // Recompute stat mods after unequip
  await recomputeStatMods(playerId)

  // Return updated inventory and player with mod totals
  const inventory = await getPlayerInventory(playerId)
  const player = await prisma.user.findUnique({
    where: { id: playerId },
    select: PLAYER_SELECT,
  })

  return {
    success: true,
    message: `Unequipped ${playerItem.ItemTemplate.name}`,
    inventory,
    player,
    item: {
      slug: playerItem.ItemTemplate.slug,
      name: playerItem.ItemTemplate.name,
      metadata: playerItem.ItemTemplate.metadata || null,
    },
  }
}

module.exports = {
  PLAYER_SELECT,
  equipItem,
  unequipItem,
  sumStatMods,
  recomputeStatMods,
}

