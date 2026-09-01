'use client'

interface NotificationBadgeProps {
  /**
   * `number` renders a numbered pill (capped at "99+"); `true` renders a small
   * dot. Falsy values (0, false, undefined) render nothing.
   */
  value?: number | boolean
  /** Positioning / layout classes supplied by the caller (e.g. "absolute -top-1 -right-1"). */
  className?: string
}

/**
 * Shared red notification badge used for tab and filter indicators.
 * Numbered when given a count, otherwise a plain dot.
 */
export default function NotificationBadge({ value, className = '' }: NotificationBadgeProps) {
  if (!value) return null
  const isNumber = typeof value === 'number'
  if (isNumber && value <= 0) return null

  return (
    <span
      className={`bg-status-error rounded-full border border-line-subtle flex items-center justify-center ${
        isNumber
          ? 'min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-fg-bright'
          : 'w-2 h-2'
      } ${className}`}
    >
      {isNumber ? (value > 99 ? '99+' : value) : ''}
    </span>
  )
}
