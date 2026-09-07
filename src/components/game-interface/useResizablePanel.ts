'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

/**
 * A desktop side panel the player can widen or narrow by dragging its inner
 * edge. The width lives only in component state for this page load: a refresh
 * puts every panel back at its default, and nothing gameplay-related reads it.
 *
 * `side` says which edge of the viewport the panel hugs, so the handle knows
 * which way a rightward drag moves its width: a left panel grows, a right
 * panel shrinks. Arrow keys move the divider the same way.
 */

export interface ResizablePanelOptions {
  side: 'left' | 'right'
  defaultWidth: number
  minWidth: number
  /** Upper bound, already reduced for the viewport and the other panels. */
  maxWidth: number
  /** Accessible name for the divider, e.g. "Resize the left panel". */
  label: string
}

const KEY_STEP = 16
const KEY_STEP_LARGE = 64
/** A drag that lands this close to the default width settles on it exactly. */
const SNAP_DISTANCE = 12

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/**
 * The viewport width, tracked so panel bounds can follow window resizes. It is
 * 0 until after mount on both server and client, so the first render matches
 * for hydration; callers should treat 0 as "unknown" and not clamp against it.
 */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const update = () => setWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return width
}

export function useResizablePanel({
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  label,
}: ResizablePanelOptions) {
  // A max below the min means the viewport is too crowded; the min still wins
  // so the panel never collapses below what its content needs.
  const effectiveMax = Math.max(minWidth, maxWidth)

  const [width, setWidth] = useState(defaultWidth)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{ x: number; width: number } | null>(null)

  // Keep the width inside its bounds when the viewport or other panels change.
  useEffect(() => {
    setWidth((current) => clamp(current, minWidth, effectiveMax))
  }, [minWidth, effectiveMax])

  const commit = useCallback(
    (next: number) => {
      const clamped = clamp(next, minWidth, effectiveMax)
      setWidth(clamped)
      return clamped
    },
    [minWidth, effectiveMax]
  )

  const direction = side === 'left' ? 1 : -1

  // The width a drag is currently asking for, clamped and pulled onto the
  // default when it comes within reach. Keyboard steps skip the snap so a
  // deliberate nudge is never swallowed by it.
  const dragWidth = useCallback(
    (start: { x: number; width: number }, clientX: number) => {
      const raw = start.width + direction * (clientX - start.x)
      const snapped = Math.abs(raw - defaultWidth) <= SNAP_DISTANCE ? defaultWidth : raw
      return clamp(snapped, minWidth, effectiveMax)
    },
    [direction, defaultWidth, minWidth, effectiveMax]
  )

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      dragStart.current = { x: event.clientX, width }
      event.currentTarget.setPointerCapture(event.pointerId)
      setIsDragging(true)
    },
    [width]
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = dragStart.current
      if (!start) return
      setWidth(dragWidth(start, event.clientX))
    },
    [dragWidth]
  )

  const endDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = dragStart.current
      if (!start) return
      dragStart.current = null
      setIsDragging(false)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      commit(dragWidth(start, event.clientX))
    },
    [commit, dragWidth]
  )

  const onDoubleClick = useCallback(() => {
    commit(defaultWidth)
  }, [commit, defaultWidth])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP
      let next: number | null = null
      switch (event.key) {
        case 'ArrowRight':
          next = width + direction * step
          break
        case 'ArrowLeft':
          next = width - direction * step
          break
        case 'Home':
          next = minWidth
          break
        case 'End':
          next = effectiveMax
          break
        case 'Enter':
          next = defaultWidth
          break
        default:
          return
      }
      event.preventDefault()
      commit(next)
    },
    [width, direction, minWidth, effectiveMax, defaultWidth, commit]
  )

  // While dragging, the whole page shows the resize cursor and refuses text
  // selection, so a fast drag that leaves the handle does not highlight the feed.
  useEffect(() => {
    if (!isDragging) return
    const { cursor, userSelect } = document.body.style
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = cursor
      document.body.style.userSelect = userSelect
    }
  }, [isDragging])

  return {
    width,
    isDragging,
    handleProps: {
      role: 'separator' as const,
      'aria-orientation': 'vertical' as const,
      'aria-label': label,
      'aria-valuenow': Math.round(width),
      'aria-valuemin': minWidth,
      'aria-valuemax': effectiveMax,
      tabIndex: 0,
      title: `${label} (double-click to reset)`,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onDoubleClick,
      onKeyDown,
    },
  }
}
