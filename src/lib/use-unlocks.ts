'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { announcementsFor, resolveUnlocks, unlockDef, type UnlockFacts, type UnlockId } from './unlocks'

/**
 * How long after a character loads before arrivals are announced. Quests,
 * the kill list and the inventory land a beat apart, and a veteran opening
 * the game on a new device should not be told, one line at a time, about
 * tabs they have had for months.
 */
const SETTLE_MS = 5000

const latchKey = (userId: string) => `lg:unlocks:${userId}`
const freshKey = (userId: string) => `lg:unlocks-fresh:${userId}`

/** Ids that have been renamed: a latch written under the old name still counts. */
const RENAMED: Record<string, UnlockId> = { 'explore:action': 'tab:actions' }

function readIds(key: string): UnlockId[] | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed
          .map((id) => (typeof id === 'string' ? RENAMED[id] ?? id : id))
          .filter((id): id is UnlockId => typeof id === 'string' && unlockDef(id as UnlockId) !== undefined)
      : []
  } catch {
    return null
  }
}

function writeIds(key: string, ids: Iterable<UnlockId>) {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids]))
  } catch {
    // Storage unavailable: unlocks still follow the facts for this page load.
  }
}

export interface Unlocks {
  /** Everything open to this character. */
  open: ReadonlySet<UnlockId>
  /** Arrived and announced, not yet looked at: these glow. */
  fresh: ReadonlySet<UnlockId>
  /** The player has opened the place; stop glowing. */
  markSeen: (ids: UnlockId[]) => void
}

/**
 * The unlock state for one character on this device.
 *
 * Open = everything latched here before, plus everything the facts earn now,
 * so nothing a player has seen is ever taken away and nothing waits on
 * storage to appear. The latch and the "fresh" set are a per-device
 * convenience in localStorage; they decide only what glows and what is said,
 * never what a player may do.
 *
 * `announce` is called once per arrival, after the settle window. A character
 * seen on this device for the first time is latched silently at that point:
 * whatever they already have, they are not congratulated for.
 */
export function useUnlocks(userId: string | null | undefined, facts: UnlockFacts | null, announce: (id: UnlockId, line: string) => void): Unlocks {
  const [latched, setLatched] = useState<Set<UnlockId>>(() => new Set())
  const [fresh, setFresh] = useState<Set<UnlockId>>(() => new Set())
  // null until the character's storage has been read; then whether a latch existed.
  const [known, setKnown] = useState<boolean | null>(null)
  const [settled, setSettled] = useState(false)
  const announceRef = useRef(announce)
  announceRef.current = announce

  useEffect(() => {
    setSettled(false)
    setKnown(null)
    if (!userId) {
      setLatched(new Set())
      setFresh(new Set())
      return
    }
    const stored = readIds(latchKey(userId))
    setLatched(new Set(stored ?? []))
    setFresh(new Set(readIds(freshKey(userId)) ?? []))
    setKnown(stored !== null)
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [userId])

  const { open, arrived } = useMemo(
    () => (facts ? resolveUnlocks(latched, facts) : { open: latched, arrived: [] as UnlockId[] }),
    [latched, facts],
  )

  useEffect(() => {
    if (!userId || !settled || known === null || arrived.length === 0) return
    const nextLatched = new Set(latched)
    for (const id of arrived) nextLatched.add(id)
    writeIds(latchKey(userId), nextLatched)
    setLatched(nextLatched)
    if (!known) {
      // First time on this device: take what they have as given, say nothing.
      setKnown(true)
      return
    }
    const nextFresh = new Set(fresh)
    for (const id of arrived) nextFresh.add(id)
    writeIds(freshKey(userId), nextFresh)
    setFresh(nextFresh)
    for (const def of announcementsFor(arrived)) announceRef.current(def.id, def.announce!)
    // `latched` and `fresh` are read, not watched: this runs when something arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, settled, known, arrived])

  // A character with no latch and nothing earned yet is still "known" once
  // settled, so their first pickup is an arrival and not a silent baseline.
  useEffect(() => {
    if (!userId || !settled || known !== false || arrived.length > 0) return
    writeIds(latchKey(userId), latched)
    setKnown(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, settled, known, arrived.length])

  const markSeen = useCallback(
    (ids: UnlockId[]) => {
      if (!userId) return
      setFresh((prev) => {
        if (!ids.some((id) => prev.has(id))) return prev
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        writeIds(freshKey(userId), next)
        return next
      })
    },
    [userId],
  )

  return { open, fresh, markSeen }
}
