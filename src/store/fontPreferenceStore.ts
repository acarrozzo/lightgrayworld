'use client'

import { create } from 'zustand'

export type FontFamily = 'regular' | 'mono'

type FontPreferenceState = {
  userId: string | null
  fontFamily: FontFamily
  setUser: (userId: string | null) => void
  setFontFamily: (fontFamily: FontFamily) => void
}

const getSettingsKey = (userId: string | null) => (userId ? `fontPreference:${userId}` : null)

const loadSettings = (userId: string | null): FontFamily => {
  if (!userId || typeof window === 'undefined') return 'regular' // Default to regular
  const key = getSettingsKey(userId)
  if (!key) return 'regular'
  
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed.fontFamily === 'regular' || parsed.fontFamily === 'mono' ? parsed.fontFamily : 'regular'
    }
  } catch {
    // Ignore parse errors, use default
  }
  
  return 'regular' // Default to regular
}

const persistSettings = (userId: string | null, fontFamily: FontFamily) => {
  if (!userId || typeof window === 'undefined') return
  const key = getSettingsKey(userId)
  if (!key) return
  
  try {
    localStorage.setItem(key, JSON.stringify({ fontFamily }))
  } catch {
    // Ignore storage errors
  }
}

export const useFontPreferenceStore = create<FontPreferenceState>((set, get) => ({
  userId: null,
  fontFamily: 'regular',

  setUser: (userId) => {
    const fontFamily = loadSettings(userId)
    set({ userId, fontFamily })
  },

  setFontFamily: (fontFamily) => {
    const { userId } = get()
    set({ fontFamily })
    persistSettings(userId, fontFamily)
  },
}))

