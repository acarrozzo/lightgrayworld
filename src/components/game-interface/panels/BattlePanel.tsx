'use client'

import { BattleState } from '@/lib/game-state'

interface BattlePanelProps {
  battle: BattleState
  onAttack: () => void
  onFlee: () => void
  isActing: boolean
}

function HpBar({ current, max, color = 'red' }: { current: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  const barColor = color === 'red' ? 'bg-red-500' : 'bg-green-500'
  return (
    <div className="w-full bg-gray-700/60 rounded-full h-2.5">
      <div
        className={`${barColor} h-2.5 rounded-full transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function BattlePanel({ battle, onAttack, onFlee, isActing }: BattlePanelProps) {
  if (!battle.isInBattle) return null

  const turnsUntilFlee = Math.max(0, 10 - battle.turnCount)

  return (
    <div className="border border-red-900/60 bg-gray-900/80 rounded-lg p-4 space-y-4 shadow-lg">
      {/* Enemy header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-red-400 font-semibold uppercase tracking-wider">In Combat</p>
          <h3 className="text-lg font-bold text-red-300">{battle.enemyName}</h3>
        </div>
        <div className="text-right text-sm text-gray-400">
          Turn <span className="text-white font-bold">{battle.turnCount}</span>
        </div>
      </div>

      {/* Enemy HP */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Enemy HP</span>
          <span className="text-red-300 font-medium">{battle.enemyCurrentHp} / {battle.enemyMaxHp}</span>
        </div>
        <HpBar current={battle.enemyCurrentHp} max={battle.enemyMaxHp} color="red" />
      </div>

      {/* Player HP */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Your HP</span>
          <span className="text-green-300 font-medium">{battle.playerHp} / {battle.playerHpMax}</span>
        </div>
        <HpBar current={battle.playerHp} max={battle.playerHpMax} color="green" />
      </div>

      {/* Last turn result */}
      {battle.lastPlayerDamage !== null && (
        <div className="text-xs text-gray-400 space-y-0.5 border-t border-gray-700/50 pt-2">
          <p className="text-amber-300">You dealt: <span className="font-bold">{battle.lastPlayerDamage}</span> dmg</p>
          <p className="text-red-300">You took: <span className="font-bold">{battle.lastEnemyDamage ?? 0}</span> dmg</p>
          {battle.multiplayerBonus && (
            <p className="text-blue-300">Group bonus: +{battle.bonusPercent}% to stats</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-1">
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
