'use client'

import { BattleState, BattleResult, InventoryItem } from '@/lib/game-state'
import Icon from '@/components/Icon'
import { useEffect, useRef, useState } from 'react'
import { getItemActions, resolveItemIcon } from '@/lib/item-actions'

type BattleTab = 'actions' | 'spells' | 'items'

interface BattlePanelProps {
  battle: BattleState
  battleResult: BattleResult | null
  onAttack: () => void
  onFlee: () => void
  onUseItem: (itemId: string, action: string) => void
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
}

function HpBar({ current, max, color, rtl = false, initialPct }: { current: number; max: number; color: string; rtl?: boolean; initialPct?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
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
    <div className="relative w-full bg-gray-700/60 rounded-full h-2">
      {damagePct > 0 && (
        <div
          className="bg-yellow-400 h-2 rounded-full absolute top-0 transition-all duration-500"
          style={rtl
            ? { right: `${pct}%`, width: `${damagePct}%` }
            : { left: `${pct}%`, width: `${damagePct}%` }}
        />
      )}
      <div
        className={`${color} h-2 rounded-full absolute top-0 transition-all duration-300 ${rtl ? 'right-0' : 'left-0'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 px-1.5 py-0.5 rounded border border-gray-600/50 bg-gray-800/60 shrink-0">
      <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide leading-none">Lv</span>
      <span className="text-sm font-black text-gray-200 leading-none tabular-nums">{level}</span>
    </span>
  )
}

function Swoosh() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" className="text-red-900/70 flex-shrink-0">
      <path d="M 42 6 Q 26 26 10 46" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 10 6 Q 26 26 42 46" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// Compact label/value pair for the victory stats card (turns, dealt, took, best).
function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] uppercase tracking-wide text-gray-600">{label}</span>
      <span className="text-xs font-bold text-gray-300 tabular-nums">{value}</span>
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
        <span className="text-red-500 font-bold text-xs tracking-widest uppercase">DEAD</span>
      )}
    </div>
  )
}

function CombatIcons({ weaponIconName, enemyIcon, enemyIsDead, isPlayerAttacking, isRanged = false }: { weaponIconName: string | null; enemyIcon?: string | null; enemyIsDead: boolean; isPlayerAttacking: boolean; isRanged?: boolean }) {
  const playerArrowColor = isRanged ? 'text-green-800/60' : 'text-red-800/60'
  return (
    <div className="flex-shrink-0 flex items-center gap-1">
      {isPlayerAttacking && (
        <>
          <Icon name={weaponIconName ?? 'equipment-fists'} size={76} className="text-white opacity-75" />
          <Icon name="attack" size={28} className={playerArrowColor} />
        </>
      )}
      {!enemyIsDead && (
        <div style={{ transform: 'scaleX(-1)' }}>
          <Icon name="attack" size={28} className="text-red-800/60" />
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
      style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', borderColor: `${glow}40`, boxShadow: `inset 0 1px 0 ${glow}20` }}
    >
      <span style={{ color, filter: `drop-shadow(0 0 6px ${glow}70)` }}>
        <Icon name={icon} size={32} />
      </span>
      <span className="mt-1 text-base font-black tabular-nums leading-none" style={{ color, textShadow: `0 0 10px ${glow}70` }}>{value}</span>
      <span className="text-[10px] text-gray-500 tracking-wide">{label}</span>
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
      <span className="text-[10px] tracking-[0.2em] uppercase text-purple-300/70 mb-2">Rewards</span>
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        {drops.map((d, i) => {
          const icon = resolveItemIcon(null, d.slug)
          return (
            <div
              key={`${d.slug}-${i}`}
              className={`relative flex flex-col items-center justify-center rounded-lg border px-3 py-2 min-w-[72px] ${d.firstKill ? 'animate-pulse' : ''}`}
              style={d.firstKill
                ? { background: 'linear-gradient(135deg, #2a1a00, #3a2400)', borderColor: '#fbbf2480', boxShadow: '0 0 16px #f59e0b50, inset 0 1px 0 #fbbf2430' }
                : { background: 'linear-gradient(135deg, #14102a, #1e1838)', borderColor: '#8b5cf640', boxShadow: 'inset 0 1px 0 #8b5cf620' }}
            >
              {d.firstKill && (
                <span className="opacity-0 absolute -top-2 px-1.5 py-px rounded-full text-[8px] font-black tracking-wider uppercase text-black whitespace-nowrap"
                  style={{ background: 'linear-gradient(90deg, #f59e0b, #fcd34d, #f59e0b)', boxShadow: '0 0 8px #f59e0b80' }}>
                  New
                </span>
              )}
              <Icon name={icon} size={d.firstKill ? 40 : 32} className={d.firstKill ? 'text-amber-200' : 'text-purple-200'} />
              <span className={`mt-1 text-[10px] font-semibold leading-tight text-center ${d.firstKill ? 'text-amber-200' : 'text-purple-200'}`}>
                {prettifyDropName(d.slug)}{d.qty > 1 ? ` ×${d.qty}` : ''}
              </span>
            </div>
          )
        })}
        <RewardTile icon="trophy" value={`+${result.xpEarned}`} label="XP" color="#4ade80" glow="#22c55e" />
        <RewardTile icon="coin" value={`+${result.goldEarned}`} label="Gold" color="#fde047" glow="#eab308" />
      </div>
    </div>
  )
}

function BattleResultCard({ result, weaponIconName, weaponName, onDismiss }: { result: BattleResult; weaponIconName: string | null; weaponName: string | null; onDismiss: () => void }) {
  const isWin = result.outcome === 'WIN'
  const lt = result.lastTurn
  const wasAdvantageTurn = lt?.playerRaw === null
  const lastBlowRanged = lt?.weaponCategory === 'RANGED'

  if (isWin) {
    return (
      <div className="rounded-xl overflow-hidden shadow-2xl border border-green-500/70"
        style={{ background: 'linear-gradient(160deg, #001a0a 0%, #002a10 40%, #001a0a 100%)' }}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center px-4 py-2.5 border-b border-green-700/40"
          style={{ background: 'linear-gradient(90deg, transparent, #14532d30, #16a34a30, #14532d30, transparent)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-base" style={{ filter: 'drop-shadow(0 0 6px #22c55e)' }}>⚔</span>
            <p className="text-base font-black tracking-widest uppercase"
              style={{ color: '#4ade80', textShadow: '0 0 16px #22c55e80, 0 0 32px #22c55e40' }}
            >
              Victory!
            </p>
            <span className="text-base" style={{ filter: 'drop-shadow(0 0 6px #22c55e)' }}>⚔</span>
          </div>
          <button onClick={onDismiss} className="absolute right-3 text-gray-600 hover:text-green-300 transition-colors p-1 rounded" aria-label="Dismiss">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Final blow + enemy defeated — two compact cards, each holding its own icon */}
        {lt && (
          <div className="flex items-stretch gap-2 px-4 py-2 border-b border-green-900/40">
            {/* Final blow card */}
            <div className="flex-1 min-w-0 rounded-lg border border-green-800/40 px-2.5 py-2 flex items-center gap-2.5"
              style={{ background: 'linear-gradient(135deg, #0a1f12, #06160c)' }}
            >
              {!wasAdvantageTurn && (
                <Icon name={weaponIconName ?? 'equipment-fists'} size={44} className="text-white opacity-80 flex-shrink-0" />
              )}
              <div className="min-w-0">
                {wasAdvantageTurn ? (
                  <p className="text-[11px] text-gray-500 italic">Ambush entry</p>
                ) : (
                  <>
                    <p className="text-[10px] text-gray-500 leading-tight truncate">Final blow · <span className={`font-semibold ${lastBlowRanged ? 'text-green-300' : 'text-red-300'}`}>{weaponName ?? 'fists'}</span></p>
                    <p
                      className={`text-xl font-black leading-tight ${lastBlowRanged ? 'text-green-400' : 'text-red-400'}`}
                      style={{ textShadow: lastBlowRanged ? '0 0 10px #22c55e60' : '0 0 10px #ef444460' }}
                    >
                      {lt.playerDealtDamage}
                    </p>
                    <p className="text-[9px] text-gray-600 leading-tight">{lt.playerRaw} − {lt.enemyBlocked} = {lt.playerDealtDamage}</p>
                  </>
                )}
              </div>
            </div>
            {/* Battle stats card — sits between the two cards */}
            <div className="flex-shrink-0 rounded-lg border border-green-900/50 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-0.5 content-center"
              style={{ background: 'linear-gradient(135deg, #0c1a10, #08120a)' }}
            >
              <StatChip label="Turns" value={result.turnsCount} />
              <StatChip label="Damage Took" value={result.totalDamageReceived} />
              <StatChip label="Best Hit" value={result.maxSingleHit} />
              <StatChip label="Damage Dealt" value={result.totalDamageDealt} />
            </div>
            {/* Enemy defeated card */}
            <div className="flex-1 min-w-0 rounded-lg border border-red-900/40 px-2.5 py-2 flex items-center justify-end gap-2.5"
              style={{ background: 'linear-gradient(135deg, #1f0a0a, #160606)' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-red-500 text-right leading-tight truncate">{result.enemyName}</p>
                <p className="text-[10px] text-gray-600 text-right tracking-wide uppercase">defeated</p>
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
        <div className="pb-2 border-b border-green-900/40">
          <DropsShowcase result={result} />
          {result.multiplayerBonus && (
            <p className="text-[10px] text-blue-400 text-center mt-1">Group bonus active</p>
          )}
        </div>

        {/* Close */}
        <div className="px-4 py-2.5">
          <button
            onClick={onDismiss}
            className="w-full py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all duration-150 text-black"
            style={{ background: 'linear-gradient(90deg, #16a34a, #22c55e, #16a34a)', boxShadow: '0 0 12px #22c55e40' }}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // Defeat
  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border border-red-800/70"
      style={{ background: 'linear-gradient(160deg, #1a0000 0%, #2a0808 40%, #1a0000 100%)' }}
    >
      {/* Header */}
      <div className="relative flex items-center justify-center px-4 py-2.5 border-b border-red-800/40"
        style={{ background: 'linear-gradient(90deg, transparent, #7f1d1d30, #dc262630, #7f1d1d30, transparent)' }}
      >
        <p className="text-base font-black tracking-widest uppercase"
          style={{ color: '#f87171', textShadow: '0 0 16px #ef444480' }}
        >
          Defeated
        </p>
        <button onClick={onDismiss} className="absolute right-3 text-gray-600 hover:text-red-300 transition-colors p-1 rounded" aria-label="Dismiss">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Big skull, dead center */}
      <div className="flex flex-col items-center px-6 pt-4 pb-3 border-b border-red-900/40">
        <span style={{ color: '#f87171', filter: 'drop-shadow(0 0 18px #ef444480)' }}>
          <Icon name="skull" size={88} />
        </span>
        <h2 className="mt-3 text-lg font-black tracking-wide uppercase"
          style={{ color: '#f87171', textShadow: '0 0 16px #ef444480' }}
        >
          HP &lt; 0 = Dead!
        </h2>
        <p className="mt-2 text-sm text-gray-400 text-center">Well it happens to the best of us.</p>
        <p className="mt-1 text-sm text-gray-400 text-center">When your health gets low make sure to heal yourself by drinking a red potion, eating some cooked meat, casting a heal spell, etc.</p>
        <p className="mt-2 text-sm text-center font-semibold" style={{ color: '#fde047', textShadow: '0 0 10px #eab30860' }}>
          Your health has been replenished and you have been teleported to the Plane of Rebirth (The Lobby).
        </p>
      </div>

      {/* Your strike + stats + enemy hit — three cards, each holding its own icon */}
      {lt && (
        <div className="flex items-stretch gap-2 px-4 py-2 border-b border-red-900/40">
          {/* Your strike card */}
          <div className="flex-1 min-w-0 rounded-lg border border-green-900/40 px-2.5 py-2 flex items-center gap-2.5"
            style={{ background: 'linear-gradient(135deg, #0a1f12, #06160c)' }}
          >
            {!wasAdvantageTurn && (
              <Icon name={weaponIconName ?? 'equipment-fists'} size={44} className="text-white opacity-80 flex-shrink-0" />
            )}
            <div className="min-w-0">
              {wasAdvantageTurn ? (
                <p className="text-[11px] text-gray-500 italic">Ambush entry</p>
              ) : (
                <>
                  <p className="text-[10px] text-gray-500 leading-tight truncate">Your strike · <span className={`font-semibold ${lastBlowRanged ? 'text-green-300' : 'text-red-300'}`}>{weaponName ?? 'fists'}</span></p>
                  <p className={`text-xl font-black leading-tight ${lastBlowRanged ? 'text-green-400' : 'text-red-400'}`}>{lt.playerDealtDamage}</p>
                </>
              )}
            </div>
          </div>
          {/* Battle stats card — sits between the two cards */}
          <div className="flex-shrink-0 rounded-lg border border-red-900/50 px-3 py-2 grid grid-cols-2 gap-x-4 gap-y-0.5 content-center"
            style={{ background: 'linear-gradient(135deg, #1a0c0c, #120808)' }}
          >
            <StatChip label="Turns" value={result.turnsCount} />
            <StatChip label="Dealt" value={result.totalDamageDealt} />
            <StatChip label="Took" value={result.totalDamageReceived} />
            <StatChip label="Best" value={result.maxSingleHit} />
          </div>
          {/* Enemy hit card */}
          <div className="flex-1 min-w-0 rounded-lg border border-yellow-900/40 px-2.5 py-2 flex items-center justify-end gap-2.5"
            style={{ background: 'linear-gradient(135deg, #1f1a0a, #161206)' }}
          >
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 text-right leading-tight truncate"><span className="text-yellow-300 font-semibold">{result.enemyName}</span> hit</p>
              <p className="text-xl font-black text-yellow-400 leading-tight text-right">{lt.enemyDealtDamage}</p>
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
        <p className="px-4 py-1.5 text-[10px] text-blue-400 text-center border-b border-red-900/40">Group bonus active</p>
      )}

      {/* Close */}
      <div className="px-4 py-2.5">
        <button
          onClick={onDismiss}
          className="w-full py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all duration-150 text-red-200"
          style={{ background: 'linear-gradient(90deg, #7f1d1d, #991b1b, #7f1d1d)' }}
        >
          That hurt
        </button>
      </div>
    </div>
  )
}

export default function BattlePanel({
  battle,
  battleResult,
  onAttack,
  onFlee,
  onUseItem,
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
}: BattlePanelProps) {
  const [activeTab, setActiveTab] = useState<BattleTab>('actions')

  const isRanged = weaponCategory === 'RANGED'
  const hasPlayerFormula = battle.playerRaw !== null
  const supportAction = battle.actionMeta
  const supportIconName = supportAction
    ? resolveItemIcon(supportAction.itemMetadata ?? null, supportAction.itemSlug)
    : null

  if (!battle.isInBattle && battleResult) {
    return <BattleResultCard result={battleResult} weaponIconName={weaponIconName} weaponName={weaponName} onDismiss={onDismissResult} />
  }

  if (!battle.isInBattle) return null

  const turnsUntilFlee = Math.max(0, 3 - battle.turnCount)
  const hasEnemyFormula = battle.enemyRaw !== null
  const enemyIsDead = battle.enemyCurrentHp <= 0

  const consumables = inventory.filter(
    (item) => item.template.type === 'CONSUMABLE' && getItemActions(item.template.slug, item.template.metadata as any).length > 0
  )

  return (
    <div className="border border-red-900/60 bg-gray-900/90 rounded-lg overflow-hidden shadow-lg">

      {/* ── In Battle header ── */}
      <div className="flex flex-col items-center justify-center px-4 py-1 border-b border-red-900/40"
        style={{ background: 'linear-gradient(90deg, transparent, #7f1d1d30, #dc262630, #7f1d1d30, transparent)' }}
      >
        <p className="text-xs font-black tracking-widest uppercase"
          style={{ color: '#f87171', textShadow: '0 0 16px #ef444480' }}
        >
          In Battle
        </p>
      </div>

      {/* ── Overview header ── */}
      <div className="flex items-stretch px-3 pt-3 pb-3 gap-3 border-b border-gray-800/60">

        {/* Player column */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <LevelBadge level={playerLevel} />
            <span className="text-base font-black text-white truncate tracking-tight">{playerName}</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black tabular-nums leading-none" style={{ color: '#f87171', textShadow: '0 0 12px #ef444450' }}>{Math.min(battle.playerHp, battle.playerHpMax)}</span>
              <span className="text-xs text-gray-600 font-semibold">/ {battle.playerHpMax} HP</span>
              {battle.playerHp > battle.playerHpMax && (
                <span className="text-xs font-bold text-yellow-400 tabular-nums">+{battle.playerHp - battle.playerHpMax}</span>
              )}
            </div>
            <HpBar current={battle.playerHp} max={battle.playerHpMax} color="bg-red-500" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold tabular-nums leading-none text-blue-400">{Math.min(playerMp, playerMpMax)}</span>
              <span className="text-xs text-gray-600 font-semibold">/ {playerMpMax} MP</span>
              {playerMp > playerMpMax && (
                <span className="text-xs font-bold text-yellow-400 tabular-nums">+{playerMp - playerMpMax}</span>
              )}
            </div>
            <HpBar current={playerMp} max={playerMpMax} color="bg-blue-500" />
          </div>
          <div className="flex items-center gap-3 pt-0.5">
            <div className="flex flex-col items-center">
              <span className={`text-[9px] uppercase tracking-widest leading-none ${isRanged ? 'text-green-600' : 'text-red-700'}`}>{isRanged ? 'DEX' : 'STR'}</span>
              <span className={`text-sm font-black leading-none ${isRanged ? 'text-green-400' : 'text-red-400'}`}>{battle.playerStrMax ?? '—'}</span>
            </div>
            <div className="w-px h-6 bg-gray-700/60" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-gray-600 uppercase tracking-widest leading-none">DEF</span>
              <span className="text-sm font-black text-yellow-400 leading-none">{battle.playerDefMax ?? '—'}</span>
            </div>
          </div>
        </div>

        {/* VS divider */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1 px-1">
          <div className="flex-1 w-px bg-gray-800" />
          <span className="text-[11px] font-black text-gray-600 tracking-widest">VS</span>
          <div className="flex-1 w-px bg-gray-800" />
        </div>

        {/* Enemy column */}
        <div className="flex-1 flex flex-col items-end gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-white truncate tracking-tight">{battle.enemyName}</span>
            {battle.enemyLevel !== null && <LevelBadge level={battle.enemyLevel} />}
          </div>
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-2xl font-black tabular-nums leading-none" style={{ color: '#f87171', textShadow: '0 0 12px #ef444450' }}>{battle.enemyCurrentHp}</span>
              <span className="text-xs text-gray-600 font-semibold">/ {battle.enemyMaxHp} HP</span>
            </div>
            <HpBar current={battle.enemyCurrentHp} max={battle.enemyMaxHp} color="bg-red-500" rtl initialPct={100} />
          </div>
          {/* spacer to match player MP block */}
          <div className="flex flex-col gap-1 w-full opacity-0 pointer-events-none" aria-hidden>
            <div className="flex items-baseline gap-1"><span className="text-base leading-none">0</span></div>
            <HpBar current={0} max={1} color="bg-blue-500" />
          </div>
          <div className="flex items-center gap-3 pt-0.5">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-gray-600 uppercase tracking-widest leading-none">ATT</span>
              <span className="text-sm font-black text-yellow-400 leading-none">{battle.enemyAtt ?? '—'}</span>
            </div>
            <div className="w-px h-6 bg-gray-700/60" />
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-gray-600 uppercase tracking-widest leading-none">DEF</span>
              <span className="text-sm font-black text-yellow-400 leading-none">{battle.enemyDef ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Turn indicator ── */}
      <div className="flex items-center justify-center px-4 py-1">
        <span className="text-[11px] text-gray-600 uppercase tracking-widest">Turn <span className="text-gray-400 font-semibold">{battle.turnCount}</span></span>
      </div>

      {/* ── Combat visualization row ── */}
      <div className="flex items-center px-3 pb-3 gap-2">

        {/* Player side */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          {supportAction ? (
            <>
              <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                {supportAction.kind === 'equip_item' ? 'Equipped'
                  : supportAction.kind === 'unequip_item' ? 'Unequipped'
                  : 'Used'}
              </p>
              <p className="text-xs text-gray-400">
                You {supportAction.actionVerb} your <span className="text-indigo-300 font-semibold">{supportAction.itemName}</span>
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {supportIconName && (
                  <Icon name={supportIconName} size={36} className="text-indigo-300 flex-shrink-0" />
                )}
                {supportAction.effectText && (
                  <p
                    className="text-2xl font-black text-indigo-300 leading-none tabular-nums"
                    style={{ textShadow: '0 0 16px #818cf860' }}
                  >
                    {supportAction.effectText}
                  </p>
                )}
              </div>
            </>
          ) : battle.missedFlyingMelee ? (
            <>
              <p className="text-[10px] text-gray-600 italic">Out of reach</p>
              <p className="text-xs text-gray-400">
                Your <span className={`font-semibold ${isRanged ? 'text-green-300' : 'text-red-300'}`}>{weaponName ?? 'fists'}</span> swing through empty air — the {battle.enemyName} is airborne!
              </p>
              <p className="text-2xl font-black text-gray-500 leading-none tabular-nums italic">
                MISS
              </p>
            </>
          ) : hasPlayerFormula ? (
            <>
              <p className="text-[10px] text-gray-600 tabular-nums">
                {battle.playerRaw} &minus; {battle.enemyBlocked} = {battle.lastPlayerDamage ?? 0}
                <span className="ml-1">(max {battle.playerStrMax})</span>
              </p>
              <p className="text-xs text-gray-400">
                You attack with your <span className={`font-semibold ${isRanged ? 'text-green-300' : 'text-red-300'}`}>{weaponName ?? 'fists'}</span>
              </p>
              <p
                className={`text-4xl font-black leading-none tabular-nums ${isRanged ? 'text-green-400' : 'text-red-400'}`}
                style={{ textShadow: isRanged ? '0 0 16px #22c55e60' : '0 0 16px #ef444460' }}
              >
                {battle.lastPlayerDamage ?? 0}
              </p>
            </>
          ) : battle.isAdvantageTurn ? (
            <p className="text-xs text-gray-500 italic">You are attacked</p>
          ) : (
            <p className="text-xs text-gray-600 italic">Waiting for first strike…</p>
          )}
        </div>

        <CombatIcons weaponIconName={weaponIconName} enemyIcon={battle.enemyIcon} enemyIsDead={enemyIsDead} isPlayerAttacking={hasPlayerFormula} isRanged={isRanged} />

        {/* Enemy side */}
        <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
          {enemyIsDead ? (
            <p className="text-sm font-bold text-red-500 text-right">{battle.enemyName}</p>
          ) : hasEnemyFormula ? (
            <>
              <p className="text-[10px] text-gray-600 text-right tabular-nums">
                <span className="mr-1">(max {battle.enemyStrMax})</span>
                {battle.enemyRaw} &minus; {battle.playerBlocked} = {battle.lastEnemyDamage ?? 0}
              </p>
              <p className="text-xs text-gray-400 text-right">
                The <span className="text-yellow-300 font-semibold">{battle.enemyName}</span> attacks you for
              </p>
              <p className="text-4xl font-black text-yellow-400 leading-none tabular-nums text-right" style={{ textShadow: '0 0 16px #eab30860' }}>
                {battle.lastEnemyDamage ?? 0}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-600 italic text-right">…</p>
          )}
        </div>
      </div>

      {battle.multiplayerBonus && (
        <div className="px-4 pb-2">
          <p className="text-xs text-blue-400">Group bonus: +{battle.bonusPercent}%</p>
        </div>
      )}

      {/* ── Tabbed action panel ── */}
      <div className="border-t border-gray-800/50">
        {/* Tab bar */}
        <div className="flex px-3 pt-2.5">
          {(['actions', 'spells', 'items'] as BattleTab[]).map((tab) => {
            const actionsActive = isRanged
              ? 'border-green-500 text-green-300 hover:border-green-500 hover:text-green-300'
              : 'border-red-500 text-red-300 hover:border-red-500 hover:text-red-300'
            const actionsHover = isRanged
              ? 'hover:border-green-500/50 hover:text-green-300/70'
              : 'hover:border-red-500/50 hover:text-red-300/70'
            const activeColor =
              tab === 'actions' ? actionsActive :
              tab === 'spells'  ? 'border-blue-500 text-blue-300 hover:border-blue-500 hover:text-blue-300' :
                                  'border-yellow-500 text-yellow-300 hover:border-yellow-500 hover:text-yellow-300'
            const hoverColor =
              tab === 'actions' ? actionsHover :
              tab === 'spells'  ? 'hover:border-blue-500/50 hover:text-blue-300/70' :
                                  'hover:border-yellow-500/50 hover:text-yellow-300/70'
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 h-8 text-xs font-medium uppercase tracking-wider border-b-2 transition-all duration-200 ${
                  activeTab === tab
                    ? activeColor
                    : `border-transparent text-gray-500 ${hoverColor}`
                }`}
              >
                {tab}
              </button>
            )
          })}
        </div>
        <div className="pt-2" />

        {/* Actions tab */}
        {activeTab === 'actions' && (
          <div className="px-3 pb-3 pt-1 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={onAttack}
                disabled={isActing}
                className={`flex-1 py-2 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all duration-150 ${isRanged ? 'bg-green-700/80 hover:bg-green-600' : 'bg-red-700/80 hover:bg-red-600'}`}
              >
                {isActing ? '...' : 'Attack'}
              </button>
              <button
                disabled={isActing}
                className="flex-1 py-2 bg-yellow-600/80 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all duration-150"
              >
                Defend
              </button>
            </div>
            <button
              onClick={onFlee}
              disabled={isActing || !battle.canFlee}
              title={battle.canFlee ? 'Retreat from battle' : `Retreat available in ${turnsUntilFlee} turn${turnsUntilFlee !== 1 ? 's' : ''}`}
              className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 py-0.5 underline underline-offset-2"
            >
              {battle.canFlee ? 'Retreat' : `Retreat (${turnsUntilFlee} turns)`}
            </button>
          </div>
        )}

        {/* Spells tab */}
        {activeTab === 'spells' && (
          <div className="px-4 pb-4 pt-4 flex items-center justify-center">
            <p className="text-xs text-gray-600 italic">No spells learned yet.</p>
          </div>
        )}

        {/* Items tab */}
        {activeTab === 'items' && (
          <div className="px-4 pb-3 pt-2 flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {consumables.length === 0 ? (
              <p className="text-xs text-gray-600 italic py-2">No items available.</p>
            ) : (
              consumables.map((item) => {
                const actions = getItemActions(item.template.slug, item.template.metadata as any)
                const primaryAction = actions[0]
                const iconName = resolveItemIcon(item.template.metadata ?? null, item.template.slug)
                return (
                  <div key={item.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onUseItem(item.id, primaryAction.action)}
                      disabled={isActing}
                      className={`px-2.5 py-1 rounded text-xs font-semibold text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${primaryAction.className ?? 'bg-indigo-600/80 hover:bg-indigo-600'}`}
                    >
                      {primaryAction.effect ?? primaryAction.label}
                    </button>
                    <Icon name={iconName} size={20} className="text-white opacity-70 flex-shrink-0" />
                    <span className="flex-1 text-xs text-gray-300 truncate">
                      {item.template.name}
                      {item.quantity > 1 && (
                        <span className="text-gray-500 ml-1">×{item.quantity}</span>
                      )}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
