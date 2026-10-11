'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** How much of `amount` would actually land, with the bar's ceiling in the way. */
export function healThatLands(current: number, max: number, amount: number): number {
  if (amount <= 0 || current >= max) return 0
  return Math.min(max, current + amount) - current
}

const SIZE = {
  /** The hairline under a number: the full-size battle card, the pinned line. */
  thin: { track: 'h-2', label: '' },
  /** A bar that carries its own number, for the compact card's MP. */
  mid: { track: 'h-2.5', label: 'text-[8px]' },
  /** A bar that carries its own number, for the compact card's HP. */
  fat: { track: 'h-3.5', label: 'text-[10px]' },
} as const

export type HpBarSize = keyof typeof SIZE

interface HpBarProps {
  current: number
  max: number
  /** The fill's background class. */
  color: string
  /** Fill from the right: the enemy's side of the card. */
  rtl?: boolean
  /** Seeds the "previous" percentage so the drain shows on the first render. */
  initialPct?: number
  /** A hovered restorer's amount; its landing part ghosts onto the bar. */
  preview?: number
  size?: HpBarSize
  /** Drawn centred over the bar; only the mid and fat sizes have room. */
  label?: ReactNode
  className?: string
}

/**
 * A vitals bar with the damage drain: when the fill drops, the lost part
 * stays lit in the XP colour for a moment before it goes, so a hit reads as
 * a hit. The battle card draws it for both sides, the pinned line draws it
 * small, and the compact card draws it fat with the number inside.
 */
export default function HpBar({ current, max, color, rtl = false, initialPct, preview = 0, size = 'thin', label, className = '' }: HpBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0
  const previewPct = max > 0 ? (healThatLands(current, max, preview) / max) * 100 : 0
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

  const { track, label: labelSize } = SIZE[size]
  return (
    <div className={`relative bg-surface-raised/80 rounded-full ${track} shadow-[inset_0_1px_2px_var(--shadow)] overflow-hidden ${className || 'w-full'}`}>
      {damagePct > 0 && (
        <div
          className="bg-resource-xp h-full rounded-full absolute top-0 transition-all duration-500"
          style={rtl
            ? { right: `${pct}%`, width: `${damagePct}%` }
            : { left: `${pct}%`, width: `${damagePct}%` }}
        />
      )}
      <div
        className={`${color} h-full rounded-full absolute top-0 transition-all duration-300 ${rtl ? 'right-0' : 'left-0'}`}
        style={{ width: `${pct}%` }}
      />
      {previewPct > 0 && (
        <div
          className={`${color} h-full rounded-r-full absolute top-0 opacity-50 animate-pulse`}
          style={{ left: `${pct}%`, width: `${Math.min(100 - pct, previewPct)}%` }}
          aria-hidden="true"
        />
      )}
      {label !== undefined && labelSize && (
        <span className={`absolute inset-0 flex items-center justify-center gap-1 leading-none font-semibold label-over-fill tabular-nums ${labelSize}`}>
          {label}
        </span>
      )}
    </div>
  )
}
