const { createWorldFeedEvent } = require('./world-feed-event-service.js')

const FIVE_MINUTES_MS = 5 * 60 * 1000
const CHECK_INTERVAL_MS = 30 * 1000

function createIdleDetectionService({ activePlayers, thresholdMs = FIVE_MINUTES_MS, intervalMs = CHECK_INTERVAL_MS, onStateChange } = {}) {
  if (!activePlayers || typeof activePlayers.forEach !== 'function') {
    throw new Error('IdleDetectionService requires an activePlayers Map')
  }

  let intervalId = null
  const idleStateByUser = new Map()

  async function safeCreateEvent(userId, username, eventType) {
    try {
      await createWorldFeedEvent({ userId, username, eventType })
    } catch (error) {
      console.error('[IdleDetection] Failed to create world feed event', { userId, username, eventType, error })
    }
  }

  function snapshotActiveUsers() {
    /** @type {Map<string, { username: string, lastActive: number }>} */
    const snapshot = new Map()

    activePlayers.forEach((player) => {
      if (!player || !player.id) {
        return
      }

      const lastActiveTs = player.lastActive instanceof Date
        ? player.lastActive.getTime()
        : new Date(player.lastActive || Date.now()).getTime()

      const current = snapshot.get(player.id)
      if (!current || lastActiveTs > current.lastActive) {
        snapshot.set(player.id, {
          username: player.username || 'Unknown',
          lastActive: lastActiveTs,
          currentRoom: player.currentRoom || null,
        })
      }
    })

    return snapshot
  }

  async function runCheck() {
    const now = Date.now()
    const snapshot = snapshotActiveUsers()
    const activeUserIds = new Set(snapshot.keys())

    for (const [userId, data] of snapshot.entries()) {
      const idleDuration = now - data.lastActive
      const isIdle = idleDuration >= thresholdMs
      const state = idleStateByUser.get(userId) || { isIdle: false }

      if (isIdle && !state.isIdle) {
        idleStateByUser.set(userId, { isIdle: true })
        await safeCreateEvent(userId, data.username, 'idle')
        if (onStateChange) onStateChange(userId, data.username, data.currentRoom, true)
      } else if (!isIdle && state.isIdle) {
        idleStateByUser.set(userId, { isIdle: false })
        await safeCreateEvent(userId, data.username, 'return')
        if (onStateChange) onStateChange(userId, data.username, data.currentRoom, false)
      } else {
        idleStateByUser.set(userId, { isIdle })
      }
    }

    for (const userId of idleStateByUser.keys()) {
      if (!activeUserIds.has(userId)) {
        idleStateByUser.delete(userId)
      }
    }
  }

  function start() {
    if (intervalId) return

    intervalId = setInterval(() => {
      runCheck().catch((error) => {
        console.error('[IdleDetection] Error while checking idle players', error)
      })
    }, intervalMs)
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // Marks a user active. Returns true if the user was previously flagged idle
  // (so callers can immediately broadcast a return transition instead of
  // waiting for the next runCheck tick).
  function markUserActive(userId) {
    if (!userId) return false
    const wasIdle = idleStateByUser.get(userId)?.isIdle === true
    idleStateByUser.set(userId, { isIdle: false })
    return wasIdle
  }

  return {
    start,
    stop,
    runCheck,
    markUserActive,
  }
}

module.exports = {
  createIdleDetectionService,
  FIVE_MINUTES_MS,
  CHECK_INTERVAL_MS,
}

