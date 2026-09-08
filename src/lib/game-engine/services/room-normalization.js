/**
 * Shared room query fragments and normalization helpers.
 * Use ROOM_ITEMS_SELECT inside a Prisma `select` block.
 * Use ROOM_ITEMS_INCLUDE at the root `include` level if select is not used.
 *
 * Room items are what players have left on the ground. What a room provides
 * for free is per player and comes from config/room-supplies.js instead.
 */

const ROOM_ITEMS_SELECT = {
  items: {
    select: {
      id: true,
      quantity: true,
      templateId: true,
      roomId: true,
      droppedByName: true,
      createdAt: true,
      updatedAt: true,
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

function toIso(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return null
}

/**
 * Normalize raw room items to UI-friendly shape. Freshest pile first, so the
 * thing just dropped is at the top of the strip.
 */
function normalizeRoomItems(rawItems) {
  if (!Array.isArray(rawItems)) return []

  const stamp = (item) => {
    const raw = item?.updatedAt ?? item?.createdAt
    const t = raw instanceof Date ? raw.getTime() : typeof raw === 'string' ? Date.parse(raw) : NaN
    return Number.isFinite(t) ? t : 0
  }

  const ordered = [...rawItems].sort((a, b) => {
    const diff = stamp(b) - stamp(a)
    if (diff !== 0) return diff
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
      droppedBy: item.droppedByName ?? null,
      droppedAt: toIso(item.updatedAt ?? item.createdAt),
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
