'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Two switches for the World map, remembered per device: whether its teleport
 * pins are drawn, and whether its controls (the trail, the level stack, VIP,
 * Here and zoom) sit over it. Presentation only — hiding the pins never
 * hides a teleport; a room's card still offers it.
 *
 * Shared through one store rather than per-component state because the game
 * draws the World tab twice on a phone (the desktop copy hidden), and both
 * copies must agree.
 */
export type WorldMapPref = 'pins' | 'controls'

const KEYS: Record<WorldMapPref, string> = { pins: 'lg:world-pins', controls: 'lg:world-controls' }

const values: Partial<Record<WorldMapPref, boolean>> = {}
const listeners = new Set<() => void>()

function read(pref: WorldMapPref): boolean {
  const known = values[pref]
  if (known !== undefined) return known
  let on = true
  try {
    on = window.localStorage.getItem(KEYS[pref]) !== '0'
  } catch {
    // Storage unavailable: both switches start on.
  }
  values[pref] = on
  return on
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useWorldMapPref(pref: WorldMapPref): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => read(pref), () => true)
  const set = useCallback(
    (next: boolean) => {
      values[pref] = next
      try {
        window.localStorage.setItem(KEYS[pref], next ? '1' : '0')
      } catch {
        // The choice holds for this page load.
      }
      listeners.forEach((listener) => listener())
    },
    [pref],
  )
  return [on, set]
}
