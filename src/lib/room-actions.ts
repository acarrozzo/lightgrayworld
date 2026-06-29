import QUESTS from './game-data/quests.json'

export interface RoomAction {
  action: string
  label: string
  icon?: string
  className?: string
  questIds?: string[]
}

/**
 * All quest IDs given by an NPC, ordered by their `number`. Derived from
 * quests.json (the single source of truth) so any quest with the matching
 * `giver.npcId` — including ones started later via onComplete effects —
 * surfaces in the NPC's room panel automatically, with no parallel list to
 * keep in sync here.
 */
export function questIdsForNpc(npcId: string): string[] {
  return Object.entries(QUESTS as Record<string, { giver?: { npcId?: string }; number?: number }>)
    .filter(([, def]) => def.giver?.npcId === npcId)
    .sort((a, b) => (a[1].number ?? 0) - (b[1].number ?? 0))
    .map(([id]) => id)
}

export const ROOM_ACTIONS: Record<string, RoomAction[]> = {
  '000': [
    { action: 'read sign', label: 'Read Sign', icon: '', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
    { action: 'examine pillar', label: 'Examine Pillar', icon: '', className: 'bg-blue-500/70 hover:bg-blue-500' },
    { action: 'teleport to grassy field', label: 'Press Button (Teleports to Grassy Field)', icon: '', className: 'bg-green-500/70 hover:bg-green-500/90' },
  ],
  '001': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-yellow-700/70 hover:bg-yellow-700/90' },
    { action: 'open gold chest', label: 'Open Gold Chest', icon: 'chest', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '002': [
    { action: 'pick redberry', label: 'Pick Redberry', icon: 'redberry', className: 'bg-red-600 hover:bg-red-700' },
  ],
  '003': [
    { action: 'talk to old man', label: 'Old Man', icon: 'npc-oldman', className: 'bg-yellow-600 hover:bg-yellow-700', questIds: questIdsForNpc('old_man') },
    { action: 'ex cabin', label: 'Examine Cabin', icon: 'cabin2', className: 'bg-gray-600 hover:bg-gray-700' },
    { action: 'attack dummy', label: 'Attack Dummy', icon: 'sword1', className: 'bg-red-500/70 hover:bg-red-500' },
    { action: 'cook meat', label: 'Cook Meat', icon: 'fire', className: 'bg-orange-600 hover:bg-orange-700' },
  ],
  '003b': [],
  '003bb': [],
  '003c': [],
  '004': [],
  '005': [
    { action: 'pick blueberry', label: 'Pick Blueberry', icon: 'blueberry', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '012d': [
    { action: 'pull lever', label: 'Pull Lever', icon: 'sign-metal2' },
  ],
  '006': [
    { action: 'view shop', label: 'View Shop', icon: 'basicshop', className: 'bg-amber-500/80 hover:bg-amber-500' },
  ],
  '007': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'talk to young soldier', label: 'Young Soldier', icon: 'npc-youngsoldier', className: 'bg-blue-600 hover:bg-blue-700', questIds: questIdsForNpc('young_soldier') },
  ],
  '020': [
    { action: 'rest at waterfall', label: 'Rest at Waterfall', icon: 'heal', className: 'bg-blue-600 hover:bg-blue-700' },
  ],
  '021': [
    { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'buy staff', label: 'Buy Staff', icon: 'equipment-basicstaff', className: 'bg-purple-600 hover:bg-purple-700' },
  ],
  '015': [
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],
  '016': [
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],
  '017': [
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],
  '018': [
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],
  '019': [
    { action: 'teleport to grassy field', label: 'Teleport to Grassy Field', icon: 'world', className: 'bg-green-500/70 hover:bg-green-600' },
    { action: 'shovel sand', label: 'Shovel Sand', icon: 'shovel', className: 'bg-yellow-600/80 hover:bg-yellow-600' },
  ],
  '028h': [
    { action: 'search', label: 'Search', icon: 'eye', className: 'bg-yellow-500/70 hover:bg-yellow-400' },
  ],
  '999': [
    { action: 'rest in lobby', label: 'Rest at the Fountain', icon: 'heal', className: 'bg-green-600 hover:bg-green-700' },
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

/**
 * Find the NPC talk action string that covers a given quest ID.
 * Returns the action string (e.g. "talk to old man") or null if not found.
 */
export function getNpcActionForQuest(questId: string): string | null {
  for (const actions of Object.values(ROOM_ACTIONS)) {
    for (const action of actions) {
      if (action.questIds?.includes(questId)) {
        return action.action
      }
    }
  }
  return null
}

