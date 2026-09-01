'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Player, useGameStore } from '@/lib/game-state'
import Icon from './Icon'

interface TrainingAllocationModalProps {
  isOpen: boolean
  player: Player | null
  isSaving?: boolean
  onClose: () => void
  onTrainingAllocated: (updatedPlayer: Player) => void
}

const TRAINING_LABELS: Record<string, string> = {
  pt: 'Physical Training',
  mt: 'Mental Training',
}

const TRAINING_DESCRIPTIONS: Record<string, string> = {
  pt: 'HP recovery per rest action',
  mt: 'MP recovery per rest action',
}

const TRAINING_COLORS: Record<string, { text: string; activeBorder: string; btnActive: string }> = {
  pt: { text: 'text-status-warning',  activeBorder: 'border-status-warning',  btnActive: 'border-status-warning bg-surface-raised text-fg-bright hover:bg-status-warning/20'  },
  mt: { text: 'text-stat-mag',  activeBorder: 'border-stat-mag',  btnActive: 'border-stat-mag bg-surface-raised text-fg-bright hover:bg-stat-mag/20'  },
}

type TrainingStatName = 'pt' | 'mt'

interface TrainingControlProps {
  statKey: TrainingStatName
  currentValue: number
  pendingAmount: number
  availableTp: number
  totalPending: number
  isAllocating: boolean
  onIncrement: (stat: TrainingStatName) => void
  onDecrement: (stat: TrainingStatName) => void
}

