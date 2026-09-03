'use client'

import ThemeSwitcher from '@/components/ThemeSwitcher'

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
  /** Unspent Core + Training Points. Desktop shows a pill beside the name; on phones the Char tab badge carries it instead, the bar has no room. */
  unspentPoints?: number
  onCharacterClick?: () => void
  isConnected?: boolean
  onRefresh?: () => void
}

function StatBar({ pct, fillClass, label, value, over, className }: {
  pct: number
  fillClass: string
  label: string
  value: string
  over?: boolean
  className?: string
}) {
  return (
    <div
      className={`relative h-4 rounded-full bg-surface-raised/90 overflow-hidden shadow-[inset_0_1px_3px_var(--shadow)] ${className ?? ''}`}
      title={`${label} ${value}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${fillClass}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] leading-none font-semibold label-over-fill tabular-nums">
        <span className={over ? 'font-bold' : ''}>{value}</span>
      </span>
    </div>
  )
}

function UnspentPill({ count }: { count?: number }) {
  if (!count || count <= 0) return null
  const label = `${count} unspent point${count === 1 ? '' : 's'}`
  return (
    <span className="relative inline-flex shrink-0" title={`${label} — open your character to spend them`} aria-label={label}>
      <span className="absolute inset-0 rounded-full bg-accent/60 animate-ping-slow" aria-hidden="true" />
      <span className="relative min-w-[1.25rem] h-5 px-1.5 rounded-full fill-accent text-[10px] font-bold leading-5 text-center tabular-nums">
        +{count}
      </span>
    </span>
  )
}

export default function GameHeader({ playerName, level, hp, hpMax, mp, mpMax, xp, xpGain, xpGainKey, str, dex, mag, def, clicks, unspentPoints, onCharacterClick, isConnected, onRefresh }: GameHeaderProps) {
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
      <header className="bg-surface-panel/95 backdrop-blur-sm border-b border-line-subtle/30 px-4 sm:px-6 py-2.5 shadow-lg shadow-black/20">

        {/* Mobile layout - no branding. Left group: name · Lv · XP% · HP · MP. Right group: stats · connection dot */}
        <div className="flex md:hidden w-full items-center justify-between gap-2.5 text-xs">
          {/* Left group */}
          <div className="flex items-center gap-2 min-w-0">
            {playerName && (
              <div
                onClick={onCharacterClick}
                className={`flex items-center gap-2 min-w-0 ${onCharacterClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              >
                <span className="text-fg-primary truncate">{playerName}</span>
                {hp !== undefined && hpMax !== undefined && (
                  <StatBar
                    className="w-12 shrink-0"
                    pct={hpMax > 0 ? (hp / hpMax) * 100 : 0}
                    fillClass="bg-gradient-to-r from-fill-resource-hp to-resource-hp"
                    label="HP"
                    value={`${hp}/${hpMax}`}
                    over={hp > hpMax}
                  />
                )}
                {mp !== undefined && mpMax !== undefined && (
                  <StatBar
                    className="w-12 shrink-0"
                    pct={mpMax > 0 ? (mp / mpMax) * 100 : 0}
                    fillClass="bg-gradient-to-r from-fill-resource-mp to-resource-mp"
                    label="MP"
                    value={`${mp}/${mpMax}`}
                    over={mp > mpMax}
                  />
                )}
                {level !== undefined && (
                  <span className="text-stat-def shrink-0">Lv. {level}</span>
                )}
                {xp !== undefined && level !== undefined && (
                  <StatBar
                    className="w-10 shrink-0"
                    pct={xpPct}
                    fillClass="bg-gradient-to-r from-fill-resource-xp to-resource-xp"
                    label="XP"
                    value={`${xpPct}%`}
                  />
                )}
                {xpGain != null && xpGain > 0 && (
                  <span
                    key={xpGainKey}
                    className="text-stat-def font-bold pointer-events-none shrink-0"
                    style={{ animation: 'xpFloat 2.5s forwards' }}
                  >
                    +{xpGain} xp
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right group - core stats + connection dot */}
          <div className="flex items-center gap-2 shrink-0">
            {str !== undefined && <span className="text-stat-str">{str}</span>}
            {dex !== undefined && <span className="text-stat-dex">{dex}</span>}
            {mag !== undefined && <span className="text-stat-mag">{mag}</span>}
            {def !== undefined && <span className="text-stat-def">{def}</span>}
            {/* The connection indicator is desktop-only, so on mobile this
                trails the stats — still the last control in the bar. */}
            <ThemeSwitcher className="ml-0.5" />
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden md:flex w-full items-center justify-between">

          {/* Left side - Player stats */}
          <div className="flex items-center gap-6">
            {playerName && (
              <div
                onClick={onCharacterClick}
                className={`flex items-center gap-2 text-xs ${onCharacterClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              >
                {/* Username */}
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-fg-primary">{playerName}</span>
                  <UnspentPill count={unspentPoints} />
                </div>

                {/* HP / MP / Level / XP */}
                <div className="flex items-center gap-2">
                  {hp !== undefined && hpMax !== undefined && (
                    <StatBar
                      className="w-16"
                      pct={hpMax > 0 ? (hp / hpMax) * 100 : 0}
                      fillClass="bg-gradient-to-r from-fill-resource-hp to-resource-hp"
                      label="HP"
                      value={`${hp}/${hpMax}`}
                      over={hp > hpMax}
                    />
                  )}
                  {mp !== undefined && mpMax !== undefined && (
                    <StatBar
                      className="w-16"
                      pct={mpMax > 0 ? (mp / mpMax) * 100 : 0}
                      fillClass="bg-gradient-to-r from-fill-resource-mp to-resource-mp"
                      label="MP"
                      value={`${mp}/${mpMax}`}
                      over={mp > mpMax}
                    />
                  )}
                  {level !== undefined && (
                    <span className="text-stat-def">Lv. {level}</span>
                  )}
                  {xp !== undefined && level !== undefined && (
                    <StatBar
                      className="w-14"
                      pct={xpPct}
                      fillClass="bg-gradient-to-r from-fill-resource-xp to-resource-xp"
                      label="XP"
                      value={`${xpPct}%`}
                    />
                  )}
                  {xpGain != null && xpGain > 0 && (
                    <span
                      key={xpGainKey}
                      className="text-stat-def font-bold pointer-events-none"
                      style={{ animation: 'xpFloat 2.5s forwards' }}
                    >
                      +{xpGain} xp
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Center - Title */}
          <div className="flex items-center gap-2 text-center absolute left-1/2 -translate-x-1/2">
            {clicks !== undefined && (
              <span className="text-[10px] text-fg-muted font-normal tabular-nums">{clicks.toLocaleString()}</span>
            )}
            <h1 className="text-sm font-semibold text-fg-bright tracking-wide">Light Gray</h1>
            <span className="text-[10px] text-fg-muted font-normal">v0.1.8</span>
          </div>

          {/* Right side - Stats and Connection Status */}
          <div className="flex-1 flex justify-end items-center gap-3 text-xs">
            {/* Stats group */}
            <div className="flex items-center gap-2">
              {str !== undefined && (
                <>
                  <span className="text-fg-muted hidden lg:inline">STR </span>
                  <span className="text-stat-str">{str}</span>
                </>
              )}
              {dex !== undefined && (
                <>
                  <span className="text-fg-muted hidden lg:inline">DEX </span>
                  <span className="text-stat-dex">{dex}</span>
                </>
              )}
              {mag !== undefined && (
                <>
                  <span className="text-fg-muted hidden lg:inline">MAG </span>
                  <span className="text-stat-mag">{mag}</span>
                </>
              )}
              {def !== undefined && (
                <>
                  <span className="text-fg-muted hidden lg:inline">DEF </span>
                  <span className="text-stat-def">{def}</span>
                </>
              )}
            </div>

            {isConnected !== undefined && (
              <div className="hidden md:flex items-center gap-2 ml-4">
                <div className="flex items-center gap-2 text-fg-secondary">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-status-success shadow-[0_0_6px_color-mix(in_srgb,var(--status-success)_50%,transparent)]' : 'bg-status-error shadow-[0_0_6px_color-mix(in_srgb,var(--status-error)_50%,transparent)]'}`} />
                  <span className="text-xs">{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                {!isConnected && onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="px-2 py-1 text-xs font-medium rounded-md fill-accent transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97]"
                    aria-label="Refresh page"
                    title="Refresh page"
                  >
                    Refresh
                  </button>
                )}
              </div>
            )}

            {/* Last in the bar, with the other chrome controls. */}
            <ThemeSwitcher className="ml-1" />
          </div>

        </div>
      </header>
    </>
  )
}
