import { EquipSlot } from '@prisma/client'

export interface RoomItemTemplate {
  id: string
  slug: string
  name: string
  description: string
  type: string
  value: number
  canSell?: boolean
  canDrop?: boolean
  equipSlot?: EquipSlot | null
  metadata?: { icon?: string } | null
}

export interface RoomItemView {
  id: string
  quantity: number
  template: RoomItemTemplate
}

export interface RoomViewNavigation {
  north?: string
  northeast?: string
  east?: string
  southeast?: string
  south?: string
  southwest?: string
  west?: string
  northwest?: string
  up?: string
  down?: string
}

/** One action a traveler offers while standing here ("talk to sherman"). */
export interface TravelerActionView {
  action: string
  label: string
  icon?: string
  className?: string
}

/**
 * A traveler standing in a room, as the server describes it: shared by everyone
 * there, gone when it moves on. `enemy` is present for one that can be fought.
 */
export interface TravelerView {
  id: string
  kind: 'creature' | 'npc' | string
  name: string
  title?: string | null
  description: string
  icon: string
  iconFile: string
  actions: TravelerActionView[]
  enemy: {
    slug: string
    name: string
    description: string
    icon: string
    level: number
    hp: number
    att: number
    def: number
    isAggressive: boolean
    isFriendly: boolean
  } | null
  /** For a scheduled traveler, when it moves on; null for a wanderer. */
  leavesAt?: number | null
}

export interface RoomView extends RoomViewNavigation {
  id: string
  roomId: string
  name: string
  subtitle: string
  subtitlePosition?: 'above' | 'below' | string
  /**
   * The world region this room belongs to. Drives its themed colours; the
   * four *Color fields below are per-room overrides on top of it and hold
   * semantic tokens, never CSS classes. See src/lib/theme/room-colors.ts.
   */
  region?: string | null
  nameColor?: string | null
  subtitleColor?: string | null
  icon?: string | null
  iconColor?: string | null
  iconSize?: string | null
  directionColors?: Record<string, string> | null
  description: string
  dangerLevel: number
  isSafe: boolean
  hasSearch?: boolean
  stateNote?: string | null
  actionOverrides?: Record<string, { className?: string; icon?: string }> | null
  /**
   * Directions out of this room that carry a gate, derived server-side from
   * ROOM_GATES. Only *whether* an exit is gated — never the condition.
   */
  gatedExits?: string[]
  players: any[]
  items: RoomItemView[]
  npcs: any[]
  /** Who is passing through right now. Live: updated by `room:travelers`. */
  travelers?: TravelerView[]
}


