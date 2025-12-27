'use client'

import { create } from 'zustand'

export type WorldFeedEntry = {
  id: string
  ts: number
  message: string
  type: 'room' | 'world' | 'action'
  level?: 'info' | 'error'
  actor?: string
  isSelf?: boolean
  roomId?: string
  /**
   * Deprecated: kept temporarily for compatibility with older persisted entries.
   * Prefer using `message` for all rendering.
   */
  text?: string
}

export type WorldFeedEntryInput = Omit<WorldFeedEntry, 'id' | 'ts'> & {
  id?: string
  ts?: number
}

type WorldFeedState = {
  userId: string | null
  entries: WorldFeedEntry[]
  setUser: (userId: string | null) => void
  append: (entry: WorldFeedEntryInput) => WorldFeedEntry | null
  appendMany: (entries: WorldFeedEntryInput[]) => void
  clear: () => void
}

const MAX_HISTORY_ENTRIES = 500

const storageKey = (userId: string) => `worldFeed:${userId}`

const safeParse = (value: string | null): WorldFeedEntry[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }

    const hasLegacyEntries = parsed.some((entry) => typeof entry?.message !== 'string')
    if (hasLegacyEntries) {
      // Drop legacy feed data to avoid parsing fragile text formats.
      return []
    }

    return parsed.filter((entry) => Boolean(entry?.id) && typeof entry?.ts === 'number' && typeof entry?.message === 'string')
  } catch {
    return []
  }
}

const loadEntries = (userId: string | null): WorldFeedEntry[] => {
  if (!userId || typeof window === 'undefined') return []
  return safeParse(localStorage.getItem(storageKey(userId)))
}

const persistEntries = (userId: string | null, entries: WorldFeedEntry[]) => {
  if (!userId || typeof window === 'undefined') return
  localStorage.setItem(storageKey(userId), JSON.stringify(entries))
}

const ensureEntry = (entry: WorldFeedEntryInput): WorldFeedEntry => {
  const message = entry.message ?? entry.text ?? ''
  return {
    id: entry.id || (crypto.randomUUID ? crypto.randomUUID() : `worldfeed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    ts: entry.ts ?? Date.now(),
    message,
    type: entry.type,
    level: entry.level,
    actor: entry.actor,
    isSelf: entry.isSelf,
    roomId: entry.roomId,
    text: entry.text ?? message,
  }
}

const trimEntries = (entries: WorldFeedEntry[]) => {
  if (entries.length <= MAX_HISTORY_ENTRIES) return entries
  return entries.slice(entries.length - MAX_HISTORY_ENTRIES)
}

export const useWorldFeedStore = create<WorldFeedState>((set, get) => ({
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

