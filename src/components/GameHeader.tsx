'use client'

import SettingsMenu from '@/components/SettingsMenu'
import { GAME_VERSION } from '@/lib/version'
import Icon from '@/components/Icon'
import VitalBar, { VitalBarKeyframes } from '@/components/game-interface/VitalBar'
import { MagicArmorPill } from '@/components/game-interface/EffectBadges'
import type { ItemPreview } from '@/lib/game-state'
import type { StatKey } from '@/lib/effective-stats'

interface GameHeaderProps {
  /**
   * Hide the bar below desktop width. A phone's fight screen draws the
   * player's vitals and four stats in the battle card, so the bar would say
   * it twice and take the deck's rows to do it. Desktop keeps it.
   */
  hiddenOnPhone?: boolean
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
  /** The gear's menu opens the Settings tab with this (All settings); the tab bar has no Settings tile. */
  onSettingsClick?: () => void
  settingsOpen?: boolean
  /** The gear's menu: Log out. */
  onLogout?: () => void
  isConnected?: boolean
  onRefresh?: () => void
  /** What the consumable under the pointer in the battle deck would do; ghosted onto the bars and stats. */
  itemPreview?: ItemPreview | null
  /** What the last click's regen restored; floats "+3" over the HP and MP bars the way XP does. */
  regenGain?: { hp: number; mp: number } | null
  regenGainKey?: number
  /** The pet along with the player, as a small icon beside the name; null with none along. */
  pet?: { name: string; iconName: string } | null
  /** The title the player wears, after the name in gold; null wears none. */
  title?: string | null
  /** Magic Armor's remaining pool, as the shield pill after the HP bar; 0 or undefined wears none. */
  magicArmor?: number
  /** What a click restores, as the regen mark after the fat bars' numbers (regenPerClick). */
  regen?: { hp: number; mp: number; hpTitle: string; mpTitle: string } | null
}

/*
 * One layout for every width. The header is a CSS container, and what it
 * shows steps down with its own width rather than the viewport's, in this
 * order (least important leaves first):
 *
 *   < 1280  version number
 *   < 1100  click count
 *   <  768  the title; HP and MP become two thin stacked bars in one slot
 *   <  360  the name (truncated to 7rem on phones) becomes its initial
 *
 * Never leaves: HP, MP, level + XP percent, the four stat numbers with their
 * 7px labels stacked above, and the Settings gear, which wears the connection
 * as a pip and opens the menu with the themes, All settings and Log out. The
 * header does not change in a fight: the enemy's bar is the battle card's
 * duel, and the pinned line's when the card scrolls.
 */

/**
 * HP/MP bar width grows with the header. On phones (two thin stacked bars)
 * 14% of the bar, 56–80px; from 768px (one fat bar each) 11% of the bar,
 * 84–176px, so a wide screen gets long bars rather than an empty left column.
 */
const BAR_WIDTH = 'w-[clamp(3.5rem,14cqw,5rem)] @min-[768px]:w-[clamp(5.25rem,11cqw,11rem)]'

/** The "+20" a hovered buff would add to a stat, beside the number. */
function StatBump({ amount }: { amount?: number }) {
  if (!amount || amount <= 0) return null
  return <span className="text-combat-heal font-bold tabular-nums animate-pulse">+{amount}</span>
}

const STAT_VAR: Record<StatKey, string> = {
  str: '--stat-str',
  dex: '--stat-dex',
  mag: '--stat-mag',
  def: '--stat-def',
}

const STAT_TEXT: Record<StatKey, string> = {
  str: 'text-stat-str',
  dex: 'text-stat-dex',
  mag: 'text-stat-mag',
  def: 'text-stat-def',
}

/**
 * One core stat: a 7px "STR" stacked over the coloured number, at every width.
 *
 * In a fight the HUD marks the one doing the damage (`emphasis="attack"`: a
 * tinted box in the stat's own colour, the label lit) and the one meeting the
 * enemy's blow (`emphasis="defend"`: an underline). Everywhere else the four
 * stand plain.
 */
