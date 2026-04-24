'use client'

interface GameHeaderProps {
  playerName?: string
  level?: number
  hp?: number
  hpMax?: number
  mp?: number
  mpMax?: number
  str?: number
  strMod?: number
  dex?: number
  dexMod?: number
  mag?: number
  magMod?: number
  def?: number
  defMod?: number
  onCharacterClick?: () => void
  isConnected?: boolean
  onRefresh?: () => void
}

export default function GameHeader({ playerName, level, hp, hpMax, mp, mpMax, str, strMod, dex, dexMod, mag, magMod, def, defMod, onCharacterClick, isConnected, onRefresh }: GameHeaderProps) {
  return (
    <header className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/50 px-4 sm:px-6 py-1 shadow-sm">
      <div className="flex w-full items-center justify-between">
        {/* Left side - Player stats */}
        {playerName && (
          <div 
            onClick={onCharacterClick}
            className={`flex items-center gap-6 text-xs ${onCharacterClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          >
            {/* Username and Level group */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-gray-300">{playerName}</span>
              {level !== undefined && (
                <span className="text-gray-400">Lv.{level}</span>
              )}
            </div>
            
            {/* HP and MP group */}
            <div className="flex items-center gap-2">
              {hp !== undefined && hpMax !== undefined && (
                <span className="text-red-400">{hp}/{hpMax}</span>
              )}
              {mp !== undefined && mpMax !== undefined && (
                <span className="text-blue-400">{mp}/{mpMax}</span>
              )}
            </div>
          </div>
        )}
        
        {/* Center - Title */}
        <div className="flex items-center gap-2 text-center absolute left-1/2 -translate-x-1/2">
          <h1 className="text-sm font-medium text-white tracking-tight">Light Gray</h1>
          <span className="text-[10px] text-gray-500 font-normal">v0.1.5</span>
        </div>
        
        {/* Right side - Connection Status and Stats */}
        <div className="flex-1 flex justify-end items-center gap-3 text-xs">
          {/* Connection Status */}
          {isConnected !== undefined && (
            <div className="hidden md:flex items-center gap-2">
              <div className="flex items-center gap-2 text-gray-400">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-xs">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              {!isConnected && onRefresh && (
                <button
                  onClick={onRefresh}
                  className="px-2 py-1 text-xs font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-all duration-200 shadow-sm hover:shadow"
                  aria-label="Refresh page"
                  title="Refresh page"
                >
                  Refresh
                </button>
              )}
            </div>
          )}
          
          {/* Stats group */}
          <div className="hidden md:flex items-center gap-2">
            {strMod !== undefined && (
              <>
                <span className="text-gray-500 hidden lg:inline">STR </span>
                <span className="text-red-400">{strMod}</span>
              </>
            )}
            {dexMod !== undefined && (
              <>
                <span className="text-gray-500 hidden lg:inline">DEX </span>
                <span className="text-green-400">{dexMod}</span>
              </>
            )}
            {magMod !== undefined && (
              <>
                <span className="text-gray-500 hidden lg:inline">MAG </span>
                <span className="text-blue-400">{magMod}</span>
              </>
            )}
            {defMod !== undefined && (
              <>
                <span className="text-gray-500 hidden lg:inline">DEF </span>
                <span className="text-yellow-400">{defMod}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
