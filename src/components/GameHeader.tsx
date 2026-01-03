'use client'

import Icon from './Icon'
import { ChevronRight, ChevronLeft } from 'lucide-react'

interface GameHeaderProps {
  onToggleCharacterSidebar?: () => void
  onToggleWorldSidebar?: () => void
  leftSidebarOpen?: boolean
  rightSidebarOpen?: boolean
  playerName?: string
}

export default function GameHeader({ 
  onToggleCharacterSidebar, 
  onToggleWorldSidebar, 
  leftSidebarOpen,
  rightSidebarOpen,
  playerName 
}: GameHeaderProps) {
  return (
    <header className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/50 px-4 sm:px-6 py-2 shadow-sm">
      <div className="flex w-full items-center gap-4">
        <div className="flex flex-1 items-center">
          {onToggleCharacterSidebar && (
            <button
              onClick={onToggleCharacterSidebar}
              className="px-3 py-2 bg-transparent hover:bg-purple-500/10 border border-purple-500/40 hover:border-purple-500/60 text-purple-300 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 flex items-center gap-2"
              aria-label="Toggle player info sidebar"
            >
              {leftSidebarOpen ? (
                <ChevronLeft size={20} />
              ) : (
                <ChevronRight size={20} />
              )}
              <Icon name="character" className="h-5 w-5" color="current" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center text-center space-y-0">
          <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Light Gray</h1>
          <span className="text-xs text-gray-500 font-normal">v0.1.4</span>
        </div>

        <div className="flex flex-1 justify-end items-center gap-2">
          {onToggleWorldSidebar && (
            <button
              onClick={onToggleWorldSidebar}
              className="px-3 py-2 bg-transparent hover:bg-blue-500/10 border border-blue-500/40 hover:border-blue-500/60 text-blue-300 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 flex items-center gap-2"
              aria-label="Toggle world feed sidebar"
            >
              {rightSidebarOpen ? (
                <ChevronRight size={20} />
              ) : (
                <ChevronLeft size={20} />
              )}
              <Icon name="world" className="h-5 w-5" color="current" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
