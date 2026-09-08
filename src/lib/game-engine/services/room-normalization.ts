import type { ItemTemplate, Prisma } from '@prisma/client'

// Room items are what players have left on the ground. What a room provides
// for free is per player and comes from config/room-supplies.js instead.

export const ROOM_ITEMS_SELECT = {
  items: {
    select: {
      id: true,
      quantity: true,
      templateId: true,
      roomId: true,
      droppedByName: true,
      createdAt: true,
      updatedAt: true,
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
  droppedByName?: string | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
  ItemTemplate?: ItemTemplateSelected | null
} & Record<string, unknown>

type RoomLike = {
  items?: Array<RoomItemWithTemplate | null> | null
} & Record<string, unknown>

export interface NormalizedRoomItem {
  id: string
  quantity: number
  /** Who left the pile (the latest dropper), for the "left by" rail. */
  droppedBy: string | null
  /** When the pile was last added to, ISO. */
  droppedAt: string | null
  template: ItemTemplateSelected
}

export type NormalizedRoomData<T extends RoomLike> = Omit<T, 'items'> & {
  items: NormalizedRoomItem[]
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' ? value : null
}

function stamp(item: RoomItemWithTemplate | null): number {
  const raw = item?.updatedAt ?? item?.createdAt
  const t = raw instanceof Date ? raw.getTime() : typeof raw === 'string' ? Date.parse(raw) : NaN
  return Number.isFinite(t) ? t : 0
}

/**
 * Normalize raw room items to UI-friendly shape. Freshest pile first, so the
 * thing just dropped is at the top of the strip.
 * Skips malformed records missing ItemTemplate to avoid runtime errors.
 */
export function normalizeRoomItems(rawItems: RoomLike['items']): NormalizedRoomItem[] {
  if (!Array.isArray(rawItems)) return []

  const ordered = [...rawItems].sort((a, b) => {
    const diff = stamp(b) - stamp(a)
    if (diff !== 0) return diff
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
