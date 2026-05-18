const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

// Global singleton survives Next.js hot-module reloads in dev
if (!global.__ghostPlayerStore) {
  global.__ghostPlayerStore = new Map() // roomId -> Map<playerId, GhostEntry>
}

const store = global.__ghostPlayerStore

function addGhost(roomId, playerData, status) {
  if (!roomId || !playerData?.id) return

  if (!store.has(roomId)) {
    store.set(roomId, new Map())
  }

  store.get(roomId).set(playerData.id, {
    id: playerData.id,
    username: playerData.username,
    level: playerData.level,
    hp: playerData.hp,
    hpMax: playerData.hpMax,
    mp: playerData.mp,
    mpMax: playerData.mpMax,
    currentRoom: roomId,
    uIcon: playerData.uIcon ?? null,
    uIconColor: playerData.uIconColor ?? null,
    isActive: false,
    status, // 'idle' | 'disconnected'
    lastSeen: Date.now(),
  })
}

function removeGhost(roomId, playerId) {
  if (!roomId || !playerId) return
  const roomGhosts = store.get(roomId)
  if (roomGhosts) {
    roomGhosts.delete(playerId)
    if (roomGhosts.size === 0) {
      store.delete(roomId)
    }
  }
}

function getGhostsForRoom(roomId) {
  if (!roomId) return []
  const roomGhosts = store.get(roomId)
  if (!roomGhosts) return []

  const now = Date.now()
  const result = []

  for (const [playerId, ghost] of roomGhosts.entries()) {
    if (now - ghost.lastSeen > TWENTY_FOUR_HOURS_MS) {
      roomGhosts.delete(playerId)
    } else {
      result.push({ ...ghost })
    }
  }

  return result
}

function cleanup() {
  const now = Date.now()
  for (const [roomId, roomGhosts] of store.entries()) {
    for (const [playerId, ghost] of roomGhosts.entries()) {
      if (now - ghost.lastSeen > TWENTY_FOUR_HOURS_MS) {
        roomGhosts.delete(playerId)
      }
    }
    if (roomGhosts.size === 0) {
      store.delete(roomId)
    }
  }
}

// Hourly cleanup
if (!global.__ghostPlayerStoreCleanupStarted) {
  global.__ghostPlayerStoreCleanupStarted = true
  setInterval(cleanup, 60 * 60 * 1000)
}

module.exports = { addGhost, removeGhost, getGhostsForRoom, cleanup }
