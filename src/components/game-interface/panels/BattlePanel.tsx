'use client'

import { BattleState, BattleResult } from '@/lib/game-state'
import Icon from '@/components/Icon'
import { useEffect, useRef, useState } from 'react'

interface BattlePanelProps {
  battle: BattleState
  battleResult: BattleResult | null
  onAttack: () => void
  onFlee: () => void
  onDismissResult: () => void
  isActing: boolean
  playerName: string
  playerLevel: number
  playerMp: number
  playerMpMax: number
  weaponIconName: string | null
  weaponName: string | null
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
    <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-yellow-500 text-black text-[10px] font-bold flex-shrink-0 leading-none">
      {level}
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

function StatRow({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={highlight ? 'text-yellow-300 font-bold' : 'text-white font-semibold'}>{value}</span>
    </div>
  )
}

function EnemyIcon({ iconName, isDead }: { iconName: string; isDead: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ transform: isDead ? 'scaleX(-1) scaleY(-1)' : 'scaleX(-1)' }}>
        <Icon
          name={iconName}
          size={isDead ? 88 : 76}
          className={isDead ? 'text-red-500' : 'text-white opacity-75'}
        />
      </div>
      {isDead && (
        <span className="text-red-500 font-bold text-xs tracking-widest uppercase">DEAD</span>
      )}
    </div>
  )
}

