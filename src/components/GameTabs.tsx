'use client'

import GameChat from './GameChat'
import RoomChat from './RoomChat'
import TabContainer, { TabConfig } from './TabContainer'
import type { Room, Player } from '@/lib/game-state'
import HistoryPanel from './HistoryPanel'

interface GameTabsProps {
  room: Room | null
  onClose?: () => void
}

export default function GameTabs({ room, onClose }: GameTabsProps) {
  const tabs: TabConfig[] = [
    {
      id: 'world-chat',
      label: 'World Chat',
      content: <GameChat onClose={onClose} />,
    },
    {
      id: 'room-chat',
      label: 'Room Chat',
      content: room ? <RoomChat room={room} /> : <div className="p-4 text-sm text-gray-400">No room loaded.</div>,
    },
    {
      id: 'history',
      label: 'History',
      content: <HistoryPanel />,
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

