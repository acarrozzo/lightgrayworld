import type { ItemTemplate, Prisma, EquipSlot } from '@prisma/client'
import { ROOM_LOOT } from '../config/room-loot'

// Canonical room-item display order: the position each (roomId, slug) holds in
// the ROOM_LOOT seed config. Prisma can't order by a config array, so room
// queries fetch unordered and normalizeRoomItems() sorts here — keeping the
// in-game room, the loot panel, and the World Atlas tool all in seed order.
const ROOM_LOOT_ORDER = new Map<string, number>(
  ROOM_LOOT.map((l, i) => [`${l.roomId}::${l.slug}`, i] as const),
)

export const ROOM_ITEMS_SELECT = {
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
          value: true,
          canSell: true,
          canDrop: true,
          equipSlot: true,
          metadata: true,
        },
      },
    },
  },
} as const satisfies Prisma.RoomSelect

export const ROOM_ITEMS_INCLUDE = {
  items: {
    include: {
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
} as const satisfies Prisma.RoomInclude

type ItemTemplateSelected = Pick<ItemTemplate, 'id' | 'slug' | 'name' | 'description' | 'type' | 'value' | 'canSell' | 'canDrop' | 'equipSlot' | 'metadata'>

type RoomItemWithTemplate = {
  id: string
  quantity: number
  templateId?: string
  roomId?: string
  ItemTemplate?: ItemTemplateSelected | null
} & Record<string, unknown>

type RoomLike = {
  items?: Array<RoomItemWithTemplate | null> | null
} & Record<string, unknown>

export interface NormalizedRoomItem {
  id: string
  quantity: number
  template: ItemTemplateSelected
}

export type NormalizedRoomData<T extends RoomLike> = Omit<T, 'items'> & {
  items: NormalizedRoomItem[]
}

/**
 * Normalize raw room items to UI-friendly shape.
 * Skips malformed records missing ItemTemplate to avoid runtime errors.
 */
export function normalizeRoomItems(rawItems: RoomLike['items']): NormalizedRoomItem[] {
  if (!Array.isArray(rawItems)) return []

  // Order by ROOM_LOOT seed position; config items first (in config order),
  // then anything else (e.g. player-dropped) alphabetically by name.
  const ordered = [...rawItems].sort((a, b) => {
    const ia = ROOM_LOOT_ORDER.get(`${a?.roomId}::${a?.ItemTemplate?.slug}`) ?? Infinity
    const ib = ROOM_LOOT_ORDER.get(`${b?.roomId}::${b?.ItemTemplate?.slug}`) ?? Infinity
    if (ia !== ib) return ia - ib
    return (a?.ItemTemplate?.name ?? '').localeCompare(b?.ItemTemplate?.name ?? '')
  })

  const normalized: NormalizedRoomItem[] = []

  for (const item of ordered) {
    if (!item?.ItemTemplate) {
      console.warn('[room-normalization] Skipping room item missing ItemTemplate', {
        id: item?.id,
        templateId: (item as { templateId?: string })?.templateId,
      })
      continue
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
  }

  return normalized
}

/**
 * Normalize full room data including items.
 */
export function normalizeRoomData(room: null | undefined): null
export function normalizeRoomData<T extends RoomLike>(room: T): NormalizedRoomData<T>
export function normalizeRoomData(room: RoomLike | null | undefined) {
  if (!room) return null

  const { items, ...rest } = room

  return {
    ...rest,
    items: normalizeRoomItems(items ?? []),
  }
}

