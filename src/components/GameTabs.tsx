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
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
              {/* <div className="flex-1 min-h-0 border-t border-gray-800/50">*/}
                <RoomChat room={room} />
              {/* </div> */}
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

