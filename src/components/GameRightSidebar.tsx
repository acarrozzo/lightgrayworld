'use client'

import GameTabs from './GameTabs'
import type { FeedControlHandlers } from './GameFeed'

interface GameRightSidebarProps {
  room: any
  onAction: (action: string) => void
  onClose?: () => void
  onOpenMap?: (src: string, title: string) => void
  actionResult?: any
  onRegisterFeedControls?: (handlers: FeedControlHandlers) => void
}

export default function GameRightSidebar({ 
  room, 
  onAction, 
  onClose, 
  onOpenMap,
  actionResult,
  onRegisterFeedControls
}: GameRightSidebarProps) {
  return (
    <GameTabs
      room={room}
      actionResult={actionResult}
      onRegisterFeedControls={onRegisterFeedControls}
      onClose={onClose}
    />
  )
}
