'use client'

import { Player, useGameStore } from '@/lib/game-state'
import PointAllocationModal, { type AllocationRow, type AllocationSummary } from './PointAllocationModal'

interface StatAllocationModalProps {
  isOpen: boolean
  player: Player | null
  onClose: () => void
  /**
   * Fired once the server has applied the spend. `updatedPlayer` is the
   * server's row projection (merge it over the store player; it carries no
   * client-only fields) and `summary` is what changed, for the feed.
   */
  onStatAllocated: (updatedPlayer: Player, summary: AllocationSummary) => void
}

type StatName = 'str' | 'dex' | 'mag' | 'def'

/**
 * The four core stats and what each number does in a fight, per
 * battle-calculator.js: STR is the melee attack roll, DEX the ranged attack
 * roll and the block against ranged hits, MAG drives spells and blocks magic
 * hits, DEF blocks melee hits. The mechanic line quotes the effective value
 * (core plus gear mods) since that is the number the dice actually see.
 */
const CORE_STATS: Array<{
  key: StatName
  code: string
  name: string
  modKey: 'strMod' | 'dexMod' | 'magMod' | 'defMod'
  tone: AllocationRow['tone']
  mechanic: (effective: number) => string
}> = [
  {
    key: 'str', code: 'STR', name: 'Strength', modKey: 'strMod',
    tone: { text: 'text-stat-str', border: 'border-stat-str' },
    mechanic: (n) => `Melee attack roll 0–${n}`,
  },
  {
    key: 'dex', code: 'DEX', name: 'Dexterity', modKey: 'dexMod',
    tone: { text: 'text-stat-dex', border: 'border-stat-dex' },
    mechanic: (n) => `Ranged attack roll 0–${n} · blocks ranged hits`,
  },
  {
    key: 'mag', code: 'MAG', name: 'Magic', modKey: 'magMod',
    tone: { text: 'text-stat-mag', border: 'border-stat-mag' },
    mechanic: (n) => `Spell power ${n} · blocks magic hits`,
  },
  {
    key: 'def', code: 'DEF', name: 'Defense', modKey: 'defMod',
    tone: { text: 'text-stat-def', border: 'border-stat-def' },
    mechanic: (n) => `Blocks melee hits 0–${n}`,
  },
]

export default function StatAllocationModal({ isOpen, player, onClose, onStatAllocated }: StatAllocationModalProps) {
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)

  if (!player) return null

  const rows: AllocationRow<StatName>[] = CORE_STATS.map((stat) => {
    const mod = player[stat.modKey] ?? 0
    return {
      key: stat.key,
      code: stat.code,
      name: stat.name,
      current: player[stat.key] ?? 0,
      tone: stat.tone,
      mechanic: (next) => `${stat.mechanic(next + mod)}${mod !== 0 ? ` (${mod > 0 ? '+' : ''}${mod} gear)` : ''}`,
    }
  })

  const submit = async (allocations: Array<{ stat: StatName; amount: number }>) => {
    const response = await fetch('/api/user/stats', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ allocations }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.player) {
      // API errors arrive as { success: false, error: { message } } (lib/error-handling).
      throw new Error(data?.error?.message || data?.message || 'Could not spend your Core Points.')
    }
    const updated = data.player as Player
    onStatAllocated(updated, {
      pointCode: 'CP',
      total: allocations.reduce((acc, a) => acc + a.amount, 0),
      changes: allocations.map((a) => {
        const stat = CORE_STATS.find((s) => s.key === a.stat)!
        return { code: stat.code, name: stat.name, from: player[a.stat] ?? 0, to: updated[a.stat] ?? (player[a.stat] ?? 0) + a.amount }
      }),
    })
  }

  return (
    <PointAllocationModal
      isOpen={isOpen}
      title="Core Points"
      intro="One point raises a core stat by one. Permanent."
      pointName="Core Point"
      pointCode="CP"
      available={player.cp ?? 0}
      rows={rows}
      onClose={onClose}
      onSubmit={submit}
    />
  )
}
