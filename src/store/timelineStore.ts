'use client'

import { create } from 'zustand'

export type TimelineEntry = {
  id: string
  ts: number
  text: string
  type: 'room' | 'world' | 'action'
  roomId?: string
}

export type TimelineEntryInput = Omit<TimelineEntry, 'id' | 'ts'> & {
  id?: string
  ts?: number
}

type TimelineState = {
  userId: string | null
  entries: TimelineEntry[]
  setUser: (userId: string | null) => void
  append: (entry: TimelineEntryInput) => TimelineEntry | null
  appendMany: (entries: TimelineEntryInput[]) => void
  clear: () => void
}

const MAX_HISTORY_ENTRIES = 500

const storageKey = (userId: string) => `timeline:${userId}`

const safeParse = (value: string | null): TimelineEntry[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.filter((entry) => Boolean(entry?.id) && Boolean(entry?.ts) && Boolean(entry?.text))
    }
    return []
  } catch {
    return []
  }
}

const loadEntries = (userId: string | null): TimelineEntry[] => {
  if (!userId || typeof window === 'undefined') return []
  return safeParse(localStorage.getItem(storageKey(userId)))
}

const persistEntries = (userId: string | null, entries: TimelineEntry[]) => {
  if (!userId || typeof window === 'undefined') return
  localStorage.setItem(storageKey(userId), JSON.stringify(entries))
}

const ensureEntry = (entry: TimelineEntryInput): TimelineEntry => {
  return {
    id: entry.id || (crypto.randomUUID ? crypto.randomUUID() : `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    ts: entry.ts ?? Date.now(),
    text: entry.text,
    type: entry.type,
    roomId: entry.roomId,
  }
}

const trimEntries = (entries: TimelineEntry[]) => {
  if (entries.length <= MAX_HISTORY_ENTRIES) return entries
  return entries.slice(entries.length - MAX_HISTORY_ENTRIES)
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  userId: null,
  entries: [],

  setUser: (userId) => {
    const hydrated = loadEntries(userId)
    set({ userId, entries: hydrated })
  },

  append: (entry) => {
    const { userId, entries } = get()
    if (!userId) return null

    const normalized = ensureEntry(entry)
    const nextEntries = trimEntries([...entries, normalized])

    set({ entries: nextEntries })
    persistEntries(userId, nextEntries)

    return normalized
  },

  appendMany: (entriesToAdd) => {
    const { userId, entries } = get()
    if (!userId) return

    const normalized = entriesToAdd.map(ensureEntry)
    const nextEntries = trimEntries([...entries, ...normalized])

    set({ entries: nextEntries })
    persistEntries(userId, nextEntries)
  },

  clear: () => {
    const { userId } = get()
    if (userId && typeof window !== 'undefined') {
      localStorage.removeItem(storageKey(userId))
    }
    set({ entries: [] })
  },
}))

