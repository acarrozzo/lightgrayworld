'use client'

import { useEffect, useState } from 'react'

/**
 * Seconds left until `deadline` (epoch ms), ticking once a second while any
 * remain, and 0 once it has passed. `onDone` fires once when the clock
 * crosses zero on this page (not when it mounts already past it), which is
 * how the room card learns a boss is back without asking the server every
 * second. A null deadline is no clock: 0, and never done.
 */
export function useCountdown(deadline: number | null, onDone?: () => void): number {
  const [left, setLeft] = useState(() => secondsUntil(deadline))

  useEffect(() => {
    setLeft(secondsUntil(deadline))
    if (deadline == null || deadline <= Date.now()) return
    let fired = false
    const tick = () => {
      const next = secondsUntil(deadline)
      setLeft(next)
      if (next <= 0 && !fired) {
        fired = true
        clearInterval(timer)
        onDone?.()
      }
    }
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
    // `onDone` is read at fire time; a new callback identity must not restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline])

  return left
}

function secondsUntil(deadline: number | null): number {
  if (deadline == null) return 0
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
}
