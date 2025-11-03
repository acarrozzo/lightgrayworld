'use client'

import { Player } from '@/lib/game-state'
import { useGameStore } from '@/lib/game-state'
import Icon from './Icon'

interface GameHeaderProps {
  player: Player
  onToggleLeftSidebar?: () => void
  onToggleRightSidebar?: () => void
}

export default function GameHeader({ player, onToggleLeftSidebar, onToggleRightSidebar }: GameHeaderProps) {
  const { logout } = useGameStore()

  const handleLogout = () => {
    logout()
  }

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile sidebar toggles */}
          <button 
            className="xl:hidden p-2 text-gray-400 hover:text-white transition-colors relative"
            onClick={onToggleLeftSidebar}
            title="Toggle Player Info (Ctrl+1 or swipe right)"
          >
            <Icon name="character" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full opacity-75"></div>
          </button>
          
          <button 
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors relative"
            onClick={onToggleRightSidebar}
            title="Toggle Chat & Navigation (Ctrl+2 or swipe left)"
          >
            <Icon name="question" size={20} />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full opacity-75"></div>
          </button>
          
          <h1 className="text-xl font-bold text-white">Light Gray RPG </h1>
          <span className="text-sm text-gray-400 font-normal">v0.1.01d</span>
          <div className="text-sm text-gray-300">
            Welcome, <span className="text-yellow-400 font-semibold">{player.username}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-300">
            Level {player.level} | HP: {player.hp}/{player.hpMax} | MP: {player.mp}/{player.mpMax}
          </div>
          
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
