'use client'

import { Settings as SettingsIcon } from 'lucide-react'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import Icon from '@/components/Icon'
import type { ItemPreview } from '@/lib/game-state'

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
  /** "STR 31 = 20 core + 8 gear + 3 skill" per stat, shown on hover. */
  statTitles?: Partial<Record<'str' | 'dex' | 'mag' | 'def', string>>
  clicks?: number
  /** Unspent Core + Training Points, as a pulsing pill beside the name. The Char tab badge carries the same count. */
  unspentPoints?: number
  onCharacterClick?: () => void
  /** The gear: Settings is opened from here, not from the tab bar. */
  onSettingsClick?: () => void
  settingsOpen?: boolean
  isConnected?: boolean
  onRefresh?: () => void
  /** What the consumable under the pointer in the battle deck would do; ghosted onto the bars and stats. */
  itemPreview?: ItemPreview | null
  /** What the last click's regen restored; floats "+3" over the HP and MP bars the way XP does. */
  regenGain?: { hp: number; mp: number } | null
  regenGainKey?: number
  /** The enemy being fought: its HP as a red bar right after the level, at every width, so every tab shows the fight. */
  enemy?: { name: string | null; hp: number; hpMax: number } | null
  /** The pet along with the player, as a small icon beside the name; null with none along. */
  pet?: { name: string; iconName: string } | null
  /** The title the player wears, after the name in gold; null wears none. */
  title?: string | null
}

/*
 * One layout for every width. The header is a CSS container, and what it
 * shows steps down with its own width rather than the viewport's, in this
 * order (least important leaves first):
 *
 *   < 1280  version number
 *   < 1100  click count
 *   <  768  the title; HP and MP become two thin stacked bars in one slot
 *   <  640  the theme dot (Settings has the full theme list)
 *   <  360  the name (truncated to 7rem on phones) becomes its initial
 *
 * Never leaves: HP, MP, level + XP percent, the four stat numbers with their
 * 7px labels stacked above, Settings, the connection dot (its word is the
 * tooltip). In a fight the enemy bar is added, never swapped
 * in for something else.
 */

/**
 * HP/MP/enemy bar width grows with the header. On phones (two thin stacked
 * bars) 14% of the bar, 56–80px; from 768px (one fat bar each) 11% of the
 * bar, 84–176px, so a wide screen gets long bars rather than an empty left
 * column. At 768px in a fight the three bars plus the title and stats just
 * fit; the name truncates first if they do not.
 */
const BAR_WIDTH = 'w-[clamp(3.5rem,14cqw,5rem)] @min-[768px]:w-[clamp(5.25rem,11cqw,11rem)]'
const VITALS_BAR_HEIGHT = 'h-1.5 @min-[768px]:h-4'
const VITALS_BAR_VALUE = 'hidden @min-[768px]:flex'

/** The "+3" that floats up off a bar when regen lands, in the bar's own colour. */
function BarFloat({ amount, colorClass, gainKey }: { amount?: number; colorClass: string; gainKey?: number }) {
  if (!amount || amount <= 0) return null
  return (
    <span
      key={gainKey}
      className={`absolute -top-3 right-0 text-[10px] font-bold leading-none pointer-events-none tabular-nums ${colorClass}`}
      style={{ animation: 'xpFloat 2.5s forwards' }}
      aria-hidden="true"
    >
      +{amount}
    </span>
  )
}

/** How far a bar would fill if `amount` landed now, as a share of the bar past the current fill. */
function previewPct(current: number, max: number, amount: number): number {
  if (max <= 0 || amount <= 0 || current >= max) return 0
  return ((Math.min(max, current + amount) - current) / max) * 100
}

/** A vitals bar with its number inside: the header's HP and MP, and the full-screen map's. */
export function StatBar({ pct, fillClass, ghostClass, previewPct = 0, label, value, over, className, rtl = false, height = 'h-4', valueClassName = 'flex', valueAlign = 'center' }: {
  pct: number
  fillClass: string
  /** Fill from the right: the enemy's side. */
  rtl?: boolean
  /** Fill for the ghosted preview segment. */
  ghostClass?: string
  /** Extra width, past `pct`, a hovered heal would add. */
  previewPct?: number
  label: string
  value: string
  over?: boolean
  className?: string
  /** The track's height class(es); a thin bar hides its value with `valueClassName`. */
  height?: string
  /** Display class(es) for the number over the fill: `flex`, or `hidden` for a bar too thin to carry it. */
  valueClassName?: string
  /** Where the number sits: centered, or at the start of the bar, clear of its rounded end. */
  valueAlign?: 'center' | 'start'
}) {
  const fillPct = Math.min(100, Math.max(0, pct))
  return (
    <div
      className={`relative rounded-full bg-surface-raised/90 overflow-hidden shadow-[inset_0_1px_3px_var(--shadow)] ${height} ${className ?? ''}`}
      title={`${label} ${value}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${fillClass} ${rtl ? 'ml-auto' : ''}`}
        style={{ width: `${fillPct}%` }}
      />
      {previewPct > 0 && (
        <div
          className={`absolute top-0 h-full rounded-r-full opacity-50 animate-pulse ${ghostClass ?? fillClass}`}
          style={{ left: `${fillPct}%`, width: `${Math.min(100 - fillPct, previewPct)}%` }}
          aria-hidden="true"
        />
      )}
      <span className={`absolute inset-0 items-center ${valueAlign === 'start' ? 'justify-start pl-2' : 'justify-center'} text-[10px] leading-none font-semibold label-over-fill tabular-nums ${valueClassName}`}>
        <span className={over ? 'font-bold' : ''}>{value}</span>
      </span>
    </div>
  )
}

