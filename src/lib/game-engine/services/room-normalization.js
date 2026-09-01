/**
 * Shared room query fragments and normalization helpers.
 * Use ROOM_ITEMS_SELECT inside a Prisma `select` block.
 * Use ROOM_ITEMS_INCLUDE at the root `include` level if select is not used.
 */

const { ROOM_LOOT } = require('../config/room-loot')

// Canonical room-item display order: the position each (roomId, slug) holds in
// the ROOM_LOOT seed config. Prisma can't order by a config array, so room
// queries fetch unordered and normalizeRoomItems() sorts here — keeping the
// in-game room, the loot panel, and the World Atlas tool all in seed order.
const ROOM_LOOT_ORDER = new Map(ROOM_LOOT.map((l, i) => [`${l.roomId}::${l.slug}`, i]))

function lootOrderIndex(item) {
  const idx = ROOM_LOOT_ORDER.get(`${item?.roomId}::${item?.ItemTemplate?.slug}`)
  return idx ?? Infinity
}

const ROOM_ITEMS_SELECT = {
  items: {
    select: {
      id: true,
      quantity: true,
      templateId: true,
      roomId: true,
      // Must stay identical to the field list in room-normalization.ts —
      // validate-world fails the build if they diverge. They already had:
      // the engine's socket path used this copy and silently dropped `value`,
      // `canSell`, `canDrop` and `metadata`, so a room item pushed over the
      // socket arrived without its icon (which lives in metadata) or its
      // sell/drop affordances, while the same item fetched over HTTP had them.
      ItemTemplate: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          value: true,
          canSell: true,
          canDrop: true,
          equipSlot: true,
          metadata: true,
        },
      },
    },
  },
}

const ROOM_ITEMS_INCLUDE = {
  items: {
    include: {
      // Must stay identical to the field list in room-normalization.ts —
      // validate-world fails the build if they diverge. They already had:
      // the engine's socket path used this copy and silently dropped `value`,
      // `canSell`, `canDrop` and `metadata`, so a room item pushed over the
      // socket arrived without its icon (which lives in metadata) or its
      // sell/drop affordances, while the same item fetched over HTTP had them.
      ItemTemplate: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          value: true,
          canSell: true,
          canDrop: true,
          equipSlot: true,
          metadata: true,
        },
      },
    },
  },
}

/**
 * Normalize raw room items to UI-friendly shape.
 */
function normalizeRoomItems(rawItems) {
  if (!Array.isArray(rawItems)) return []

  // Order by ROOM_LOOT seed position; config items first (in config order),
  // then anything else (e.g. player-dropped) alphabetically by name.
  const ordered = [...rawItems].sort((a, b) => {
    const ia = lootOrderIndex(a)
    const ib = lootOrderIndex(b)
    if (ia !== ib) return ia - ib
    return (a?.ItemTemplate?.name ?? '').localeCompare(b?.ItemTemplate?.name ?? '')
  })

  const normalized = []

  ordered.forEach((item) => {
    if (!item?.ItemTemplate) {
      console.warn('[room-normalization] Skipping room item missing ItemTemplate', {
        id: item?.id,
        templateId: item?.templateId,
      })
      return
    }

    normalized.push({
      id: item.id,
      quantity: item.quantity,
      template: {
        id: item.ItemTemplate.id,
        slug: item.ItemTemplate.slug,
        name: item.ItemTemplate.name,
        description: item.ItemTemplate.description,
        type: item.ItemTemplate.type,
        value: item.ItemTemplate.value,
        canSell: item.ItemTemplate.canSell,
        canDrop: item.ItemTemplate.canDrop,
        equipSlot: item.ItemTemplate.equipSlot,
        metadata: item.ItemTemplate.metadata,
      },
    })
  })

  return normalized
}

/**
 * Normalize full room data including items.
 */
function normalizeRoomData(room) {
  if (!room) return null

  return {
    ...room,
    items: normalizeRoomItems(room.items || []),
  }
}

module.exports = {
  ROOM_ITEMS_SELECT,
  ROOM_ITEMS_INCLUDE,
  normalizeRoomItems,
  normalizeRoomData,
}

