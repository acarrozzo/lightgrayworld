'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

/**
 * The ledger behind both point-spending modals (Core Points into STR/DEX/MAG/DEF,
 * Training Points into PT/MT). One row per stat: the code, the current value,
 * the value it becomes, a one-line note on what the number actually does in
 * battle, and the controls — raise by one, lower by one, or put every
 * remaining point in (the original's "+N STR" button).
 *
 * Presentation only. The wrapper owns the endpoint and the player; this
 * component owns the pending tally and the sheet/dialog chrome: a full-height
 * sheet with one column on phones, a wider centred dialog with the rows two
 * abreast from `sm` up so every stat is in view without scrolling.
 */

export interface AllocationTone {
  /** Text colour class for the stat code and its new value, e.g. `text-stat-str`. */
  text: string
  /** Border colour class for a row with points pending, e.g. `border-stat-str`. */
  border: string
}

export interface AllocationRow<K extends string = string> {
  key: K
  /** Short code shown in the row: STR, DEX, PT, MT. */
  code: string
  /** Full name, for screen readers and the confirmation feed line. */
  name: string
  current: number
  /** What the number does, phrased for the value it would become. */
  mechanic: (nextValue: number) => string
  tone: AllocationTone
}

export interface AllocationChange {
  code: string
  name: string
  from: number
  to: number
}

export interface AllocationSummary {
  pointCode: string
  total: number
  changes: AllocationChange[]
}

export interface PointAllocationModalProps<K extends string> {
  isOpen: boolean
  title: string
  intro: string
  /** Singular noun: "Core Point". */
  pointName: string
  /** Short code on the spend button: "CP". */
  pointCode: string
  available: number
  rows: AllocationRow<K>[]
  onClose: () => void
  /**
   * Sends the allocation to the server. Resolve when applied (the modal then
   * closes); reject with an Error whose message is shown to the player.
   */
  onSubmit: (allocations: Array<{ stat: K; amount: number }>) => Promise<void>
}

const emptyPending = <K extends string>(rows: AllocationRow<K>[]): Record<K, number> =>
  Object.fromEntries(rows.map((row) => [row.key, 0])) as Record<K, number>

const sum = (pending: Record<string, number>) => Object.values(pending).reduce((acc, n) => acc + n, 0)

