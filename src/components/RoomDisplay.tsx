import { useState } from 'react'
import Icon from './Icon'

interface RoomDisplayProps {
  room: any
  onAction?: (action: string) => void
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

export default function RoomDisplay({ room, onAction }: RoomDisplayProps) {
  const [isPerformingAction, setIsPerformingAction] = useState<string | null>(null)
  
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

  return (
    <div className="mt-4 space-y-4">
      {/* Room Info */}
      <div className="bg-gray-800 rounded-lg">
        <div className="text-sm text-gray-400 mb-1">Room {room.roomId}</div>
        <h3 className="text-lg font-semibold text-white mb-2">{room.name}</h3>
        <p className="text-gray-300 leading-relaxed">{room.description}</p>
      </div>

      {/* Room Actions */}
      {roomActions.length > 0 && (
        <div className="bg-gray-800 rounded-lg">
          <h4 className="text-md font-semibold text-green-400 mb-3 flex items-center gap-2">
            <Icon name="inv" size={16} color="green" />
            Room Actions
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {roomActions.map((action) => (
              <button
                key={action.action}
                onClick={() => handleAction(action.action)}
                disabled={isPerformingAction === action.action}
                className={`
                  px-3 py-2 rounded-md text-sm font-medium text-white transition-colors
                  flex items-center gap-2 justify-center
                  ${action.className || 'bg-gray-600 hover:bg-gray-700'}
                  ${isPerformingAction === action.action ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {action.icon && <Icon name={action.icon} size={20} color="white" />}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
