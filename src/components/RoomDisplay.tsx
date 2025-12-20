import { useMemo, useState } from 'react'
import type { Player } from '@/lib/game-state'
import { getRoomActions } from '@/lib/room-actions'

interface RoomDisplayProps {
  room: any
  roomPlayers?: Player[]
  currentPlayerId?: string
  onAction?: (action: string) => void
  showHeader?: boolean
  className?: string
  showPlayers?: boolean
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
}