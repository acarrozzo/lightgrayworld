'use client'

import type { Player } from '@/lib/game-state'
import { MessageCircle, PersonStanding, Settings as SettingsIcon } from 'lucide-react'

interface GameHeaderProps {
  player: Player
  onToggleLeftSidebar?: () => void
  onToggleRightSidebar?: () => void
  onOpenSettings?: () => void
}

export default function GameHeader({ player, onToggleLeftSidebar, onToggleRightSidebar, onOpenSettings }: GameHeaderProps) {
  return (
    <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile sidebar toggles */}
          <button 
            className="xl:hidden p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 relative"
            onClick={onToggleLeftSidebar}
            title="Toggle Player Info (Ctrl+1 or swipe right)"
          >
            <PersonStanding className="h-5 w-5" strokeWidth={2} />
          </button>
          
          <button 
            className="lg:hidden p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800 relative"
            onClick={onToggleRightSidebar}
            title="Toggle Chat & Navigation (Ctrl+2 or swipe left)"
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="flex items-center space-x-4 hidden md:flex">
            <h1 className="text-xl font-bold text-white">Light Gray RPG </h1>
            <span className="text-sm text-gray-400 font-normal">v0.1.01e</span>
            <div className="text-sm text-gray-300">
              Welcome, <span className="text-yellow-400 font-semibold">{player.username}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-4 hidden md:flex">
          <div className="text-sm text-gray-300">
            Level {player.level} | HP: {player.hp}/{player.hpMax} | MP: {player.mp}/{player.mpMax}
          </div>
          </div>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-800"
              aria-label="Open settings"
            >
              <SettingsIcon className="h-5 w-5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
