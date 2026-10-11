'use client'

import { BattleState, BattleResult, BattleSkillUse, BattleSpellCast, InventoryItem, Player, useGameStore } from '@/lib/game-state'
import Icon from '@/components/Icon'
import EnemyTraitTags from '@/components/EnemyTraitTags'
import { useEffect, type ReactNode, type Ref } from 'react'
import type { LevelUpPayload } from '@/lib/socket'
import { ChevronRight } from 'lucide-react'
import HpBar from '@/components/game-interface/HpBar'
import type { FightFrame } from '@/components/game-interface/useFightFrame'
import { resolveItemIcon } from '@/lib/item-actions'
import { spellTone } from '@/lib/spellbook'
import ActionDeck, { type TravelDeckProps } from '@/components/game-interface/ActionDeck'
import { companionInHand, deckContextFromBattle, rangeText } from '@/lib/action-deck'
import { skillTone } from '@/lib/skillbook'

/** What the victory card needs to announce a level gained by the win. */
export interface VictoryLevelUp {
  data: LevelUpPayload
  /** Core + Training points waiting to be spent. */
  toSpend: number
  onSpend: () => void
}

/** How many times an enemy must already have been beaten before a win with nothing new is shown as one line. */
const ROUTINE_KILLS = 10

interface BattlePanelProps {
  battle: BattleState
  battleResult: BattleResult | null
  onAttack: () => void
  onFlee: () => void
  /**
   * True when Retreat opens its own confirmation — leaving a fight also leaves
   * the player's party behind, and that gets a dialog. The row then fires on
   * the first tap rather than arming, so the player is not asked twice.
   */
  fleeNeedsConfirm?: boolean
  /**
   * `fight`: the card fills a pinned column and its list takes the rest of
   * the height. `fallback` (the default): the card is as tall as its content
   * and the list is a fixed box, for a holder that scrolls. See useFightFrame.
   */
  frame?: FightFrame
  /** The card and its list, for the holder to measure. */
  panelRef?: Ref<HTMLDivElement>
  listRef?: Ref<HTMLDivElement>
  /** The strip's Room chip: the room's number, and what pressing it opens. Neither, no chip. */
  roomLabel?: string
  onOpenRoom?: () => void
  onUseItem: (itemId: string, action: string) => void
  onCastSpell: (spellId: string) => void
  /** Strike with a skill — Slice, Smash, Aim, Magic Strike — on this turn's swing. */
  onUseSkill: (skillId: string) => void
  onDismissResult: () => void
  /** A level gained by this win: the victory card carries it as a gold band instead of a second card. */
  levelUp?: VictoryLevelUp | null
  /** The deck's Travel tab (teleport, Retreat). Absent until the World has been found. */
  travel?: Omit<TravelDeckProps, 'onRetreat' | 'retreatNeedsConfirm'> | null
  isActing: boolean
  playerName: string
  playerLevel: number
  playerMp: number
  playerMpMax: number
  weaponIconName: string | null
  weaponName: string | null
  weaponCategory: 'MELEE' | 'RANGED' | null
  inventory: InventoryItem[]
  /** Spell levels, teachers and MAG — everything the Spells list derives from. */
  player: Player
}

function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 px-1.5 py-0.5 rounded border border-line-strong/50 bg-surface-raised/60 shrink-0">
      <span className="text-[9px] font-semibold text-fg-muted uppercase tracking-wide leading-none">Lv</span>
      <span className="text-sm font-black text-fg-bright leading-none tabular-nums">{level}</span>
    </span>
  )
}

/** BOSS / MINI-BOSS beside the level: the same gold tag the room card wears. */
function RankBadge({ rank }: { rank: 'boss' | 'miniboss' }) {
  return (
    <span className="shrink-0 rounded border border-resource-gold/40 bg-resource-gold/15 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider leading-none text-resource-gold">
      {rank === 'boss' ? 'Boss' : 'Mini-boss'}
    </span>
  )
}

function Swoosh() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="text-combat-defeat/70 flex-shrink-0">
      <path d="M 42 6 Q 26 26 10 46" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 10 6 Q 26 26 42 46" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * What the enemy's standing behaviours did on the last turn, under its hit:
 * each hit after the first with its own roll and block (so the total adds up
 * the way the main formula does), the stone its gaze left, and the HP it
 * took back. Nothing is drawn on an ordinary turn.
 */
function EnemyHitExtras({ battle }: { battle: BattleState }) {
  const fx = battle.enemyEffects ?? {}
  const hasEffects =
    fx.healCast !== undefined || !!fx.stolen || !!fx.hpDrained || !!fx.mpDrained || !!fx.resurrected || !!fx.windUp
  if (!battle.petrifyApplied && !battle.enemyHealed && !hasEffects) return null
  return (
    <>
      {battle.petrifyApplied > 0 && (
        <p className="text-[11px] font-black tracking-[0.15em] uppercase text-right text-fg-bright">
          Stone {battle.petrifyApplied} turn{battle.petrifyApplied === 1 ? '' : 's'}
        </p>
      )}
      {battle.enemyHealed > 0 && (
        <p className="text-[10px] text-hue-green text-right tabular-nums">absorbs {battle.enemyHealed} HP</p>
      )}
      {fx.windUp && (
        <p className="text-[11px] font-black tracking-[0.12em] uppercase text-right text-combat-crit">
          {fx.windUp.name} next turn
        </p>
      )}
      {fx.resurrected && (
        <p className="text-[11px] font-black tracking-[0.15em] uppercase text-right text-fg-bright">Rises again</p>
      )}
      {fx.healCast !== undefined && (
        <p className="text-[10px] text-hue-green text-right tabular-nums">casts Heal +{fx.healCast} HP instead of attacking</p>
      )}
      {!!fx.hpDrained && (
        <p className="text-[10px] text-resource-hp text-right tabular-nums">drains {fx.hpDrained} HP</p>
      )}
      {!!fx.mpDrained && (
        <p className="text-[10px] text-resource-mp text-right tabular-nums">drains {fx.mpDrained} MP</p>
      )}
      {!!fx.stolen && (
        <p className="text-[10px] text-resource-gold text-right tabular-nums">pickpockets {fx.stolen} gold</p>
      )}
    </>
  )
}

// The readout's icons, by the card's width: small in a narrow card so the
// pinned fight screen leaves the deck its rows, full size with room to spare.
const BIG_ICON = 'h-10 w-10 @min-[600px]:h-[76px] @min-[600px]:w-[76px]'
const DEAD_ICON = 'h-12 w-12 @min-[600px]:h-[88px] @min-[600px]:w-[88px]'
const MID_ICON = 'h-5 w-5 @min-[600px]:h-8 @min-[600px]:w-8'
const ARROW_ICON = 'h-4 w-4 @min-[600px]:h-7 @min-[600px]:w-7'

/**
 * A multi-hit turn, hit by hit, under the big number: Hit 1 is the swing the
 * formula line would have shown alone, the rest are the enemy's extra hits —
 * each its roll, its block and what landed, a pack's second bite or a named
 * special where it was one, "dodged" where it came to nothing. They add up to
 * the big number, which wears the count beside it. Nothing on a one-hit turn.
 */
function EnemyHitList({ battle, firstRoll }: { battle: BattleState; firstRoll: string }) {
  const extras = battle.extraHits ?? []
  if (extras.length === 0) return null
  const extraTotal = extras.reduce((sum, hit) => sum + hit.damage, 0)
  const first = (battle.lastEnemyDamage ?? 0) - extraTotal
  const line = (index: number, label: string | null, body: ReactNode) => (
    <p key={index} className="text-[10px] text-fg-disabled text-right tabular-nums">
      <span className="mr-1 text-fg-muted">Hit {index + 1}</span>
      {label && <span className="mr-1 text-combat-crit font-semibold">{label}</span>}
      {body}
    </p>
  )
  return (
    <>
      {line(0, null, <>{firstRoll} &minus; {battle.playerBlocked} = <span className={first > 0 ? 'text-stat-def font-semibold' : ''}>{first}</span></>)}
      {extras.map((hit, i) =>
        line(
          i + 1,
          hit.pack ? 'pack' : hit.action ? hit.action.name : null,
          hit.dodged ? (
            <span className="text-hue-purple">dodged</span>
          ) : (
            <>{hit.action && hit.action.rolls.length > 1 ? `( ${hit.action.rolls.join(' + ')} )` : hit.raw} &minus; {hit.block} = <span className={hit.damage > 0 ? 'text-stat-def font-semibold' : ''}>{hit.damage}</span></>
          ),
        ),
      )}
    </>
  )
}