export function Stat({ stat, value, title, bump, emphasis, onClick }: { stat: StatKey; value?: number; title?: string; bump?: number; emphasis?: 'attack' | 'defend'; onClick?: () => void }) {
  if (value === undefined) return null
  const style =
    emphasis === 'attack'
      ? { background: `color-mix(in srgb, var(${STAT_VAR[stat]}) 18%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(${STAT_VAR[stat]}) 45%, transparent)` }
      : emphasis === 'defend'
        ? { boxShadow: `inset 0 -2px 0 color-mix(in srgb, var(${STAT_VAR[stat]}) 60%, transparent)` }
        : undefined
  const body = (
    <>
      <span className={`text-[7px] tracking-wider ${emphasis === 'attack' ? STAT_TEXT[stat] : 'text-fg-muted'}`} aria-hidden="true">
        {stat.toUpperCase()}
      </span>
      <span className="inline-flex items-baseline gap-1">
        <span className={`tabular-nums ${STAT_TEXT[stat]} ${emphasis === 'attack' ? 'font-bold' : ''}`}>{value}</span>
        <StatBump amount={bump} />
      </span>
    </>
  )
  const className = 'inline-flex flex-col items-center leading-none rounded px-1 py-0.5 -my-0.5'
  // Given something to open (the fight HUD's four lead to the bag, where the
  // gear behind them is), the stat is a button and says so on hover.
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={`${stat.toUpperCase()} ${value}: open your inventory`}
        className={`${className} transition-colors duration-150 hover:bg-surface-raised/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus`}
        style={style}
      >
        {body}
      </button>
    )
  }
  return (
    <span className={className} title={title} style={style}>
      {body}
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

export default function GameHeader({ hiddenOnPhone = false, playerName, level, hp, hpMax, mp, mpMax, xp, xpGain, xpGainKey, str, dex, mag, def, statTitles, clicks, unspentPoints, pet = null, title = null, onCharacterClick, onSettingsClick, settingsOpen = false, onLogout, isConnected, onRefresh, itemPreview, regenGain, regenGainKey, magicArmor = 0, regen = null }: GameHeaderProps) {
  let xpPct = 0
  if (xp !== undefined && level !== undefined) {
    const xpFromLevel = (level ** 3) * 2
    const xpForLevel = ((level + 1) ** 3) * 2
    const xpInLevel = Math.max(0, xp - xpFromLevel)
    const xpNeeded = xpForLevel - xpFromLevel
    xpPct = Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100))
  }

  // One bar at two sizes: a thin one without its number under 768px, a fat
  // one with the number inside from there. The container decides which shows.
  const bar = (kind: 'hp' | 'mp', current: number, max: number, preview: number, gain?: number) => (
    <>
      <VitalBar kind={kind} size="thin" self current={current} max={max} preview={preview} number="none" gain={gain} gainKey={regenGainKey} className={`block @min-[768px]:hidden ${BAR_WIDTH}`} />
      <VitalBar kind={kind} size="fat" self current={current} max={max} preview={preview} gain={gain} gainKey={regenGainKey} regen={regen ? { amount: regen[kind], title: kind === 'hp' ? regen.hpTitle : regen.mpTitle } : null} className={`hidden @min-[768px]:block ${BAR_WIDTH}`} />
    </>
  )

  return (
    <>
      <VitalBarKeyframes />
      <header className={`@container bg-surface-panel/95 backdrop-blur-sm border-b border-line-subtle/30 shadow-lg shadow-black/20 ${hiddenOnPhone ? 'hidden lg:block' : ''}`}>
        {/* The header is the container and carries no padding of its own, so its queries measure the full bar. Below 768px a flex row with the two groups at the edges; from 768px a three-column grid so the title has its own column and nothing can run under it. */}
        <div className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-xs @min-[640px]:px-6 @min-[768px]:grid @min-[768px]:grid-cols-[1fr_auto_1fr]">

          {/* Left: who, vitals, level */}
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
                    {hp !== undefined && hpMax !== undefined && bar('hp', hp, hpMax, itemPreview?.hp ?? 0, regenGain?.hp)}
                    {mp !== undefined && mpMax !== undefined && bar('mp', mp, mpMax, itemPreview?.mp ?? 0, regenGain?.mp)}
                  </div>
                ) : null}
                {/* Magic Armor's pool, the original's "+N" box beside the HP bar, as the duel's shield pill. Not on a narrow header: the duel carries it there. */}
                <span className="hidden @min-[768px]:inline-flex">
                  <MagicArmorPill amount={magicArmor} />
                </span>

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
                        style={{ animation: 'vitalFloat 2.5s forwards' }}
                        aria-label={`+${xpGain} xp`}
                      >
                        +{xpGain}
                      </span>
                    )}
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
            <span className="hidden @min-[1280px]:inline text-[10px] text-fg-muted font-normal">{GAME_VERSION}</span>
          </div>

          {/* Right: core stats, then the gear */}
          <div className="flex items-center gap-3 shrink-0 justify-self-end">
            <div className="flex items-center gap-2">
              <Stat stat="str" value={str} title={statTitles?.str} bump={itemPreview?.stats?.str} />
              <Stat stat="dex" value={dex} title={statTitles?.dex} bump={itemPreview?.stats?.dex} />
              <Stat stat="mag" value={mag} title={statTitles?.mag} bump={itemPreview?.stats?.mag} />
              <Stat stat="def" value={def} title={statTitles?.def} bump={itemPreview?.stats?.def} />
            </div>

            {/* A hairline ends the stats; then the gear, its menu, and the connection on its shoulder. */}
            <span className="h-[22px] w-px shrink-0 bg-line-strong" aria-hidden="true" />
            <SettingsMenu
              isConnected={isConnected}
              onRefresh={onRefresh}
              onOpenSettings={onSettingsClick}
              settingsOpen={settingsOpen}
              onLogout={onLogout}
            />
          </div>
        </div>
      </header>
    </>
  )
}
