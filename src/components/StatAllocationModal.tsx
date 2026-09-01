'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Player, useGameStore } from '@/lib/game-state'
import Icon from './Icon'

interface StatAllocationModalProps {
  isOpen: boolean
  player: Player | null
  isSaving?: boolean
  onClose: () => void
  onStatAllocated: (updatedPlayer: Player) => void
}

const STAT_LABELS: Record<string, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  mag: 'Magic',
  def: 'Defense',
}

const STAT_DESCRIPTIONS: Record<string, string> = {
  str: 'Physical power and damage',
  dex: 'Speed and accuracy',
  mag: 'Magical power and spells',
  def: 'Physical and magical resistance',
}

const STAT_COLORS: Record<string, { text: string; activeBorder: string; btnActive: string }> = {
  str: { text: 'text-status-error',     activeBorder: 'border-status-error',     btnActive: 'border-status-error bg-surface-raised text-fg-bright hover:bg-status-error/20'     },
  dex: { text: 'text-status-success', activeBorder: 'border-status-success', btnActive: 'border-status-success bg-surface-raised text-fg-bright hover:bg-status-success/20' },
  mag: { text: 'text-status-info',     activeBorder: 'border-status-info',     btnActive: 'border-status-info bg-surface-raised text-fg-bright hover:bg-status-info/20'     },
  def: { text: 'text-resource-gold',   activeBorder: 'border-resource-gold',   btnActive: 'border-resource-gold bg-surface-raised text-fg-bright hover:bg-resource-gold/20'   },
}

type StatName = 'str' | 'dex' | 'mag' | 'def'

interface StatControlProps {
  statKey: StatName
  currentValue: number
  pendingAmount: number
  availableCp: number
  totalPending: number
  isAllocating: boolean
  onIncrement: (stat: StatName) => void
  onDecrement: (stat: StatName) => void
}

function StatControl({
  statKey,
  currentValue,
  pendingAmount,
  availableCp,
  totalPending,
  isAllocating,
  onIncrement,
  onDecrement,
}: StatControlProps) {
  const label = STAT_LABELS[statKey] || statKey.toUpperCase()
  const description = STAT_DESCRIPTIONS[statKey] || ''
  const color = STAT_COLORS[statKey]
  const canIncrement = availableCp > totalPending && !isAllocating
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

export default function StatAllocationModal({
  isOpen,
  player,
  isSaving = false,
  onClose,
  onStatAllocated,
}: StatAllocationModalProps) {
  const getAuthHeaders = useGameStore((state) => state.getAuthHeaders)
  const [mounted, setMounted] = useState(false)
  const [isAllocating, setIsAllocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Track pending allocations (preview mode)
  const [pendingAllocations, setPendingAllocations] = useState<Record<StatName, number>>({
    str: 0,
    dex: 0,
    mag: 0,
    def: 0,
  })

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setIsAllocating(false)
      // Reset pending allocations when modal opens
      setPendingAllocations({
        str: 0,
        dex: 0,
        mag: 0,
        def: 0,
      })
    }
  }, [isOpen])

  const handleIncrement = (stat: StatName) => {
    if (!player || isAllocating) return
    const currentCp = player.cp ?? 0
    const totalPending = Object.values(pendingAllocations).reduce((sum, val) => sum + val, 0)
    
    if (currentCp > totalPending) {
      setPendingAllocations((prev) => ({
        ...prev,
        [stat]: prev[stat] + 1,
      }))
    }
  }

  const handleDecrement = (stat: StatName) => {
    if (!player || isAllocating) return
    if (pendingAllocations[stat] > 0) {
      setPendingAllocations((prev) => ({
        ...prev,
        [stat]: prev[stat] - 1,
      }))
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
      // Build allocations array (only include stats with pending amounts > 0)
      const allocations = Object.entries(pendingAllocations)
        .filter(([_, amount]) => amount > 0)
        .map(([stat, amount]) => ({ stat, amount }))

      const response = await fetch('/api/user/stats', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ allocations }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to allocate stats')
      }

      const data = await response.json()
      if (data.player) {
        onStatAllocated(data.player as Player)
        onClose()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to allocate stats'
      setError(errorMessage)
      console.error('Stat allocation error:', err)
    } finally {
      setIsAllocating(false)
    }
  }

  const handleCancel = () => {
    if (!isAllocating && !isSaving) {
      setPendingAllocations({
        str: 0,
        dex: 0,
        mag: 0,
        def: 0,
      })
      onClose()
    }
  }

  if (!mounted || !isOpen || !player) {
    return null
  }

  const currentCp = player.cp ?? 0
  const str = player.str ?? 0
  const dex = player.dex ?? 0
  const mag = player.mag ?? 0
  const def = player.def ?? 0

  const totalPending = Object.values(pendingAllocations).reduce((sum, val) => sum + val, 0)
  const remainingCp = currentCp - totalPending

  // Build summary text
  const summaryParts: string[] = []
  if (pendingAllocations.str > 0) summaryParts.push(`+${pendingAllocations.str} STR`)
  if (pendingAllocations.dex > 0) summaryParts.push(`+${pendingAllocations.dex} DEX`)
  if (pendingAllocations.mag > 0) summaryParts.push(`+${pendingAllocations.mag} MAG`)
  if (pendingAllocations.def > 0) summaryParts.push(`+${pendingAllocations.def} DEF`)
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
            <h3 className="text-lg font-semibold text-fg-bright">Allocate Core Points</h3>
            <p className="text-xs text-fg-secondary mt-0.5">
              Use the plus and minus buttons to adjust your stat allocations. Click Confirm to apply changes.
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
                <p className="text-xs uppercase tracking-[0.4em] text-accent-hover/80 mb-1">Available</p>
                <h4 className="text-3xl font-semibold text-fg-bright">{currentCp} Core Points</h4>
              </div>
              {totalPending > 0 && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.4em] text-status-success/80 mb-1">Pending</p>
                  <h4 className="text-2xl font-semibold text-status-success">-{totalPending}</h4>
                  <p className="text-sm text-fg-secondary mt-1">Remaining: {remainingCp}</p>
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
            <p className="text-xs uppercase tracking-widest text-fg-secondary mb-4">Core Stats</p>
            <div className="grid grid-cols-2 gap-4">
              <StatControl
                statKey="str"
                currentValue={str}
                pendingAmount={pendingAllocations.str}
                availableCp={currentCp}
                totalPending={totalPending}
                isAllocating={isAllocating || isSaving}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
              />
              <StatControl
                statKey="dex"
                currentValue={dex}
                pendingAmount={pendingAllocations.dex}
                availableCp={currentCp}
                totalPending={totalPending}
                isAllocating={isAllocating || isSaving}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
              />
              <StatControl
                statKey="mag"
                currentValue={mag}
                pendingAmount={pendingAllocations.mag}
                availableCp={currentCp}
                totalPending={totalPending}
                isAllocating={isAllocating || isSaving}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
              />
              <StatControl
                statKey="def"
                currentValue={def}
                pendingAmount={pendingAllocations.def}
                availableCp={currentCp}
                totalPending={totalPending}
                isAllocating={isAllocating || isSaving}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
              />
            </div>
          </div>

          {totalPending > 0 && (
            <div className="bg-accent-muted/20 border border-accent/50 rounded-2xl p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-accent-hover/80 mb-2">Summary</p>
              <p className="text-lg font-semibold text-fg-bright">
                Spending {totalPending} Core Point{totalPending !== 1 ? 's' : ''}: {summaryText}
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
