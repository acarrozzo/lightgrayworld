import type { ItemTemplate, Prisma } from '@prisma/client'

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
          metadata: true,
        },
      },
    },
    orderBy: {
      ItemTemplate: {
        name: 'asc'
      }
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
          metadata: true,
        },
      },
    },
  },
} as const satisfies Prisma.RoomInclude

type ItemTemplateSelected = Pick<ItemTemplate, 'id' | 'slug' | 'name' | 'description' | 'type' | 'value' | 'canSell' | 'canDrop' | 'metadata'>

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

  const normalized: NormalizedRoomItem[] = []

  for (const item of rawItems) {
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

