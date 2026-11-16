const FIVE_MINUTES_MS = 5 * 60 * 1000
const CHECK_INTERVAL_MS = 30 * 1000

/**
 * Idle detection: who is connected but has stopped doing anything.
 *
 * This service only decides *when* an account crosses the line and says so
 * through `onStateChange`. It owns no presentation and writes nothing: the
 * presence store is where "idle, and since when" lives, and the world feed is
 * not told at all (an idle line and a return line per player per coffee was
 * most of the World channel, and a row in the database each time).
 *
 * "Since when" is the account's last activity, not the moment the sweep
 * noticed. The sweep runs every 30 seconds after a 5 minute threshold, so the
 * moment of noticing is 5 to 5.5 minutes late, and a card built on it read
 * "idle 0s" for somebody who had been gone five minutes.
 */

/**
 * One account's most recent activity across all of its sockets.
 * @typedef {Object} IdleSnapshotEntry
 * @property {string} username
 * @property {number} lastActive - epoch ms of the latest activity seen
 * @property {string|null} currentRoom
 */

/**
 * @param {Object} [options]
 * @param {Map<string, any>} [options.activePlayers] - live socket.id -> player map.
 *   Required in practice; the constructor throws when it is missing, so it is
 *   marked optional here only so the `= {}` default stays well-typed.
 * @param {number} [options.thresholdMs] - idle after this long without activity
 * @param {number} [options.intervalMs] - how often to sweep for idle players
 * @param {(userId: string, username: string, currentRoom: string|null, isIdle: boolean, lastActive: number) => void} [options.onStateChange]
 *   `lastActive` is the epoch ms of the account's last activity: when it went
 *   quiet, for an idle transition.
 * @param {() => number} [options.now] - clock, injectable for tests
 */
function createIdleDetectionService({
  activePlayers,
  thresholdMs = FIVE_MINUTES_MS,
  intervalMs = CHECK_INTERVAL_MS,
  onStateChange,
  now = Date.now,
} = {}) {
  if (!activePlayers || typeof activePlayers.forEach !== 'function') {
    throw new Error('IdleDetectionService requires an activePlayers Map')
  }

  let intervalId = null
  const idleStateByUser = new Map()

  function snapshotActiveUsers() {
    /** @type {Map<string, IdleSnapshotEntry>} */
    const snapshot = new Map()

    activePlayers.forEach((player) => {
      if (!player || !player.id) {
        return
      }

      const lastActiveTs = player.lastActive instanceof Date
        ? player.lastActive.getTime()
        : new Date(player.lastActive || now()).getTime()

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

  function notify(userId, data, isIdle) {
    if (!onStateChange) return
    try {
      onStateChange(userId, data.username, data.currentRoom, isIdle, data.lastActive)
    } catch (error) {
      console.error('[IdleDetection] onStateChange failed', { userId, isIdle, error })
    }
  }

  async function runCheck() {
    const nowTs = now()
    const snapshot = snapshotActiveUsers()
    const activeUserIds = new Set(snapshot.keys())

    for (const [userId, data] of snapshot.entries()) {
      const idleDuration = nowTs - data.lastActive
      const isIdle = idleDuration >= thresholdMs
      const state = idleStateByUser.get(userId) || { isIdle: false }

      idleStateByUser.set(userId, { isIdle })
      if (isIdle && !state.isIdle) {
        notify(userId, data, true)
      } else if (!isIdle && state.isIdle) {
        notify(userId, data, false)
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
    // The server is kept alive by its sockets, not by this sweep.
    intervalId.unref?.()
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
