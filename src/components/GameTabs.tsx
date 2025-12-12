'use client'

import { FeedControlHandlers, renderRoomInfo } from './GameFeed'
import GameChat from './GameChat'
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
      id: 'feed',
      label: 'Feed',
      content: (
        <div className="h-full overflow-y-auto">
          {room && (
            <>
              <div className="border border-gray-800/50 rounded-xl m-4 sm:m-6 bg-gray-900/30 backdrop-blur-sm shadow-lg">
                {renderRoomInfo(room, {
                  player,
                  onAction: onAction,
                })}

                {/* Action Controls Section */}
                <div className="border-t border-gray-800/50 p-5 mt-5 max-w-4xl mx-auto">
                  <div className="flex flex-col gap-2.5">
                    {/* Action Buttons */}
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => {
                          console.log('[ActionButton] Attack button clicked')
                          onAction?.('attack')
                        }}
                        disabled={isLoadingRoom}
                        className="px-4 py-2.5 bg-red-600/90 hover:bg-red-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
                      >
                        {isLoadingRoom && action === 'attack' ? '...' : 'Attack'}
                      </button>
                      <button
                        onClick={() => {
                          console.log('[ActionButton] Search button clicked')
                          onAction?.('search')
                        }}
                        disabled={isLoadingRoom}
                        className="px-4 py-2.5 bg-amber-600/90 hover:bg-amber-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
                      >
                        {isLoadingRoom && action === 'search' ? '...' : 'Search'}
                      </button>
                      <button
                        onClick={() => {
                          console.log('[ActionButton] Rest button clicked')
                          onAction?.('rest')
                        }}
                        disabled={isLoadingRoom}
                        className="px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
                      >
                        {isLoadingRoom && action === 'rest' ? '...' : 'Rest'}
                      </button>
                      <button
                        onClick={() => {
                          console.log('[ActionButton] Look button clicked')
                          onAction?.('look')
                        }}
                        disabled={isLoadingRoom}
                        className="px-4 py-2.5 bg-blue-600/90 hover:bg-blue-500 disabled:bg-gray-700/50 disabled:cursor-not-allowed disabled:opacity-50 text-white rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow"
                      >
                        {isLoadingRoom && action === 'look' ? '...' : 'Look'}
                      </button>
                    </div>

                    {/* Custom Action Input */}
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
                </div>
              </div>
            </>
          )}
        </div>
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

