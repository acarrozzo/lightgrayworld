'use client'

import type { BattleState } from '@/lib/game-state'
import HpBar from './HpBar'

/**
 * The fight's numbers in one line, pinned to the top of the room area when
 * the area is too short to pin the whole battle card (see `useFightFrame`).
 * Your HP, the turn, the enemy's HP: what you need while the deck's list is
 * scrolled into reach and the card is off the top.
 */
export default function BattleVitalsLine({ battle }: { battle: BattleState }) {
  const hp = Math.min(battle.playerHp, battle.playerHpMax)
  return (
    <div
      className="sticky top-0 z-10 flex h-[30px] flex-shrink-0 items-center gap-2 border-b border-combat-defeat/40 bg-surface-sunken/95 px-3 text-[10px] font-semibold tabular-nums backdrop-blur-sm"
      role="status"
      aria-label={`You ${hp} of ${battle.playerHpMax} HP, turn ${battle.turnCount}, ${battle.enemyName ?? 'enemy'} ${battle.enemyCurrentHp} of ${battle.enemyMaxHp} HP`}
    >
      <span className="shrink-0 text-fg-bright">You</span>
      <HpBar current={battle.playerHp} max={battle.playerHpMax} color="bg-resource-hp" className="min-w-8 max-w-28 flex-1" />
      <span className="shrink-0 text-combat-damage">{hp}</span>
      <span className="shrink-0 px-1 text-fg-disabled">T{battle.turnCount}</span>
      <span className="shrink-0 text-combat-damage">{battle.enemyCurrentHp}</span>
      <HpBar current={battle.enemyCurrentHp} max={battle.enemyMaxHp} color="bg-resource-hp" rtl initialPct={100} className="min-w-8 max-w-28 flex-1" />
      <span className="min-w-[5ch] max-w-[9rem] shrink truncate text-fg-bright">{battle.enemyName}</span>
    </div>
  )
}
