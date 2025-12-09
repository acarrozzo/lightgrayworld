'use client'

import { Player } from '@/lib/game-state'
import TabContainer, { TabConfig } from './TabContainer'

interface GameSidebarProps {
  player: Player
  onClose?: () => void
}

export default function GameSidebar({ player, onClose }: GameSidebarProps) {
  const tabs: TabConfig[] = [
    {
      id: 'stats',
      label: 'Stats',
      icon: 'character',
      color: 'blue',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Character Stats</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Level:</span>
              <span className="text-white">{player.level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">HP:</span>
              <span className="text-red-400">{player.hp}/{player.hpMax}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">MP:</span>
              <span className="text-blue-400">{player.mp}/{player.mpMax}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-700">
            <h4 className="text-md font-semibold text-white mb-2">Attributes</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">STR:</span>
                <span className="text-white">10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">DEX:</span>
                <span className="text-white">10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">MAG:</span>
                <span className="text-white">10</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">DEF:</span>
                <span className="text-white">10</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: 'inv',
      color: 'green',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Inventory</h3>
          <div className="text-gray-400 text-sm">
            Your inventory is empty.
          </div>
        </div>
      ),
    },
    {
      id: 'skills',
      label: 'Skills',
      icon: 'attack',
      color: 'red',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Skills & Spells</h3>
          <div className="text-gray-400 text-sm">
            No skills learned yet.
          </div>
        </div>
      ),
    },
    {
      id: 'quests',
      label: 'Quests',
      icon: 'inv',
      color: 'purple',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Quests</h3>
          <div className="text-gray-400 text-sm">
            No active quests.
          </div>
        </div>
      ),
    },
  ]

  return (
    <TabContainer
      tabs={tabs}
      defaultTab="stats"
      onClose={onClose}
      closeButtonPlacement="separate"
      closeButtonBreakpoint="xl"
      contentClassName="p-4"
    />
  )
}
