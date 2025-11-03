import { useMemo, useState } from 'react'
import type { Player } from '@/lib/game-state'

interface RoomDisplayProps {
  room: any
  roomPlayers?: Player[]
  currentPlayerId?: string
  onAction?: (action: string) => void
  showHeader?: boolean
  className?: string
  showPlayers?: boolean
}

// Room-specific actions configuration
const getRoomActions = (roomId: string) => {
  const roomActions: Record<string, Array<{action: string, label: string, icon?: string, className?: string}>> = {
    '000': [
      { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
      { action: 'pick up map', label: 'Pick Up Map', icon: 'world', className: 'bg-green-600 hover:bg-green-700' },
      { action: 'press button', label: 'Press Button', icon: 'target', className: 'bg-yellow-600 hover:bg-yellow-700' }
    ],
    '001': [
      { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
      { action: 'ex chest', label: 'Examine Chest', icon: 'chest', className: 'bg-yellow-600 hover:bg-yellow-700' },
      { action: 'open chest', label: 'Open Gold Chest', icon: 'key', className: 'bg-green-600 hover:bg-green-700' }
    ],
    '002': [
      { action: 'pick redberry', label: 'Pick Redberries', icon: 'redberry', className: 'bg-red-600 hover:bg-red-700' }
    ],
    '003': [
      { action: 'ex cabin', label: 'Examine Cabin', icon: 'cabin2', className: 'bg-gray-600 hover:bg-gray-700' },
      { action: 'attack dummy', label: 'Attack Dummy', icon: 'sword1', className: 'bg-red-600 hover:bg-red-700' },
      { action: 'cook meat', label: 'Cook Meat', icon: 'fire', className: 'bg-orange-600 hover:bg-orange-700' }
    ],
    '004': [
      { action: 'pick flower', label: 'Pick Flower', icon: 'flower', className: 'bg-pink-600 hover:bg-pink-700' }
    ],
    '005': [
      { action: 'pick blueberry', label: 'Pick Blueberries', icon: 'blueberry', className: 'bg-blue-600 hover:bg-blue-700' },
      { action: 'ex tent', label: 'Examine Tent', icon: 'tent', className: 'bg-purple-600 hover:bg-purple-700' }
    ],
    '006': [
      { action: 'buy dagger', label: 'Buy Dagger', icon: 'sword1', className: 'bg-gray-600 hover:bg-gray-700' },
      { action: 'buy potion', label: 'Buy Potion', icon: 'potion', className: 'bg-red-600 hover:bg-red-700' }
    ],
    '007': [
      { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
      { action: 'search', label: 'Search Area', icon: 'aim', className: 'bg-green-600 hover:bg-green-700' }
    ],
    '020': [
      { action: 'rest', label: 'Rest at Springs', icon: 'heal', className: 'bg-blue-600 hover:bg-blue-700' }
    ],
    '021': [
      { action: 'read sign', label: 'Read Sign', icon: 'sign', className: 'bg-blue-600 hover:bg-blue-700' },
      { action: 'buy staff', label: 'Buy Staff', icon: 'equipment-basicstaff', className: 'bg-purple-600 hover:bg-purple-700' }
    ]
  }
  
  return roomActions[roomId] || []
}

export default function RoomDisplay({
  room,
  onAction,
  roomPlayers = [],
  currentPlayerId,
  showHeader = true,
  className,
  showPlayers = true,
}: RoomDisplayProps) {
  const [isPerformingAction, setIsPerformingAction] = useState<string | null>(null)

  const otherUsers = useMemo(
    () => roomPlayers.filter((player) => player.id !== currentPlayerId),
    [roomPlayers, currentPlayerId]
  )
  
  if (!room) {
    return (
      <div className="mt-4 p-4 bg-gray-800 rounded-lg">
        <div className="text-gray-400">Loading room...</div>
      </div>
    )
  }

  const roomActions = getRoomActions(room.roomId)

  const handleAction = async (action: string) => {
    if (!onAction || isPerformingAction) return
    
    setIsPerformingAction(action)
    try {
      await onAction(action)
    } catch (error) {
      console.error('Room action error:', error)
    } finally {
      setIsPerformingAction(null)
    }
  }

  const handleInspectPlayer = async (player: Player) => {
    if (!onAction || isPerformingAction) return

    const inspectAction = `look at ${player.username}`

    setIsPerformingAction(inspectAction)
    try {
      await onAction(inspectAction)
    } catch (error) {
      console.error('Room inspect error:', error)
    } finally {
      setIsPerformingAction(null)
    }
  }

  const containerClasses = [showHeader ? 'mt-4' : '', 'space-y-4', className || ''].filter(Boolean).join(' ')

  return (
    <div className={containerClasses}>
      {/* Room Info */}
      {showHeader && (
        <div className="bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-400 mb-1">Room {room.roomId}</div>
          <h3 className="text-lg font-semibold text-white mb-2">{room.name}</h3>
        </div>
      )}

      {/* Players in Room */}
      {showPlayers && otherUsers.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
              Players in Room ({otherUsers.length})
            </h4>
          </div>

          <div className="flex flex-wrap gap-2">
            {otherUsers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => handleInspectPlayer(player)}
                disabled={isPerformingAction !== null}
                className={`group relative px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                  isPerformingAction !== null
                    ? 'bg-purple-900/60 text-purple-300 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                <span>{player.username}</span>

                <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-md border border-gray-700 bg-gray-900/95 p-3 text-left text-xs text-gray-200 shadow-xl group-hover:block">
                  <p className="text-sm font-semibold text-white">{player.username}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-400">Level {player.level}</p>
                  <div className="mt-2 flex flex-col gap-1 text-[11px] text-gray-300">
                    <span>HP: {player.hp}/{player.hpMax}</span>
                    <span>MP: {player.mp}/{player.mpMax}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
