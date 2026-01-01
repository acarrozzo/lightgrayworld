/**
 * Shared room query fragments and normalization helpers.
 * Use ROOM_ITEMS_SELECT inside a Prisma `select` block.
 * Use ROOM_ITEMS_INCLUDE at the root `include` level if select is not used.
 */

const ROOM_ITEMS_SELECT = {
  items: {
    select: {
      id: true,
      quantity: true,
      templateId: true,
      roomId: true,
      ItemTemplate: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          equipSlot: true,
        },
      },
    },
    orderBy: {
      ItemTemplate: {
        name: 'asc'
      }
    },
  },
}

const ROOM_ITEMS_INCLUDE = {
  items: {
    include: {
      ItemTemplate: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          equipSlot: true,
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

  const normalized = []

  rawItems.forEach((item) => {
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
        equipSlot: item.ItemTemplate.equipSlot,
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

