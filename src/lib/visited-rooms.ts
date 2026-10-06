'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * The rooms this character has stood in, by id, with the name each had when
 * they were there. The compass uses it to name an exit ("Spider Cave") once
 * the player has been through it, and to say "?" until then — so what lies
 * next door stays a discovery.
 *
 * A per-device record in localStorage, never authoritative: it only decides
 * what a label says. The server already knows where the player has been.
 */
const key = (userId: string) => `lg:visited:${userId}`

function read(userId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(key(userId))
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function useVisitedRooms(userId: string | null | undefined): [Record<string, string>, (roomId: string, name: string) => void] {
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    setNames(userId ? read(userId) : {})
  }, [userId])

  const remember = useCallback(
    (roomId: string, name: string) => {
      if (!userId || !roomId) return
      setNames((prev) => {
        if (prev[roomId] === name) return prev
        const next = { ...prev, [roomId]: name }
        try {
          window.localStorage.setItem(key(userId), JSON.stringify(next))
        } catch {
          // Storage unavailable: the names still hold for this page load.
        }
        return next
      })
    },
    [userId],
  )

  return [names, remember]
}
