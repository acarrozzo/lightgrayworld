'use client'

import { create } from 'zustand'
import type { PresencePlayer } from '@/lib/socket'

export type { PresencePlayer }

/**
 * Live global roster: everyone currently holding a socket, anywhere in the world.
 *
 * Deliberately NOT part of the persisted game store — presence is ephemeral and
 * server-owned. It is seeded by `world:presence-sync` on login and kept current by
 * `world:presence-update` deltas. Players who are offline are not in here at all;
 * the Players tab backfills them from /api/users/list and merges the two.
 */
type PresenceState = {
  byUserId: Record<string, PresencePlayer>
  /** Server timestamp of the last sync/delta, so the UI can show staleness honestly. */
  syncedAt: number | null
  syncPresence: (players: PresencePlayer[], serverTime: number) => void
  upsertPresence: (player: PresencePlayer, serverTime: number) => void
  removePresence: (id: string, serverTime: number) => void
  clearPresence: () => void
}

export const usePresenceStore = create<PresenceState>((set) => ({
  byUserId: {},
  syncedAt: null,

  // A sync replaces the roster wholesale — anyone missing from the snapshot has
  // genuinely gone offline, so merging would leave stale ghosts behind.
  syncPresence: (players, serverTime) =>
    set(() => ({
      byUserId: Object.fromEntries(players.map((p) => [p.id, p])),
      syncedAt: serverTime,
    })),

  upsertPresence: (player, serverTime) =>
    set((state) => ({
      byUserId: { ...state.byUserId, [player.id]: player },
      syncedAt: serverTime,
    })),

  removePresence: (id, serverTime) =>
    set((state) => {
      if (!state.byUserId[id]) return { syncedAt: serverTime }
      const next = { ...state.byUserId }
      delete next[id]
      return { byUserId: next, syncedAt: serverTime }
    }),

  clearPresence: () => set({ byUserId: {}, syncedAt: null }),
}))
