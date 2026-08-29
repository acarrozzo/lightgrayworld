// Global online-presence registry — the source of truth for "who is online right now".
//
// Presence is ephemeral and socket-derived: a player is in this store only while
// they hold a live socket. The durable `User.isActive` column is deliberately NOT
// presence — it is written true on login and false on disconnect, so a crash or a
// server restart strands everyone as permanently "online". Offline players are
// backfilled by the client from /api/users/list instead, which is also where their
// `lastActive` timestamp comes from.
//
// Room-scoped presence (player-joined / player-left / player-idle / player-returned)
// is unchanged and still drives the room's "Others here" list. This store powers the
// single *global* roster feed the Players tab subscribes to. Both are fanned out from
// the same call sites so the two views cannot disagree.
//
// Process-local, like ghost-player-store: it disappears on restart, which is correct —
// the sockets disappear with it.

const { SOCKET_EVENTS } = require('../socket-utils.js')

// Global singleton survives Next.js hot-module reloads in dev.
if (!global.__presenceStore) {
  global.__presenceStore = new Map() // userId -> PresenceEntry
}

const store = global.__presenceStore

/**
 * Upsert a player as online. Called on login. Fields the caller does not know about
 * (inBattle, partyLeaderId) are preserved from any existing entry so a second socket
 * for the same account does not blank them.
 */
function setPresence(playerData, overrides = {}) {
  if (!playerData || !playerData.id) return null

  const existing = store.get(playerData.id)
  const entry = {
    id: playerData.id,
    username: playerData.username,
    level: playerData.level ?? 1,
    hp: playerData.hp ?? 0,
    hpMax: playerData.hpMax ?? 0,
    mp: playerData.mp ?? 0,
    mpMax: playerData.mpMax ?? 0,
    currentRoom: playerData.currentRoom ?? null,
    uIcon: playerData.uIcon ?? null,
    uIconColor: playerData.uIconColor ?? null,
    status: 'active',
    inBattle: existing?.inBattle ?? false,
    partyLeaderId: playerData.partyLeaderId ?? existing?.partyLeaderId ?? null,
    lastSeen: Date.now(),
    ...overrides,
  }

  store.set(entry.id, entry)
  return entry
}

/**
 * Merge a partial update into an existing entry. Returns the updated entry, or null
 * when the player is not online or nothing actually changed — callers use the null to
 * skip a redundant broadcast (vitals in particular fire on every action).
 */
function patchPresence(userId, patch) {
  if (!userId || !patch) return null

  const existing = store.get(userId)
  if (!existing) return null

  let changed = false
  const next = { ...existing }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (next[key] !== value) {
      next[key] = value
      changed = true
    }
  }

  if (!changed) return null

  next.lastSeen = Date.now()
  store.set(userId, next)
  return next
}

/** Drop a player from the roster. Returns the removed entry, or null if absent. */
function removePresence(userId) {
  if (!userId) return null
  const entry = store.get(userId)
  if (!entry) return null
  store.delete(userId)
  return entry
}

function getPresence(userId) {
  if (!userId) return null
  const entry = store.get(userId)
  return entry ? { ...entry } : null
}

function getAllPresence() {
  return Array.from(store.values(), (entry) => ({ ...entry }))
}

function clearPresence() {
  store.clear()
}

/** Full snapshot payload for `world:presence-sync`. */
function buildPresenceSync() {
  return { players: getAllPresence(), serverTime: Date.now() }
}

/** Broadcast one player's current state to every connected client. */
function broadcastPresenceUpsert(io, entry) {
  if (!io || !entry) return
  io.emit(SOCKET_EVENTS.WORLD_PRESENCE_UPDATE, {
    type: 'upsert',
    player: { ...entry },
    serverTime: Date.now(),
  })
}

/** Broadcast that a player is no longer online. */
function broadcastPresenceRemove(io, userId) {
  if (!io || !userId) return
  io.emit(SOCKET_EVENTS.WORLD_PRESENCE_UPDATE, {
    type: 'remove',
    id: userId,
    serverTime: Date.now(),
  })
}

/** Announce a login (or re-login) — upsert the entry and fan it out. */
function announcePresence(io, playerData, overrides) {
  const entry = setPresence(playerData, overrides)
  if (entry) broadcastPresenceUpsert(io, entry)
  return entry
}

/** Patch + broadcast, but only when the patch actually changed something. */
function updatePresence(io, userId, patch) {
  const next = patchPresence(userId, patch)
  if (next) broadcastPresenceUpsert(io, next)
  return next
}

/** Remove + broadcast. Callers must confirm the user has no remaining sockets. */
function departPresence(io, userId) {
  const entry = removePresence(userId)
  if (entry) broadcastPresenceRemove(io, userId)
  return entry
}

module.exports = {
  setPresence,
  patchPresence,
  removePresence,
  getPresence,
  getAllPresence,
  clearPresence,
  buildPresenceSync,
  broadcastPresenceUpsert,
  broadcastPresenceRemove,
  announcePresence,
  updatePresence,
  departPresence,
}
