'use client'

import { useEffect, useRef, useState } from 'react'
import { LOW_HP_FRACTION, type SquadMember } from '@/lib/party/squad'

const PULSE_MS = 2500

/**
 * Notices the moment a teammate drops into trouble.
 *
 * Fires once per *crossing*, not once per tick: a member sitting at 8 HP is not
 * news every time they take another swing, and a feed line per turn would bury
 * the one that mattered. The tile pulse is deliberately brief — it marks the
 * moment and then gets out of the way, leaving the red ring to carry the state.
 *
 * The viewer's own row is excluded. They have a health bar in the header and do
 * not need to be told about themselves.
 *
 * @returns the ids currently pulsing, for the squad bar to render.
 */
export function useLowHpAlerts(
  members: SquadMember[],
  onAlert: (member: SquadMember) => void
): Set<string> {
  const wasLowRef = useRef<Map<string, boolean>>(new Map())
  const [pulsing, setPulsing] = useState<Set<string>>(new Set())
  const onAlertRef = useRef(onAlert)
  onAlertRef.current = onAlert

  useEffect(() => {
    const seen = new Set<string>()
    const crossed: SquadMember[] = []

    for (const member of members) {
      seen.add(member.id)
      if (member.isSelf || member.hpPct === null) continue

      const isLow = member.hpPct <= LOW_HP_FRACTION * 100 && (member.hp ?? 0) > 0
      const wasLow = wasLowRef.current.get(member.id)
      wasLowRef.current.set(member.id, isLow)
      // `undefined` means this is the first reading we have of them — someone
      // who was already hurt when we met them has not just been hurt.
      if (isLow && wasLow === false) crossed.push(member)
    }

    // Forget people who left the party, so rejoining reads as a fresh meeting.
    for (const id of wasLowRef.current.keys()) {
      if (!seen.has(id)) wasLowRef.current.delete(id)
    }

    if (!crossed.length) return

    for (const member of crossed) onAlertRef.current(member)
    setPulsing((prev) => {
      const next = new Set(prev)
      for (const member of crossed) next.add(member.id)
      return next
    })
    const ids = crossed.map((m) => m.id)
    const timer = setTimeout(() => {
      setPulsing((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }, PULSE_MS)
    return () => clearTimeout(timer)
  }, [members])

  return pulsing
}
