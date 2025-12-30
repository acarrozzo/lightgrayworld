export interface RoomAction {
  action: string
  label: string
  icon?: string
  className?: string
}

export const ROOM_ACTIONS: Record<string, RoomAction[]> = {
  '000': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
    { action: 'examine pillar', label: 'Examine Pillar', icon: 'target', className: 'bg-blue-500/70 hover:bg-blue-600' },
    { action: 'teleport to grassy field', label: 'Press Button', icon: 'ePow', className: 'bg-green-500/70 hover:bg-green-600' },
  ],
  '001': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'open gold chest', label: 'Open Gold Chest', icon: 'chest', className: 'bg-orange-500/90 hover:bg-orange-500' },
  ],
  '002': [
    { action: 'pick redberry', label: 'Pick Redberry', icon: 'redberry', className: 'bg-red-600 hover:bg-red-700' },
  ],
  '003': [
    { action: 'ex cabin', label: 'Examine Cabin', icon: 'cabin2', className: 'bg-gray-600 hover:bg-gray-700' },
    { action: 'attack dummy', label: 'Attack Dummy', icon: 'sword1', className: 'bg-red-500/70 hover:bg-red-500' },
    { action: 'cook meat', label: 'Cook Meat', icon: 'fire', className: 'bg-orange-600 hover:bg-orange-700' },
  ],
  '003c': [],
  '004': [
    { action: 'pick flower', label: 'Pick Flower', icon: 'flower', className: 'bg-pink-600 hover:bg-pink-700' },
  ],
  '005': [
    { action: 'pick blueberry', label: 'Pick Blueberry', icon: 'blueberry', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'ex tent', label: 'Examine Tent', icon: 'tent', className: 'bg-purple-600 hover:bg-purple-700' },
  ],
  '006': [
    { action: 'view shop', label: 'View Shop', icon: 'shop', className: 'bg-gray-600 hover:bg-gray-700' },
  ],
  '007': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'search', label: 'Search', icon: 'aim', className: 'bg-green-600 hover:bg-green-700' },
  ],
  '020': [
    { action: 'rest', label: 'Rest at Waterfall', icon: 'heal', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '021': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'buy staff', label: 'Buy Staff', icon: 'equipment-basicstaff', className: 'bg-purple-600 hover:bg-purple-700' },
  ],
  '999': [
    { action: 'teleport to grassy field', label: 'Teleport to the Grassy Field', icon: 'world', className: 'bg-green-500/70  hover:bg-green-600' },
  ],
}

/**
 * Get available actions for a specific room
 */
export function getRoomActions(roomId: string): RoomAction[] {
  return ROOM_ACTIONS[roomId] || []
}

/**
 * Check if an action is available for a specific room
 */
export function isActionAvailableForRoom(roomId: string, action: string): boolean {
  const actions = getRoomActions(roomId)
  return actions.some((a) => a.action.toLowerCase() === action.toLowerCase())
}

