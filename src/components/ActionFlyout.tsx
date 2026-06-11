'use client'

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { entryAccent, formatRelative } from './feed/activityFormat'

export type ActionFlyoutResult = {
  action?: string
  success?: boolean
  outcome?: 'success' | 'failure' | 'info'
  message?: string
  timestamp?: string
  data?: any
}

interface ActionFlyoutProps {
  result: ActionFlyoutResult
  /** Live element to anchor to (re-tracked on scroll/resize). */
  anchorRef?: RefObject<HTMLElement | null>
  /** Frozen viewport coords to anchor to — used when the anchor button is
   *  removed from the DOM (e.g. an item picked up). Takes precedence. */
  anchorRect?: { top: number; left: number } | null
  onDismiss: () => void
}

const GAP = 8 // px between the button and the flyout
const FLYOUT_WIDTH = 320 // px (w-80)

/**
 * Small popover showing the same result text as the world feed and the top
 * ActivityTicker. Rendered into a document.body portal with fixed positioning
 * computed from the anchor button's rect, so it can't be clipped by the scroll
 * containers around the room view. The parent controls mount / auto-dismiss.
 */
export default function ActionFlyout({ result, anchorRef, anchorRect, onDismiss }: ActionFlyoutProps) {
  const tsMs = result.timestamp ? new Date(result.timestamp).getTime() : Date.now()
  const [now, setNow] = useState(() => Date.now())
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Position above the anchor, left-aligned, clamped to the viewport. A frozen
  // anchorRect wins over the live anchorRef (used when the button is removed).
  useLayoutEffect(() => {
    const clampLeft = (left: number) =>
      Math.min(Math.max(left, 8), window.innerWidth - FLYOUT_WIDTH - 8)

    if (anchorRect) {
      setPos({ top: anchorRect.top - GAP, left: clampLeft(anchorRect.left) })
      return
    }

    const updatePosition = () => {
      const el = anchorRef?.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPos({ top: rect.top - GAP, left: clampLeft(rect.left) })
    }
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [anchorRef, anchorRect])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (pos === null || typeof document === 'undefined') return null

  const accent = entryAccent({
    outcome: result.outcome,
    level: result.success === false ? 'error' : undefined,
  })

  return createPortal(
    <div
      data-action-flyout
      role="status"
      aria-live="polite"
      className="fixed z-[60] -translate-y-full animate-[flyoutFadeIn_0.2s_ease-out]"
      style={{ top: pos.top, left: pos.left, width: FLYOUT_WIDTH }}
    >
      <div className="relative rounded-md border border-gray-700/60 bg-gray-900/95 backdrop-blur-sm shadow-lg px-3 py-2">
        <div className="flex items-start gap-2">
          <span
            className={`flex-shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${accent}`}
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0 whitespace-normal break-words text-xs text-gray-200">
            {result.message}
          </span>
          <span className="flex-shrink-0 mt-0.5 text-[10px] text-gray-500 tabular-nums">
            {formatRelative(tsMs, now)}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="flex-shrink-0 -mt-0.5 -mr-1 text-gray-500 hover:text-gray-300 text-sm leading-none"
          >
            ×
          </button>
        </div>
        {/* downward caret pointing at the button (near the left edge) */}
        <span
          className="absolute top-full left-5 -translate-x-1/2 -mt-px w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-gray-900/95"
          aria-hidden="true"
        />
      </div>

      <style jsx>{`
        @keyframes flyoutFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>,
    document.body
  )
}