function CombatIcons({ weaponIconName, enemyIcon, enemyIsDead }: { weaponIconName: string | null; enemyIcon?: string | null; enemyIsDead: boolean }) {
  return (
    <div className="flex-shrink-0 flex items-center gap-1">
      <Icon name={weaponIconName ?? 'equipment-fists'} size={76} className="text-white opacity-75" />
      <Icon name="attack" size={28} className="text-red-800/60" />
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

function BattleResultCard({ result, weaponIconName, weaponName, onDismiss }: { result: BattleResult; weaponIconName: string | null; weaponName: string | null; onDismiss: () => void }) {
  const isWin = result.outcome === 'WIN'
  const lt = result.lastTurn
  const wasAdvantageTurn = lt?.playerRaw === null

  return (
    <div className={`border ${isWin ? 'border-green-700/60' : 'border-red-800/60'} bg-gray-900/95 rounded-lg overflow-hidden shadow-lg`}>

      {/* Header */}
      <div className={`relative flex items-center justify-center px-4 py-2 ${isWin ? 'bg-green-900/40' : 'bg-red-900/30'} border-b ${isWin ? 'border-green-700/50' : 'border-red-800/50'}`}>
        <p className={`text-sm font-black tracking-widest uppercase ${isWin ? 'text-green-300' : 'text-red-400'}`}>
          {isWin ? 'Victory' : 'Defeated'}
        </p>
      </div>

      {/* Last turn replay */}
      {lt && (
        <div className="flex items-center px-4 py-3 gap-2 border-b border-gray-800/60">
          {/* Player side */}
          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
            {wasAdvantageTurn ? (
              <p className="text-xs text-gray-500 italic">You were ambushed entering the room</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">
                  {lt.playerRaw} &minus; {lt.enemyBlocked} = {lt.playerDealtDamage}
                  <span className="text-gray-600 ml-1">(max {lt.playerStrMax})</span>
                </p>
                <p className="text-xs text-gray-400">
                  Final strike with{' '}
                  <span className="text-red-300 font-semibold">{weaponName ?? 'fists'}</span>
                </p>
                <p className="text-3xl font-bold text-red-400 leading-tight">{lt.playerDealtDamage}</p>
              </>
            )}
          </div>

          {/* Icons */}
          <CombatIcons weaponIconName={weaponIconName} enemyIcon={result.enemyIcon} enemyIsDead={isWin} />

          {/* Enemy side */}
          <div className="flex-1 flex flex-col items-end gap-0.5 min-w-0">
            {isWin ? (
              <p className="text-sm font-bold text-red-500 text-right">{result.enemyName}</p>
            ) : (
              <>
                <p className="text-xs text-gray-500 text-right">
                  <span className="text-gray-600 mr-1">(max {lt.enemyStrMax})</span>
                  {lt.enemyRaw} &minus; {lt.playerBlocked} = {lt.enemyDealtDamage}
                </p>
                <p className="text-xs text-gray-400 text-right">
                  <span className="text-yellow-300 font-semibold">{result.enemyName}</span> attacks for
                </p>
                <p className="text-3xl font-bold text-yellow-400 leading-tight text-right">{lt.enemyDealtDamage}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-4 py-3 space-y-1.5 border-b border-gray-800/60">
        <StatRow label="Turns" value={result.turnsCount} />
        <StatRow label="Damage dealt" value={result.totalDamageDealt} />
        <StatRow label="Damage received" value={result.totalDamageReceived} />
        <StatRow label="Biggest hit" value={result.maxSingleHit} highlight />
        {result.multiplayerBonus && (
          <p className="text-xs text-blue-400 pt-0.5">Group bonus was active</p>
        )}
      </div>

      {/* Rewards (win only) */}
      {isWin && (
        <div className="px-4 py-3 space-y-1.5 border-b border-gray-800/60">
          <StatRow label="XP earned" value={`+${result.xpEarned}`} />
          <StatRow label="Gold earned" value={`+${result.goldEarned}`} />
          {result.itemsDropped.length > 0 ? (
            <div className="flex items-start justify-between text-sm">
              <span className="text-gray-400">Items</span>
              <span className="text-green-300 font-semibold text-right">{result.itemsDropped.join(', ')}</span>
            </div>
          ) : (
            <StatRow label="Items" value="No drops" />
          )}
        </div>
      )}

      {/* Close */}
      <div className="px-4 py-4 flex justify-center">
        <button
          onClick={onDismiss}
          className={`w-full py-3 rounded-lg text-sm font-black tracking-widest uppercase transition-all duration-150 ${isWin ? 'bg-green-700/80 hover:bg-green-600 text-white' : 'bg-red-900/60 hover:bg-red-800 text-red-200'}`}
        >
          Close
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
  onDismissResult,
  isActing,
  playerName,
  playerLevel,
  playerMp,
  playerMpMax,
  weaponIconName,
  weaponName,
}: BattlePanelProps) {
  if (!battle.isInBattle && battleResult) {
    return <BattleResultCard result={battleResult} weaponIconName={weaponIconName} weaponName={weaponName} onDismiss={onDismissResult} />
  }

  if (!battle.isInBattle) return null

  const turnsUntilFlee = Math.max(0, 10 - battle.turnCount)
  const hasPlayerFormula = battle.playerRaw !== null
  const hasEnemyFormula = battle.enemyRaw !== null
  const enemyIsDead = battle.enemyCurrentHp <= 0

  return (
    <div className="border border-red-900/60 bg-gray-900/90 rounded-lg overflow-hidden shadow-lg">

      {/* ── Overview header ── */}
      <div className="flex items-stretch px-4 pt-3 pb-3 gap-4 border-b border-gray-800/60">

        {/* Player column */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <LevelBadge level={playerLevel} />
            <span className="text-sm font-bold text-white truncate">{playerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-red-300 w-14 tabular-nums">{battle.playerHp}/{battle.playerHpMax}</span>
            <HpBar current={battle.playerHp} max={battle.playerHpMax} color="bg-red-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-blue-300 w-14 tabular-nums">{playerMp}/{playerMpMax}</span>
            <HpBar current={playerMp} max={playerMpMax} color="bg-blue-500" />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
            <span>STR</span>
            <span className="text-yellow-400 font-semibold">{battle.playerStrMax ?? '—'}</span>
            <span>DEF</span>
            <span className="text-yellow-400 font-semibold">{battle.playerDefMax ?? '—'}</span>
          </div>
        </div>

        {/* VS badge */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700/60">
            <span className="text-sm font-black text-white tracking-wider">VS</span>
          </div>
        </div>

        {/* Enemy column */}
        <div className="flex-1 flex flex-col items-end gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white truncate">{battle.enemyName}</span>
            {battle.enemyLevel !== null && <LevelBadge level={battle.enemyLevel} />}
          </div>
          <div className="flex items-center gap-2 w-full">
            <HpBar current={battle.enemyCurrentHp} max={battle.enemyMaxHp} color="bg-red-500" rtl initialPct={100} />
            <span className="text-[11px] text-red-300 w-14 tabular-nums text-right flex-shrink-0">
              {battle.enemyCurrentHp}/{battle.enemyMaxHp}
            </span>
          </div>
          {/* spacer to align with player's MP row */}
          <div className="h-2" />
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
            <span>eATT</span>
            <span className="text-yellow-400 font-semibold">{battle.enemyAtt ?? '—'}</span>
            <span>eDEF</span>
            <span className="text-yellow-400 font-semibold">{battle.enemyDef ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* ── Turn indicator ── */}
      <div className="flex items-center justify-center px-4 py-1 border-b border-gray-800/60">
        <span className="text-[11px] text-gray-600 uppercase tracking-widest">Turn <span className="text-gray-400 font-semibold">{battle.turnCount}</span></span>
      </div>

      {/* ── Combat visualization row ── */}
      <div className="flex items-center px-4 pb-3 gap-2">
        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
          {hasPlayerFormula ? (
            <>
              <p className="text-xs text-gray-500">
                {battle.playerRaw} &minus; {battle.enemyBlocked} = {battle.lastPlayerDamage ?? 0}
                <span className="text-gray-600 ml-1">(max {battle.playerStrMax})</span>
              </p>
              <p className="text-xs text-gray-400">
                You attack with your{' '}
                <span className="text-red-300 font-semibold">{weaponName ?? 'fists'}</span>
              </p>
              <p className="text-3xl font-bold text-red-400 leading-tight">{battle.lastPlayerDamage ?? 0}</p>
            </>
          ) : battle.isAdvantageTurn ? (
            <p className="text-xs text-gray-500 italic">You were ambushed entering the room</p>
          ) : (
            <p className="text-xs text-gray-600 italic">Waiting for first strike…</p>
          )}
        </div>

        <CombatIcons weaponIconName={weaponIconName} enemyIcon={battle.enemyIcon} enemyIsDead={enemyIsDead} />

        <div className="flex-1 flex flex-col items-end gap-0.5 min-w-0">
          {enemyIsDead ? (
            <p className="text-sm font-bold text-red-500 text-right">{battle.enemyName}</p>
          ) : hasEnemyFormula ? (
            <>
              <p className="text-xs text-gray-500 text-right">
                <span className="text-gray-600 mr-1">(max {battle.enemyStrMax})</span>
                {battle.enemyRaw} &minus; {battle.playerBlocked} = {battle.lastEnemyDamage ?? 0}
              </p>
              <p className="text-xs text-gray-400 text-right">
                The{' '}
                <span className="text-yellow-300 font-semibold">{battle.enemyName}</span>{' '}
                attacks you for
              </p>
              <p className="text-3xl font-bold text-yellow-400 leading-tight text-right">{battle.lastEnemyDamage ?? 0}</p>
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

      {/* ── Action buttons ── */}
      <div className="flex gap-3 px-4 pb-3 pt-2 border-t border-gray-800/50">
        <button
          onClick={onAttack}
          disabled={isActing}
          className="flex-1 py-2 bg-red-700/80 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all duration-150"
        >
          {isActing ? '...' : 'Attack'}
        </button>
        <button
          onClick={onFlee}
          disabled={isActing || !battle.canFlee}
          title={battle.canFlee ? 'Flee from battle' : `Flee available in ${turnsUntilFlee} turn${turnsUntilFlee !== 1 ? 's' : ''}`}
          className="flex-1 py-2 bg-gray-700/80 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all duration-150"
        >
          {battle.canFlee ? 'Flee' : `Flee (${turnsUntilFlee})`}
        </button>
      </div>
    </div>
  )
}
