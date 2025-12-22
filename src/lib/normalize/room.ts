import { RoomItemTemplate, RoomItemView, RoomView } from '@/lib/types/room'

type RawRoomItem = {
  id?: string
  quantity?: number
  template?: Partial<RoomItemTemplate> | null
  ItemTemplate?: Partial<RoomItemTemplate> | null
}

type RawRoom = {
  items?: RawRoomItem[]
  players?: any[]
  npcs?: any[]
  [key: string]: any
}

const fallbackTemplate: RoomItemTemplate = {
  id: 'unknown',
  slug: 'unknown-item',
  name: 'Unknown Item',
  description: '',
  type: 'generic',
}

const normalizeTemplate = (item: RawRoomItem): RoomItemTemplate | null => {
  const source = item?.template ?? item?.ItemTemplate
  if (!source) {
    return null
  }

  return {
    ...fallbackTemplate,
    ...source,
  }
}

export function normalizeRoomItems(rawItems?: RawRoomItem[] | null): RoomItemView[] {
  if (!Array.isArray(rawItems)) {
    return []
  }

  return rawItems
    .map((item) => {
      const template = normalizeTemplate(item)
      if (!template || !item?.id) {
        return null
      }

      return {
        id: item.id,
        quantity: typeof item.quantity === 'number' ? item.quantity : 1,
        template,
      }
    })
    .filter((item): item is RoomItemView => Boolean(item))
}

export function normalizeRoom(room: RawRoom | null | undefined): RoomView | null {
  if (!room) {
    return null
  }

  return {
    ...room,
    players: Array.isArray(room.players) ? room.players : [],
    items: normalizeRoomItems(room.items),
    npcs: Array.isArray(room.npcs) ? room.npcs : [],
  } as RoomView
}


