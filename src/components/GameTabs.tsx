'use client'

import { FeedControlHandlers, renderRoomInfo } from './GameFeed'
import GameChat from './GameChat'
import RoomChat from './RoomChat'
import TabContainer, { TabConfig } from './TabContainer'
import type { Room, Player } from '@/lib/game-state'

interface GameTabsProps {
  room: Room | null
  actionResult?: any
  onRegisterFeedControls?: (handlers: FeedControlHandlers) => void
  onClose?: () => void
  player?: Player
  onAction?: (action: string) => void
  isLoadingRoom?: boolean
  action?: string
}

export default function GameTabs({ room, actionResult, onRegisterFeedControls, onClose, player, onAction, isLoadingRoom, action }: GameTabsProps) {
  const tabs: TabConfig[] = [
    {
      id: 'world-chat',
      label: 'World Chat',
      content: <GameChat onClose={onClose} />,
    },
    {
      id: 'feed',
      label: 'Room',
      content: (
        <div className="h-full flex flex-col min-h-0">
          {room && (
            <>
              <div className="m-3 bg-gray-900/30g flex-shrink-0">
                {renderRoomInfo(room, {
                  player,
                  onAction: onAction,
                  variant: 'sidebar',
                })}
              </div>

              {/* Room Chat */}
              <div className="flex-1 min-h-0 border-t border-gray-800/50">
                <RoomChat room={room} />
              </div>

              {/* Custom Action Input */}
              <div className="border-t border-gray-800/50 p-5 max-w-4xl mx-auto flex-shrink-0">
                <div className="flex w-full max-w-[280px]">
                  <input
                    type="text"
                    placeholder="Enter custom action..."
                    className="flex-1 px-4 py-2.5 bg-gray-800/50 text-white border border-gray-700/50 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 text-sm transition-all duration-200"
                  />
                  <button
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-r-lg whitespace-nowrap text-sm font-medium transition-all duration-200 shadow-sm hover:shadow"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <TabContainer
      tabs={tabs}
      defaultTab="world-chat"
      onClose={onClose}
      closeButtonPlacement="integrated"
      closeButtonBreakpoint="lg"
      containerClassName="h-full"
      buttonPadding="px-4 py-3"
    />
  )
}

