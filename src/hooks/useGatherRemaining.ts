'use client'

import { useEffect, useMemo, useState } from 'react'
import type { GatherCooldownView } from '@/lib/types/room'

/**
 * Live seconds remaining per rolling gather action (sand, dirt, stone,
 * berries, wood), keyed by action name, ticking down once a second. A room can
 * host several at once; 0 or absent means that action is ready.
 *
 * Seeded from the room's cooldown table, refreshed from action feedback (a
 * collect returns the full window as `secondsUntilReset`, a too-early attempt
 * what is left), shared by the room card's buttons and the shortcut rail so
 * both flip at the same second.
 */
export function useGatherRemaining(gatherCooldowns: GatherCooldownView[], roomId: string | undefined, actionResult: any) {
  const [gatherRemaining, setGatherRemaining] = useState<Record<string, number>>({})

  const gatherByAction = useMemo(() => {
    const map = new Map<string, GatherCooldownView>()
    for (const g of gatherCooldowns) map.set(g.action, g)
    return map
  }, [gatherCooldowns])

  useEffect(() => {
    const next: Record<string, number> = {}
    for (const g of gatherCooldowns) next[g.action] = g.secondsRemaining
    setGatherRemaining(next)
  }, [gatherCooldowns, roomId])

  useEffect(() => {
    const action = actionResult?.action
    if (!action || !gatherByAction.has(action)) return
    const secondsUntilReset = actionResult?.data?.secondsUntilReset
    if (typeof secondsUntilReset === 'number') {
      setGatherRemaining((prev) => ({ ...prev, [action]: secondsUntilReset }))
    }
  }, [actionResult, gatherByAction])

  useEffect(() => {
    if (!Object.values(gatherRemaining).some((v) => v > 0)) return
    const interval = setInterval(() => {
      setGatherRemaining((prev) => {
        let changed = false
        const next: Record<string, number> = {}
        for (const [action, secs] of Object.entries(prev)) {
          const decremented = secs <= 1 ? 0 : secs - 1
          if (decremented !== secs) changed = true
          next[action] = decremented
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [gatherRemaining])

  return { gatherByAction, gatherRemaining }
}
