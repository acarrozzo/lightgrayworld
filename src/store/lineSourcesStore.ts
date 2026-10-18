'use client'

import { create } from 'zustand'

/**
 * Whether the feed shows where a spoken line came from (game-data/lines.js):
 * the "roomId · speaker · set #n" tag beside each `line` entry. A review aid
 * for authoring, off by default, remembered on this device only.
 */
type LineSourcesState = {
  showSources: boolean
  setShowSources: (show: boolean) => void
}

const STORAGE_KEY = 'lineSources'

const load = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const useLineSourcesStore = create<LineSourcesState>((set) => ({
  showSources: load(),
  setShowSources: (show) => {
    try {
      localStorage.setItem(STORAGE_KEY, show ? '1' : '0')
    } catch {
      // storage unavailable: the toggle still works for this visit
    }
    set({ showSources: show })
  },
}))
