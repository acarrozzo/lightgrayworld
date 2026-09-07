'use client'

import { useSyncExternalStore } from 'react'

// Tailwind's `md`, which is where every World Tool list swaps cards for a table.
const WIDE = '(min-width: 48rem)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(WIDE)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/**
 * Whether the viewport is at or past `md`.
 *
 * The list pages used to render every row twice — a table under `hidden
 * md:block` and a card under `md:hidden` — and let CSS pick one. Items alone
 * was 768 anchors and two megabytes of HTML for 384 items. Rendering only the
 * layout in use halves the DOM and the hydration work.
 *
 * The server has no viewport and answers "wide", which is what the HTML is
 * hydrated against; a phone re-renders to cards right after. That brief table
 * is the trade for not shipping both.
 */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => true
  )
}
