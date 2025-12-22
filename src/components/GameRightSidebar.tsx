'use client'

import GameTabs from './GameTabs'

interface GameRightSidebarProps {
  room: any
  onClose?: () => void
}

export default function GameRightSidebar({ room, onClose }: GameRightSidebarProps) {
  return (
    <GameTabs
      room={room}
      onClose={onClose}
    />
  )
}
