'use client'

import GameFeed, { FeedControlHandlers } from './GameFeed'
import GameChat from './GameChat'
import TabContainer, { TabConfig } from './TabContainer'
import type { Room } from '@/lib/game-state'

interface GameTabsProps {
  room: Room | null
  actionResult?: any
  onRegisterFeedControls?: (handlers: FeedControlHandlers) => void
  onClose?: () => void
}

export default function GameTabs({ room, actionResult, onRegisterFeedControls, onClose }: GameTabsProps) {
  const tabs: TabConfig[] = [
    {
      id: 'feed',
      label: 'Feed',
      content: (
        <GameFeed 
          room={room} 
          actionResult={actionResult} 
          onRegisterControls={onRegisterFeedControls}
        />
      ),
    },
    {
      id: 'world-chat',
      label: 'World Chat',
      content: <GameChat onClose={onClose} />,
    },
    {
      id: 'room-chat',
      label: 'Room Chat',
      content: (
        <div className="h-full flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-gray-400 text-lg mb-2">Room Chat</p>
            <p className="text-gray-500/80 text-sm">Coming Soon</p>
          </div>
        </div>
      ),
    },
  ]

  return (
    <TabContainer
      tabs={tabs}
      defaultTab="feed"
      onClose={onClose}
      closeButtonPlacement="integrated"
      closeButtonBreakpoint="lg"
      containerClassName="h-full"
      buttonPadding="px-4 py-3"
    />
  )
}