function EnemyIcon({ iconName, isDead }: { iconName: string; isDead: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={`/icons/enemy/${encodeURIComponent(iconName)}.svg`}
        alt={iconName}
        width={isDead ? 88 : 76}
        height={isDead ? 88 : 76}
        style={{ transform: isDead ? 'scaleX(-1) scaleY(-1)' : 'scaleX(-1)' }}
        className={`${isDead ? DEAD_ICON : BIG_ICON} object-contain brightness-0 invert${isDead ? ' opacity-50' : ' opacity-75'}`}
      />
      {isDead && (
        <span className="text-enemy-hostile font-bold text-xs tracking-widest uppercase">DEAD</span>
      )}
    </div>
  )
}

function CombatIcons({ weaponIconName, enemyIcon, enemyIsDead, isPlayerAttacking, isRanged = false, spell = null, skill = null }: { weaponIconName: string | null; enemyIcon?: string | null; enemyIsDead: boolean; isPlayerAttacking: boolean; isRanged?: boolean; spell?: BattleSpellCast | null; skill?: BattleSkillUse | null }) {
  const playerArrowColor = isRanged ? 'text-combat-heal/60' : 'text-combat-damage/60'
  return (
    <div className="flex-shrink-0 flex items-center gap-1">
      {isPlayerAttacking && spell ? (
        // The original drew a casting hand where the weapon goes, and the
        // spell's own strike icon in the spell's colour where the arrow goes.
        <>
          <Icon name="spellhand" className={`${BIG_ICON} text-fg-bright opacity-75`} />
          <Icon name={spell.attackIcon} className={`${MID_ICON} ${spellTone(spell.hue).text} opacity-80`} />
        </>
      ) : isPlayerAttacking && skill ? (
        // A skill strike is still the weapon's swing; the skill's own icon, in
        // its hue, takes the arrow's place — the original's Slice/Smash/Aim tiles.
        <>
          <Icon name={weaponIconName ?? 'equipment-fists'} className={`${BIG_ICON} text-fg-bright opacity-75`} />
          <Icon name={skill.attackIcon} className={`${MID_ICON} ${skillTone(skill.hue).text} opacity-85`} />
        </>
      ) : isPlayerAttacking && (
        <>
          <Icon name={weaponIconName ?? 'equipment-fists'} className={`${BIG_ICON} text-fg-bright opacity-75`} />
          <Icon name="attack" className={`${ARROW_ICON} ${playerArrowColor}`} />
        </>
      )}
      {!enemyIsDead && (
        <div style={{ transform: 'scaleX(-1)' }}>
          <Icon name="attack" className={`${ARROW_ICON} text-combat-damage/60`} />
        </div>
      )}
      <div className="flex justify-center min-w-[48px] @min-[600px]:min-w-[88px]">
        {enemyIcon && <EnemyIcon iconName={enemyIcon} isDead={enemyIsDead} />}
      </div>
    </div>
  )
}

