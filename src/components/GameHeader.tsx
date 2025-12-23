'use client'

import Icon from './Icon'

interface GameHeaderProps {
  onToggleCharacterSidebar?: () => void
  onToggleWorldSidebar?: () => void
}

export default function GameHeader({ onToggleCharacterSidebar, onToggleWorldSidebar }: GameHeaderProps) {
  return (
    <header className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/50 px-4 sm:px-6 py-2 shadow-sm">
      <div className="flex w-full items-center gap-4">
        <div className="flex flex-1 items-center">
          {onToggleCharacterSidebar && (
            <button
              onClick={onToggleCharacterSidebar}
              className="xl:hidden p-2 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              aria-label="Toggle player info sidebar"
            >
              <Icon name="character" className="h-5 w-5" color="current" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center text-center space-y-0">
          <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight">Light Gray</h1>
          <span className="text-xs text-gray-500 font-normal">v0.1.3 - item epic</span>
        </div>

        <div className="flex flex-1 justify-end">
          {onToggleWorldSidebar && (
            <button
              onClick={onToggleWorldSidebar}
              className="lg:hidden p-2 bg-gray-800/50 hover:bg-gray-800 text-white rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              aria-label="Toggle world feed sidebar"
            >
              <Icon name="world" className="h-5 w-5" color="current" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
