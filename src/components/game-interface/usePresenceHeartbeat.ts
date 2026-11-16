import { useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import type { useSocketHandlers } from '@/lib/socket-handlers'
import { nextHeartbeat, settleHeartbeat, type HeartbeatState } from '@/lib/presence/idle'

type SocketHandlers = ReturnType<typeof useSocketHandlers>

/**
 * "Still here."
 *
 * The server calls a player idle after five minutes without activity, and the
 * only activity it could see was a game action over the socket. Shopping and
 * DMs go over HTTP, and reading the inventory, the map or a quest sends nothing
 * at all, so a player doing any of those was announced as idle while sitting
 * at the keyboard.
 *
 * This tells the server the page saw a person: a pointer move or press, a key,
 * a scroll, a touch, or the tab coming back to the front. At most one message
 * a minute goes out, and the first input after a quiet spell goes at once, so
 * coming back from idle clears it immediately.
 *
 * It is cosmetic. It moves no character, costs no turn, counts no click, and
 * the server must never let anything with an outcome depend on it.
 */
export function usePresenceHeartbeat(socket: Socket | null, socketHandlers: SocketHandlers) {
  useEffect(() => {
    if (!socket) return

    let state: HeartbeatState = { lastSentAt: 0, inFlight: false }

    const ping = () => {
      const decision = nextHeartbeat(state, Date.now())
      if (!decision.send) return
      state = decision.state
      const sentAt = state.lastSentAt
      socketHandlers.sendActivity().then((landed) => {
        // A ping that did not land (sent before login finished, or dropped)
        // is due again in a few seconds rather than a minute.
        state = settleHeartbeat(sentAt, landed)
      })
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') ping()
    }

    const passive: AddEventListenerOptions = { passive: true }
    const inputs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const
    for (const name of inputs) window.addEventListener(name, ping, passive)
    window.addEventListener('focus', ping)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      for (const name of inputs) window.removeEventListener(name, ping)
      window.removeEventListener('focus', ping)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [socket, socketHandlers])
}
