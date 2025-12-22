'use client'

import { create } from 'zustand'

export type HistoryEntry = {
  id: string
  ts: number
  text: string
  roomId?: string
  scope?: 'room' | 'world' | 'system'
}

export type HistoryEntryInput = Omit<HistoryEntry, 'id' | 'ts'> & {
  id?: string
  ts?: number
}

type HistoryState = {
  userId: string | null
  entries: HistoryEntry[]
  setUser: (userId: string | null) => void
  append: (entry: string | HistoryEntryInput) => HistoryEntry | null
  appendMany: (entries: Array<string | HistoryEntryInput>) => void
  clear: () => void
}

const MAX_HISTORY_ENTRIES = 500

const storageKey = (userId: string) => `history:${userId}`

const safeParse = (value: string | null): HistoryEntry[] => {
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

const loadEntries = (userId: string | null): HistoryEntry[] => {
  if (!userId || typeof window === 'undefined') return []
  return safeParse(localStorage.getItem(storageKey(userId)))
}

const persistEntries = (userId: string | null, entries: HistoryEntry[]) => {
  if (!userId || typeof window === 'undefined') return
  localStorage.setItem(storageKey(userId), JSON.stringify(entries))
}

const ensureEntry = (entry: string | HistoryEntryInput): HistoryEntry => {
  if (typeof entry === 'string') {
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      text: entry,
    }
  }

  return {
    id: entry.id || (crypto.randomUUID ? crypto.randomUUID() : `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    ts: entry.ts ?? Date.now(),
    text: entry.text,
    roomId: entry.roomId,
    scope: entry.scope,
  }
}

const trimEntries = (entries: HistoryEntry[]) => {
  if (entries.length <= MAX_HISTORY_ENTRIES) return entries
  return entries.slice(entries.length - MAX_HISTORY_ENTRIES)
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
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

