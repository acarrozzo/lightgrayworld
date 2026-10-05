'use client'

import { useEffect, useId, useState } from 'react'

/**
 * The ledger behind both kinds of point spending (Core Points into
 * STR/DEX/MAG/DEF, Training Points into PT/MT), drawn in place on the Char
 * page whenever there are points to spend. One row per stat: the code, the
 * current value, the value it becomes, a one-line note on what the number
 * actually does in battle, and the controls: raise by one, lower by one.
 *
 * Presentation only. The wrapper owns the endpoint and the player; this
 * component owns the pending tally. Nothing is spent until Spend is pressed.
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

export interface PointAllocationProps<K extends string> {
  title: string
  intro: string
  /** Singular noun: "Core Point". */
  pointName: string
  /** Short code on the spend button: "CP". */
  pointCode: string
  available: number
  rows: AllocationRow<K>[]
  /** The frame's colour: the accent for Core Points, gold for Training Points. */
  frame?: 'accent' | 'gold'
  /** Write each stat's name out ("Physical Training") instead of its code. */
  fullNames?: boolean
  /**
   * Sends the allocation to the server. Resolve when applied; reject with an
   * Error whose message is shown to the player.
   */
  onSubmit: (allocations: Array<{ stat: K; amount: number }>) => Promise<void>
}

// Written out in full so Tailwind generates them.
const FRAME = {
  accent: {
    border: 'border-accent shadow-[0_0_14px_-2px_color-mix(in_srgb,var(--accent)_55%,transparent)]',
    band: 'fill-accent',
    raise: 'border-accent bg-accent/15 text-accent hover:bg-accent/30',
    spend: 'fill-accent hover:bg-accent-hover',
  },
  gold: {
    border: 'border-resource-gold shadow-[0_0_14px_-2px_color-mix(in_srgb,var(--resource-gold)_55%,transparent)]',
    band: 'fill-resource-gold',
    raise: 'border-resource-gold bg-resource-gold/15 text-resource-gold hover:bg-resource-gold/30',
    spend: 'fill-resource-gold hover:brightness-110',
  },
} as const

const emptyPending = <K extends string>(rows: AllocationRow<K>[]): Record<K, number> =>
  Object.fromEntries(rows.map((row) => [row.key, 0])) as Record<K, number>

const sum = (pending: Record<string, number>) => Object.values(pending).reduce((acc, n) => acc + n, 0)

export default function PointAllocation<K extends string>({
  title,
  intro,
  pointName,
  pointCode,
  available,
  rows,
  frame = 'accent',
  fullNames = false,
  onSubmit,
}: PointAllocationProps<K>) {
  const tone = FRAME[frame]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<K, number>>(() => emptyPending(rows))
  const titleId = useId()

  // A spend changes what is left; start the tally clean for what remains.
  useEffect(() => {
    setPending(emptyPending(rows))
    // rows is rebuilt by the wrapper on every render; only the count matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available])

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

  const reset = () => {
    if (busy) return
    setPending(emptyPending(rows))
    setError(null)
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
      : `${changed.map((row) => `+${pending[row.key]} ${fullNames ? row.name : row.code}`).join(', ')}${
          remaining > 0 ? ` · ${remaining} ${plural(remaining)} stay${remaining === 1 ? 's' : ''} unspent` : ''
        }`

  return (
    // Small on the page but not quiet: an accent band that says how many
    // points are waiting, then one line per stat.
    <section aria-labelledby={titleId} className={`overflow-hidden rounded-lg border-2 ${tone.border}`}>
      <div className={`flex items-center gap-2 px-3 py-1.5 ${tone.band}`}>
        <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-current opacity-70 animate-ping-slow" />
          <span className="relative h-2 w-2 rounded-full bg-current" />
        </span>
        <h4 id={titleId} className="text-sm font-bold tabular-nums">
          {remaining} {plural(remaining)} to spend
        </h4>
        <span className="ml-auto truncate text-[10px] font-medium opacity-80" title={intro}>{title}</span>
      </div>

      <div className="divide-y divide-line-subtle/40 bg-surface-canvas/40">
        {error && (
          <div role="alert" className="bg-status-error/20 px-3 py-1.5">
            <p className="text-xs text-status-error">{error}</p>
          </div>
        )}
        {rows.map((row) => {
          const amount = pending[row.key]
          const next = row.current + amount
          const canRaise = remaining > 0 && !busy
          const canLower = amount > 0 && !busy
          return (
            <div key={row.key} className="flex items-center gap-2 px-3 py-1.5">
              {/* The stat and what it does on the left, its number in the middle, the controls on the right. */}
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className={`truncate text-sm font-bold ${fullNames ? '' : 'tracking-wide'} ${row.tone.text}`}>{fullNames ? row.name : row.code}</span>
                <span className="truncate text-[10px] text-fg-muted tabular-nums" title={row.mechanic(next)}>
                  {row.mechanic(next)}
                </span>
              </span>
              <span className="flex flex-shrink-0 items-baseline gap-1 tabular-nums">
                {amount > 0 ? (
                  <>
                    <span className="text-xs text-fg-muted">{row.current}</span>
                    <span className="text-[10px] text-fg-disabled" aria-hidden="true">→</span>
                    <span className={`text-base font-bold leading-none ${row.tone.text}`}>{next}</span>
                    <span className="sr-only">becomes {next}</span>
                  </>
                ) : (
                  <span className="text-base font-bold leading-none text-fg-primary">{row.current}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => adjust(row.key, -1)}
                disabled={!canLower}
                aria-label={`Lower ${row.name} by one`}
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-lg font-bold leading-none transition-colors ${
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
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-lg font-bold leading-none transition-colors ${
                  canRaise
                    ? tone.raise
                    : 'border-line-subtle bg-surface-panel/50 text-fg-disabled cursor-not-allowed'
                }`}
              >
                +
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-line-subtle/50 bg-surface-canvas/40 px-3 py-2">
        <p className="min-w-0 flex-1 truncate text-[11px] text-fg-secondary tabular-nums" aria-live="polite" title={summary}>{summary}</p>
        {totalPending > 0 && (
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="h-8 flex-shrink-0 rounded-md px-2.5 text-xs font-medium text-fg-primary transition-colors hover:bg-surface-raised hover:text-fg-bright disabled:opacity-50"
          >
            Reset
          </button>
        )}
        <button
          type="button"
          onClick={confirm}
          disabled={busy || totalPending === 0}
          className={`h-8 flex-shrink-0 rounded-md px-3 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 tabular-nums ${tone.spend}`}
        >
          {busy ? 'Spending…' : totalPending > 0 ? `Spend ${totalPending} ${pointCode}` : `Spend ${pointCode}`}
        </button>
      </div>
    </section>
  )
}