function TrainingControl({
  statKey,
  currentValue,
  pendingAmount,
  availableTp,
  totalPending,
  isAllocating,
  onIncrement,
  onDecrement,
}: TrainingControlProps) {
  const label = TRAINING_LABELS[statKey] || statKey.toUpperCase()
  const description = TRAINING_DESCRIPTIONS[statKey] || ''
  const color = TRAINING_COLORS[statKey]
  const canIncrement = availableTp > totalPending && !isAllocating
  const canDecrement = pendingAmount > 0 && !isAllocating
  const newValue = currentValue + pendingAmount

  return (
    <div className={`bg-surface-panel/70 border rounded-2xl p-6 ${pendingAmount > 0 ? color.activeBorder : 'border-line-subtle'}`}>
      <div className="text-center mb-4">
        <p className={`text-lg font-semibold ${color.text}`}>{label}</p>
        <p className="text-xs text-fg-secondary mt-1">{description}</p>
      </div>

      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          type="button"
          onClick={() => onDecrement(statKey)}
          disabled={!canDecrement}
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xl font-bold transition-all ${
            canDecrement ? color.btnActive : 'border-line-subtle bg-surface-panel/50 text-fg-disabled cursor-not-allowed'
          }`}
        >
          −
        </button>

        <div className="text-center min-w-[80px]">
          <div className={`text-3xl font-bold ${color.text}`}>{newValue}</div>
          {pendingAmount > 0 ? (
            <div className="text-xs text-status-success mt-1">+{pendingAmount}</div>
          ) : (
            <div className="text-xs text-fg-muted mt-1">{currentValue}</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onIncrement(statKey)}
          disabled={!canIncrement}
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xl font-bold transition-all ${
            canIncrement ? color.btnActive : 'border-line-subtle bg-surface-panel/50 text-fg-disabled cursor-not-allowed'
          }`}
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function TrainingAllocationModal({
  isOpen,
  player,
  isSaving = false,
  onClose,
  onTrainingAllocated,
}: TrainingAllocationModalProps) {
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const [mounted, setMounted] = useState(false)
  const [isAllocating, setIsAllocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pendingAllocations, setPendingAllocations] = useState<Record<TrainingStatName, number>>({
    pt: 0,
    mt: 0,
  })

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setIsAllocating(false)
      setPendingAllocations({ pt: 0, mt: 0 })
    }
  }, [isOpen])

  const handleIncrement = (stat: TrainingStatName) => {
    if (!player || isAllocating) return
    const currentTp = player.tp ?? 0
    const totalPending = Object.values(pendingAllocations).reduce((sum, val) => sum + val, 0)
    if (currentTp > totalPending) {
      setPendingAllocations((prev) => ({ ...prev, [stat]: prev[stat] + 1 }))
    }
  }

  const handleDecrement = (stat: TrainingStatName) => {
    if (!player || isAllocating) return
    if (pendingAllocations[stat] > 0) {
      setPendingAllocations((prev) => ({ ...prev, [stat]: prev[stat] - 1 }))
    }
  }

  const handleConfirm = async () => {
    if (!player || isAllocating || isSaving) return

    const totalPending = Object.values(pendingAllocations).reduce((sum, val) => sum + val, 0)
    if (totalPending === 0) {
      setError('No allocations to confirm')
      return
    }

    setIsAllocating(true)
    setError(null)

    try {
      const allocations = Object.entries(pendingAllocations)
        .filter(([_, amount]) => amount > 0)
        .map(([stat, amount]) => ({ stat, amount }))

      const response = await fetch('/api/user/training', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ allocations }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to allocate training points')
      }

      const data = await response.json()
      if (data.player) {
        onTrainingAllocated(data.player as Player)
        onClose()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to allocate training points'
      setError(errorMessage)
      console.error('Training allocation error:', err)
    } finally {
      setIsAllocating(false)
    }
  }

  const handleCancel = () => {
    if (!isAllocating && !isSaving) {
      setPendingAllocations({ pt: 0, mt: 0 })
      onClose()
    }
  }

  if (!mounted || !isOpen || !player) return null

  const currentTp = player.tp ?? 0
  const totalPending = Object.values(pendingAllocations).reduce((sum, val) => sum + val, 0)
  const remainingTp = currentTp - totalPending

  const summaryParts: string[] = []
  if (pendingAllocations.pt > 0) summaryParts.push(`+${pendingAllocations.pt} PT`)
  if (pendingAllocations.mt > 0) summaryParts.push(`+${pendingAllocations.mt} MT`)
  const summaryText = summaryParts.length > 0 ? summaryParts.join(', ') : 'No changes'

  return createPortal(
    <div className="fixed inset-0 z-50 p-4 sm:p-6 lg:p-10">
      <div
        className="absolute inset-0 bg-surface-sunken/70 backdrop-blur-sm"
        onClick={handleCancel}
      />
      <div className="relative z-10 h-full w-full bg-surface-panel/95 border border-line-subtle/50 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line-subtle/50">
          <div>
            <h3 className="text-lg font-semibold text-fg-bright">Allocate Training Points</h3>
            <p className="text-xs text-fg-secondary mt-0.5">
              Use the plus and minus buttons to invest Training Points into PT or MT. Click Confirm to apply.
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="text-fg-secondary hover:text-fg-bright transition-colors p-1.5 rounded hover:bg-surface-raised"
            disabled={isSaving || isAllocating}
          >
            <span className="sr-only">Close</span>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="bg-surface-panel/70 border border-line-subtle rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-status-warning/80 mb-1">Available</p>
                <h4 className="text-3xl font-semibold text-fg-bright">{currentTp} Training Point{currentTp !== 1 ? 's' : ''}</h4>
              </div>
              {totalPending > 0 && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.4em] text-status-success/80 mb-1">Pending</p>
                  <h4 className="text-2xl font-semibold text-status-success">-{totalPending}</h4>
                  <p className="text-sm text-fg-secondary mt-1">Remaining: {remainingTp}</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-status-error/30 border border-status-error/50 rounded-2xl p-4">
              <p className="text-sm text-status-error">{error}</p>
            </div>
          )}

          <div className="bg-surface-panel/70 border border-line-subtle rounded-2xl p-6">
            <p className="text-xs uppercase tracking-widest text-fg-secondary mb-4">Training Stats</p>
            <div className="grid grid-cols-2 gap-4">
              <TrainingControl
                statKey="pt"
                currentValue={player.physicalTraining ?? 1}
                pendingAmount={pendingAllocations.pt}
                availableTp={currentTp}
                totalPending={totalPending}
                isAllocating={isAllocating || isSaving}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
              />
              <TrainingControl
                statKey="mt"
                currentValue={player.mentalTraining ?? 1}
                pendingAmount={pendingAllocations.mt}
                availableTp={currentTp}
                totalPending={totalPending}
                isAllocating={isAllocating || isSaving}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
              />
            </div>
          </div>

          {totalPending > 0 && (
            <div className="bg-status-warning/20 border border-status-warning/50 rounded-2xl p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-status-warning/80 mb-2">Summary</p>
              <p className="text-lg font-semibold text-fg-bright">
                Spending {totalPending} Training Point{totalPending !== 1 ? 's' : ''}: {summaryText}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-line-subtle/50">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-1.5 rounded text-sm font-medium text-fg-primary hover:text-fg-bright hover:bg-surface-raised transition-colors"
            disabled={isSaving || isAllocating}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving || isAllocating || totalPending === 0}
            className="px-4 py-1.5 rounded text-sm font-medium text-fg-bright bg-surface-hover hover:bg-surface-selected transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isAllocating ? 'Allocating...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
