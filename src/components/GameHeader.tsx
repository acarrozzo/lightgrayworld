'use client'

import Icon from './Icon'
import { Settings as SettingsIcon } from 'lucide-react'

interface GameHeaderProps {
  onToggleCharacterSidebar?: () => void
  onToggleWorldSidebar?: () => void
  onOpenSettings?: () => void
  playerName?: string
}

export default function GameHeader({ onToggleCharacterSidebar, onToggleWorldSidebar, onOpenSettings, playerName }: GameHeaderProps) {
  return (
    <header className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/50 px-4 sm:px-6 py-2 shadow-sm">
      <div className="flex w-full items-center gap-4">
        <div className="flex flex-1 items-center">
          {onToggleCharacterSidebar && (
            <button
              onClick={onToggleCharacterSidebar}
              className="xl:hidden px-3 py-2 bg-transparent hover:bg-purple-500/10 border border-purple-500/40 hover:border-purple-500/60 text-purple-300 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 flex items-center gap-2"
              aria-label="Toggle player info sidebar"
            >
              <Icon name="character" className="h-5 w-5" color="current" />
              {playerName && <span className="text-sm font-medium">{playerName}</span>}
            </button>
          )}
        </div>

        <div className="flex flex-col items-center text-center space-y-0">
          <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Light Gray</h1>
          <span className="text-xs text-gray-500 font-normal">v0.1.3 - item epic</span>
        </div>

        <div className="flex flex-1 justify-end items-center gap-2">
          {onToggleWorldSidebar && (
            <button
              onClick={onToggleWorldSidebar}
              className="md:hidden px-3 py-2 bg-transparent hover:bg-blue-500/10 border border-blue-500/40 hover:border-blue-500/60 text-blue-300 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 flex items-center gap-2"
              aria-label="Toggle world feed sidebar"
            >
              <Icon name="world" className="h-5 w-5" color="current" />
              <span className="text-sm font-medium">World</span>
            </button>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="md:hidden p-2 bg-transparent hover:bg-gray-500/10 border border-gray-500/40 hover:border-gray-500/60 text-gray-300 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              aria-label="Open settings"
              title="Open settings"
            >
              <SettingsIcon className="h-5 w-5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
