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

export interface RoomView extends RoomViewNavigation {
  id: string
  roomId: string
  name: string
  subtitle: string
  subtitlePosition?: 'above' | 'below' | string
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
}


