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
    <header className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/50 px-4 sm:px-6 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Mobile sidebar toggles */}
          <button 
            className="xl:hidden p-2 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 relative"
            onClick={onToggleLeftSidebar}
            title="Toggle Player Info (Ctrl+1 or swipe right)"
          >
            <PersonStanding className="h-5 w-5" strokeWidth={2} />
          </button>
          
          <button 
            className="lg:hidden p-2 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 relative"
            onClick={onToggleRightSidebar}
            title="Toggle Chat & Navigation (Ctrl+2 or swipe left)"
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="flex items-center space-x-3 sm:space-x-4 hidden md:flex">
            <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Light Gray RPG</h1>
            <span className="text-xs sm:text-sm text-gray-500 font-normal">v0.1.1</span>
            <div className="text-sm text-gray-400">
              Welcome, <span className="text-amber-400/90 font-medium">{player.username}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3 sm:space-x-4">
        <div className="flex items-center space-x-3 sm:space-x-4 hidden md:flex">
          <div className="text-xs sm:text-sm text-gray-400">
            <span className="font-medium">Lv.{player.level}</span> | <span className="text-red-400/90">HP: {player.hp}/{player.hpMax}</span> | <span className="text-blue-400/90">MP: {player.mp}/{player.mpMax}</span>
          </div>
          </div>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
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