// Turn a slug ("goblin-cloak") into a readable label ("Goblin Cloak").
function prettifyDropName(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// A vertical reward tile (icon over value/label) that matches the loot-card shape so XP/Gold
// sit in the same row as the dropped items.
function RewardTile({ icon, value, label, color, glow }: { icon: string; value: string; label: string; color: string; glow: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border px-3 py-2 min-w-[72px]"
      style={{ background: 'linear-gradient(135deg, var(--surface-panel), var(--surface-raised))', borderColor: `${glow}40`, boxShadow: `inset 0 1px 0 ${glow}20` }}
    >
      <span style={{ color, filter: `drop-shadow(0 0 6px ${glow}70)` }}>
        <Icon name={icon} size={32} />
      </span>
      <span className="mt-1 text-base font-black tabular-nums leading-none" style={{ color, textShadow: `0 0 10px ${glow}70` }}>{value}</span>
      <span className="text-[10px] text-fg-muted tracking-wide">{label}</span>
    </div>
  )
}

// Rewards showcase: dropped loot plus XP/Gold, all in one centered row. firstKill drops lead
// the row and get extra emphasis.
function DropsShowcase({ result }: { result: BattleResult }) {
  // Prefer the rich dropDetails payload; fall back to plain slug strings from older events.
  const rawDrops = result.dropDetails && result.dropDetails.length > 0
    ? result.dropDetails
    : result.itemsDropped.map((s) => {
        const m = s.match(/^(.*?)\s*x(\d+)$/)
        return { slug: m ? m[1] : s, qty: m ? Number(m[2]) : 1, firstKill: false }
      })
  // Show "First only" drops first so the rarest reward leads the row.
  const drops = [...rawDrops].sort((a, b) => Number(b.firstKill) - Number(a.firstKill))

  return (
    <div className="px-3 pt-3 pb-1 flex flex-col items-center @min-[560px]:px-4">
      <span className="text-[10px] tracking-[0.2em] uppercase text-loot-epic/70 mb-2">Rewards</span>
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        {drops.map((d, i) => {
          const icon = resolveItemIcon(null, d.slug)
          return (
            <div
              key={`${d.slug}-${i}`}
              className={`relative flex flex-col items-center justify-center rounded-lg border px-3 py-2 min-w-[72px] ${d.firstKill ? 'animate-pulse' : ''}`}
              style={d.firstKill
                ? { background: 'linear-gradient(135deg, color-mix(in srgb, var(--resource-gold) 18%, var(--surface-canvas)), color-mix(in srgb, var(--resource-gold) 26%, var(--surface-canvas)))', borderColor: 'color-mix(in srgb, var(--combat-crit) 50%, transparent)', boxShadow: '0 0 16px color-mix(in srgb, var(--resource-gold) 31%, transparent), inset 0 1px 0 color-mix(in srgb, var(--combat-crit) 19%, transparent)' }
                : { background: 'linear-gradient(135deg, color-mix(in srgb, var(--loot-epic) 14%, var(--surface-canvas)), color-mix(in srgb, var(--loot-epic) 22%, var(--surface-canvas)))', borderColor: 'color-mix(in srgb, var(--loot-epic) 25%, transparent)', boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--loot-epic) 13%, transparent)' }}
            >
              {d.firstKill && (
                <span className="opacity-0 absolute -top-2 px-1.5 py-px rounded-full text-[8px] font-black tracking-wider uppercase text-fg-on-accent whitespace-nowrap"
                  style={{ background: 'linear-gradient(90deg, var(--resource-gold), var(--combat-crit), var(--resource-gold))', boxShadow: '0 0 8px color-mix(in srgb, var(--resource-gold) 50%, transparent)' }}>
                  New
                </span>
              )}
              <Icon name={icon} size={d.firstKill ? 40 : 32} className={d.firstKill ? 'text-loot-legendary' : 'text-loot-epic'} />
              <span className={`mt-1 text-[10px] font-semibold leading-tight text-center ${d.firstKill ? 'text-loot-legendary' : 'text-loot-epic'}`}>
                {prettifyDropName(d.slug)}{d.qty > 1 ? ` ×${d.qty}` : ''}
              </span>
            </div>
          )
        })}
        <RewardTile icon="trophy" value={`+${result.xpEarned}`} label="XP" color="var(--combat-victory)" glow="var(--combat-victory)" />
        <RewardTile icon="coin" value={`+${result.goldEarned}`} label="Gold" color="var(--combat-crit)" glow="var(--resource-gold)" />
      </div>
    </div>
  )
}

function BattleResultCard({ result, weaponName, levelUp, onDismiss }: { result: BattleResult; weaponName: string | null; levelUp?: VictoryLevelUp | null; onDismiss: () => void }) {
  const isWin = result.outcome === 'WIN'
  const lt = result.lastTurn
  const wasAdvantageTurn = lt?.playerRaw === null
  const lastBlowRanged = lt?.weaponCategory === 'RANGED'
  const lastBlowSpell = lt?.spell ?? null
  const lastBlowSkill = lt?.skill ?? null
  const killList = useGameStore((state) => state.killList)

  // Enter continues after a win. Not after a death — Rise again is a move,
  // and should be pressed on purpose — and not while typing, or with a
  // control focused that Enter already presses.
  useEffect(() => {
    if (!isWin) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName))) return
      event.preventDefault()
      onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isWin, onDismiss])

  if (isWin) {
    // Two sizes, by how much the win is worth looking at. An enemy beaten
    // many times, dropping nothing you have not seen and gaining you no
    // level, is one line; everything else is the full card.
    const kills = killList.find((entry) => entry.monster === result.enemySlug || entry.monster === result.enemyName)?.kills ?? 0
    const firstKillDrop = (result.dropDetails ?? []).some((drop) => drop.firstKill)
    const firstKill = kills <= 1
    const routine = kills >= ROUTINE_KILLS && !firstKillDrop && !levelUp
    const drops = result.dropDetails && result.dropDetails.length > 0
      ? result.dropDetails
      : result.itemsDropped.map((entry) => {
          const match = entry.match(/^(.*?)\s*x(\d+)$/)
          return { slug: match ? match[1] : entry, qty: match ? Number(match[2]) : 1, firstKill: false }
        })
    const finalBlowName = lastBlowSpell ? lastBlowSpell.name : lastBlowSkill ? `${lastBlowSkill.name} · ${weaponName ?? 'fists'}` : (weaponName ?? 'fists')

    if (routine) {
      return (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-combat-victory/60 px-3 py-2 shadow-lg"
          style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--combat-victory) 16%, var(--surface-canvas)), color-mix(in srgb, var(--combat-victory) 8%, var(--surface-canvas)))' }}
          role="status"
        >
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--combat-victory)' }}>Victory</p>
          <p className="text-[11px] text-fg-muted">
            <span className="font-semibold text-enemy-hostile">{result.enemyName}</span> · {result.turnsCount} {result.turnsCount === 1 ? 'turn' : 'turns'}
          </p>
          <p className="flex items-baseline gap-1 text-xs tabular-nums">
            <span className="font-black" style={{ color: 'var(--combat-victory)' }}>+{result.xpEarned}</span>
            <span className="text-fg-muted">XP</span>
          </p>
          <p className="flex items-baseline gap-1 text-xs tabular-nums">
            <span className="font-black" style={{ color: 'var(--combat-crit)' }}>+{result.goldEarned}</span>
            <span className="text-fg-muted">gold</span>
          </p>
          {drops.map((drop, index) => (
            <span key={`${drop.slug}-${index}`} className="flex items-center gap-1 text-xs font-semibold text-loot-epic">
              <Icon name={resolveItemIcon(null, drop.slug)} size={16} />
              {prettifyDropName(drop.slug)}{drop.qty > 1 ? ` ×${drop.qty}` : ''}
            </span>
          ))}
          <button
            onClick={onDismiss}
            className="ml-auto h-8 flex-shrink-0 rounded-lg px-3 text-[11px] font-black uppercase tracking-widest text-fg-on-accent transition-all duration-150 hover:brightness-110"
            style={{ background: 'var(--combat-victory)' }}
          >
            Continue
          </button>
        </div>
      )
    }

    return (
      <div className="@container rounded-xl overflow-hidden shadow-2xl border border-combat-victory/70"
        style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--combat-victory) 10%, var(--surface-canvas)) 0%, color-mix(in srgb, var(--combat-victory) 18%, var(--surface-canvas)) 40%, color-mix(in srgb, var(--combat-victory) 10%, var(--surface-canvas)) 100%)' }}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center px-4 py-2.5 border-b border-combat-victory/40"
          style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--combat-victory) 19%, transparent), transparent)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base" style={{ filter: 'drop-shadow(0 0 6px var(--combat-victory))' }}>⚔</span>
            <p className="text-base font-black tracking-widest uppercase"
              style={{ color: 'var(--combat-victory)', textShadow: '0 0 16px color-mix(in srgb, var(--combat-victory) 50%, transparent), 0 0 32px color-mix(in srgb, var(--combat-victory) 25%, transparent)' }}
            >
              Victory!
            </p>
            <span className="text-base" style={{ filter: 'drop-shadow(0 0 6px var(--combat-victory))' }}>⚔</span>
          </div>
          <button onClick={onDismiss} className="absolute right-3 text-fg-disabled hover:text-combat-victory transition-colors p-1 rounded" aria-label="Dismiss">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* A level gained by this win rides here, in gold, instead of as a
            second card stacked on top of this one. */}
        {levelUp && (
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-status-warning/50 px-3 py-2 @min-[560px]:px-4"
            style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--resource-gold) 26%, var(--surface-canvas)), color-mix(in srgb, var(--resource-gold) 10%, var(--surface-canvas)))' }}
          >
            <p className="flex items-baseline gap-1.5">
              <span style={{ color: 'var(--combat-crit)', filter: 'drop-shadow(0 0 6px var(--combat-crit))' }} aria-hidden="true">★</span>
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--combat-crit)' }}>Level Up</span>
              <span className="text-xl font-black leading-none tabular-nums" style={{ color: 'var(--combat-crit)', textShadow: '0 0 14px color-mix(in srgb, var(--combat-crit) 50%, transparent)' }}>{levelUp.data.newLevel}</span>
            </p>
            <p className="flex flex-wrap items-baseline gap-x-2.5 text-[11px] font-bold tabular-nums">
              {levelUp.data.tpGained > 0 && <span className="text-resource-gold">+{levelUp.data.tpGained} TP</span>}
              {levelUp.data.cpGained > 0 && <span className="text-accent">+{levelUp.data.cpGained} CP</span>}
              {levelUp.data.spGained > 0 && <span className="text-stat-mag">+{levelUp.data.spGained} SP</span>}
              {levelUp.data.hpGained > 0 && <span className="text-resource-hp">+{levelUp.data.hpGained} HP</span>}
              {levelUp.data.mpGained > 0 && <span className="text-resource-mp">+{levelUp.data.mpGained} MP</span>}
            </p>
            {levelUp.toSpend > 0 && (
              <button
                onClick={levelUp.onSpend}
                className="ml-auto h-8 flex-shrink-0 rounded-lg px-3 text-[11px] font-black uppercase tracking-widest fill-resource-gold transition-all hover:brightness-110"
              >
                Spend {levelUp.toSpend} {levelUp.toSpend === 1 ? 'point' : 'points'}
              </button>
            )}
          </div>
        )}

        {/* Rewards first: what was won is why the fight was fought. */}
        <div className="pb-2 border-b border-combat-victory/40">
          <DropsShowcase result={result} />
          {result.multiplayerBonus && (
            <p className="text-[10px] text-resource-mp text-center mt-1">Group bonus active</p>
          )}
        </div>

        {/* The fight, in two small lines beside the thing that lost it. */}
        <div className="flex items-center gap-3 border-b border-combat-victory/40 px-3 py-2 @min-[560px]:px-4">
          {result.enemyIcon && (
            <img
              src={`/icons/enemy/${encodeURIComponent(result.enemyIcon)}.svg`}
              alt=""
              width={44}
              height={44}
              style={{ transform: 'scaleX(-1) scaleY(-1)' }}
              className="h-11 w-11 flex-shrink-0 object-contain brightness-0 invert opacity-50"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
              <span className="font-bold text-enemy-hostile">{result.enemyName}</span>
              <span className="text-fg-muted">defeated in {result.turnsCount} {result.turnsCount === 1 ? 'turn' : 'turns'}</span>
              {firstKill && (
                <span className="rounded-sm border border-combat-crit/60 px-1 text-[9px] font-black uppercase tracking-wider text-combat-crit">First kill</span>
              )}
            </p>
            <p className="text-[10px] tabular-nums text-fg-muted">
              dealt <span className="font-semibold text-fg-secondary">{result.totalDamageDealt}</span>
              {(result.companionDamageDealt ?? 0) > 0 && result.companionName && (
                <> (<span className="font-semibold text-combat-victory">{result.companionName}</span> {result.companionDamageDealt} of it)</>
              )}
              {' '}· took <span className="font-semibold text-fg-secondary">{result.totalDamageReceived}</span> · best hit{' '}
              <span className="font-semibold text-fg-secondary">{result.maxSingleHit}</span>
            </p>
            {lt && (
              <p className="truncate text-[10px] tabular-nums text-fg-muted">
                {wasAdvantageTurn ? (
                  'Ambush entry'
                ) : (
                  <>
                    final blow{' '}
                    <span className={`font-semibold ${lastBlowSpell ? spellTone(lastBlowSpell.hue).text : lastBlowRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{finalBlowName}</span>{' '}
                    {lastBlowSpell?.text ? `[ ${lastBlowSpell.text} ]` : lastBlowSkill?.text ? `( ${lastBlowSkill.text} )` : lt.playerRaw} − {lt.enemyBlocked} ={' '}
                    <span className={`font-bold ${lastBlowSpell ? spellTone(lastBlowSpell.hue).text : lastBlowRanged ? 'text-combat-heal' : 'text-combat-damage'}`}>{lt.playerDealtDamage}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Close */}
        <div className="px-4 py-2.5">
          <button
            onClick={onDismiss}
            className="w-full py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all duration-150 text-fg-on-accent"
            style={{ background: 'var(--combat-victory)', boxShadow: '0 0 12px color-mix(in srgb, var(--combat-victory) 25%, transparent)' }}
          >
            Continue
          </button>
          <p className="mt-1 hidden text-center text-[10px] text-fg-disabled lg:block">or press Enter</p>
        </div>
      </div>
    )
  }

  // Defeat
  return (
    <div className="@container rounded-xl overflow-hidden shadow-2xl border border-combat-defeat/70"
      style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--combat-defeat) 10%, var(--surface-canvas)) 0%, color-mix(in srgb, var(--combat-defeat) 18%, var(--surface-canvas)) 40%, color-mix(in srgb, var(--combat-defeat) 10%, var(--surface-canvas)) 100%)' }}
    >
      {/* Header */}
      <div className="relative flex items-center justify-center px-4 py-2.5 border-b border-combat-defeat/40"
        style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--combat-defeat) 19%, transparent), color-mix(in srgb, var(--combat-defeat) 19%, transparent), color-mix(in srgb, var(--combat-defeat) 19%, transparent), transparent)' }}
      >
        <p className="text-base font-black tracking-widest uppercase"
          style={{ color: 'var(--combat-damage)', textShadow: '0 0 16px color-mix(in srgb, var(--combat-damage) 50%, transparent)' }}
        >
          Defeated
        </p>
        <button onClick={onDismiss} className="absolute right-3 text-fg-disabled hover:text-combat-defeat transition-colors p-1 rounded" aria-label="Dismiss">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Big skull, dead center */}
      <div className="flex flex-col items-center px-6 pt-4 pb-3 border-b border-combat-defeat/40">
        <span style={{ color: 'var(--combat-damage)', filter: 'drop-shadow(0 0 18px color-mix(in srgb, var(--combat-damage) 50%, transparent))' }}>
          <Icon name="skull" size={88} />
        </span>
        <h2 className="mt-3 text-lg font-black tracking-wide uppercase"
          style={{ color: 'var(--combat-damage)', textShadow: '0 0 16px color-mix(in srgb, var(--combat-damage) 50%, transparent)' }}
        >
          HP &lt; 0 = Dead!
        </h2>
        <p className="mt-2 text-sm text-fg-secondary text-center">Well it happens to the best of us.</p>
        <p className="mt-1 text-sm text-fg-secondary text-center">When your health gets low make sure to heal yourself by drinking a red potion, eating some cooked meat, casting a heal spell, etc.</p>
        <p className="mt-2 text-sm text-center font-semibold" style={{ color: 'var(--combat-crit)', textShadow: '0 0 10px color-mix(in srgb, var(--resource-gold) 38%, transparent)' }}>
          You will be teleported back to the Plane of Rebirth.
        </p>
        <p className="mt-2 text-sm text-fg-secondary text-center">Godspeed.</p>
      </div>

      {/* What killed you, first and largest: who, with what, for how much.
          Then the fight in one line, and your last strike. */}
      <div className="border-b border-combat-defeat/40 px-3 py-2.5 @min-[560px]:px-4">
        <div className="flex items-center gap-3">
          {result.enemyIcon && (
            <img
              src={`/icons/enemy/${encodeURIComponent(result.enemyIcon)}.svg`}
              alt=""
              width={52}
              height={52}
              style={{ transform: 'scaleX(-1)' }}
              className="h-[52px] w-[52px] flex-shrink-0 object-contain brightness-0 invert opacity-75"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-fg-muted">Killed by</p>
            <p className="truncate text-sm font-bold text-resource-gold">{result.enemyName}</p>
            {/* Name the special that finished you off — a 45 with no label
                looks like the enemy simply rolled high. */}
            {lt?.enemyAction && (
              <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--combat-crit)' }}>{lt.enemyAction.name}</p>
            )}
          </div>
          {lt && (
            <div className="flex-shrink-0 text-right">
              <p className={`text-2xl font-black leading-none tabular-nums ${lt.enemyAction ? 'text-combat-crit' : 'text-stat-def'}`}>{lt.enemyDealtDamage}</p>
              <p className="mt-0.5 text-[10px] tabular-nums text-fg-disabled">
                {lt.enemyAction && lt.enemyAction.rolls.length > 1 ? `( ${lt.enemyAction.rolls.join(' + ')} )` : lt.enemyRaw} − {lt.playerBlocked} = {lt.enemyDealtDamage}
              </p>
            </div>
          )}
        </div>

        <dl className="mt-2.5 divide-y divide-line-subtle/30 text-[11px]">
          <div className="flex items-baseline justify-between gap-3 py-1">
            <dt className="text-fg-muted">The fight</dt>
            <dd className="text-right tabular-nums text-fg-secondary">
              {result.turnsCount} {result.turnsCount === 1 ? 'turn' : 'turns'} · you dealt <span className="font-semibold text-fg-primary">{result.totalDamageDealt}</span> · took{' '}
              <span className="font-semibold text-fg-primary">{result.totalDamageReceived}</span>
            </dd>
          </div>
          {lt && !wasAdvantageTurn && (
            <div className="flex items-baseline justify-between gap-3 py-1">
              <dt className="text-fg-muted">Your last strike</dt>
              <dd className="min-w-0 truncate text-right tabular-nums text-fg-secondary">
                <span className={`font-semibold ${lastBlowSpell ? spellTone(lastBlowSpell.hue).text : lastBlowRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>
                  {lastBlowSpell ? lastBlowSpell.name : lastBlowSkill ? `${lastBlowSkill.name} · ${weaponName ?? 'fists'}` : (weaponName ?? 'fists')}
                </span>{' '}
                for <span className="font-semibold text-fg-primary">{lt.playerDealtDamage}</span>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {result.multiplayerBonus && (
        <p className="px-4 py-1.5 text-[10px] text-resource-mp text-center border-b border-combat-defeat/40">Group bonus active</p>
      )}

      {/* Rise again — the only way out. The move to the Plane of Rebirth runs
          when this is pressed; until then the player is dead where they fell. */}
      <div className="px-4 py-2.5">
        <button
          onClick={onDismiss}
          className="w-full py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all duration-150 text-fg-bright"
          style={{ background: 'linear-gradient(90deg, var(--combat-defeat), color-mix(in srgb, var(--combat-defeat) 70%, var(--surface-canvas)), var(--combat-defeat))' }}
        >
          Rise again
        </button>
      </div>
    </div>
  )
}


// ─── Command deck ──────────────────────────────────────────────────────────
//
// The action area under the turn readout. The strike row never moves: Attack
// on the left, and beside it every learned strike the weapon in hand can carry
// (Slice for a one-hander, Smash for two, Aim behind a bow, Magic Strike with
// anything) as power-attack buttons. Every one of them wears its damage range
// — the raw roll before the enemy's block, the original's "(max N)" made
// honest: a swing rolls 0–STR (or DEX), a strike adds its bonus roll on top.
// A filled switch under the row picks the list — Spells, Items, Travel — and
// every row in the list is one tap. Retreat is a row of the Travel tab, which
// a fight always has, found World or not.
//
// Two drawings of the vitals, by the card's width: under 600px you are on
// the left and the enemy on the right with the numbers inside fat bars and
// the readout at two thirds size, so a phone's pinned fight screen leaves
// the deck its rows; wider, the full-size overview and readout as before.

export default function BattlePanel({
  battle,
  battleResult,
  onAttack,
  onFlee,
  fleeNeedsConfirm = false,
  frame = 'fallback',
  panelRef,
  listRef,
  roomLabel,
  onOpenRoom,
  onUseItem,
  onCastSpell,
  onUseSkill,
  onDismissResult,
  levelUp = null,
  travel = null,
  isActing,
  playerName,
  playerLevel,
  playerMp,
  playerMpMax,
  weaponIconName,
  weaponName,
  weaponCategory,
  inventory,
  player,
}: BattlePanelProps) {
  // The item under the pointer: a restorer ghosts onto the HP/MP bars here
  // and in the header, a buff puts its "+20" beside the stat it lifts.
  // Cleared when the pointer leaves, when the item is used (the tile may
  // vanish without a leave event), and when the deck unmounts.
  // The deck itself (ConsumableDeck) sets and clears the preview; the bars
  // here only read it.
  const itemPreview = useGameStore((s) => s.itemPreview)

  const isRanged = weaponCategory === 'RANGED'
  const hasPlayerFormula = battle.playerRaw !== null
  const supportAction = battle.actionMeta
  // The spell the last strike was, if it was one; its tone paints that side of the row.
  const spellCast = battle.spell
  const spellCastTone = spellCast ? spellTone(spellCast.hue) : null
  // The skill the last strike carried, if any — a swing with a bonus on it.
  const skillUse = battle.skill
  const skillUseTone = skillUse ? skillTone(skillUse.hue) : null
  const supportIconName = supportAction
    ? resolveItemIcon(supportAction.itemMetadata ?? null, supportAction.itemSlug ?? '')
    : null

  if (!battle.isInBattle && battleResult) {
    return <BattleResultCard result={battleResult} weaponName={weaponName} levelUp={levelUp} onDismiss={onDismissResult} />
  }

  if (!battle.isInBattle) return null

  const hasEnemyFormula = battle.enemyRaw !== null
  // The server tells us outright when the enemy used a special — we never infer
  // one from the size of the damage. `rolls` is the real breakdown behind the
  // total (a Power Attack is three separate ATT rolls, not one number tripled).
  const enemyAction = battle.enemyAction
  const enemyRollText = enemyAction && enemyAction.rolls.length > 1
    ? `( ${enemyAction.rolls.join(' + ')} )`
    : String(battle.enemyRaw)
  const enemyIsDead = battle.enemyCurrentHp <= 0
  // How many times the enemy swung this turn: its hit, plus its extra hits.
  const enemyHits = 1 + (battle.extraHits?.length ?? 0)

  // The number beside the vitals is the item's full amount, the same "+100"
  // its button wears; the ghost on the bar is the part that lands.
  const previewHp = Math.max(0, itemPreview?.hp ?? 0)
  const previewMp = Math.max(0, itemPreview?.mp ?? 0)
  // The stat the card shows beside DEF is whichever the weapon rolls.
  const previewOffense = itemPreview?.stats?.[spellCast ? 'mag' : isRanged ? 'dex' : 'str'] ?? 0
  const previewDef = itemPreview?.stats?.def ?? 0
  // What the command deck needs to draw: target, reach, the top of the swing.
  const deckContext = deckContextFromBattle(battle, player, inventory)
  // The stat the last strike rolled: MAG for a spell, else the weapon's.
  const offenseLabel = spellCast ? 'MAG' : isRanged ? 'DEX' : 'STR'
  const offenseTone = spellCast ? 'text-stat-mag' : isRanged ? 'text-combat-heal' : 'text-combat-damage'
  // Pinned: the card fills its column and the list takes what is left.
  const fill = frame === 'fight'
  // The companion at your side, from the bag: named under your vitals with
  // its range, from the first turn, before it has swung.
  const companion = companionInHand(inventory)
  // What the enemy lost this turn: your hit, and what swung beside it. The
  // big number is the total; under it, each part, so they add up in sight.
  const playerHit = battle.lastPlayerDamage ?? 0
  const hasHelpers = !!battle.extraShot || !!battle.companion
  const totalHit = playerHit + (battle.extraShot?.damage ?? 0) + (battle.companion?.damage ?? 0)
  // With helpers, the big number is the total and your own part rides the
  // sentence after the weapon's name, so it is not said twice.
  const ownHit = hasHelpers ? (
    <span className={`ml-1 font-bold tabular-nums ${playerHit > 0 ? 'text-fg-bright' : 'text-fg-disabled'}`}>{playerHit}</span>
  ) : null
  const companionLine = companion ? (
    <div className="flex min-w-0 items-center gap-1 text-[10px] tabular-nums text-fg-muted" title={`${companion.name} swings ${rangeText(companion.min, companion.max)} beside every attack you make`}>
      <Icon name={companion.iconName} className="h-3.5 w-3.5 shrink-0 text-combat-victory opacity-90" />
      <span className="truncate font-semibold text-fg-secondary">{companion.name}</span>
      <span className="shrink-0">{rangeText(companion.min, companion.max)}</span>
    </div>
  ) : null

  return (
    <div
      ref={panelRef}
      className={`@container flex min-h-0 flex-col border border-combat-defeat/60 bg-surface-panel/90 rounded-lg overflow-hidden shadow-lg ${fill ? 'flex-1' : ''}`}
    >

      {/* ── In Battle strip, the room in its corner ── */}
      <div className="relative flex items-center justify-center px-4 py-1.5 border-b border-combat-defeat/40"
        style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--combat-defeat) 19%, transparent), color-mix(in srgb, var(--combat-defeat) 19%, transparent), color-mix(in srgb, var(--combat-defeat) 19%, transparent), transparent)' }}
      >
        <p className="text-xs font-black tracking-widest uppercase"
          style={{ color: 'var(--combat-damage)', textShadow: '0 0 16px color-mix(in srgb, var(--combat-damage) 50%, transparent)' }}
        >
          In Battle
        </p>
        {/* The room, one tap away while the card is pinned over it: its
            actions, its supplies, who is standing here. Retreat is not here
            any more; the Travel tab holds it. */}
        {roomLabel && onOpenRoom && (
          <button
            type="button"
            onClick={onOpenRoom}
            title="The room: its actions, supplies and who is here"
            className="absolute right-1.5 @min-[600px]:right-12 top-1/2 -translate-y-1/2 h-6 px-2.5 rounded-full border border-hue-blue/50 bg-hue-blue/10 text-hue-blue text-[9px] font-bold tracking-wider inline-flex items-center gap-1 transition-colors duration-150 hover:bg-hue-blue/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            style={{ textShadow: 'none' }}
          >
            <ChevronRight size={11} aria-hidden="true" />
            Room
            <span className="font-mono font-medium tracking-normal normal-case text-fg-secondary tabular-nums">{roomLabel}</span>
          </button>
        )}
      </div>

      {/* ── Overview, compact: a narrow card. You left, the enemy right, the
          numbers inside the bars, the stats as one line each. ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-2.5 py-2 border-b border-line-subtle/60 @min-[600px]:hidden">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <LevelBadge level={playerLevel} />
            <span className="truncate text-xs font-black tracking-tight text-fg-bright">{playerName}</span>
          </div>
          <HpBar
            size="fat"
            current={battle.playerHp}
            max={battle.playerHpMax}
            color="bg-resource-hp"
            preview={itemPreview?.hp ?? 0}
            label={
              <>
                {Math.min(battle.playerHp, battle.playerHpMax)} / {battle.playerHpMax}
                {battle.playerHp > battle.playerHpMax && <span className="text-stat-def">+{battle.playerHp - battle.playerHpMax}</span>}
                {previewHp > 0 && <span className="text-combat-heal animate-pulse">+{previewHp}</span>}
              </>
            }
          />
          <HpBar
            size="mid"
            current={playerMp}
            max={playerMpMax}
            color="bg-resource-mp"
            preview={itemPreview?.mp ?? 0}
            label={
              <>
                {Math.min(playerMp, playerMpMax)} / {playerMpMax}
                {playerMp > playerMpMax && <span className="text-stat-def">+{playerMp - playerMpMax}</span>}
                {previewMp > 0 && <span className="text-combat-heal animate-pulse">+{previewMp}</span>}
              </>
            }
          />
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className={`text-[8px] uppercase tracking-widest ${offenseTone}`}>{offenseLabel}</span>
            <span className={`text-xs font-black leading-none ${offenseTone}`}>
              {battle.playerStrMax ?? '—'}
              {previewOffense > 0 && <span className="text-combat-heal animate-pulse"> +{previewOffense}</span>}
            </span>
            <span className="text-[8px] uppercase tracking-widest text-fg-disabled">DEF</span>
            <span className="text-xs font-black leading-none text-stat-def">
              {battle.playerDefMax ?? '—'}
              {previewDef > 0 && <span className="text-combat-heal animate-pulse"> +{previewDef}</span>}
            </span>
          </div>
          {companionLine}
        </div>
        <div className="flex flex-col items-center justify-center gap-0.5 px-0.5">
          <span className="text-[10px] font-black tracking-widest text-fg-disabled">VS</span>
          <span className="whitespace-nowrap text-[8px] uppercase tracking-widest text-fg-muted">
            Turn <span className="text-[10px] font-semibold tracking-normal text-fg-secondary">{battle.turnCount}</span>
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1 text-right">
          <div className="flex min-w-0 max-w-full items-center justify-end gap-1.5">
            <span className="truncate text-xs font-black tracking-tight text-fg-bright">{battle.enemyName}</span>
            {battle.enemyLevel !== null && <LevelBadge level={battle.enemyLevel} />}
            {battle.enemyRank && <RankBadge rank={battle.enemyRank} />}
          </div>
          <HpBar
            size="fat"
            current={battle.enemyCurrentHp}
            max={battle.enemyMaxHp}
            color="bg-resource-hp"
            rtl
            initialPct={100}
            label={<>{battle.enemyCurrentHp} / {battle.enemyMaxHp}</>}
          />
          <EnemyTraitTags traits={battle.enemyTraits} activeId={enemyAction?.id} align="end" className="justify-end" />
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-[8px] uppercase tracking-widest text-fg-disabled">ATT</span>
            <span className="text-xs font-black leading-none text-stat-def">{battle.enemyAtt ?? '—'}</span>
            <span className="text-[8px] uppercase tracking-widest text-fg-disabled">DEF</span>
            <span className="text-xs font-black leading-none text-stat-def">{battle.enemyDef ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* ── Overview header, full size: a wide card ── */}
      <div className="hidden @min-[600px]:flex items-stretch px-3 pt-2.5 pb-2.5 gap-2.5 border-b border-line-subtle/60">

        {/* Player column */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <LevelBadge level={playerLevel} />
            <span className="text-sm font-black text-fg-bright truncate tracking-tight">{playerName}</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black tabular-nums leading-none" style={{ color: 'var(--combat-damage)', textShadow: '0 0 12px color-mix(in srgb, var(--combat-damage) 31%, transparent)' }}>{Math.min(battle.playerHp, battle.playerHpMax)}</span>
              <span className="text-[11px] text-fg-disabled font-semibold">/ {battle.playerHpMax} HP</span>
              {battle.playerHp > battle.playerHpMax && (
                <span className="text-[11px] font-bold text-stat-def tabular-nums">+{battle.playerHp - battle.playerHpMax}</span>
              )}
              {previewHp > 0 && (
                <span className="text-[11px] font-bold text-combat-heal tabular-nums animate-pulse">+{previewHp}</span>
              )}
            </div>
            <HpBar current={battle.playerHp} max={battle.playerHpMax} color="bg-resource-hp" preview={itemPreview?.hp ?? 0} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold tabular-nums leading-none text-resource-mp">{Math.min(playerMp, playerMpMax)}</span>
              <span className="text-[11px] text-fg-disabled font-semibold">/ {playerMpMax} MP</span>
              {playerMp > playerMpMax && (
                <span className="text-[11px] font-bold text-stat-def tabular-nums">+{playerMp - playerMpMax}</span>
              )}
              {previewMp > 0 && (
                <span className="text-[11px] font-bold text-combat-heal tabular-nums animate-pulse">+{previewMp}</span>
              )}
            </div>
            <HpBar current={playerMp} max={playerMpMax} color="bg-resource-mp" preview={itemPreview?.mp ?? 0} />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              {/* The stat the last strike rolled: MAG for a spell, else the weapon's. */}
              <span className={`text-[9px] uppercase tracking-widest leading-none ${offenseTone}`}>{offenseLabel}</span>
              <span className={`text-xs font-black leading-none mt-0.5 ${offenseTone}`}>
                {battle.playerStrMax ?? '—'}
                {previewOffense > 0 && <span className="text-combat-heal tabular-nums animate-pulse"> +{previewOffense}</span>}
              </span>
            </div>
            <div className="w-px h-5 bg-surface-hover/60" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-fg-disabled uppercase tracking-widest leading-none">DEF</span>
              <span className="text-xs font-black text-stat-def leading-none mt-0.5">
                {battle.playerDefMax ?? '—'}
                {previewDef > 0 && <span className="text-combat-heal tabular-nums animate-pulse"> +{previewDef}</span>}
              </span>
            </div>
            {/* The companion beside the stats, where the wide card has the room. */}
            {companionLine && (
              <>
                <div className="w-px h-5 bg-surface-hover/60" />
                <div className="min-w-0">{companionLine}</div>
              </>
            )}
          </div>
        </div>

        {/* VS divider carries the turn count */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-1">
          <div className="flex-1 w-px bg-surface-raised" />
          <span className="text-[11px] font-black text-fg-disabled tracking-widest">VS</span>
          <span className="text-[9px] text-fg-muted uppercase tracking-widest whitespace-nowrap">
            Turn <span className="text-[11px] text-fg-secondary font-semibold tracking-normal">{battle.turnCount}</span>
          </span>
          <div className="flex-1 w-px bg-surface-raised" />
        </div>

        {/* Enemy column */}
        <div className="flex-1 flex flex-col items-end gap-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-fg-bright truncate tracking-tight">{battle.enemyName}</span>
            {battle.enemyLevel !== null && <LevelBadge level={battle.enemyLevel} />}
            {battle.enemyRank && <RankBadge rank={battle.enemyRank} />}
          </div>
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-xl font-black tabular-nums leading-none" style={{ color: 'var(--combat-damage)', textShadow: '0 0 12px color-mix(in srgb, var(--combat-damage) 31%, transparent)' }}>{battle.enemyCurrentHp}</span>
              <span className="text-[11px] text-fg-disabled font-semibold">/ {battle.enemyMaxHp} HP</span>
            </div>
            <HpBar current={battle.enemyCurrentHp} max={battle.enemyMaxHp} color="bg-resource-hp" rtl initialPct={100} />
          </div>
          {/* Trait row left of ATT/DEF, as the original HUD placed its buffBoxes.
              The tag for the special that just fired glows with the damage number. */}
          <div className="mt-auto flex items-center justify-end flex-wrap gap-x-3 gap-y-1">
            <EnemyTraitTags traits={battle.enemyTraits} activeId={enemyAction?.id} align="end" className="justify-end" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-fg-disabled uppercase tracking-widest leading-none">ATT</span>
              <span className="text-xs font-black text-stat-def leading-none mt-0.5">{battle.enemyAtt ?? '—'}</span>
            </div>
            <div className="w-px h-5 bg-surface-hover/60" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-fg-disabled uppercase tracking-widest leading-none">DEF</span>
              <span className="text-xs font-black text-stat-def leading-none mt-0.5">{battle.enemyDef ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Combat visualization row ── */}
      <div className="flex items-center px-3 py-2 gap-1.5 @min-[600px]:py-3 @min-[600px]:gap-2">

        {/* Player side */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          {supportAction ? (
            <>
              <p className="text-[10px] text-fg-disabled uppercase tracking-widest">
                {supportAction.label
                  ? supportAction.label
                  : supportAction.kind === 'equip_item' ? 'Equipped'
                  : supportAction.kind === 'unequip_item' ? 'Unequipped'
                  : supportAction.kind === 'auto_equip' ? 'Auto-equipped'
                  : supportAction.kind === 'cast_spell' ? 'Cast'
                  : 'Used'}
              </p>
              {/* A turn spent on something that isn't an item — a search, a
                  swing of a pickaxe — brings its own line; the item paths
                  build theirs from the item's name. */}
              <p className="text-xs text-fg-secondary">
                {supportAction.text ? supportAction.text : (
                  <>
                    {supportAction.kind === 'cast_spell' ? 'You cast ' : `You ${supportAction.actionVerb} your `}
                    <span className="text-accent-hover font-semibold">{supportAction.itemName}</span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {supportIconName && (
                  <Icon name={supportIconName} size={36} className="text-accent-hover flex-shrink-0" />
                )}
                {supportAction.effectText && (
                  <p
                    className="text-xl @min-[600px]:text-2xl font-black text-accent-hover leading-none tabular-nums"
                    style={{ textShadow: '0 0 16px color-mix(in srgb, var(--accent) 38%, transparent)' }}
                  >
                    {supportAction.effectText}
                  </p>
                )}
              </div>
            </>
          ) : battle.petrified ? (
            // A Gorgon's or Medusa's gaze: the turn passed and nothing was swung.
            <>
              <p className="text-[10px] text-fg-disabled italic">Petrified</p>
              <p className="text-xs text-fg-secondary">
                You are <span className="font-semibold text-fg-bright">STONE</span>
                {battle.petrifiedTurns > 0 ? ` — ${battle.petrifiedTurns} more turn${battle.petrifiedTurns === 1 ? '' : 's'}` : ' — it is wearing off'}
              </p>
              <p className="text-xl @min-[600px]:text-2xl font-black text-fg-muted leading-none tabular-nums italic">
                STONE
              </p>
            </>
          ) : battle.enemyDodged ? (
            // The enemy's own Dodge: nothing was rolled and nothing was spent.
            <>
              <p className="text-[10px] text-fg-disabled italic">{battle.enemyEffects?.blocked ? 'Blocked' : 'Dodged'}</p>
              <p className="text-xs text-fg-secondary">
                The {battle.enemyName} {battle.enemyEffects?.blocked ? 'blocks your' : 'steps out of your'}{' '}
                <span className={`font-semibold ${spellCast && spellCastTone ? spellCastTone.text : isRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{spellCast ? spellCast.name : (weaponName ?? 'fists')}</span>
                {spellCast ? ' — no MP spent' : ''}
              </p>
              <p className="text-xl @min-[600px]:text-2xl font-black text-hue-purple leading-none tabular-nums italic">
                {battle.enemyEffects?.blocked ? 'BLOCKED' : 'MISS'}
              </p>
            </>
          ) : skillUse && skillUseTone ? (
            <>
              <p className="text-[10px] text-fg-disabled tabular-nums">
                ( {skillUse.weaponRaw} + {skillUse.bonus} ) &minus; {battle.enemyBlocked}{battle.melted ? ' ÷ 2' : ''} = {battle.lastPlayerDamage ?? 0}
                <span className="ml-1">(max {battle.playerStrMax}{skillUse.bonusMax > 0 ? ` + ${skillUse.bonusMax}` : ''})</span>
              </p>
              <p className="text-xs text-fg-secondary">
                You <span className={`font-semibold ${skillUseTone.text}`}>{skillUse.name}</span> with your{' '}
                <span className={`font-semibold ${isRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{weaponName ?? 'fists'}</span>
                {ownHit}
                {battle.immuneToMagic ? (
                  <span className="ml-1 text-fg-muted italic">— the {battle.enemyName} shrugs off the magic, no MP spent</span>
                ) : (
                  <span className="ml-1 text-resource-mp tabular-nums">(−{skillUse.cost} MP)</span>
                )}
              </p>
              <p
                className={`text-2xl @min-[600px]:text-4xl font-black leading-none tabular-nums ${skillUseTone.text}`}
                style={{ textShadow: `0 0 16px color-mix(in srgb, ${skillUseTone.glow} 38%, transparent)` }}
              >
                {totalHit}
              </p>
            </>
          ) : spellCast && spellCastTone ? (
            battle.immuneToMagic ? (
              <>
                <p className="text-[10px] text-fg-disabled italic">Immune to magic</p>
                <p className="text-xs text-fg-secondary">
                  Your <span className={`font-semibold ${spellCastTone.text}`}>{spellCast.name}</span> fizzles — the {battle.enemyName} shrugs off magic!
                </p>
                <p className="text-xl @min-[600px]:text-2xl font-black text-fg-muted leading-none tabular-nums italic">
                  IMMUNE
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] text-fg-disabled tabular-nums">
                  [ {spellCast.text} ] &minus; {battle.enemyBlocked} = {battle.lastPlayerDamage ?? 0}
                  <span className="ml-1">(mag {battle.playerStrMax})</span>
                </p>
                <p className="text-xs text-fg-secondary">
                  You cast <span className={`font-semibold ${spellCastTone.text}`}>{spellCast.name}</span>
                  {ownHit}
                  <span className="ml-1 text-resource-mp tabular-nums">(−{spellCast.cost} MP)</span>
                </p>
                <p
                  className={`text-2xl @min-[600px]:text-4xl font-black leading-none tabular-nums ${spellCastTone.text}`}
                  style={{ textShadow: `0 0 16px color-mix(in srgb, ${spellCastTone.glow} 38%, transparent)` }}
                >
                  {totalHit}
                </p>
              </>
            )
          ) : battle.missedFlyingMelee ? (
            <>
              <p className="text-[10px] text-fg-disabled italic">Out of reach</p>
              <p className="text-xs text-fg-secondary">
                Your <span className={`font-semibold ${isRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{weaponName ?? 'fists'}</span> swing through empty air — the {battle.enemyName} is airborne!
              </p>
              <p className="text-xl @min-[600px]:text-2xl font-black text-fg-muted leading-none tabular-nums italic">
                MISS
              </p>
            </>
          ) : battle.immuneToWeapon ? (
            <>
              <p className="text-[10px] text-fg-disabled italic">
                {battle.immuneToWeapon === 'RANGED' ? 'Immune to ranged' : 'Immune to melee'}
              </p>
              <p className="text-xs text-fg-secondary">
                Your <span className={`font-semibold ${isRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{weaponName ?? 'fists'}</span>
                {battle.immuneToWeapon === 'RANGED' ? ' glance off — the ' : ' bounce off — the '}
                {battle.enemyName}
                {battle.immuneToWeapon === 'RANGED' ? ' cannot be hit at range!' : ' cannot be cut!'}
              </p>
              <p className="text-xl @min-[600px]:text-2xl font-black text-fg-muted leading-none tabular-nums italic">
                IMMUNE
              </p>
            </>
          ) : hasPlayerFormula ? (
            <>
              <p className="text-[10px] text-fg-disabled tabular-nums">
                {battle.playerRaw} &minus; {battle.enemyBlocked}{battle.melted ? ' ÷ 2' : ''} = {battle.lastPlayerDamage ?? 0}
                <span className="ml-1">(max {battle.playerStrMax})</span>
              </p>
              <p className="text-xs text-fg-secondary">
                You attack with your <span className={`font-semibold ${isRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{weaponName ?? 'fists'}</span>
                {ownHit}
                {battle.melted && <span className="ml-1 text-fg-muted italic">— the magma takes half</span>}
              </p>
              <p
                className={`text-2xl @min-[600px]:text-4xl font-black leading-none tabular-nums ${isRanged ? 'text-combat-heal' : 'text-combat-damage'}`}
                style={{ textShadow: isRanged ? '0 0 16px color-mix(in srgb, var(--combat-victory) 38%, transparent)' : '0 0 16px color-mix(in srgb, var(--combat-damage) 38%, transparent)' }}
              >
                {totalHit}
              </p>
            </>
          ) : battle.isAdvantageTurn ? (
            <p className="text-xs text-fg-muted italic">You are attacked</p>
          ) : (
            <p className="text-xs text-fg-disabled italic">Waiting for first strike…</p>
          )}
          {/* The rest of the big number: each swing beside yours. With the
              number in the sentence above, they add up to it. */}
          {battle.extraShot && (
            <p className="text-[10px] text-fg-muted tabular-nums">
              <span className="font-semibold text-combat-victory">Second arrow</span>
              {' '}<span className={battle.extraShot.damage > 0 ? 'text-combat-victory font-semibold' : 'text-fg-disabled'}>{battle.extraShot.damage}</span>
              <span className="ml-1 text-fg-disabled">({battle.extraShot.roll} &minus; {battle.extraShot.block})</span>
            </p>
          )}
          {battle.companion && (
            <p className="text-[10px] text-fg-muted tabular-nums">
              <span className="font-semibold text-combat-victory">{battle.companion.name}</span>
              {' '}<span className={battle.companion.damage > 0 ? 'text-combat-victory font-semibold' : 'text-fg-disabled'}>{battle.companion.damage}</span>
              <span className="ml-1 text-fg-disabled">({battle.companion.roll} &minus; {battle.companion.block})</span>
            </p>
          )}
        </div>

        <CombatIcons weaponIconName={weaponIconName} enemyIcon={battle.enemyIcon} enemyIsDead={enemyIsDead} isPlayerAttacking={hasPlayerFormula} isRanged={isRanged} spell={spellCast} skill={skillUse} />

        {/* Enemy side */}
        <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
          {enemyIsDead ? (
            <p className="text-sm font-bold text-enemy-hostile text-right">{battle.enemyName}</p>
          ) : hasEnemyFormula && battle.playerDodged ? (
            // The Dodge skill: the whole swing came to nothing. The original's
            // purple "You DODGE", with what you sidestepped for the record.
            <>
              <p className="text-[10px] text-fg-disabled text-right tabular-nums">
                <span className="mr-1">(max {battle.enemyStrMax})</span>
                {enemyRollText} dodged
              </p>
              <p className="text-xs text-fg-secondary text-right">
                You <span className="font-semibold text-hue-purple">DODGE</span> the{' '}
                <span className="text-resource-gold font-semibold">{battle.enemyName}</span>&rsquo;s {enemyAction ? enemyAction.name.toLowerCase() : 'attack'}!
              </p>
              <p className="text-xl @min-[600px]:text-2xl font-black text-hue-purple leading-none tabular-nums italic text-right">
                DODGE
              </p>
              <EnemyHitList battle={battle} firstRoll={enemyRollText} />
              <EnemyHitExtras battle={battle} />
            </>
          ) : hasEnemyFormula ? (
            <>
              {enemyAction && (
                <p
                  className="text-[11px] font-black tracking-[0.18em] uppercase text-right leading-tight"
                  style={{ color: 'var(--combat-crit)', textShadow: '0 0 14px color-mix(in srgb, var(--combat-crit) 50%, transparent)80' }}
                >
                  {enemyAction.name}
                </p>
              )}
              <p className="text-[10px] text-fg-disabled text-right tabular-nums">
                <span className="mr-1">(max {battle.enemyStrMax})</span>
                {enemyHits > 1 ? (
                  `${enemyHits} swings`
                ) : (
                  <>{enemyRollText} &minus; {battle.playerBlocked} = {battle.lastEnemyDamage ?? 0}</>
                )}
              </p>
              <p className="text-xs text-fg-secondary text-right">
                The <span className="text-resource-gold font-semibold">{battle.enemyName}</span>{' '}
                {enemyAction ? 'unleashes it for' : 'attacks you for'}
              </p>
              <div className="flex items-baseline justify-end gap-1.5">
                {enemyHits > 1 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-combat-crit">{enemyHits} hits</span>
                )}
                <p
                  className={`text-2xl @min-[600px]:text-4xl font-black leading-none tabular-nums text-right ${enemyAction ? 'text-combat-crit' : 'text-stat-def'}`}
                  style={{ textShadow: enemyAction ? '0 0 16px color-mix(in srgb, var(--combat-crit) 50%, transparent)' : '0 0 16px color-mix(in srgb, var(--resource-gold) 38%, transparent)' }}
                >
                  {battle.lastEnemyDamage ?? 0}
                </p>
              </div>
              <EnemyHitList battle={battle} firstRoll={enemyRollText} />
              {/* What the hit did besides damage: what Magic Armor ate,
                  whether poison took hold. */}
              {battle.absorbed > 0 && (
                <p className="text-[10px] text-stat-def text-right tabular-nums">
                  Magic Armor absorbs {battle.absorbed}{battle.magicArmorLeft > 0 ? ` · ${battle.magicArmorLeft} left` : ' · shattered'}
                </p>
              )}
              {battle.poisonApplied && (
                <p className="text-[11px] font-black tracking-[0.15em] uppercase text-right text-hue-green">Poisoned {battle.poisonApplied.clicks}</p>
              )}
              <EnemyHitExtras battle={battle} />
            </>
          ) : (
            <p className="text-xs text-fg-disabled italic text-right">…</p>
          )}
        </div>
      </div>

      {battle.multiplayerBonus && (
        <div className="px-4 pb-2">
          <p className="text-xs text-resource-mp">Group bonus: +{battle.bonusPercent}%</p>
        </div>
      )}

      {/* ── Command deck ── */}
      <div className={`flex min-h-0 flex-col border-t border-line-subtle/50 px-3 pt-3 pb-3 ${fill ? 'flex-1' : ''}`}>
        <ActionDeck
          player={player}
          inventory={inventory}
          context={deckContext}
          mpMax={playerMpMax}
          isActing={isActing}
          onAttack={onAttack}
          onUseSkill={onUseSkill}
          onCastSpell={onCastSpell}
          onUseItem={onUseItem}
          // A fight always has its Travel tab: Retreat lives there, so a
          // fighter who has not found the World yet gets the tab with Retreat
          // alone rather than no way out.
          travel={
            travel
              ? { ...travel, onRetreat: onFlee, retreatNeedsConfirm: fleeNeedsConfirm }
              : { grid: false, teleportBlockedReason: null, onRetreat: onFlee, retreatNeedsConfirm: fleeNeedsConfirm }
          }
          // Pinned, the list takes whatever height the column leaves. Scrolling,
          // it is a fixed box: the same size whichever tab is open and however
          // much is in it.
          className={fill ? 'flex-1' : ''}
          listRef={listRef}
          listClassName={fill ? 'flex-1' : 'h-60'}
          idPrefix="battle"
        />
      </div>
    </div>
  )
}
