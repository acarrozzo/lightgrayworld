import { useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import { useGameStore } from '@/lib/game-state'
import { useWorldFeedStore } from '@/store/worldFeedStore'
import { usePresenceStore } from '@/store/presenceStore'
import { normalizeRoomItems } from '@/lib/normalize/room'
import type { useSocketHandlers } from '@/lib/socket-handlers'

type SocketHandlers = ReturnType<typeof useSocketHandlers>

export type WorldTickState =
  | { tickNumber: number; nextTickAt: number; tickIntervalMs: number }
  | undefined

/**
 * Socket subscriptions that only feed state, never read it.
 *
 * What makes these safe to own outside the coordinator is that each one is a
 * pure sink: it takes a payload off the wire and writes it somewhere. None of
 * them reads component state, so their lifetime is the socket's rather than a
 * render's, and they can be mounted once and left alone.
 *
 * The rest of GameInterface's subscriptions — action feedback, battle, party,
 * room population — are deliberately *not* here. They drive component-local UI
 * (modals, toasts, the level-up overlay, the room's enemy list, the
 * move-in-progress flag) and read refs to decide what to do. Moving them would
 * mean threading a dozen setters through this signature, which relocates the
 * coupling instead of removing it. Lifting that UI state into the store is the
 * change that would actually make them extractable, and that is a design
 * decision rather than a mechanical move.
 *
 * `setWorldTick` is passed in because the tick is component state, not store
 * state — the one sink here that has not been lifted yet.
 */
export function useGameSocketBindings(
  socket: Socket | null,
  socketHandlers: SocketHandlers,
  setWorldTick: (tick: WorldTickState) => void
) {
  const updateRoomItems = useGameStore((s) => s.updateRoomItems)
  const appendWorldFeed = useWorldFeedStore((s) => s.append)
  const syncPresence = usePresenceStore((s) => s.syncPresence)
  const upsertPresence = usePresenceStore((s) => s.upsertPresence)
  const removePresence = usePresenceStore((s) => s.removePresence)

  // World tick: drives the countdown and anything tick-aligned.
  useEffect(() => {
    if (!socket) return
    return socketHandlers.onWorldTick((payload) => {
      const tickNumber = payload?.tickNumber ?? payload?.tickId ?? 0
      const interval = payload?.tickIntervalMs ?? 10000
      const nextTickAt = payload?.nextTickAt ?? Date.now() + interval
      setWorldTick({ tickNumber, nextTickAt, tickIntervalMs: interval })
    })
  }, [socket, socketHandlers, setWorldTick])

  // Ground items changing in a room the player can see.
  useEffect(() => {
    if (!socket) return
    return socketHandlers.onRoomItemsUpdate((payload) => {
      if (!payload?.roomId || !Array.isArray(payload.items)) return
      updateRoomItems(payload.roomId, normalizeRoomItems(payload.items))
    })
  }, [socket, socketHandlers, updateRoomItems])

  // World feed: logins, deaths and other world-scale events.
  useEffect(() => {
    if (!socket) return
    return socketHandlers.onWorldActivity((payload) => {
      if (!payload) return
      appendWorldFeed({
        id: payload.id,
        ts: payload.ts,
        type: payload.type ?? 'world',
        level: payload.level,
        actor: payload.actor,
        message: payload.message,
        eventType: payload.eventType,
      })
    })
  }, [socket, socketHandlers, appendWorldFeed])

  // Global roster: a full snapshot on login, deltas thereafter.
  useEffect(() => {
    if (!socket) return

    const cleanupSync = socketHandlers.onWorldPresenceSync((payload) => {
      syncPresence(payload.players ?? [], payload.serverTime ?? Date.now())
    })

    const cleanupUpdate = socketHandlers.onWorldPresenceUpdate((payload) => {
      const serverTime = payload.serverTime ?? Date.now()
      if (payload.type === 'remove') {
        removePresence(payload.id, serverTime)
        return
      }
      if (payload.player) upsertPresence(payload.player, serverTime)
    })

    return () => {
      cleanupSync()
      cleanupUpdate()
    }
  }, [socket, socketHandlers, syncPresence, upsertPresence, removePresence])
}
