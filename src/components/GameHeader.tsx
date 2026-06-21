'use client'

interface GameHeaderProps {
  playerName?: string
  level?: number
  hp?: number
  hpMax?: number
  mp?: number
  mpMax?: number
  xp?: number
  xpGain?: number | null
  xpGainKey?: number
  str?: number
  dex?: number
  mag?: number
  def?: number
  clicks?: number
  onCharacterClick?: () => void
  isConnected?: boolean
  onRefresh?: () => void
  panelsOpen?: boolean
  onTogglePanels?: () => void
}

export default function GameHeader({ playerName, level, hp, hpMax, mp, mpMax, xp, xpGain, xpGainKey, str, dex, mag, def, clicks, onCharacterClick, isConnected, onRefresh, panelsOpen, onTogglePanels }: GameHeaderProps) {
  let xpInLevel = 0
  let xpNeeded = 1
  let xpPct = 0
  if (xp !== undefined && level !== undefined) {
    const xpFromLevel = (level ** 3) * 2
    const xpForLevel = ((level + 1) ** 3) * 2
    xpInLevel = Math.max(0, xp - xpFromLevel)
    xpNeeded = xpForLevel - xpFromLevel
    xpPct = Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100))
  }

  return (
    <>
      <style>{`
        @keyframes xpFloat {
          0%   { opacity: 1;  transform: translateY(0px); }
          60%  { opacity: 1; transform: translateY(-6px); }
          100% { opacity: 0; transform: translateY(-12px); }
        }
      `}</style>
      <header className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/50 px-4 sm:px-6 py-2.5 shadow-sm">
        <div className="flex w-full items-center justify-between">

          {/* Left side - Player stats */}
          {playerName && (
            <div
              onClick={onCharacterClick}
              className={`flex items-center gap-6 text-xs ${onCharacterClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            >
              {/* Username and Level */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-gray-300">{playerName}</span>
                {level !== undefined && (
                  <span className="text-yellow-400">Lv.{level}</span>
                )}
                {xp !== undefined && level !== undefined && (
                  <span className="text-green-400">{xpPct}%</span>
                )}
              </div>

              {/* HP / MP / XP */}
              <div className="flex items-center gap-2">
                {hp !== undefined && hpMax !== undefined && (
                  <span className="text-red-400">
                    <span className={hp > hpMax ? 'text-yellow-400' : undefined}>{hp}</span>/{hpMax}
                  </span>
                )}
                {mp !== undefined && mpMax !== undefined && (
                  <span className="text-blue-400">
                    <span className={mp > mpMax ? 'text-yellow-400' : undefined}>{mp}</span>/{mpMax}
                  </span>
                )}
                {xpGain != null && xpGain > 0 && (
                  <span
                    key={xpGainKey}
                    className="text-yellow-400 font-bold pointer-events-none"
                    style={{ animation: 'xpFloat 2.5s forwards' }}
                  >
                    +{xpGain} xp
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Center - Title */}
          <div className="flex items-center gap-2 text-center absolute left-1/2 -translate-x-1/2">
            {clicks !== undefined && (
              <span className="text-[10px] text-gray-500 font-normal tabular-nums">{clicks.toLocaleString()}</span>
            )}
            <h1 className="text-sm font-medium text-white tracking-tight">Light Gray</h1>
            {onTogglePanels && (
              <button
                onClick={onTogglePanels}
                aria-label={panelsOpen ? 'Hide side panels' : 'Show side panels'}
                title={panelsOpen ? 'Hide side panels' : 'Show side panels'}
                className="hidden lg:inline-flex items-center justify-center w-4 h-4 rounded-sm text-gray-500 hover:text-gray-200 hover:bg-gray-800/60 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="0.5" y="1.5" width="11" height="9" rx="1" stroke="currentColor" strokeWidth="1" />
                  {panelsOpen ? (
                    <>
                      <line x1="3.5" y1="1.5" x2="3.5" y2="10.5" stroke="currentColor" strokeWidth="1" />
                      <line x1="8.5" y1="1.5" x2="8.5" y2="10.5" stroke="currentColor" strokeWidth="1" />
                    </>
                  ) : null}
                </svg>
              </button>
            )}
            <span className="text-[10px] text-gray-500 font-normal">v0.1.5</span>
          </div>

          {/* Right side - Stats and Connection Status */}
          <div className="flex-1 flex justify-end items-center gap-3 text-xs">
            {/* Stats group */}
            <div className="flex items-center gap-2">
              {str !== undefined && (
                <>
                  <span className="text-gray-500 hidden lg:inline">STR </span>
                  <span className="text-red-400">{str}</span>
                </>
              )}
              {dex !== undefined && (
                <>
                  <span className="text-gray-500 hidden lg:inline">DEX </span>
                  <span className="text-green-400">{dex}</span>
                </>
              )}
              {mag !== undefined && (
                <>
                  <span className="text-gray-500 hidden lg:inline">MAG </span>
                  <span className="text-blue-400">{mag}</span>
                </>
              )}
              {def !== undefined && (
                <>
                  <span className="text-gray-500 hidden lg:inline">DEF </span>
                  <span className="text-yellow-400">{def}</span>
                </>
              )}
            </div>

            {isConnected !== undefined && (
              <div className="hidden md:flex items-center gap-2 ml-4">
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
          </div>

        </div>
      </header>
    </>
  )
}
