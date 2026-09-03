'use client'

import { Player, useGameStore } from '@/lib/game-state'
import PointAllocationModal, { type AllocationRow, type AllocationSummary } from './PointAllocationModal'

interface TrainingAllocationModalProps {
  isOpen: boolean
  player: Player | null
  onClose: () => void
  /** See StatAllocationModal: merge `updatedPlayer` over the store player. */
  onTrainingAllocated: (updatedPlayer: Player, summary: AllocationSummary) => void
}

type TrainingStatName = 'pt' | 'mt'

/**
 * Physical Training is HP per rest action and, at each level-up, 1 + 2×PT
 * max HP; Mental Training is the same for MP (room-state rest, leveling-service).
 */
const TRAINING: Array<{
  key: TrainingStatName
  code: string
  name: string
  field: 'physicalTraining' | 'mentalTraining'
  fallback: number
  tone: AllocationRow['tone']
  mechanic: (n: number) => string
}> = [
  {
    key: 'pt', code: 'PT', name: 'Physical Training', field: 'physicalTraining', fallback: 1,
    tone: { text: 'text-resource-hp', border: 'border-resource-hp' },
    mechanic: (n) => `+${n} HP per rest · +${1 + n * 2} max HP per level`,
  },
  {
    key: 'mt', code: 'MT', name: 'Mental Training', field: 'mentalTraining', fallback: 0,
    tone: { text: 'text-resource-mp', border: 'border-resource-mp' },
    mechanic: (n) => `+${n} MP per rest · +${1 + n * 2} max MP per level`,
  },
]

export default function TrainingAllocationModal({ isOpen, player, onClose, onTrainingAllocated }: TrainingAllocationModalProps) {
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)

  if (!player) return null

  const currentOf = (p: Player, stat: (typeof TRAINING)[number]) => p[stat.field] ?? stat.fallback

  const rows: AllocationRow<TrainingStatName>[] = TRAINING.map((stat) => ({
    key: stat.key,
    code: stat.code,
    name: stat.name,
    current: currentOf(player, stat),
    tone: stat.tone,
    mechanic: stat.mechanic,
  }))

  const submit = async (allocations: Array<{ stat: TrainingStatName; amount: number }>) => {
    const response = await fetch('/api/user/training', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ allocations }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data?.player) {
      // API errors arrive as { success: false, error: { message } } (lib/error-handling).
      throw new Error(data?.error?.message || data?.message || 'Could not spend your Training Points.')
    }
    const updated = data.player as Player
    onTrainingAllocated(updated, {
      pointCode: 'TP',
      total: allocations.reduce((acc, a) => acc + a.amount, 0),
      changes: allocations.map((a) => {
        const stat = TRAINING.find((s) => s.key === a.stat)!
        const from = currentOf(player, stat)
        return { code: stat.code, name: stat.name, from, to: updated[stat.field] ?? from + a.amount }
      }),
    })
  }

  return (
    <PointAllocationModal
      isOpen={isOpen}
      title="Training Points"
      intro="One point raises Physical or Mental Training by one. Permanent."
      pointName="Training Point"
      pointCode="TP"
      available={player.tp ?? 0}
      rows={rows}
      onClose={onClose}
      onSubmit={submit}
    />
  )
}
