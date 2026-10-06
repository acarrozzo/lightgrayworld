'use client'

import { useCallback, useEffect, useState } from 'react'
import type { JournalQuestRow } from './quest-journal'

/**
 * The quests the player is following: pinned from the Quests tab, shown
 * beside the compass with their next step so "what was I doing?" has an
 * answer without opening the journal. Up to three; pinning a fourth lets the
 * oldest go. A per-device choice in localStorage, never authoritative for
 * anything.
 */
export const MAX_TRACKED_QUESTS = 3

const key = (userId: string) => `lg:tracked-quests:${userId}`

function read(userId: string): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key(userId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(0, MAX_TRACKED_QUESTS) : []
  } catch {
    return []
  }
}

export function useTrackedQuests(userId: string | null | undefined): {
  ids: string[]
  /** Pin a quest, or unpin it if it is pinned. */
  toggle: (questId: string) => void
  /** Drop a quest (it was turned in). */
  remove: (questId: string) => void
} {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    setIds(userId ? read(userId) : [])
  }, [userId])

  const write = useCallback(
    (next: string[]) => {
      setIds(next)
      if (!userId) return
      try {
        window.localStorage.setItem(key(userId), JSON.stringify(next))
      } catch {
        // Storage unavailable: the pins still hold for this page load.
      }
    },
    [userId],
  )

  const toggle = useCallback(
    (questId: string) => {
      const without = ids.filter((id) => id !== questId)
      if (without.length !== ids.length) write(without)
      else write([...without, questId].slice(-MAX_TRACKED_QUESTS))
    },
    [ids, write],
  )

  const remove = useCallback(
    (questId: string) => {
      if (ids.includes(questId)) write(ids.filter((id) => id !== questId))
    },
    [ids, write],
  )

  return { ids, toggle, remove }
}

/** What the tracker says about one followed quest. */
export interface TrackedQuestView {
  questId: string
  title: string
  /** The next thing to do, in one line. */
  step: string
  /** "2/5" or "1 of 3", when the quest counts something. */
  progress: string | null
  /** The quest can be turned in. */
  ready: boolean
}

/**
 * The line for a followed quest: when it is ready, where to take it;
 * otherwise the quest's own next step, or its objective if it has none written.
 */
export function trackedQuestView(row: JournalQuestRow, roomNames: Record<string, string> = {}): TrackedQuestView {
  const ready = row.state === 'ready'
  const giver = row.giver.spokenName ?? row.giver.name
  const where = roomNames[row.giver.roomId] ? `${roomNames[row.giver.roomId]} (#${row.giver.roomId})` : `room ${row.giver.roomId}`
  return {
    questId: row.questId,
    title: row.def.title,
    step: ready ? `Ready to turn in — return to ${giver}, ${where}.` : row.def.nextStep ?? row.def.objective,
    progress: row.progressLabel,
    ready,
  }
}
