'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * How the room area is framed while a fight is on.
 *
 * `fight`: the area does not scroll. The battle card's strip, vitals and
 * readout are pinned, the deck's list takes whatever height is left and is
 * the only thing that scrolls. Watching and acting share one screen.
 *
 * `fallback`: the area is too short for that — the list would get fewer than
 * two rows — so it scrolls as it always did, with the list at its fixed
 * height, and a one-line vitals strip pinned to the top so the numbers never
 * leave the screen. Phones in landscape, an SE in Safari with the toolbar up,
 * a half-height desktop window.
 */
export type FightFrame = 'fight' | 'fallback'

/** Fewer than two rows of the deck and the frame gives up on pinning. */
const MIN_LIST = 116
/** It comes back only with room to spare, so a turn that adds a line to the readout cannot make it flicker. */
const RETURN_LIST = 140
/** The battle card's top padding inside the area (`pt-4`). */
const PANEL_TOP = 16

/**
 * Measures, never guesses: the area's height, and the card's height less its
 * list (the strip, vitals, readout, switch and paddings, which grow on a
 * messy turn). What is left is the list's share. Re-measured on every resize
 * of any of the three, so the browser toolbar, the keyboard, a party rail
 * appearing, or a Stone line in the readout all count.
 */
export function useFightFrame(
  active: boolean,
  areaRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  listRef: RefObject<HTMLElement | null>,
): FightFrame {
  const [frame, setFrame] = useState<FightFrame>('fight')

  useLayoutEffect(() => {
    if (!active) {
      setFrame('fight')
      return
    }
    let current: FightFrame = 'fight'
    const measure = () => {
      const area = areaRef.current
      const panel = panelRef.current
      const list = listRef.current
      if (!area || !panel || !list) return
      const fixed = panel.offsetHeight - list.offsetHeight
      const available = area.clientHeight - PANEL_TOP - fixed
      const next: FightFrame =
        current === 'fight' ? (available < MIN_LIST ? 'fallback' : 'fight') : available >= RETURN_LIST ? 'fight' : 'fallback'
      if (next !== current) {
        current = next
        setFrame(next)
      }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    for (const ref of [areaRef, panelRef, listRef]) {
      if (ref.current) observer.observe(ref.current)
    }
    return () => observer.disconnect()
  }, [active, areaRef, panelRef, listRef])

  return active ? frame : 'fight'
}
