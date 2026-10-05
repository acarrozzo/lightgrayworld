'use client'

import { useLayoutEffect, useMemo, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import { findMentionedItem, followFeedLink } from '@/lib/feed-links'
import { entryAccent } from './feed/activityFormat'

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
 *
 * It appears the moment something happens and goes away on its own, so it
 * carries no "now": the feed keeps the time. If the message names an item the
 * player is carrying, that word is a link to it in the Inv tab.
 */
export default function ActionFlyout({ result, anchorRef, anchorRect, onDismiss }: ActionFlyoutProps) {
  const inventory = useGameStore((state) => state.inventory)
  const mention = useMemo(
    () => findMentionedItem(result.message, inventory.map((item) => ({ id: item.id, name: item.template.name }))),
    [result.message, inventory],
  )
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
      // The same anchor can be mounted twice at different breakpoints (the
      // desktop and mobile D-pad copies). The hidden one reports an all-zero
      // rect, so leave `pos` null and let only the visible copy render.
      if (rect.width === 0 && rect.height === 0) return
      setPos({ top: rect.top - GAP, left: clampLeft(rect.left) })
    }
    updatePosition()
    // When the flyout moves to a *different* button it remounts here, and this
    // layout effect can run before the new anchor button's wrapper ref is
    // attached — leaving anchorRef.current null and pos unset, so nothing shows.
    // Retry on the next frame once refs are committed.
    let raf = 0
    if (!anchorRef?.current) raf = requestAnimationFrame(updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [anchorRef, anchorRect])

  if (pos === null || typeof document === 'undefined') return null

  const accent = entryAccent({
    outcome: result.outcome,
    level: result.success === false ? 'error' : undefined,
  })

  // Clicking anywhere on the flyout dismisses it, same as the × button. The ×
  // stays as the visible affordance for keyboard/AT users (Escape works too).
  return createPortal(
    <div
      data-action-flyout
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      className="fixed z-[60] -translate-y-full animate-[flyoutFadeIn_0.2s_ease-out] cursor-pointer"
      style={{ top: pos.top, left: pos.left, width: FLYOUT_WIDTH }}
    >
      <div className="relative rounded-lg border border-line-subtle/40 bg-surface-panel/95 backdrop-blur-sm shadow-xl shadow-black/30 px-3 py-2">
        <div className="flex items-start gap-2">
          <span
            className={`flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full ${accent}`}
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0 whitespace-normal break-words pt-1 text-xs text-fg-bright">
            {mention && result.message ? (
              <>
                {result.message.slice(0, mention.start)}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    followFeedLink({ tab: 'inv', itemId: mention.itemId })
                    onDismiss()
                  }}
                  title="Show it in your inventory"
                  className="rounded-sm font-semibold text-hue-green underline decoration-dotted underline-offset-2 hover:decoration-solid focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                >
                  {result.message.slice(mention.start, mention.end)}
                </button>
                {result.message.slice(mention.end)}
              </>
            ) : (
              result.message
            )}
          </span>
          {/* A full-size target, not a small glyph: this is what a thumb or a
              keyboard user dismisses with. */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            title="Dismiss"
            className="-my-0.5 -mr-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <X size={18} aria-hidden="true" />
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
