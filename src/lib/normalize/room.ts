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
  value: 10,
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
    // Surface the server `inFight` flag as `inBattle` so room snapshots show the
    // battle tag for players already fighting when you arrive. Live changes after
    // that arrive via the player-battle-status socket event.
    players: Array.isArray(room.players)
      ? room.players.map((p: any) => ({ ...p, inBattle: p?.inBattle ?? p?.inFight ?? false }))
      : [],
    items: normalizeRoomItems(room.items),
    npcs: Array.isArray(room.npcs) ? room.npcs : [],
  } as RoomView
}


