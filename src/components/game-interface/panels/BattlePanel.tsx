'use client'

import { BattleState, BattleResult, BattleSkillUse, BattleSpellCast, InventoryItem, Player, useGameStore } from '@/lib/game-state'
import Icon from '@/components/Icon'
import EnemyTraitTags from '@/components/EnemyTraitTags'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { resolveItemIcon } from '@/lib/item-actions'
import { spellTone } from '@/lib/spellbook'
import ActionDeck from '@/components/game-interface/ActionDeck'
import { deckContextFromBattle } from '@/lib/action-deck'
import { skillTone } from '@/lib/skillbook'

interface BattlePanelProps {
  battle: BattleState
  battleResult: BattleResult | null
  onAttack: () => void
  onFlee: () => void
  /**
   * True when Retreat opens its own confirmation — leaving a fight also leaves
   * the player's party behind, and that gets a dialog. The pill then fires on
   * the first tap rather than arming, so the player is not asked twice.
   */
  fleeNeedsConfirm?: boolean
  onUseItem: (itemId: string, action: string) => void
  onCastSpell: (spellId: string) => void
  /** Strike with a skill — Slice, Smash, Aim, Magic Strike — on this turn's swing. */
  onUseSkill: (skillId: string) => void
  onDismissResult: () => void
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

/** How much of `amount` would actually land, with the bar's ceiling in the way. */
function healThatLands(current: number, max: number, amount: number): number {
  if (amount <= 0 || current >= max) return 0
  return Math.min(max, current + amount) - current
}

function HpBar({ current, max, color, rtl = false, initialPct, preview = 0 }: { current: number; max: number; color: string; rtl?: boolean; initialPct?: number; preview?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  // A hovered restorer ghosts its heal onto the bar, capped at the ceiling.
  const previewPct = max > 0 ? (healThatLands(current, max, preview) / max) * 100 : 0
  // initialPct lets the caller seed the "previous" percentage so the drain
  // animation fires on the first render even when current is already 0 at mount
  // (e.g. 1-turn kills where the server sends post-damage state).
  const prevPct = useRef(initialPct ?? pct)
  const [damagePct, setDamagePct] = useState<number>(() => {
    const init = initialPct ?? pct
    return init > pct ? init - pct : 0
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (pct < prevPct.current) {
      setDamagePct(prevPct.current - pct)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setDamagePct(0), 700)
    }
    prevPct.current = pct
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [pct])

  return (
    <div className="relative w-full bg-surface-raised/80 rounded-full h-2 shadow-[inset_0_1px_2px_var(--shadow)]">
      {damagePct > 0 && (
        <div
          className="bg-resource-xp h-2 rounded-full absolute top-0 transition-all duration-500"
          style={rtl
            ? { right: `${pct}%`, width: `${damagePct}%` }
            : { left: `${pct}%`, width: `${damagePct}%` }}
        />
      )}
      <div
        className={`${color} h-2 rounded-full absolute top-0 transition-all duration-300 ${rtl ? 'right-0' : 'left-0'}`}
        style={{ width: `${pct}%` }}
      />
      {previewPct > 0 && (
        <div
          className={`${color} h-2 rounded-r-full absolute top-0 opacity-50 animate-pulse`}
          style={{ left: `${pct}%`, width: `${Math.min(100 - pct, previewPct)}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 px-1.5 py-0.5 rounded border border-line-strong/50 bg-surface-raised/60 shrink-0">
      <span className="text-[9px] font-semibold text-fg-muted uppercase tracking-wide leading-none">Lv</span>
      <span className="text-sm font-black text-fg-bright leading-none tabular-nums">{level}</span>
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

// Compact label/value pair for the victory stats card (turns, dealt, took, best).
function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] uppercase tracking-wide text-fg-disabled">{label}</span>
      <span className="text-xs font-bold text-fg-primary tabular-nums">{value}</span>
    </div>
  )
}

function EnemyIcon({ iconName, isDead }: { iconName: string; isDead: boolean }) {
  const size = isDead ? 88 : 76
  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={`/icons/enemy/${encodeURIComponent(iconName)}.svg`}
        alt={iconName}
        width={size}
        height={size}
        style={{ transform: isDead ? 'scaleX(-1) scaleY(-1)' : 'scaleX(-1)' }}
        className={`object-contain brightness-0 invert${isDead ? ' opacity-50' : ' opacity-75'}`}
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
          <Icon name="spellhand" size={76} className="text-fg-bright opacity-75" />
          <Icon name={spell.attackIcon} size={32} className={`${spellTone(spell.hue).text} opacity-80`} />
        </>
      ) : isPlayerAttacking && skill ? (
        // A skill strike is still the weapon's swing; the skill's own icon, in
        // its hue, takes the arrow's place — the original's Slice/Smash/Aim tiles.
        <>
          <Icon name={weaponIconName ?? 'equipment-fists'} size={76} className="text-fg-bright opacity-75" />
          <Icon name={skill.attackIcon} size={32} className={`${skillTone(skill.hue).text} opacity-85`} />
        </>
      ) : isPlayerAttacking && (
        <>
          <Icon name={weaponIconName ?? 'equipment-fists'} size={76} className="text-fg-bright opacity-75" />
          <Icon name="attack" size={28} className={playerArrowColor} />
        </>
      )}
      {!enemyIsDead && (
        <div style={{ transform: 'scaleX(-1)' }}>
          <Icon name="attack" size={28} className="text-combat-damage/60" />
        </div>
      )}
      <div style={{ minWidth: 88 }} className="flex justify-center">
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
    <div className="px-4 pt-3 pb-1 flex flex-col items-center">
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

function BattleResultCard({ result, weaponIconName, weaponName, onDismiss }: { result: BattleResult; weaponIconName: string | null; weaponName: string | null; onDismiss: () => void }) {
  const isWin = result.outcome === 'WIN'
  const lt = result.lastTurn
  const wasAdvantageTurn = lt?.playerRaw === null
  const lastBlowRanged = lt?.weaponCategory === 'RANGED'
  const lastBlowSpell = lt?.spell ?? null
  const lastBlowSkill = lt?.skill ?? null

  if (isWin) {
    return (
      <div className="rounded-xl overflow-hidden shadow-2xl border border-combat-victory/70"
        style={{ background: 'linear-gradient(160deg, color-mix(in srgb, var(--combat-victory) 10%, var(--surface-canvas)) 0%, color-mix(in srgb, var(--combat-victory) 18%, var(--surface-canvas)) 40%, color-mix(in srgb, var(--combat-victory) 10%, var(--surface-canvas)) 100%)' }}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center px-4 py-2.5 border-b border-combat-victory/40"
          style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--combat-victory) 19%, transparent), color-mix(in srgb, var(--combat-victory) 19%, transparent), color-mix(in srgb, var(--combat-victory) 19%, transparent), transparent)' }}
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

        {/* Final blow + enemy defeated — two compact cards, each holding its own icon */}
        {lt && (
          <div className="flex items-stretch gap-2 px-4 py-2 border-b border-combat-victory/40">
            {/* Final blow card */}
            <div className="flex-1 min-w-0 rounded-lg border border-combat-victory/40 px-2.5 py-2 flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--combat-victory) 12%, var(--surface-canvas)), color-mix(in srgb, var(--combat-victory) 7%, var(--surface-canvas)))' }}
            >
              {!wasAdvantageTurn && (
                <Icon name={lastBlowSpell ? lastBlowSpell.attackIcon : (weaponIconName ?? 'equipment-fists')} size={44} className={`${lastBlowSpell ? spellTone(lastBlowSpell.hue).text : 'text-fg-bright'} opacity-80 flex-shrink-0`} />
              )}
              <div className="min-w-0">
                {wasAdvantageTurn ? (
                  <p className="text-[11px] text-fg-muted italic">Ambush entry</p>
                ) : (
                  <>
                    <p className="text-[10px] text-fg-muted leading-tight truncate">Final blow · <span className={`font-semibold ${lastBlowSpell ? spellTone(lastBlowSpell.hue).text : lastBlowRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{lastBlowSpell ? lastBlowSpell.name : lastBlowSkill ? `${lastBlowSkill.name} · ${weaponName ?? 'fists'}` : (weaponName ?? 'fists')}</span></p>
                    <p
                      className={`text-xl font-black leading-tight ${lastBlowSpell ? spellTone(lastBlowSpell.hue).text : lastBlowRanged ? 'text-combat-heal' : 'text-combat-damage'}`}
                      style={{ textShadow: lastBlowSpell ? `0 0 10px color-mix(in srgb, ${spellTone(lastBlowSpell.hue).glow} 38%, transparent)` : lastBlowRanged ? '0 0 10px color-mix(in srgb, var(--combat-victory) 38%, transparent)' : '0 0 10px color-mix(in srgb, var(--combat-damage) 38%, transparent)' }}
                    >
                      {lt.playerDealtDamage}
                    </p>
                    <p className="text-[9px] text-fg-disabled leading-tight">{lastBlowSpell?.text ? `[ ${lastBlowSpell.text} ]` : lastBlowSkill?.text ? `( ${lastBlowSkill.text} )` : lt.playerRaw} − {lt.enemyBlocked} = {lt.playerDealtDamage}</p>
                  </>
                )}
              </div>
            </div>
            {/* Battle stats card — sits between the two cards */}
            <div className="flex-shrink-0 rounded-lg border border-combat-victory/50 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-0.5 content-center"
              style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--combat-victory) 11%, var(--surface-canvas)), color-mix(in srgb, var(--combat-victory) 6%, var(--surface-canvas)))' }}
            >
              <StatChip label="Turns" value={result.turnsCount} />
              <StatChip label="Damage Took" value={result.totalDamageReceived} />
              <StatChip label="Best Hit" value={result.maxSingleHit} />
              <StatChip label="Damage Dealt" value={result.totalDamageDealt} />
            </div>
            {/* Enemy defeated card */}
            <div className="flex-1 min-w-0 rounded-lg border border-combat-defeat/40 px-2.5 py-2 flex items-center justify-end gap-2.5"
              style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--combat-defeat) 14%, var(--surface-canvas)), color-mix(in srgb, var(--combat-defeat) 8%, var(--surface-canvas)))' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-enemy-hostile text-right leading-tight truncate">{result.enemyName}</p>
                <p className="text-[10px] text-fg-disabled text-right tracking-wide uppercase">defeated</p>
              </div>
              {result.enemyIcon && (
                <img
                  src={`/icons/enemy/${encodeURIComponent(result.enemyIcon)}.svg`}
                  alt={result.enemyName}
                  width={52}
                  height={52}
                  style={{ transform: 'scaleX(-1) scaleY(-1)' }}
                  className="object-contain brightness-0 invert opacity-50 flex-shrink-0"
                />
              )}
            </div>
          </div>
        )}

        {/* Rewards — loot + XP + Gold, all in one row */}
        <div className="pb-2 border-b border-combat-victory/40">
          <DropsShowcase result={result} />
          {result.multiplayerBonus && (
            <p className="text-[10px] text-resource-mp text-center mt-1">Group bonus active</p>
          )}
        </div>

        {/* Close */}
        <div className="px-4 py-2.5">
          <button
            onClick={onDismiss}
            className="w-full py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all duration-150 text-fg-on-accent"
            style={{ background: 'linear-gradient(90deg, var(--combat-victory), var(--combat-victory), var(--combat-victory))', boxShadow: '0 0 12px color-mix(in srgb, var(--combat-victory) 25%, transparent)' }}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // Defeat
  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border border-combat-defeat/70"
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

      {/* Your strike + stats + enemy hit — three cards, each holding its own icon */}
      {lt && (
        <div className="flex items-stretch gap-2 px-4 py-2 border-b border-combat-defeat/40">
          {/* Your strike card */}
          <div className="flex-1 min-w-0 rounded-lg border border-combat-victory/40 px-2.5 py-2 flex items-center gap-2.5"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--combat-victory) 12%, var(--surface-canvas)), color-mix(in srgb, var(--combat-victory) 7%, var(--surface-canvas)))' }}
          >
            {!wasAdvantageTurn && (
              <Icon name={lastBlowSpell ? lastBlowSpell.attackIcon : (weaponIconName ?? 'equipment-fists')} size={44} className={`${lastBlowSpell ? spellTone(lastBlowSpell.hue).text : 'text-fg-bright'} opacity-80 flex-shrink-0`} />
            )}
            <div className="min-w-0">
              {wasAdvantageTurn ? (
                <p className="text-[11px] text-fg-muted italic">Ambush entry</p>
              ) : (
                <>
                  <p className="text-[10px] text-fg-muted leading-tight truncate">Your strike · <span className={`font-semibold ${lastBlowSpell ? spellTone(lastBlowSpell.hue).text : lastBlowRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{lastBlowSpell ? lastBlowSpell.name : lastBlowSkill ? `${lastBlowSkill.name} · ${weaponName ?? 'fists'}` : (weaponName ?? 'fists')}</span></p>
                  <p className={`text-xl font-black leading-tight ${lastBlowSpell ? spellTone(lastBlowSpell.hue).text : lastBlowRanged ? 'text-combat-heal' : 'text-combat-damage'}`}>{lt.playerDealtDamage}</p>
                </>
              )}
            </div>
          </div>
          {/* Battle stats card — sits between the two cards */}
          <div className="flex-shrink-0 rounded-lg border border-combat-defeat/50 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-0.5 content-center"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--combat-defeat) 12%, var(--surface-canvas)), color-mix(in srgb, var(--combat-defeat) 7%, var(--surface-canvas)))' }}
          >
            <StatChip label="Turns" value={result.turnsCount} />
            <StatChip label="Dealt" value={result.totalDamageDealt} />
            <StatChip label="Took" value={result.totalDamageReceived} />
            <StatChip label="Best" value={result.maxSingleHit} />
          </div>
          {/* Enemy hit card */}
          <div className="flex-1 min-w-0 rounded-lg border border-resource-gold/40 px-2.5 py-2 flex items-center justify-end gap-2.5"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--resource-gold) 12%, var(--surface-canvas)), color-mix(in srgb, var(--resource-gold) 7%, var(--surface-canvas)))' }}
          >
            <div className="min-w-0">
              <p className="text-[10px] text-fg-secondary text-right leading-tight truncate"><span className="text-resource-gold font-semibold">{result.enemyName}</span> hit</p>
              {/* Name the special that finished you off — a 45 with no label
                  looks like the enemy simply rolled high. */}
              {lt.enemyAction && (
                <p className="text-[9px] font-black tracking-[0.15em] uppercase text-right leading-tight" style={{ color: 'var(--combat-crit)' }}>
                  {lt.enemyAction.name}
                </p>
              )}
              <p className={`text-xl font-black leading-tight text-right ${lt.enemyAction ? 'text-combat-crit' : 'text-stat-def'}`}>{lt.enemyDealtDamage}</p>
              {lt.enemyAction && lt.enemyAction.rolls.length > 1 && (
                <p className="text-[9px] text-fg-disabled text-right leading-tight tabular-nums">
                  ( {lt.enemyAction.rolls.join(' + ')} ) &minus; {lt.playerBlocked} = {lt.enemyDealtDamage}
                </p>
              )}
            </div>
            {result.enemyIcon && (
              <img
                src={`/icons/enemy/${encodeURIComponent(result.enemyIcon)}.svg`}
                alt={result.enemyName}
                width={52}
                height={52}
                style={{ transform: 'scaleX(-1)' }}
                className="object-contain brightness-0 invert opacity-75 flex-shrink-0"
              />
            )}
          </div>
        </div>
      )}

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
// A filled two-way switch under the row picks the list — Items, Spells — and
// every row in the list is one tap. Retreat lives in the In Battle strip's
// corner (the original's spot) and takes two taps.

/** How long a first Retreat tap stays armed before it quietly disarms. */
const RETREAT_CONFIRM_MS = 2500

export default function BattlePanel({
  battle,
  battleResult,
  onAttack,
  onFlee,
  fleeNeedsConfirm = false,
  onUseItem,
  onCastSpell,
  onUseSkill,
  onDismissResult,
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
  const [retreatArmed, setRetreatArmed] = useState(false)
  const retreatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The item under the pointer: a restorer ghosts onto the HP/MP bars here
  // and in the header, a buff puts its "+20" beside the stat it lifts.
  // Cleared when the pointer leaves, when the item is used (the tile may
  // vanish without a leave event), and when the deck unmounts.
  // The deck itself (ConsumableDeck) sets and clears the preview; the bars
  // here only read it.
  const itemPreview = useGameStore((s) => s.itemPreview)

  const disarmRetreat = useCallback(() => {
    if (retreatTimer.current) clearTimeout(retreatTimer.current)
    retreatTimer.current = null
    setRetreatArmed(false)
  }, [])

  // A new fight, or the end of one, drops a half-pressed Retreat.
  useEffect(() => { disarmRetreat() }, [battle.isInBattle, battle.enemySlug, disarmRetreat])
  useEffect(() => () => { if (retreatTimer.current) clearTimeout(retreatTimer.current) }, [])

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
    return <BattleResultCard result={battleResult} weaponIconName={weaponIconName} weaponName={weaponName} onDismiss={onDismissResult} />
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

  // The number beside the vitals is the item's full amount, the same "+100"
  // its button wears; the ghost on the bar is the part that lands.
  const previewHp = Math.max(0, itemPreview?.hp ?? 0)
  const previewMp = Math.max(0, itemPreview?.mp ?? 0)
  // The stat the card shows beside DEF is whichever the weapon rolls.
  const previewOffense = itemPreview?.stats?.[spellCast ? 'mag' : isRanged ? 'dex' : 'str'] ?? 0
  const previewDef = itemPreview?.stats?.def ?? 0
  // What the command deck needs to draw: target, reach, the top of the swing.
  const deckContext = deckContextFromBattle(battle, player, inventory)

  const handleRetreat = () => {
    if (isActing) return
    if (fleeNeedsConfirm || retreatArmed) {
      disarmRetreat()
      onFlee()
      return
    }
    setRetreatArmed(true)
    retreatTimer.current = setTimeout(() => setRetreatArmed(false), RETREAT_CONFIRM_MS)
  }

  return (
    <div className="border border-combat-defeat/60 bg-surface-panel/90 rounded-lg overflow-hidden shadow-lg">

      {/* ── In Battle strip, Retreat in its corner ── */}
      <div className="relative flex items-center justify-center px-4 py-1.5 border-b border-combat-defeat/40"
        style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--combat-defeat) 19%, transparent), color-mix(in srgb, var(--combat-defeat) 19%, transparent), color-mix(in srgb, var(--combat-defeat) 19%, transparent), transparent)' }}
      >
        <p className="text-xs font-black tracking-widest uppercase"
          style={{ color: 'var(--combat-damage)', textShadow: '0 0 16px color-mix(in srgb, var(--combat-damage) 50%, transparent)' }}
        >
          In Battle
        </p>
        {/* Two taps: the first arms "Leave the fight?" for a moment, the second
            retreats. Open from the first turn — the enemy stays in the room at
            full HP, so there is nothing to farm by running. */}
        <button
          type="button"
          onClick={handleRetreat}
          disabled={isActing}
          aria-live="polite"
          aria-label={retreatArmed ? 'Tap again to leave the fight' : 'Retreat from battle'}
          title="Retreat to the room you came from"
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-2 rounded-md border text-[10px] font-semibold tracking-wide normal-case inline-flex items-center gap-1 transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
            retreatArmed
              ? 'fill-status-error border-status-error'
              : 'border-line-strong/70 bg-surface-canvas/70 text-fg-muted hover:text-fg-primary hover:border-fg-muted'
          }`}
          style={{ textShadow: 'none' }}
        >
          <LogOut size={11} aria-hidden="true" />
          {retreatArmed ? 'Leave the fight?' : 'Retreat'}
        </button>
      </div>

      {/* ── Overview header ── */}
      <div className="flex items-stretch px-3 pt-2.5 pb-2.5 gap-2.5 border-b border-line-subtle/60">

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
              <span className={`text-[9px] uppercase tracking-widest leading-none ${spellCast ? 'text-stat-mag' : isRanged ? 'text-combat-heal' : 'text-combat-damage'}`}>{spellCast ? 'MAG' : isRanged ? 'DEX' : 'STR'}</span>
              <span className={`text-xs font-black leading-none mt-0.5 ${spellCast ? 'text-stat-mag' : isRanged ? 'text-combat-heal' : 'text-combat-damage'}`}>
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
      <div className="flex items-center px-3 pt-3 pb-3 gap-2">

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
                    className="text-2xl font-black text-accent-hover leading-none tabular-nums"
                    style={{ textShadow: '0 0 16px color-mix(in srgb, var(--accent) 38%, transparent)' }}
                  >
                    {supportAction.effectText}
                  </p>
                )}
              </div>
            </>
          ) : skillUse && skillUseTone ? (
            <>
              <p className="text-[10px] text-fg-disabled tabular-nums">
                ( {skillUse.weaponRaw} + {skillUse.bonus} ) &minus; {battle.enemyBlocked} = {battle.lastPlayerDamage ?? 0}
                <span className="ml-1">(max {battle.playerStrMax}{skillUse.bonusMax > 0 ? ` + ${skillUse.bonusMax}` : ''})</span>
              </p>
              <p className="text-xs text-fg-secondary">
                You <span className={`font-semibold ${skillUseTone.text}`}>{skillUse.name}</span> with your{' '}
                <span className={`font-semibold ${isRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{weaponName ?? 'fists'}</span>
                {battle.immuneToMagic ? (
                  <span className="ml-1 text-fg-muted italic">— the {battle.enemyName} shrugs off the magic, no MP spent</span>
                ) : (
                  <span className="ml-1 text-resource-mp tabular-nums">(−{skillUse.cost} MP)</span>
                )}
              </p>
              <p
                className={`text-4xl font-black leading-none tabular-nums ${skillUseTone.text}`}
                style={{ textShadow: `0 0 16px color-mix(in srgb, ${skillUseTone.glow} 38%, transparent)` }}
              >
                {battle.lastPlayerDamage ?? 0}
              </p>
            </>
          ) : spellCast && spellCastTone ? (
            battle.immuneToMagic ? (
              <>
                <p className="text-[10px] text-fg-disabled italic">Immune to magic</p>
                <p className="text-xs text-fg-secondary">
                  Your <span className={`font-semibold ${spellCastTone.text}`}>{spellCast.name}</span> fizzles — the {battle.enemyName} shrugs off magic!
                </p>
                <p className="text-2xl font-black text-fg-muted leading-none tabular-nums italic">
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
                  <span className="ml-1 text-resource-mp tabular-nums">(−{spellCast.cost} MP)</span>
                </p>
                <p
                  className={`text-4xl font-black leading-none tabular-nums ${spellCastTone.text}`}
                  style={{ textShadow: `0 0 16px color-mix(in srgb, ${spellCastTone.glow} 38%, transparent)` }}
                >
                  {battle.lastPlayerDamage ?? 0}
                </p>
              </>
            )
          ) : battle.missedFlyingMelee ? (
            <>
              <p className="text-[10px] text-fg-disabled italic">Out of reach</p>
              <p className="text-xs text-fg-secondary">
                Your <span className={`font-semibold ${isRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{weaponName ?? 'fists'}</span> swing through empty air — the {battle.enemyName} is airborne!
              </p>
              <p className="text-2xl font-black text-fg-muted leading-none tabular-nums italic">
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
              <p className="text-2xl font-black text-fg-muted leading-none tabular-nums italic">
                IMMUNE
              </p>
            </>
          ) : hasPlayerFormula ? (
            <>
              <p className="text-[10px] text-fg-disabled tabular-nums">
                {battle.playerRaw} &minus; {battle.enemyBlocked} = {battle.lastPlayerDamage ?? 0}
                <span className="ml-1">(max {battle.playerStrMax})</span>
              </p>
              <p className="text-xs text-fg-secondary">
                You attack with your <span className={`font-semibold ${isRanged ? 'text-combat-victory' : 'text-combat-damage'}`}>{weaponName ?? 'fists'}</span>
              </p>
              <p
                className={`text-4xl font-black leading-none tabular-nums ${isRanged ? 'text-combat-heal' : 'text-combat-damage'}`}
                style={{ textShadow: isRanged ? '0 0 16px color-mix(in srgb, var(--combat-victory) 38%, transparent)' : '0 0 16px color-mix(in srgb, var(--combat-damage) 38%, transparent)' }}
              >
                {battle.lastPlayerDamage ?? 0}
              </p>
            </>
          ) : battle.isAdvantageTurn ? (
            <p className="text-xs text-fg-muted italic">You are attacked</p>
          ) : (
            <p className="text-xs text-fg-disabled italic">Waiting for first strike…</p>
          )}
          {battle.companion && (
            <p className="text-[10px] text-fg-muted tabular-nums">
              <span className="font-semibold text-combat-victory">{battle.companion.name}</span>
              {' '}{battle.companion.roll} &minus; {battle.companion.block} ={' '}
              <span className={battle.companion.damage > 0 ? 'text-combat-victory font-semibold' : 'text-fg-disabled'}>{battle.companion.damage}</span>
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
              <p className="text-2xl font-black text-hue-purple leading-none tabular-nums italic text-right">
                DODGE
              </p>
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
                {enemyRollText} &minus; {battle.playerBlocked} = {battle.lastEnemyDamage ?? 0}
              </p>
              <p className="text-xs text-fg-secondary text-right">
                The <span className="text-resource-gold font-semibold">{battle.enemyName}</span>{' '}
                {enemyAction ? 'unleashes it for' : 'attacks you for'}
              </p>
              <p
                className={`text-4xl font-black leading-none tabular-nums text-right ${enemyAction ? 'text-combat-crit' : 'text-stat-def'}`}
                style={{ textShadow: enemyAction ? '0 0 16px color-mix(in srgb, var(--combat-crit) 50%, transparent)' : '0 0 16px color-mix(in srgb, var(--resource-gold) 38%, transparent)' }}
              >
                {battle.lastEnemyDamage ?? 0}
              </p>
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
      <div className="border-t border-line-subtle/50 px-3 pt-3 pb-3">
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
          listClassName="max-h-60"
          idPrefix="battle"
        />
      </div>
    </div>
  )
}
