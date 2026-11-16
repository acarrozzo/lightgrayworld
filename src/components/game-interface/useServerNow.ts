import { useEffect, useState } from 'react'
import { serverNow } from '@/lib/presence/idle'

/**
 * The server's clock as a value that moves.
 *
 * "Idle 12m" is a duration, and a label computed once sits at "12m" until
 * something else happens to re-render it. This ticks (every 30 seconds by
 * default: the label is in minutes) so idle time, the Away tier and the
 * leader-idle nudge all arrive on their own.
 */
export function useServerNow(intervalMs: number = 30_000): number {
  const [now, setNow] = useState(() => serverNow())
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