export default function PointAllocationModal<K extends string>({
  isOpen,
  title,
  intro,
  pointName,
  pointCode,
  available,
  rows,
  onClose,
  onSubmit,
}: PointAllocationModalProps<K>) {
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<K, number>>(() => emptyPending(rows))
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  // Every open starts from a clean tally, and keyboard users land inside the
  // dialog rather than wherever the opening button was.
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setBusy(false)
    setPending(emptyPending(rows))
    const id = window.setTimeout(() => dialogRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
    // rows is rebuilt by the wrapper on every render; only the open edge matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const totalPending = sum(pending)
  const remaining = Math.max(0, available - totalPending)

  const adjust = (key: K, delta: number) => {
    if (busy) return
    setPending((prev) => {
      const next = Math.max(0, prev[key] + delta)
      const spent = sum(prev) - prev[key] + next
      if (spent > available) return prev
      return { ...prev, [key]: next }
    })
  }

  const allIn = (key: K) => {
    if (busy) return
    setPending((prev) => {
      const left = available - sum(prev)
      if (left <= 0) return prev
      return { ...prev, [key]: prev[key] + left }
    })
  }

  const reset = () => {
    if (busy) return
    setPending(emptyPending(rows))
    setError(null)
  }

  const cancel = () => {
    if (busy) return
    onClose()
  }

  const confirm = async () => {
    if (busy || totalPending === 0) return
    setBusy(true)
    setError(null)
    try {
      const allocations = rows
        .filter((row) => pending[row.key] > 0)
        .map((row) => ({ stat: row.key, amount: pending[row.key] }))
      await onSubmit(allocations)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not spend your ${pointName}s.`)
    } finally {
      setBusy(false)
    }
  }

  const plural = (n: number) => `${pointName}${n === 1 ? '' : 's'}`
  const changed = rows.filter((row) => pending[row.key] > 0)
  const summary =
    changed.length === 0
      ? `Raise a stat to spend a ${pointName}.`
      : `${changed.map((row) => `+${pending[row.key]} ${row.code}`).join(', ')}${
          remaining > 0 ? ` · ${remaining} ${plural(remaining)} stay${remaining === 1 ? 's' : ''} unspent` : ''
        }`

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-surface-sunken/70 backdrop-blur-sm" onClick={cancel} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 flex flex-col w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-surface-panel/95 border border-line-subtle/50 sm:rounded-lg shadow-2xl overflow-hidden focus:outline-none"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-line-subtle/50">
          <div className="min-w-0">
            <h3 id={titleId} className="text-lg font-semibold text-fg-bright">{title}</h3>
            <p className="text-xs text-fg-secondary mt-0.5">{intro}</p>
          </div>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            aria-label="Close"
            className="flex-shrink-0 text-fg-secondary hover:text-fg-bright transition-colors p-1.5 rounded hover:bg-surface-raised disabled:opacity-50"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="flex items-baseline gap-2 px-4 pt-3 pb-1">
          <span className="text-3xl font-bold leading-none tabular-nums text-accent">{remaining}</span>
          <span className="text-xs text-fg-secondary">
            of {available} {plural(available)} left to spend
          </span>
          {totalPending > 0 && (
            <span className="ml-auto text-xs text-fg-muted tabular-nums">{totalPending} pending</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
          {error && (
            <div role="alert" className="sm:col-span-2 bg-status-error/30 border border-status-error/50 rounded-xl px-3 py-2">
              <p className="text-sm text-status-error">{error}</p>
            </div>
          )}

          {rows.map((row) => {
            const amount = pending[row.key]
            const next = row.current + amount
            const canRaise = remaining > 0 && !busy
            const canLower = amount > 0 && !busy
            return (
              <div
                key={row.key}
                className={`rounded-xl border px-3 py-2.5 bg-surface-canvas/35 ${amount > 0 ? row.tone.border : 'border-line-subtle'}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`text-base font-bold tracking-wide ${row.tone.text}`}>{row.code}</span>
                  <span className="flex items-baseline gap-1.5 tabular-nums">
                    {amount > 0 ? (
                      <>
                        <span className="text-sm text-fg-muted">{row.current}</span>
                        <span className="text-xs text-fg-disabled" aria-hidden="true">→</span>
                        <span className={`text-2xl font-bold leading-none ${row.tone.text}`}>{next}</span>
                        <span className="sr-only">becomes {next}</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold leading-none text-fg-primary">{row.current}</span>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-fg-muted mt-0.5 tabular-nums">{row.mechanic(next)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => adjust(row.key, -1)}
                    disabled={!canLower}
                    aria-label={`Lower ${row.name} by one`}
                    className={`w-11 h-11 rounded-lg border flex items-center justify-center text-xl font-bold transition-colors ${
                      canLower
                        ? `${row.tone.border} ${row.tone.text} bg-surface-raised hover:bg-surface-hover`
                        : 'border-line-subtle bg-surface-panel/50 text-fg-disabled cursor-not-allowed'
                    }`}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => adjust(row.key, 1)}
                    disabled={!canRaise}
                    aria-label={`Raise ${row.name} by one`}
                    className={`w-11 h-11 rounded-lg border flex items-center justify-center text-xl font-bold transition-colors ${
                      canRaise
                        ? 'border-line-strong bg-surface-raised text-fg-bright hover:bg-surface-hover'
                        : 'border-line-subtle bg-surface-panel/50 text-fg-disabled cursor-not-allowed'
                    }`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => allIn(row.key)}
                    disabled={!canRaise}
                    aria-label={`Put all remaining ${plural(remaining)} into ${row.name}`}
                    className="ml-auto h-11 px-3 rounded-lg border border-dashed border-line-strong text-xs text-fg-secondary hover:bg-surface-raised hover:text-fg-bright transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    all in
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-line-subtle/50 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          <p className="text-xs text-fg-secondary tabular-nums" aria-live="polite">{summary}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={totalPending > 0 ? reset : cancel}
              disabled={busy}
              className="px-4 py-3 rounded-lg text-sm font-medium text-fg-primary hover:text-fg-bright hover:bg-surface-raised transition-colors disabled:opacity-50"
            >
              {totalPending > 0 ? 'Reset' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={busy || totalPending === 0}
              className="flex-1 py-3 rounded-lg text-sm font-semibold fill-accent hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed tabular-nums"
            >
              {busy ? 'Spending…' : totalPending > 0 ? `Spend ${totalPending} ${pointCode}` : `Spend ${pointCode}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
