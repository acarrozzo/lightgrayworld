'use client'

import { create } from 'zustand'

type TickerState = {
  userId: string | null
  enabled: boolean
  setUser: (userId: string | null) => void
  setEnabled: (enabled: boolean) => void
}

const storageKey = (userId: string) => `ticker:${userId}`
const legacyStorageKey = (userId: string) => `notifications:${userId}`

const loadEnabled = (userId: string | null): boolean => {
  if (!userId || typeof window === 'undefined') return true

  try {
    const stored = localStorage.getItem(storageKey(userId))
    if (stored) {
      const parsed = JSON.parse(stored)
      return typeof parsed.enabled === 'boolean' ? parsed.enabled : true
    }

    const legacy = localStorage.getItem(legacyStorageKey(userId))
    if (legacy) {
      const parsed = JSON.parse(legacy)
      const enabled = typeof parsed.enabled === 'boolean' ? parsed.enabled : true
      localStorage.setItem(storageKey(userId), JSON.stringify({ enabled }))
      return enabled
    }
  } catch {
    // Ignore parse errors, use default
  }

  return true
}

const persistEnabled = (userId: string | null, enabled: boolean) => {
  if (!userId || typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ enabled }))
  } catch {
    // Ignore storage errors
  }
}

export const useTickerStore = create<TickerState>((set, get) => ({
  userId: null,
  enabled: true,

  setUser: (userId) => {
    const enabled = loadEnabled(userId)
    set({ userId, enabled })
  },

  setEnabled: (enabled) => {
    const { userId } = get()
    set({ enabled })
    persistEnabled(userId, enabled)
  },
}))
