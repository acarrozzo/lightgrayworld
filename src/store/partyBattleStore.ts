'use client'

import { create } from 'zustand'
import type { PartyMemberBattlePayload } from '@/lib/socket'
import type { BattleGlance } from '@/lib/party/squad'

export type { BattleGlance }

/**
 * What each teammate is fighting, and how it is going.
 *
 * Presence says *that* somebody is in a battle; this says whether they are
 * winning it. It is party-scoped by construction — the server only sends
 * `party:member-battle` to the rest of the fighter's party — and ephemeral
 * like the party itself: not persisted, emptied when the party ends, and
 * re-sent by the server on join and on reconnect.
 */
type PartyBattleState = {
  byUserId: Record<string, BattleGlance>
  apply: (payload: PartyMemberBattlePayload) => void
  clearAll: () => void
}

export const usePartyBattleStore = create<PartyBattleState>((set) => ({
  byUserId: {},

  apply: (payload) =>
    set((state) => {
      if ('ended' in payload) {
        const current = state.byUserId[payload.id]
        if (!current) return state
        // A fight that ended before the one we are showing started is stale
        // news, and clearing on it would blank a live fight.
        if (current.ts > payload.ts) return state
        const next = { ...state.byUserId }
        delete next[payload.id]
        return { byUserId: next }
      }
      // Never let a late packet overwrite a newer one: reconnect replays can
      // land after a live turn.
      const current = state.byUserId[payload.id]
      if (current && current.ts > payload.ts) return state
      return { byUserId: { ...state.byUserId, [payload.id]: payload } }
    }),

  clearAll: () => set({ byUserId: {} }),
}))