/** The "+20" a hovered buff would add to a stat, beside the number. */
function StatBump({ amount }: { amount?: number }) {
  if (!amount || amount <= 0) return null
  return <span className="text-combat-heal font-bold tabular-nums animate-pulse">+{amount}</span>
}

/** One core stat: a 7px "STR" stacked over the coloured number, at every width. */
function Stat({ label, value, colorClass, title, bump }: { label: string; value?: number; colorClass: string; title?: string; bump?: number }) {
  if (value === undefined) return null
  return (
    <span className="inline-flex flex-col items-center leading-none" title={title}>
      <span className="text-[7px] tracking-wider text-fg-muted" aria-hidden="true">
        {label}
      </span>
      <span className="inline-flex items-baseline gap-1">
        <span className={`tabular-nums ${colorClass}`}>{value}</span>
        <StatBump amount={bump} />
      </span>
    </span>
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

export default function GameHeader({ playerName, level, hp, hpMax, mp, mpMax, xp, xpGain, xpGainKey, str, dex, mag, def, statTitles, clicks, unspentPoints, pet = null, title = null, onCharacterClick, onSettingsClick, settingsOpen = false, isConnected, onRefresh, itemPreview, regenGain, regenGainKey, enemy = null }: GameHeaderProps) {
  let xpPct = 0
  if (xp !== undefined && level !== undefined) {
    const xpFromLevel = (level ** 3) * 2
    const xpForLevel = ((level + 1) ** 3) * 2
    const xpInLevel = Math.max(0, xp - xpFromLevel)
    const xpNeeded = xpForLevel - xpFromLevel
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
      <header className="@container bg-surface-panel/95 backdrop-blur-sm border-b border-line-subtle/30 shadow-lg shadow-black/20">
        {/* The header is the container and carries no padding of its own, so its queries measure the full bar. Below 768px a flex row with the two groups at the edges; from 768px a three-column grid so the title has its own column and nothing can run under it. */}
        <div className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-xs @min-[640px]:px-6 @min-[768px]:grid @min-[768px]:grid-cols-[1fr_auto_1fr]">

          {/* Left: who, vitals, level, and the enemy in a fight */}
          <div className="flex items-center gap-2 min-w-0">
            {playerName && (
              <div
                onClick={onCharacterClick}
                className={`flex items-center gap-2 min-w-0 ${onCharacterClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              >
                <span
                  className="@min-[360px]:hidden inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-semibold text-fg-bright"
                  title={playerName}
                  aria-label={playerName}
                >
                  {playerName.charAt(0).toUpperCase()}
                </span>
                <span className="hidden @min-[360px]:inline text-fg-primary truncate min-w-0 max-w-[7rem] @min-[768px]:max-w-none">{playerName}</span>
                {/* The title worn: the Pillar's name or a guild's, in gold after the name. Hidden where the bar is too narrow to carry it. */}
                {title && (
                  <span className="hidden @min-[560px]:inline shrink truncate min-w-0 max-w-[11rem] text-[11px] font-semibold text-resource-gold" title={`Title: ${title}`}>
                    {title}
                  </span>
                )}
                {/* The pet along: a small glyph after the name, named on hover. Company, no numbers. */}
                {pet && (
                  <span className="inline-flex shrink-0 items-center text-fg-secondary" title={`${pet.name} is along`} aria-label={`${pet.name} is along`}>
                    <Icon name={pet.iconName} size={14} color="current" />
                  </span>
                )}
                <UnspentPill count={unspentPoints} />

                {(hp !== undefined && hpMax !== undefined) || (mp !== undefined && mpMax !== undefined) ? (
                  <div className="flex flex-col gap-[3px] shrink-0 @min-[768px]:flex-row @min-[768px]:items-center @min-[768px]:gap-2">
                    {hp !== undefined && hpMax !== undefined && (
                      <span className="relative block">
                        <StatBar
                          className={BAR_WIDTH}
                          height={VITALS_BAR_HEIGHT}
                          valueClassName={VITALS_BAR_VALUE}
                          valueAlign="start"
                          pct={hpMax > 0 ? (hp / hpMax) * 100 : 0}
                          fillClass="bg-gradient-to-r from-fill-resource-hp to-resource-hp"
                          ghostClass="bg-resource-hp"
                          previewPct={previewPct(hp, hpMax, itemPreview?.hp ?? 0)}
                          label="HP"
                          value={`${hp}/${hpMax}`}
                          over={hp > hpMax}
                        />
                        <BarFloat amount={regenGain?.hp} colorClass="text-resource-hp" gainKey={regenGainKey} />
                      </span>
                    )}
                    {mp !== undefined && mpMax !== undefined && (
                      <span className="relative block">
                        <StatBar
                          className={BAR_WIDTH}
                          height={VITALS_BAR_HEIGHT}
                          valueClassName={VITALS_BAR_VALUE}
                          valueAlign="start"
                          pct={mpMax > 0 ? (mp / mpMax) * 100 : 0}
                          fillClass="bg-gradient-to-r from-fill-resource-mp to-resource-mp"
                          ghostClass="bg-resource-mp"
                          previewPct={previewPct(mp, mpMax, itemPreview?.mp ?? 0)}
                          label="MP"
                          value={`${mp}/${mpMax}`}
                          over={mp > mpMax}
                        />
                        <BarFloat amount={regenGain?.mp} colorClass="text-resource-mp" gainKey={regenGainKey} />
                      </span>
                    )}
                  </div>
                ) : null}

                {level !== undefined && (
                  <span
                    className="relative inline-flex items-baseline gap-1 shrink-0 whitespace-nowrap text-stat-def tabular-nums"
                    title={xp !== undefined ? `Level ${level} · ${xpPct}% to ${level + 1}` : `Level ${level}`}
                  >
                    <span>Lv. {level}</span>
                    {xp !== undefined && (
                      <span className="text-[10px] font-semibold text-resource-xp">{xpPct}%</span>
                    )}
                    {xpGain != null && xpGain > 0 && (
                      <span
                        key={xpGainKey}
                        className="absolute -top-3 right-0 text-[10px] font-bold leading-none pointer-events-none text-resource-xp"
                        style={{ animation: 'xpFloat 2.5s forwards' }}
                        aria-label={`+${xpGain} xp`}
                      >
                        +{xpGain}
                      </span>
                    )}
                  </span>
                )}

                {enemy && (
                  <span className="inline-flex items-center gap-1.5 shrink-0">
                    <span className="hidden @min-[1024px]:inline text-enemy-hostile font-semibold">vs</span>
                    <StatBar
                      className={BAR_WIDTH}
                      rtl
                      pct={enemy.hpMax > 0 ? (enemy.hp / enemy.hpMax) * 100 : 0}
                      fillClass="bg-enemy-boss"
                      label={`${enemy.name ?? 'Enemy'} HP`}
                      value={`${Math.max(0, enemy.hp)}/${enemy.hpMax}`}
                    />
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Centre: the title, in its own grid column from 768px; the click count and version return as room allows */}
          <div className="hidden @min-[768px]:flex items-center gap-2 justify-self-center whitespace-nowrap">
            {clicks !== undefined && (
              <span className="hidden @min-[1100px]:inline text-[10px] text-fg-muted font-normal tabular-nums">{clicks.toLocaleString()}</span>
            )}
            <h1 className="text-sm font-semibold text-fg-bright tracking-wide">Light Gray</h1>
            <span className="hidden @min-[1280px]:inline text-[10px] text-fg-muted font-normal">v0.1.8</span>
          </div>

          {/* Right: core stats, Settings, connection dot, theme */}
          <div className="flex items-center gap-3 shrink-0 justify-self-end">
            <div className="flex items-center gap-2">
              <Stat label="STR" value={str} colorClass="text-stat-str" title={statTitles?.str} bump={itemPreview?.stats?.str} />
              <Stat label="DEX" value={dex} colorClass="text-stat-dex" title={statTitles?.dex} bump={itemPreview?.stats?.dex} />
              <Stat label="MAG" value={mag} colorClass="text-stat-mag" title={statTitles?.mag} bump={itemPreview?.stats?.mag} />
              <Stat label="DEF" value={def} colorClass="text-stat-def" title={statTitles?.def} bump={itemPreview?.stats?.def} />
            </div>

            {/* Settings sits right after DEF, before the connection dot and the theme dot. */}
            {onSettingsClick && (
              <button
                type="button"
                onClick={onSettingsClick}
                aria-pressed={settingsOpen}
                aria-label="Settings"
                title="Settings"
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                  settingsOpen ? 'bg-surface-raised text-fg-bright' : 'text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-bright'
                }`}
              >
                <SettingsIcon size={15} aria-hidden="true" />
              </button>
            )}
            {/* The connection dot: green or red, the word only on hover. Refresh appears beside it when the socket is gone. */}
            {isConnected !== undefined && (
              <div className="flex items-center gap-2 text-fg-secondary" title={isConnected ? 'Connected' : 'Disconnected'}>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-status-success shadow-[0_0_6px_color-mix(in_srgb,var(--status-success)_50%,transparent)]' : 'bg-status-error shadow-[0_0_6px_color-mix(in_srgb,var(--status-error)_50%,transparent)]'}`}
                  role="img"
                  aria-label={isConnected ? 'Connected' : 'Disconnected'}
                />
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

            {/* On phones the theme dot folds away; Settings carries the full theme list. */}
            <span className="hidden @min-[640px]:block">
              <ThemeSwitcher />
            </span>
          </div>
        </div>
      </header>
    </>
  )
}
